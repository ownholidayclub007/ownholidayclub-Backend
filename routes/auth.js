const express = require("express");

const EmailVerification = require("../models/EmailVerification");
const MobileVerification = require("../models/MobileVerification");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { sendOtpEmail } = require("../utils/email");
const { sendOtpSms } = require("../utils/sms");
const {
  buildOtpDebugPayload,
  generateOtp,
  getOtpExpiry,
  hasOtpExpired,
  hashSecret,
  normaliseEmail,
  normaliseMobile,
  verifySecret,
} = require("../utils/security");

const router = express.Router();
const mobileOtpRateLimitStore = new Map();

const createHttpError = (statusCode, message, details) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
};

const sendPostOnlyHint = (res, endpoint, exampleBody) => {
  res.set("Allow", "POST");
  return res.status(405).json({
    message: `Use POST ${endpoint} with a JSON request body.`,
    example: exampleBody,
  });
};

const getPositiveNumber = (value, fallback) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const getMobileOtpConfig = () => ({
  otpLength: Math.max(4, Math.floor(getPositiveNumber(process.env.MOBILE_OTP_LENGTH, 6))),
  ttlMinutes: getPositiveNumber(process.env.MOBILE_OTP_TTL_MINUTES, 15),
  resendCooldownSeconds: getPositiveNumber(
    process.env.MOBILE_OTP_RESEND_COOLDOWN_SECONDS,
    60,
  ),
  maxRequestsPerWindow: Math.max(
    1,
    Math.floor(getPositiveNumber(process.env.MOBILE_OTP_MAX_REQUESTS_PER_WINDOW, 3)),
  ),
  rateLimitWindowMinutes: getPositiveNumber(
    process.env.MOBILE_OTP_RATE_LIMIT_WINDOW_MINUTES,
    15,
  ),
});

