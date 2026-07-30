const express = require("express");
const mongoose = require("mongoose");
const ServiceDetail = require("../models/ServiceDetail");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");
const { logActivity, getChangedFields } = require("../utils/logger");

const router = express.Router();

// Get all service details (Public)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const services = await ServiceDetail.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: services });
  })
);

// Get all service details (Admin)
router.get(
  "/admin",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const services = await ServiceDetail.find().sort({ order: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: services });
  })
);

const ExploreService = require("../models/ExploreService");

// Get single service detail by slug
router.get(
  "/slug/:slug",
  asyncHandler(async (req, res) => {
    const service = await ServiceDetail.findOne({ slug: req.params.slug, isActive: true });
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    // Try to find the matching ExploreService card to get its image and subServices
    const exploreData = await ExploreService.findOne({ isPublished: true });
    let exploreImage = "";
    let subServicesConfig = {};
    let subServices = [];

    if (exploreData && exploreData.services) {
      const matchingCard = exploreData.services.find(s => s.title.trim().toLowerCase() === service.serviceTitle.trim().toLowerCase());
      if (matchingCard) {
        exploreImage = matchingCard.image;
        subServicesConfig = matchingCard.subServicesConfig || {};
        subServices = matchingCard.subServices || [];
      }
    }

    res.status(200).json({ 
      success: true, 
      data: {
        ...service.toObject(),
        exploreImage,
        subServicesConfig,
        subServices
      } 
    });
  })
);

// Create new service detail
router.post(
  "/",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (!data.slug && data.serviceTitle) {
      data.slug = data.serviceTitle
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }
    const service = await ServiceDetail.create(data);

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Created",
        module: "Service",
        details: `Created service: ${service.serviceTitle}`,
        req
    });

    res.status(201).json({ success: true, message: "Service details created successfully", data: service });
  })
);

// Update service detail
router.put(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const oldService = await ServiceDetail.findById(req.params.id);
    if (!oldService) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    const changedInfo = getChangedFields(oldService.toObject(), req.body);

    const service = await ServiceDetail.findByIdAndUpdate(req.params.id, req.body, { 
      new: true,
      runValidators: true 
    });

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Updated",
        module: "Service",
        details: `Updated service: ${service.serviceTitle}${changedInfo}`,
        req
    });

    res.status(200).json({ success: true, message: "Service details updated successfully", data: service });
  })
);

// Delete service detail
router.delete(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const service = await ServiceDetail.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Deleted",
        module: "Service",
        details: `Deleted service: ${service.serviceTitle}`,
        req
    });

    res.status(200).json({ success: true, message: "Service details deleted successfully" });
  })
);

// Upload image
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
      folder: "ownholidayclub/services",
      documentType: "service-image",
    });

    res.status(200).json({
      success: true,
      data: { url: uploaded.url },
    });
  })
);

module.exports = router;
