const express = require("express");
const mongoose = require("mongoose");

const CmsPage = require("../models/CmsPage");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { logActivity } = require("../utils/logger");

const router = express.Router();

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const normaliseSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const pages = await CmsPage.find().sort({ updatedAt: -1 });

    return res.status(200).json({
      message: "Pages fetched successfully.",
      pages,
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid page id." });
    }

    const page = await CmsPage.findById(id);

    if (!page) {
      return res.status(404).json({ message: "Page not found." });
    }

    return res.status(200).json({
      message: "Page fetched successfully.",
      page,
    });
  })
);

router.post(
  "/",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const slug = normaliseSlug(req.body.slug);
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "");
    const isPublished = Boolean(req.body.isPublished);

    if (!slug || !title) {
      return res.status(400).json({
        message: "slug and title are required.",
      });
    }

    const existingPage = await CmsPage.findOne({ slug });

    if (existingPage) {
      return res.status(409).json({
        message: "A page with the same slug already exists.",
      });
    }

    const page = await CmsPage.create({
      slug,
      title,
      body,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
    });

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Created",
      module: "CustomPage",
      details: `Created page: ${page.title}`,
      req
    });

    return res.status(201).json({
      message: "Page created successfully.",
      page,
    });
  })
);

router.put(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid page id." });
    }

    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, "slug")) {
      const slug = normaliseSlug(req.body.slug);
      if (!slug) {
        return res.status(400).json({ message: "slug cannot be empty." });
      }
      updates.slug = slug;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
      const title = String(req.body.title || "").trim();
      if (!title) {
        return res.status(400).json({ message: "title cannot be empty." });
      }
      updates.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "body")) {
      updates.body = String(req.body.body || "");
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "isPublished")) {
      updates.isPublished = Boolean(req.body.isPublished);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "At least one valid field is required to update a page.",
      });
    }

    if (Object.prototype.hasOwnProperty.call(updates, "isPublished")) {
      updates.publishedAt = updates.isPublished ? new Date() : null;
    }

    if (updates.slug) {
      const existingPage = await CmsPage.findOne({
        _id: { $ne: id },
        slug: updates.slug,
      });

      if (existingPage) {
        return res.status(409).json({
          message: "Another page already uses that slug.",
        });
      }
    }

    const updatedPage = await CmsPage.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedPage) {
      return res.status(404).json({ message: "Page not found." });
    }

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Updated",
      module: "CustomPage",
      details: `Updated page: ${updatedPage.title}`,
      req
    });

    return res.status(200).json({
      message: "Page updated successfully.",
      page: updatedPage,
    });
  })
);

router.delete(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid page id." });
    }

    const deletedPage = await CmsPage.findByIdAndDelete(id);

    if (!deletedPage) {
      return res.status(404).json({ message: "Page not found." });
    }

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Deleted",
      module: "CustomPage",
      details: `Deleted page: ${deletedPage.title}`,
      req
    });

    return res.status(200).json({
      message: "Page deleted successfully.",
    });
  })
);

module.exports = router;
