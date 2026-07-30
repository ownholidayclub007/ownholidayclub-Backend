const express = require("express");

const SuperAdmin = require("../models/SuperAdmin");
const asyncHandler = require("../utils/asyncHandler");
const {
  generateOtp,
  getOtpExpiry,
  hasOtpExpired,
  hashSecret,
  normaliseUsername,
  verifySecret,
} = require("../utils/security");
const { sendOtpEmail } = require("../utils/email");

const router = express.Router();

const getSuperAdmin = (withSensitiveFields = false) => {
  const query = SuperAdmin.findOne();

  if (!withSensitiveFields) {
    return query;
  }

  return query.select(
    "+passwordHash +resetOtpCode +resetOtpExpiresAt +profileOtpCode +profileOtpExpiresAt +pendingEmail +emailOtpCode +emailOtpExpiresAt"
  );
};

router.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const superAdmin = await getSuperAdmin();

    if (!superAdmin) {
      return res.status(404).json({ message: "Super admin not configured yet." });
    }

    return res.status(200).json({
      message: "Super admin profile fetched successfully.",
      superAdmin,
    });
  })
);

router.post(
  "/setup",
  asyncHandler(async (req, res) => {
    const existingSuperAdmin = await SuperAdmin.findOne();

    if (existingSuperAdmin) {
      return res.status(409).json({
        message: "Super admin is already configured.",
      });
    }

    const username = normaliseUsername(req.body.username);
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "username, password, and email are required.",
      });
    }

    const superAdmin = await SuperAdmin.create({
      username,
      email,
      passwordHash: hashSecret(password),
    });

    return res.status(201).json({
      message: "Super admin created successfully.",
      superAdmin,
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const username = normaliseUsername(req.body.username);
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({
        message: "username and password are required.",
      });
    }

    const superAdmin = await SuperAdmin.findOne({ username }).select("+passwordHash");

    if (!superAdmin || !verifySecret(password, superAdmin.passwordHash)) {
      return res.status(401).json({
        message: "Invalid super admin credentials.",
      });
    }

    superAdmin.lastLoginAt = new Date();
    await superAdmin.save();

    return res.status(200).json({
      message: "Login successful.",
      superAdmin,
    });
  })
);

router.post(
  "/forgot-password/send-otp",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "email is required.",
      });
    }

    const superAdmin = await SuperAdmin.findOne({ email }).select(
      "+resetOtpCode +resetOtpExpiresAt"
    );

    if (!superAdmin) {
      return res.status(404).json({
        message: "No super admin found with that email.",
      });
    }

    const otp = generateOtp();

    superAdmin.resetOtpCode = otp;
    superAdmin.resetOtpExpiresAt = getOtpExpiry();
    await superAdmin.save();

    try {
      const ttlMinutes = Number(process.env.OTP_TTL_MINUTES || 10);
      await sendOtpEmail(email, otp, ttlMinutes);
    } catch (error) {
      superAdmin.resetOtpCode = null;
      superAdmin.resetOtpExpiresAt = null;
      await superAdmin.save();
      return res.status(500).json({
        message: "Failed to send OTP SMS. Please try again.",
      });
    }

    return res.status(200).json({
      message: "Password reset OTP generated successfully.",
      expiresAt: superAdmin.resetOtpExpiresAt,
    });
  })
);

router.post(
  "/forgot-password/verify-otp",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({
        message: "email and otp are required.",
      });
    }

    const superAdmin = await SuperAdmin.findOne({ email }).select(
      "+resetOtpCode +resetOtpExpiresAt"
    );

    if (!superAdmin) {
      return res.status(404).json({
        message: "No super admin found with that email.",
      });
    }

    if (
      hasOtpExpired(superAdmin.resetOtpExpiresAt) ||
      superAdmin.resetOtpCode !== otp
    ) {
      return res.status(400).json({
        message: "OTP is invalid or expired.",
      });
    }

    return res.status(200).json({
      message: "OTP verified successfully.",
    });
  })
);

router.put(
  "/forgot-password/reset",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();
    const username = normaliseUsername(req.body.username);
    const password = String(req.body.password || "").trim();

    if (!email || !otp || !username || !password) {
      return res.status(400).json({
        message: "email, otp, username, and password are required.",
      });
    }

    const superAdmin = await SuperAdmin.findOne({ email }).select(
      "+passwordHash +resetOtpCode +resetOtpExpiresAt"
    );

    if (!superAdmin) {
      return res.status(404).json({
        message: "No super admin found with that email.",
      });
    }

    if (
      hasOtpExpired(superAdmin.resetOtpExpiresAt) ||
      superAdmin.resetOtpCode !== otp
    ) {
      return res.status(400).json({
        message: "OTP is invalid or expired.",
      });
    }

    superAdmin.username = username;
    superAdmin.passwordHash = hashSecret(password);
    superAdmin.resetOtpCode = null;
    superAdmin.resetOtpExpiresAt = null;
    await superAdmin.save();

    return res.status(200).json({
      message: "Super admin credentials reset successfully.",
      superAdmin,
    });
  })
);

