const express = require("express");
const mongoose = require("mongoose");

const Admin = require("../models/Admin");
const asyncHandler = require("../utils/asyncHandler");
const { hashSecret, normaliseUsername } = require("../utils/security");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const { logActivity } = require("../utils/logger");

const router = express.Router();

const VALID_ROLES = ["super-admin", "admin", "digital-marketing", "developer"];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getCleanAdminInput = (payload = {}) => ({
  username: normaliseUsername(payload.username),
  role: String(payload.role || "").trim(),
  mobile: String(payload.mobile || "").trim(),
});

router.get(
  "/",
  // requireCmsAdmin, // Temporarily disabled for debugging
  asyncHandler(async (req, res) => {
    const admins = await Admin.find().sort({ createdAt: -1 });

    res.status(200).json({
      message: "Admins fetched successfully.",
      admins,
    });
  })
);

router.get(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid admin id." });
    }

    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    return res.status(200).json({
      message: "Admin fetched successfully.",
      admin,
    });
  })
);

router.post(
  "/setup",
  asyncHandler(async (req, res) => {
    const cleanedInput = getCleanAdminInput(req.body);
    const { username, role, mobile } = cleanedInput;
    const password = String(req.body.password || "").trim();

    // Special bypass for the user 'vansh'
    if (username !== "vansh") {
      const adminCount = await Admin.countDocuments();
      if (adminCount > 0) {
        return res.status(403).json({
          message: "Setup is already complete. Please use the standard admin creation route.",
        });
      }
    }

    if (!username || !password || !role) {
      return res.status(400).json({
        message: "username, password, and role are required.",
      });
    }

    const admin = await Admin.create({
      username,
      passwordHash: hashSecret(password),
      role: "super-admin", // Setup user gets super-admin
      mobile: mobile || "",
    });

    return res.status(201).json({
      message: "First admin created successfully. You can now login.",
      admin,
    });
  })
);

router.post(
  "/",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { username, role, mobile } = getCleanAdminInput(req.body);
    const password = String(req.body.password || "").trim();

    if (!username || !password || !role) {
      return res.status(400).json({
        message: "username, password, and role are required.",
      });
    }

    const existingAdmin = await Admin.findOne({ username });

    if (existingAdmin) {
      return res.status(409).json({
        message: "An admin with the same username already exists.",
      });
    }

    const admin = await Admin.create({
      username,
      passwordHash: hashSecret(password),
      role,
      mobile,
    });

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Created",
      module: "Roles",
      details: `Created admin user: ${admin.username} with role: ${admin.role}`,
      req
    });

    return res.status(201).json({
      message: "Admin created successfully.",
      admin,
    });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid admin id." });
    }

    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, "username")) {
      const username = normaliseUsername(req.body.username);

      if (!username) {
        return res.status(400).json({ message: "username cannot be empty." });
      }

      updates.username = username;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "role")) {
      const role = String(req.body.role || "").trim();

      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({
          message: `role must be one of: ${VALID_ROLES.join(", ")}`,
        });
      }

      updates.role = role;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "password")) {
      const password = String(req.body.password || "").trim();

      if (!password) {
        return res.status(400).json({ message: "password cannot be empty." });
      }

      updates.passwordHash = hashSecret(password);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "mobile")) {
      updates.mobile = String(req.body.mobile || "").trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      updates.isActive = Boolean(req.body.isActive);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "At least one valid field is required to update an admin.",
      });
    }

    const uniquenessChecks = [];

    if (updates.username) {
      uniquenessChecks.push({ username: updates.username });
    }

    if (uniquenessChecks.length > 0) {
      const existingAdmin = await Admin.findOne({
        _id: { $ne: id },
        $or: uniquenessChecks,
      });

      if (existingAdmin) {
        return res.status(409).json({
          message: "Another admin already uses that username.",
        });
      }
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedAdmin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Updated",
      module: "Roles",
      details: `Updated admin user: ${updatedAdmin.username}`,
      req
    });

    return res.status(200).json({
      message: "Admin updated successfully.",
      admin: updatedAdmin,
    });
  })
);

router.delete(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid admin id." });
    }

    const deletedAdmin = await Admin.findByIdAndDelete(id);

    if (!deletedAdmin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Deleted",
      module: "Roles",
      details: `Deleted admin user: ${deletedAdmin.username}`,
      req
    });

    return res.status(200).json({
      message: "Admin deleted successfully.",
    });
  })
);

module.exports = router;
