const Seo = require("../models/Seo");
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");
const asyncHandler = require("../utils/asyncHandler");
const { logActivity, getChangedFields } = require("../utils/logger");

// Create SEO Entry
exports.createSeo = asyncHandler(async (req, res) => {
    const { page, metaTitle, metaKeywords, metaDescription, openGraphTags, schemaMarkup, canonicalTag, ogImage, isActive, updatedBy } = req.body;

    // Check if entry for this page already exists
    const existingSeo = await Seo.findOne({ page });
    if (existingSeo) {
        return res.status(400).json({ success: false, message: `SEO for page "${page}" already exists. Use update instead.` });
    }

    let ogImageUrl = "";
    if (ogImage && ogImage.startsWith("data:image")) {
        const uploaded = await uploadDocumentToCloudinary({
            file: { dataUrl: ogImage },
            folder: "ownholidayclub/seo",
            documentType: "og-image",
        });
        ogImageUrl = uploaded.url;
    }

    const seo = await Seo.create({
        page,
        metaTitle,
        metaKeywords,
        metaDescription,
        openGraphTags,
        schemaMarkup,
        canonicalTag,
        ogImage: ogImageUrl,
        isActive: isActive !== undefined ? isActive : true,
        updatedBy
    });

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Created",
        module: "SEO",
        details: `Created SEO for page: ${seo.page}`,
        req
    });

    res.status(201).json({ success: true, message: "SEO data created successfully", data: seo });
});

// Update SEO Entry
exports.updateSeo = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { metaTitle, metaKeywords, metaDescription, openGraphTags, schemaMarkup, canonicalTag, ogImage, isActive, updatedBy } = req.body;

    const seo = await Seo.findById(id);
    if (!seo) {
        return res.status(404).json({ success: false, message: "SEO entry not found" });
    }

    let ogImageUrl = seo.ogImage;
    if (ogImage && ogImage.startsWith("data:image")) {
        const uploaded = await uploadDocumentToCloudinary({
            file: { dataUrl: ogImage },
            folder: "ownholidayclub/seo",
            documentType: "og-image",
        });
        ogImageUrl = uploaded.url;
    }

    const changedInfo = getChangedFields(seo.toObject(), req.body);

    const updatedSeo = await Seo.findByIdAndUpdate(id, {
        metaTitle,
        metaKeywords,
        metaDescription,
        openGraphTags,
        schemaMarkup,
        canonicalTag,
        ogImage: ogImageUrl,
        isActive,
        updatedBy
    }, { new: true });

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Updated",
        module: "SEO",
        details: `Updated SEO for page: ${updatedSeo.page}${changedInfo}`,
        req
    });

    res.status(200).json({ success: true, message: "SEO data updated successfully", data: updatedSeo });
});

// Get All SEO Entries
exports.getAllSeo = asyncHandler(async (req, res) => {
    const entries = await Seo.find().sort({ page: 1 });
    res.status(200).json({ success: true, data: entries });
});

// Get SEO by Page Path
exports.getSeoByPage = asyncHandler(async (req, res) => {
    const { page } = req.params; // Expects encoded path or slug
    const seo = await Seo.findOne({ page: decodeURIComponent(page), isActive: true });
    if (!seo) {
        return res.status(404).json({ success: false, message: "No SEO found for this page" });
    }
    res.status(200).json({ success: true, data: seo });
});

// Delete SEO Entry
exports.deleteSeo = asyncHandler(async (req, res) => {
    const seo = await Seo.findByIdAndDelete(req.params.id);
    if (!seo) {
        return res.status(404).json({ success: false, message: "SEO entry not found" });
    }

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Deleted",
        module: "SEO",
        details: `Deleted SEO for page: ${seo.page}`,
        req
    });

    res.status(200).json({ success: true, message: "SEO entry deleted successfully" });
});
