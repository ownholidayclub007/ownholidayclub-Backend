const express = require("express");

const Admin = require("../models/Admin");
const asyncHandler = require("../utils/asyncHandler");
const {
  normaliseUsername,
  signCmsToken,
  verifySecret,
  hashSecret,
} = require("../utils/security");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const { logActivity } = require("../utils/logger");

const router = express.Router();

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

    const admin = await Admin.findOne({ username }).select("+passwordHash");

    if (!admin || !verifySecret(password, admin.passwordHash)) {
      return res.status(401).json({
        message: "Invalid admin credentials.",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        message: "Admin account is disabled.",
      });
    }


    await logActivity({
      user: admin.username,
      action: "Logged In",
      module: "Auth",
      details: `Admin ${admin.username} logged in`,
      req
    });

    return res.status(200).json({
      message: "Login successful.",
      admin,
      token: signCmsToken(admin),
    });
  })
);

router.post(
  "/change-password",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const adminId = req.cmsAdmin._id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Old and new passwords are required.",
      });
    }

    const admin = await Admin.findById(adminId).select("+passwordHash");

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found.",
      });
    }

    if (!verifySecret(oldPassword, admin.passwordHash)) {
      return res.status(401).json({
        message: "Incorrect old password.",
      });
    }

    admin.passwordHash = hashSecret(newPassword);
    await admin.save();

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Updated",
      module: "Auth",
      details: `Admin ${req.cmsAdmin.username} changed their password`,
      req
    });

    return res.status(200).json({
      message: "Password changed successfully.",
    });
  })
);

router.post(
  "/logout",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    await logActivity({
      user: req.cmsAdmin.username,
      action: "Logged Out",
      module: "Auth",
      details: `Admin ${req.cmsAdmin.username} logged out`,
      req
    });

    return res.status(200).json({
      message: "Logged out successfully.",
    });
  })
);

module.exports = router;
