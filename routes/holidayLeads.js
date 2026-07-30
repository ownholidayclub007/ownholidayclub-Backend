const express = require("express");

const HolidayLead = require("../models/HolidayLead");
const EmailVerification = require("../models/EmailVerification");
const MobileVerification = require("../models/MobileVerification");
const asyncHandler = require("../utils/asyncHandler");
const { sendOtpEmail } = require("../utils/email");
const { sendOtpSms } = require("../utils/sms");
const {
  normaliseEmail,
  normaliseMobile,
  buildOtpDebugPayload,
  generateOtp,
  getOtpExpiry,
  hasOtpExpired,
} = require("../utils/security");
const { sendLeadNotificationEmail, sendLeadThankYouEmail } = require("../utils/email");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const requireSuperAdmin = require("../middleware/requireSuperAdmin");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normaliseName = (value) => String(value || "").trim().replace(/\s+/g, " ");
const normaliseText = (value) => String(value || "").trim().replace(/\s+/g, " ");

const normaliseSource = (value) =>
  String(value || "home-hero")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "home-hero";

const normaliseContextType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

// ── CUSTOM OTP ENDPOINTS FOR LEADS ──

// Send Mobile OTP
router.post(
  "/mobile/send-otp",
  asyncHandler(async (req, res) => {
    const mobile = normaliseMobile(req.body.mobile);

    if (mobile.length !== 10) {
      return res.status(400).json({
        message: "A valid 10-digit mobile number is required.",
      });
    }

    const otp = generateOtp(6);
    const expiresAt = getOtpExpiry(15);

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
      console.error("SMS OTP sending failed:", error.message);
      if (process.env.NODE_ENV === "production") {
        await MobileVerification.deleteOne({ mobile });
        throw error;
      }
    }

    return res.status(200).json({
      message: "Verification code sent successfully.",
      mobile,
      expiresAt,
      ...buildOtpDebugPayload(otp),
    });
  })
);

// Verify Mobile OTP
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
  })
);

// Send Email OTP
router.post(
  "/email/send-otp",
  asyncHandler(async (req, res) => {
    const email = normaliseEmail(req.body.email);

    if (!email) {
      return res.status(400).json({
        message: "A valid email address is required.",
      });
    }

    const otp = generateOtp(6);
    const expiresAt = getOtpExpiry(15);

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

    try {
      await sendOtpEmail(email, otp);
    } catch (error) {
      console.error("Email OTP sending failed:", error.message);
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
    }

    return res.status(200).json({
      message: "Verification code sent successfully.",
      email,
      expiresAt,
      ...buildOtpDebugPayload(otp),
    });
  })
);

// Verify Email OTP
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
  })
);

// Submit callback/lead
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const name = normaliseName(req.body?.name);
    const email = normaliseEmail(req.body?.email);
    const phone = normaliseMobile(req.body?.phone);
    const contextType = normaliseContextType(req.body?.contextType);
    const contextName = normaliseText(req.body?.contextName);
    const message = normaliseText(req.body?.message);
    const source = normaliseSource(req.body?.source);
    const checkInInput = normaliseText(req.body?.checkIn);
    const checkOutInput = normaliseText(req.body?.checkOut);
    const location = normaliseText(req.body?.location);
    const searchLocation = normaliseText(req.body?.searchLocation);
    const locationType = normaliseText(req.body?.locationType || "Domestic");
    const budget = normaliseText(req.body?.budget);
    const travelType = normaliseText(req.body?.travelType);

    const adults =
      req.body?.adults === undefined || req.body?.adults === null || req.body?.adults === ""
        ? 0
        : Number(req.body?.adults);
    const kids =
      req.body?.kids === undefined || req.body?.kids === null || req.body?.kids === ""
        ? 0
        : Number(req.body?.kids);
    let checkIn = null;
    let checkOut = null;

    if (name.length < 2) {
      return res.status(400).json({
        message: "A valid name is required.",
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        message: "A valid email address is required.",
      });
    }

    if (phone.length !== 10) {
      return res.status(400).json({
        message: "A valid 10-digit phone number is required.",
      });
    }

    // Verify phone OTP was verified
    const isMobileVerified = await MobileVerification.findOne({
      mobile: phone,
      verifiedAt: { $ne: null },
    });
    if (!isMobileVerified) {
      return res.status(400).json({
        message: "Please verify your phone number with OTP first.",
      });
    }

    if (checkInInput || checkOutInput) {
      if (!checkInInput || !checkOutInput) {
        return res.status(400).json({
          message: "Both check-in and check-out are required.",
        });
      }

      checkIn = new Date(checkInInput);
      checkOut = new Date(checkOutInput);

      if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
        return res.status(400).json({
          message: "Please provide valid check-in and check-out values.",
        });
      }

      if (checkOut <= checkIn) {
        return res.status(400).json({
          message: "Check-out must be later than check-in.",
        });
      }
    }

    if (!Number.isInteger(adults) || adults < 0) {
      return res.status(400).json({
        message: "Adults must be a valid number.",
      });
    }

    if (!Number.isInteger(kids) || kids < 0) {
      return res.status(400).json({
        message: "Kids must be a valid number.",
      });
    }

    const lead = await HolidayLead.create({
      name,
      email,
      phone,
      contextType,
      contextName,
      checkIn,
      checkOut,
      adults,
      kids,
      message,
      source,
      location,
      searchLocation,
      locationType,
      budget,
      travelType,
      status: "new",
    });

    try {
      await sendLeadNotificationEmail({
        leadType: contextType === 'callback-request' ? "Callback Request" : "Holiday Lead",
        leadDetails: {
          "Name": name,
          "Email": email,
          "Phone": phone,
          "From Location": location || "Not provided",
          "To Location": searchLocation || "Not provided",
          "Check In": checkIn ? checkIn.toLocaleDateString() : "",
          "Check Out": checkOut ? checkOut.toLocaleDateString() : "",
          "Budget": budget,
          "Travel Type": travelType,
          "Adults": adults,
          "Kids": kids,
        },
        message: message,
      });
    } catch (mailErr) {
      console.error("Failed to send lead email:", mailErr);
    }

    try {
      await sendLeadThankYouEmail({
        to: email,
        name: name,
      });
    } catch (thankYouErr) {
      console.error("Failed to send thank you email:", thankYouErr);
    }

    return res.status(201).json({
      message: "Lead submitted successfully.",
      lead,
    });
  }),
);

// @route   GET /api/holiday-leads
// @desc    Get all leads (admin)
router.get(
  "/",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const leads = await HolidayLead.find().sort({ createdAt: -1 });
    res.json({ success: true, leads });
  })
);

// @route   DELETE /api/holiday-leads/:id
// @desc    Delete a lead (admin)
router.delete(
  "/:id",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const lead = await HolidayLead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found." });
    }
    res.json({ success: true, message: "Lead deleted successfully." });
  })
);

// @route   PUT /api/holiday-leads/:id
// @desc    Update lead status (admin)
router.put(
  "/:id",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const lead = await HolidayLead.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found." });
    }
    res.json({ success: true, lead });
  })
);

module.exports = router;
