const express = require("express");

const CmsEntry = require("../models/CmsEntry");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { logActivity } = require("../utils/logger");

const router = express.Router();

const normaliseKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const normaliseCollection = (value) => normaliseKey(value);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const collection = normaliseCollection(req.query.collection);

    if (!collection) {
      return res.status(400).json({ message: "collection query param is required." });
    }

    const entries = await CmsEntry.find({ collection }).sort({ updatedAt: -1 });

    return res.status(200).json({
      message: "Entries fetched successfully.",
      entries,
    });
  })
);

router.post(
  "/",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const collection = normaliseCollection(req.body.collection);
    const key = normaliseKey(req.body.key);
    const data = req.body.data ?? null;

    if (!collection || !key || data === null) {
      return res.status(400).json({
        message: "collection, key, and data are required.",
      });
    }

    const existing = await CmsEntry.findOne({ collection, key });
    if (existing) {
      return res.status(409).json({
        message: "An entry with the same key already exists in this collection.",
      });
    }

    const entry = await CmsEntry.create({ collection, key, data });

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Created",
      module: collection.charAt(0).toUpperCase() + collection.slice(1),
      details: `Created entry in ${collection}: ${key}`,
      req
    });

    return res.status(201).json({
      message: "Entry created successfully.",
      entry,
    });
  })
);

router.put(
  "/:collection/:key",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const collection = normaliseCollection(req.params.collection);
    const key = normaliseKey(req.params.key);
    const data = req.body.data ?? null;

    if (!collection || !key) {
      return res.status(400).json({ message: "Invalid collection or key." });
    }

    if (data === null) {
      return res.status(400).json({ message: "data is required." });
    }

    const updated = await CmsEntry.findOneAndUpdate(
      { collection, key },
      { data },
      { new: true, runValidators: true, upsert: false }
    );

    if (!updated) {
      return res.status(404).json({ message: "Entry not found." });
    }

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Updated",
      module: collection.charAt(0).toUpperCase() + collection.slice(1),
      details: `Updated entry in ${collection}: ${key}`,
      req
    });

    return res.status(200).json({
      message: "Entry updated successfully.",
      entry: updated,
    });
  })
);

router.delete(
  "/:collection/:key",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const collection = normaliseCollection(req.params.collection);
    const key = normaliseKey(req.params.key);

    if (!collection || !key) {
      return res.status(400).json({ message: "Invalid collection or key." });
    }

    const deleted = await CmsEntry.findOneAndDelete({ collection, key });

    if (!deleted) {
      return res.status(404).json({ message: "Entry not found." });
    }

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Deleted",
      module: collection.charAt(0).toUpperCase() + collection.slice(1),
      details: `Deleted entry from ${collection}: ${key}`,
      req
    });

    return res.status(200).json({ message: "Entry deleted successfully." });
  })
);

module.exports = router;
