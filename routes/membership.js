const express = require("express");

const CmsEntry = require("../models/CmsEntry");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { logActivity } = require("../utils/logger");
const {
  getDefaultMembershipTiers,
  normalizeTier,
} = require("../utils/membership");

const router = express.Router();

const MEMBERSHIP_COLLECTION = "membership";
const TIERS_KEY = "tiers";

router.get(
  "/tiers",
  asyncHandler(async (req, res) => {
    const entry = await CmsEntry.findOneAndUpdate(
      {
        collection: MEMBERSHIP_COLLECTION,
        key: TIERS_KEY,
      },
      {
        $setOnInsert: {
          data: getDefaultMembershipTiers(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(200).json({
      message: "Membership tiers fetched successfully.",
      tiers: Array.isArray(entry?.data) ? entry.data.map(normalizeTier) : [],
      collection: MEMBERSHIP_COLLECTION,
      key: TIERS_KEY,
    });
  }),
);

router.put(
  "/tiers",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    if (!Array.isArray(req.body?.tiers)) {
      return res.status(400).json({
        message: "tiers must be an array.",
      });
    }

    const tiers = req.body.tiers.map(normalizeTier);

    const entry = await CmsEntry.findOneAndUpdate(
      {
        collection: MEMBERSHIP_COLLECTION,
        key: TIERS_KEY,
      },
      {
        data: tiers,
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Updated",
      module: "Membership",
      details: `Updated membership tiers`,
      req
    });

    return res.status(200).json({
      message: "Membership tiers saved successfully.",
      tiers: Array.isArray(entry?.data) ? entry.data : tiers,
    });
  }),
);

module.exports = router;
