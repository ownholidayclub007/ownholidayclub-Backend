const express = require("express");
const mongoose = require("mongoose");
const Faq = require("../models/Faq");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");
const { logActivity, getChangedFields } = require("../utils/logger");

const router = express.Router();

// Get FAQs for a specific page
router.get(
  "/:page",
  asyncHandler(async (req, res) => {
    let faq = await Faq.findOne({ page: req.params.page });
    if (!faq) {
      return res.status(200).json({ 
        success: true, 
        data: { 
          page: req.params.page,
          subheading: "",
          heading: "",
          highlightedWord: "",
          mainImage: "",
          faqs: []
        } 
      });
    }
    res.status(200).json({ success: true, data: faq });
  })
);

// Save/Update FAQ headings and main image
router.post(
  "/headings",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { page, subheading, heading, highlightedWord, mainImage } = req.body;
    const oldFaq = await Faq.findOne({ page });
    const changedInfo = oldFaq ? getChangedFields(oldFaq.toObject(), req.body) : '';
    let faq = oldFaq;

    if (faq) {
      faq.subheading = subheading;
      faq.heading = heading;
      faq.highlightedWord = highlightedWord;
      faq.mainImage = mainImage;
      await faq.save();
    } else {
      faq = await Faq.create({ page, subheading, heading, highlightedWord, mainImage, faqs: [] });
    }
    
    await logActivity({
        user: req.cmsAdmin.username,
        action: "Updated",
        module: "FAQ",
        details: `Updated FAQ headings for page: ${page}${changedInfo}`,
        req
    });

    res.status(200).json({ success: true, message: "Headings updated successfully", data: faq });
  })
);

// Add or Update FAQ item
router.post(
  "/items",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { page, faqItem, faqId } = req.body;
    let faq = await Faq.findOne({ page });
    
    if (!faq) {
      faq = await Faq.create({ page, faqs: [] });
    }
    
    if (faqId) {
      const itemIndex = faq.faqs.findIndex(item => item._id.toString() === faqId);
      if (itemIndex > -1) {
        faq.faqs[itemIndex] = { ...faq.faqs[itemIndex].toObject(), ...faqItem };
      }
    } else {
      faq.faqs.push(faqItem);
    }
    
    await faq.save();

    await logActivity({
        user: req.cmsAdmin.username,
        action: faqId ? "Updated" : "Created",
        module: "FAQ",
        details: `${faqId ? 'Updated' : 'Added'} FAQ item for page: ${page}`,
        req
    });

    res.status(200).json({ success: true, message: faqId ? "FAQ updated" : "FAQ added", data: faq });
  })
);

// Delete FAQ item
router.delete(
  "/items/:page/:faqId",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { page, faqId } = req.params;
    let faq = await Faq.findOne({ page });
    
    if (!faq) {
      return res.status(404).json({ success: false, message: "Page FAQs not found" });
    }
    
    faq.faqs = faq.faqs.filter(item => item._id.toString() !== faqId);
    await faq.save();

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Deleted",
        module: "FAQ",
        details: `Deleted FAQ item from page: ${page}`,
        req
    });

    res.status(200).json({ success: true, message: "FAQ item deleted successfully" });
  })
);

// Upload FAQ image
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
      folder: "ownholidayclub/faqs",
      documentType: "faq-image",
    });

    res.status(200).json({
      success: true,
      data: { url: uploaded.url },
    });
  })
);

module.exports = router;
