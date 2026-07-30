const express = require("express");
const HeroSlide = require("../models/HeroSlide");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");
const { logActivity, getChangedFields } = require("../utils/logger");

const router = express.Router();

// Get all slides
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const slides = await HeroSlide.find({ isActive: true }).sort({ order: 1 });
    return res.status(200).json({
      success: true,
      data: slides,
    });
  })
);

// Admin: Get all slides including inactive
router.get(
  "/admin",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const slides = await HeroSlide.find().sort({ order: 1 });
    return res.status(200).json({
      success: true,
      data: slides,
    });
  })
);

// Create slide
router.post(
  "/",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const slideData = req.body;
    const slide = await HeroSlide.create(slideData);

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Created",
        module: "Home Slider",
        details: `Added new slide: ${slide.subtitle || 'Hero Slide'}`,
        req
    });

    return res.status(201).json({
      success: true,
      message: "Hero slide added successfully",
      data: slide,
    });
  })
);

// Update slide
router.put(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const oldSlide = await HeroSlide.findById(id);
    if (!oldSlide) {
      return res.status(404).json({ success: false, message: "Slide not found" });
    }

    const changedInfo = getChangedFields(oldSlide.toObject(), updateData);

    const slide = await HeroSlide.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Updated",
        module: "Home Slider",
        details: `Updated slide: ${slide.subtitle || 'Hero Slide'}${changedInfo}`,
        req
    });

    return res.status(200).json({
      success: true,
      message: "Hero slide updated successfully",
      data: slide,
    });
  })
);

// Delete slide
router.delete(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const slide = await HeroSlide.findByIdAndDelete(id);

    if (!slide) {
      return res.status(404).json({ success: false, message: "Slide not found" });
    }

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Deleted",
        module: "Home Slider",
        details: `Deleted slide: ${slide.subtitle || 'Hero Slide'}`,
        req
    });

    return res.status(200).json({
      success: true,
      message: "Hero slide deleted successfully",
    });
  })
);

// Upload image for slide
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
      folder: "ownholidayclub/hero-slides",
      documentType: "hero-slide-image",
    });

    return res.status(200).json({
      success: true,
      data: {
        url: uploaded.url,
      },
    });
  })
);

module.exports = router;
