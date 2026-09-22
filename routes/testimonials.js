const express = require("express");
const Testimonial = require("../models/Testimonial");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");
const { logActivity, getChangedFields } = require("../utils/logger");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const testimonials = await Testimonial.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data: testimonials });
  })
);

router.get(
  "/admin",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const testimonials = await Testimonial.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, data: testimonials });
  })
);

router.post(
  "/",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const testimonial = await Testimonial.create(req.body);
    await logActivity({
      user: req.cmsAdmin.username,
      action: "Created",
      module: "Testimonials",
      details: `Added testimonial by ${testimonial.name}`,
      req,
    });
    res.status(201).json({ success: true, message: "Testimonial added successfully", data: testimonial });
  })
);

router.put(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const oldTestimonial = await Testimonial.findById(req.params.id);
    if (!oldTestimonial) {
      return res.status(404).json({ success: false, message: "Testimonial not found" });
    }

    const changedInfo = getChangedFields(oldTestimonial.toObject(), req.body);
    const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    await logActivity({
      user: req.cmsAdmin.username,
      action: "Updated",
      module: "Testimonials",
      details: `Updated testimonial by ${testimonial.name}${changedInfo}`,
      req,
    });
    res.json({ success: true, message: "Testimonial updated successfully", data: testimonial });
  })
);

router.delete(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    if (!testimonial) {
      return res.status(404).json({ success: false, message: "Testimonial not found" });
    }
    await logActivity({
      user: req.cmsAdmin.username,
      action: "Deleted",
      module: "Testimonials",
      details: `Deleted testimonial by ${testimonial.name}`,
      req,
    });
    res.json({ success: true, message: "Testimonial deleted successfully" });
  })
);

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
      folder: "ownholidayclub/testimonials",
      documentType: "testimonial-image",
    });
    res.json({ success: true, data: { url: uploaded.url } });
  })
);

module.exports = router;