router.post(
  "/profile/send-otp",
  asyncHandler(async (req, res) => {
    const superAdmin = await getSuperAdmin(true);

    if (!superAdmin) {
      return res.status(404).json({ message: "Super admin not configured yet." });
    }

    const otp = generateOtp();

    superAdmin.profileOtpCode = otp;
    superAdmin.profileOtpExpiresAt = getOtpExpiry();
    await superAdmin.save();

    try {
      const ttlMinutes = Number(process.env.OTP_TTL_MINUTES || 10);
      await sendOtpEmail(superAdmin.email, otp, ttlMinutes);
    } catch (error) {
      superAdmin.profileOtpCode = null;
      superAdmin.profileOtpExpiresAt = null;
      await superAdmin.save();
      return res.status(500).json({
        message: "Failed to send OTP SMS. Please try again.",
      });
    }

    return res.status(200).json({
      message: "Profile credentials OTP generated successfully.",
      expiresAt: superAdmin.profileOtpExpiresAt,
    });
  })
);

router.post(
  "/profile/verify-otp",
  asyncHandler(async (req, res) => {
    const otp = String(req.body.otp || "").trim();

    if (!otp) {
      return res.status(400).json({
        message: "otp is required.",
      });
    }

    const superAdmin = await getSuperAdmin(true);

    if (!superAdmin) {
      return res.status(404).json({ message: "Super admin not configured yet." });
    }

    if (
      hasOtpExpired(superAdmin.profileOtpExpiresAt) ||
      superAdmin.profileOtpCode !== otp
    ) {
      return res.status(400).json({
        message: "OTP is invalid or expired.",
      });
    }

    return res.status(200).json({
      message: "OTP verified successfully.",
    });
  })
);

router.post(
  "/profile/email/send-otp",
  asyncHandler(async (req, res) => {
    const currentUsername = normaliseUsername(req.body.currentUsername);
    const currentPassword = String(req.body.currentPassword || "");
    const newEmail = String(req.body.newEmail || "").trim().toLowerCase();

    if (!currentUsername || !currentPassword || !newEmail) {
      return res.status(400).json({
        message: "currentUsername, currentPassword, and newEmail are required.",
      });
    }

    const superAdmin = await getSuperAdmin(true);

    if (!superAdmin) {
      return res.status(404).json({ message: "Super admin not configured yet." });
    }

    if (
      superAdmin.username !== currentUsername ||
      !verifySecret(currentPassword, superAdmin.passwordHash)
    ) {
      return res.status(401).json({
        message: "Current super admin credentials are invalid.",
      });
    }

    const existingEmail = await SuperAdmin.findOne({
      email: newEmail,
      _id: { $ne: superAdmin._id },
    });

    if (existingEmail) {
      return res.status(409).json({
        message: "That email is already in use.",
      });
    }

    const otp = generateOtp();
    superAdmin.pendingEmail = newEmail;
    superAdmin.emailOtpCode = otp;
    superAdmin.emailOtpExpiresAt = getOtpExpiry();
    await superAdmin.save();

    try {
      const ttlMinutes = Number(process.env.OTP_TTL_MINUTES || 10);
      await sendOtpEmail(newEmail, otp, ttlMinutes);
    } catch (error) {
      superAdmin.pendingEmail = null;
      superAdmin.emailOtpCode = null;
      superAdmin.emailOtpExpiresAt = null;
      await superAdmin.save();
      return res.status(500).json({
        message: "Failed to send OTP email. Please try again.",
      });
    }

    return res.status(200).json({
      message: "Email verification OTP generated successfully.",
      expiresAt: superAdmin.emailOtpExpiresAt,
    });
  })
);

router.post(
  "/profile/email/verify-otp",
  asyncHandler(async (req, res) => {
    const otp = String(req.body.otp || "").trim();

    if (!otp) {
      return res.status(400).json({
        message: "otp is required.",
      });
    }

    const superAdmin = await getSuperAdmin(true);

    if (!superAdmin) {
      return res.status(404).json({ message: "Super admin not configured yet." });
    }

    if (
      hasOtpExpired(superAdmin.emailOtpExpiresAt) ||
      superAdmin.emailOtpCode !== otp
    ) {
      return res.status(400).json({
        message: "OTP is invalid or expired.",
      });
    }

    if (!superAdmin.pendingEmail) {
      return res.status(400).json({
        message: "No pending email change found.",
      });
    }

    superAdmin.email = superAdmin.pendingEmail;
    superAdmin.pendingEmail = null;
    superAdmin.emailOtpCode = null;
    superAdmin.emailOtpExpiresAt = null;
    await superAdmin.save();

    return res.status(200).json({
      message: "Email updated successfully.",
      superAdmin,
    });
  })
);

router.put(
  "/profile/credentials",
  asyncHandler(async (req, res) => {
    const otp = String(req.body.otp || "").trim();
    const username = normaliseUsername(req.body.username);
    const password = String(req.body.password || "").trim();

    if (!otp || !username || !password) {
      return res.status(400).json({
        message: "otp, username, and password are required.",
      });
    }

    const superAdmin = await getSuperAdmin(true);

    if (!superAdmin) {
      return res.status(404).json({ message: "Super admin not configured yet." });
    }

    if (
      hasOtpExpired(superAdmin.profileOtpExpiresAt) ||
      superAdmin.profileOtpCode !== otp
    ) {
      return res.status(400).json({
        message: "OTP is invalid or expired.",
      });
    }

    superAdmin.username = username;
    superAdmin.passwordHash = hashSecret(password);
    superAdmin.profileOtpCode = null;
    superAdmin.profileOtpExpiresAt = null;
    await superAdmin.save();

    return res.status(200).json({
      message: "Super admin credentials updated successfully.",
      superAdmin,
    });
  })
);

module.exports = router;
