const express = require("express");
const mongoose = require("mongoose");
const WhyChooseUs = require("../models/WhyChooseUs");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");
const { logActivity, getChangedFields } = require("../utils/logger");

const router = express.Router();

// Get Why Choose Us data for a specific page
router.get(
  "/:page",
  asyncHandler(async (req, res) => {
    let wcu = await WhyChooseUs.findOne({ page: req.params.page });
    if (!wcu) {
      return res.status(200).json({ 
        success: true, 
        data: { 
          page: req.params.page,
          subheading: "",
          heading: "",
          highlightedWord: "",
          mainImage: "",
          items: []
        } 
      });
    }
    res.status(200).json({ success: true, data: wcu });
  })
);

// Save/Update Why Choose Us headings and main image
router.post(
  "/headings",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { page, subheading, heading, highlightedWord, mainImage } = req.body;
    const oldWcu = await WhyChooseUs.findOne({ page });
    const changedInfo = oldWcu ? getChangedFields(oldWcu.toObject(), req.body) : '';
    let wcu = oldWcu;

    if (wcu) {
      wcu.subheading = subheading;
      wcu.heading = heading;
      wcu.highlightedWord = highlightedWord;
      wcu.mainImage = mainImage;
      await wcu.save();
    } else {
      wcu = await WhyChooseUs.create({ page, subheading, heading, highlightedWord, mainImage, items: [] });
    }
    
    await logActivity({
        user: req.cmsAdmin.username,
        action: "Updated",
        module: "WhyChooseUs",
        details: `Updated WhyChooseUs headings for page: ${page}${changedInfo}`,
        req
    });

    res.status(200).json({ success: true, message: "Headings updated successfully", data: wcu });
  })
);

// Add or Update Why Choose Us item
router.post(
  "/items",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { page, wcuItem, itemId } = req.body;
    let wcu = await WhyChooseUs.findOne({ page });
    
    if (!wcu) {
      wcu = await WhyChooseUs.create({ page, items: [] });
    }
    
    if (itemId) {
      const itemIndex = wcu.items.findIndex(item => item._id.toString() === itemId);
      if (itemIndex > -1) {
        wcu.items[itemIndex] = { ...wcu.items[itemIndex].toObject(), ...wcuItem };
      }
    } else {
      wcu.items.push(wcuItem);
    }
    
    await wcu.save();

    await logActivity({
        user: req.cmsAdmin.username,
        action: itemId ? "Updated" : "Created",
        module: "WhyChooseUs",
        details: `${itemId ? 'Updated' : 'Added'} WhyChooseUs item for page: ${page}`,
        req
    });

    res.status(200).json({ success: true, message: itemId ? "Item updated" : "Item added", data: wcu });
  })
);

// Delete Why Choose Us item
router.delete(
  "/items/:page/:itemId",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { page, itemId } = req.params;
    let wcu = await WhyChooseUs.findOne({ page });
    
    if (!wcu) {
      return res.status(404).json({ success: false, message: "Page WhyChooseUs not found" });
    }
    
    wcu.items = wcu.items.filter(item => item._id.toString() !== itemId);
    await wcu.save();

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Deleted",
        module: "WhyChooseUs",
        details: `Deleted WhyChooseUs item from page: ${page}`,
        req
    });

    res.status(200).json({ success: true, message: "WhyChooseUs item deleted successfully" });
  })
);

// Upload Section Main Image
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
      folder: "ownholidayclub/whychooseus",
      documentType: "wcu-image",
    });

    res.status(200).json({
      success: true,
      data: { url: uploaded.url },
    });
  })
);

module.exports = router;
