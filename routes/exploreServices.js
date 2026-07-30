const express = require("express");
const ExploreService = require("../models/ExploreService");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");

const router = express.Router();

// Get all explore services data
router.get(
  "/",
  asyncHandler(async (req, res) => {
    let data = await ExploreService.findOne().sort({ createdAt: -1 });

    if (!data) {
      data = await ExploreService.create({
        subheading: "The OWN Membership Experience",
        heading: "Explore Our Services.",
        description:
          "Elevate your lifestyle with exclusive services designed to create unforgettable family moments and premium holiday experiences.",
        services: [],
      });
    }

    // Sort services by order field
    if (data.services && data.services.length > 0) {
      data.services.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    return res.status(200).json({
      success: true,
      data,
    });
  })
);

// Update global headings
router.post(
  "/headings",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { subheading, heading, description } = req.body;

    let data = await ExploreService.findOne().sort({ createdAt: -1 });

    if (!data) {
      data = new ExploreService();
    }

    data.subheading = subheading || data.subheading;
    data.heading = heading || data.heading;
    data.description = description || data.description;

    await data.save();

    return res.status(200).json({
      success: true,
      message: "Headings updated successfully",
      data,
    });
  })
);

// Upload image to Cloudinary
router.post(
  "/images",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { file } = req.body; // Expecting { name, type, size, dataUrl }

    if (!file || !file.dataUrl) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }

    const uploaded = await uploadDocumentToCloudinary({
      file,
      folder: "ownholidayclub/explore-services",
      documentType: "service-image",
    });

    return res.status(200).json({
      success: true,
      data: {
        url: uploaded.url,
      },
    });
  })
);

// Add service card
router.post(
  "/cards",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { title, description, image, altText, icon, buttonText, buttonUrl, number, order } = req.body;

    let data = await ExploreService.findOne().sort({ createdAt: -1 });

    if (!data) {
      data = await ExploreService.create({ services: [] });
    }

    const newCard = {
      title,
      description,
      image,
      altText,
      icon,
      buttonText,
      buttonUrl: buttonUrl || "#",
      number: number || `0${data.services.length + 1}`.slice(-2),
      order: order || 0,
    };

    data.services.push(newCard);
    await data.save();

    return res.status(201).json({
      success: true,
      message: "Service card added successfully",
      data: data.services[data.services.length - 1],
    });
  })
);

// Update service card
router.put(
  "/cards/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const data = await ExploreService.findOne().sort({ createdAt: -1 });

    if (!data) {
      return res.status(404).json({ success: false, message: "Services data not found" });
    }

    const cardIndex = data.services.findIndex((card) => card._id.toString() === id);

    if (cardIndex === -1) {
      return res.status(404).json({ success: false, message: "Service card not found" });
    }

    // Update fields
    Object.keys(updateData).forEach((key) => {
      if (key !== "_id") {
        data.services[cardIndex][key] = updateData[key];
      }
    });

    await data.save();

    return res.status(200).json({
      success: true,
      message: "Service card updated successfully",
      data: data.services[cardIndex],
    });
  })
);

// Delete service card
router.delete(
  "/cards/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const data = await ExploreService.findOne().sort({ createdAt: -1 });

    if (!data) {
      return res.status(404).json({ success: false, message: "Services data not found" });
    }

    const card = data.services.id(id);
    if (!card) {
      return res.status(404).json({ success: false, message: "Service card not found" });
    }

    data.services.pull(id);
    await data.save();

    return res.status(200).json({
      success: true,
      message: "Service card deleted successfully",
    });
  })
);

module.exports = router;
