const express = require("express");
const mongoose = require("mongoose");
const Destination = require("../models/Destination");
const DestinationHeading = require("../models/DestinationHeading");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");
const { logActivity, getChangedFields } = require("../utils/logger");

const router = express.Router();

// Get all destinations (Public)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const destinations = await Destination.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: destinations });
  })
);

// Get all destinations (Admin)
router.get(
  "/admin",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const destinations = await Destination.find().sort({ order: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: destinations });
  })
);

// Create new destination
router.post(
  "/",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (!data.slug && data.name) {
      data.slug = data.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }
    const destination = await Destination.create(data);

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Created",
        module: "Destination",
        details: `Created destination: ${destination.name}`,
        req
    });

    res.status(201).json({ success: true, message: "Destination created successfully", data: destination });
  })
);

// Update destination
router.put(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    try {
      // Sanitize ID: Remove any weird suffixes like :1 that might come from some UI states
      let cleanId = req.params.id;
      if (cleanId && cleanId.includes(":")) {
        cleanId = cleanId.split(":")[0];
      }

      // Check if it's a valid ObjectId (unless you are using custom string IDs)
      // If your database uses string IDs, you can comment out the check below.
      if (!mongoose.Types.ObjectId.isValid(cleanId)) {
        return res.status(400).json({ success: false, message: "Invalid Destination ID format" });
      }

      const oldDestination = await Destination.findById(cleanId);
      if (!oldDestination) {
        return res.status(404).json({ success: false, message: "Destination not found" });
      }

      const changedInfo = getChangedFields(oldDestination.toObject(), req.body);

      const destination = await Destination.findByIdAndUpdate(cleanId, req.body, { 
        new: true,
        runValidators: true 
      });

      await logActivity({
          user: req.cmsAdmin.username,
          action: "Updated",
          module: "Destination",
          details: `Updated destination: ${destination.name}${changedInfo}`,
          req
      });

      res.status(200).json({ success: true, message: "Destination updated successfully", data: destination });
    } catch (error) {
      console.error("Error updating destination:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to update destination", 
        error: error.message 
      });
    }
  })
);

// Delete destination
router.delete(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const destination = await Destination.findByIdAndDelete(req.params.id);
    if (!destination) {
      return res.status(404).json({ success: false, message: "Destination not found" });
    }

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Deleted",
        module: "Destination",
        details: `Deleted destination: ${destination.name}`,
        req
    });

    res.status(200).json({ success: true, message: "Destination deleted successfully" });
  })
);

// Upload destination image to Cloudinary
router.post(
  "/images",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { file } = req.body;
    if (!file || !file.dataUrl) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }

    const uploaded = await uploadDocumentToCloudinary({
      file,
      folder: "ownholidayclub/destinations",
      documentType: "destination-image",
    });

    res.status(200).json({
      success: true,
      data: { url: uploaded.url },
    });
  })
);

// --- Global Headings & Settings ---

// Get Headings (Public)
router.get(
  "/headings/public",
  asyncHandler(async (req, res) => {
    let headings = await DestinationHeading.findOne();
    if (!headings) {
      headings = await DestinationHeading.create({});
    }
    res.status(200).json({ success: true, data: headings });
  })
);

// Save Headings (Admin)
router.post(
  "/headings",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    let headings = await DestinationHeading.findOne();
    if (headings) {
      headings = await DestinationHeading.findByIdAndUpdate(headings._id, req.body, { new: true });
    } else {
      headings = await DestinationHeading.create(req.body);
    }
    res.status(200).json({ success: true, message: "Global headings updated", data: headings });
  })
);

module.exports = router;