const enforceMobileOtpRateLimit = (mobile) => {
  const config = getMobileOtpConfig();
  const now = Date.now();
  const cooldownMs = config.resendCooldownSeconds * 1000;
  const windowMs = config.rateLimitWindowMinutes * 60 * 1000;
  const currentEntry = mobileOtpRateLimitStore.get(mobile) || {
    lastRequestAt: 0,
    requestTimestamps: [],
  };
  const recentRequests = currentEntry.requestTimestamps.filter(
    (timestamp) => now - timestamp < windowMs,
  );

  if (currentEntry.lastRequestAt && now - currentEntry.lastRequestAt < cooldownMs) {
    const retryAfterSeconds = Math.ceil(
      (cooldownMs - (now - currentEntry.lastRequestAt)) / 1000,
    );

    throw createHttpError(
      429,
      `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
      { retryAfterSeconds },
    );
  }

  if (recentRequests.length >= config.maxRequestsPerWindow) {
    throw createHttpError(
      429,
      "Too many OTP requests for this mobile number. Please try again later.",
      { retryAfterMinutes: config.rateLimitWindowMinutes },
    );
  }

  recentRequests.push(now);
  mobileOtpRateLimitStore.set(mobile, {
    lastRequestAt: now,
    requestTimestamps: recentRequests,
  });
};

const findUserByIdentifier = async (identifier, includeSensitive = false) => {
  const normalizedIdentifier = String(identifier || "").trim();
  const normalizedEmail = normaliseEmail(normalizedIdentifier);
  const query = {
    $or: [
      { email: normalizedEmail },
      { membershipId: normalizedIdentifier.toUpperCase() },
    ],
  };

  const finder = User.findOne(query);
  return includeSensitive
    ? finder.select("+passwordHash +resetOtpCode +resetOtpExpiresAt")
    : finder;
};

router.post(
  "/email/send-otp",
  asyncHandler(async (req, res) => {
    const email = normaliseEmail(req.body.email);

    if (!email) {
      return res.status(400).json({
        message: "A valid email address is required.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser?.membershipId) {
      return res.status(409).json({
        message: "This email is already linked to an existing member account.",
      });
    }

    const otp = generateOtp();
    const expiresAt = getOtpExpiry();

    await EmailVerification.findOneAndUpdate(
      { email },
      {
        email,
        otpCode: otp,
        expiresAt,
        verifiedAt: null,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    await sendOtpEmail(email, otp);

    return res.status(200).json({
      message: "Verification code sent successfully.",
      email,
      expiresAt,
      ...buildOtpDebugPayload(otp),
    });
  }),
);

router.get("/email/send-otp", (req, res) =>
  sendPostOnlyHint(res, "/api/auth/email/send-otp", {
    email: "member@example.com",
  }),
);

router.post(
  "/email/verify-otp",
  asyncHandler(async (req, res) => {
    const email = normaliseEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({
        message: "email and otp are required.",
      });
    }

    const record = await EmailVerification.findOne({ email });

    if (!record || hasOtpExpired(record.expiresAt) || record.otpCode !== otp) {
      return res.status(400).json({
        message: "Invalid or expired verification code.",
      });
    }

    record.verifiedAt = new Date();
    await record.save();

    return res.status(200).json({
      message: "Email verified successfully.",
      email,
      verified: true,
    });
  }),
);

router.get("/email/verify-otp", (req, res) =>
  sendPostOnlyHint(res, "/api/auth/email/verify-otp", {
    email: "member@example.com",
    otp: "123456",
  }),
);

router.post(
  "/mobile/send-otp",
  asyncHandler(async (req, res) => {
    const mobileOtpConfig = getMobileOtpConfig();
    const mobile = normaliseMobile(req.body.mobile);

    if (mobile.length !== 10) {
      return res.status(400).json({
        message: "A valid 10-digit mobile number is required.",
      });
    }

    const existingUser = await User.findOne({ mobile });

    if (existingUser?.membershipId) {
      return res.status(409).json({
        message:
          "This mobile number is already linked to an existing member account.",
      });
    }

    enforceMobileOtpRateLimit(mobile);

    const otp = generateOtp(mobileOtpConfig.otpLength);
    const expiresAt = getOtpExpiry(mobileOtpConfig.ttlMinutes);

    await MobileVerification.findOneAndUpdate(
      { mobile },
      {
        mobile,
        otpCode: otp,
        expiresAt,
        verifiedAt: null,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    try {
      await sendOtpSms(mobile, otp);
    } catch (error) {
      await MobileVerification.deleteOne({ mobile });
      throw error;
    }

    return res.status(200).json({
      message: "Verification code sent successfully.",
      mobile,
      expiresAt,
      expiresInMinutes: mobileOtpConfig.ttlMinutes,
      ...buildOtpDebugPayload(otp),
    });
  }),
);

router.get("/mobile/send-otp", (req, res) =>
  sendPostOnlyHint(res, "/api/auth/mobile/send-otp", {
    mobile: "9315751394",
  }),
);

router.post(
  "/mobile/verify-otp",
  asyncHandler(async (req, res) => {
    const mobile = normaliseMobile(req.body.mobile);
    const otp = String(req.body.otp || "").trim();

    if (mobile.length !== 10 || !otp) {
      return res.status(400).json({
        message: "mobile and otp are required.",
      });
    }

    const record = await MobileVerification.findOne({ mobile });

    if (!record || hasOtpExpired(record.expiresAt) || record.otpCode !== otp) {
      return res.status(400).json({
        message: "Invalid or expired verification code.",
      });
    }

    record.verifiedAt = new Date();
    await record.save();

    return res.status(200).json({
      message: "Mobile verified successfully.",
      mobile,
      verified: true,
    });
  }),
);

router.get("/mobile/verify-otp", (req, res) =>
  sendPostOnlyHint(res, "/api/auth/mobile/verify-otp", {
    mobile: "9315751394",
    otp: "123456",
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const identifier = String(req.body.identifier || "").trim();
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({
        message: "identifier and password are required.",
      });
    }

    const user = await findUserByIdentifier(identifier, true);

    if (!user || !verifySecret(password, user.passwordHash)) {
      return res.status(401).json({
        message: "Invalid email or membership ID or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "This account is disabled.",
      });
    }

    return res.status(200).json({
      message: "Login successful.",
      user,
    });
  }),
);

router.post(
  "/forgot-password/send-otp",
  asyncHandler(async (req, res) => {
    const identifier = String(req.body.identifier || "").trim();

    if (!identifier) {
      return res.status(400).json({
        message: "identifier is required.",
      });
    }

    const user = await findUserByIdentifier(identifier, true);

    if (!user || !user.email) {
      return res.status(404).json({
        message: "No account found for that email or membership ID.",
      });
    }

    const otp = generateOtp();
    user.resetOtpCode = otp;
    user.resetOtpExpiresAt = getOtpExpiry();
    await user.save();

    await sendOtpEmail(user.email, otp);

    return res.status(200).json({
      message: "Password reset OTP sent successfully.",
      email: user.email,
      ...buildOtpDebugPayload(otp),
    });
  }),
);

router.post(
  "/forgot-password/verify-otp",
  asyncHandler(async (req, res) => {
    const identifier = String(req.body.identifier || "").trim();
    const otp = String(req.body.otp || "").trim();

    if (!identifier || !otp) {
      return res.status(400).json({
        message: "identifier and otp are required.",
      });
    }

    const user = await findUserByIdentifier(identifier, true);

    if (
      !user ||
      hasOtpExpired(user.resetOtpExpiresAt) ||
      user.resetOtpCode !== otp
    ) {
      return res.status(400).json({
        message: "Invalid or expired OTP.",
      });
    }

    return res.status(200).json({
      message: "OTP verified successfully.",
    });
  }),
);

router.put(
  "/forgot-password/reset",
  asyncHandler(async (req, res) => {
    const identifier = String(req.body.identifier || "").trim();
    const otp = String(req.body.otp || "").trim();
    const password = String(req.body.password || "").trim();

    if (!identifier || !otp || !password) {
      return res.status(400).json({
        message: "identifier, otp, and password are required.",
      });
    }

    const user = await findUserByIdentifier(identifier, true);

    if (
      !user ||
      hasOtpExpired(user.resetOtpExpiresAt) ||
      user.resetOtpCode !== otp
    ) {
      return res.status(400).json({
        message: "Invalid or expired OTP.",
      });
    }

    user.passwordHash = hashSecret(password);
    user.resetOtpCode = null;
    user.resetOtpExpiresAt = null;
    await user.save();

    return res.status(200).json({
      message: "Password changed successfully.",
      user,
    });
  }),
);

module.exports = router;
