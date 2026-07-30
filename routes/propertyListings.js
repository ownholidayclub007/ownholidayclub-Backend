const express = require("express");

const PropertyListing = require("../models/PropertyListing");
const asyncHandler = require("../utils/asyncHandler");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");

const router = express.Router();

const normaliseListingPayload = (body = {}) => ({
  firstName: String(body.firstName || "").trim(),
  lastName: String(body.lastName || "").trim(),
  email: String(body.email || "").trim().toLowerCase(),
  phone: String(body.phone || "").trim(),
  propertyName: String(body.propertyName || "").trim(),
  propertyType: String(body.propertyType || "").trim(),
  address: String(body.address || "").trim(),
  targetDestination: String(body.targetDestination || "").trim(),
  leadPackage: String(body.leadPackage || "").trim(),
  description: String(body.description || "").trim(),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = normaliseListingPayload(req.body);

    if (
      !payload.firstName ||
      !payload.lastName ||
      !payload.email ||
      !payload.phone ||
      !payload.propertyName ||
      !payload.propertyType ||
      !payload.targetDestination ||
      !payload.leadPackage
    ) {
      return res.status(400).json({
        message:
          "firstName, lastName, email, phone, propertyName, propertyType, targetDestination, and leadPackage are required.",
      });
    }

    const listing = await PropertyListing.create({
      ...payload,
      status: "pending",
    });

    return res.status(201).json({
      message: "Lead Partnership request submitted successfully.",
      listing,
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const listings = await PropertyListing.find().sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Lead Partnerships fetched successfully.",
      listings,
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const listing = await PropertyListing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        message: "Lead Partnership not found.",
      });
    }

    return res.status(200).json({
      message: "Lead Partnership fetched successfully.",
      listing,
    });
  }),
);

// Route to update status for Admin Approval
router.put(
  "/:id/status",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    if (req.cmsAdmin.role !== "super-admin") {
      return res.status(403).json({ message: "Only super-admins can update status" });
    }

    const { status } = req.body;
    
    if (!status || !["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const listing = await PropertyListing.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ message: "Lead Partnership not found" });
    }

    return res.status(200).json({
      message: "Status updated successfully.",
      listing,
    });
  })
);

router.delete(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    if (req.cmsAdmin.role !== "super-admin") {
      return res.status(403).json({ message: "Only super-admins can delete data" });
    }

    const listing = await PropertyListing.findByIdAndDelete(req.params.id);

    if (!listing) {
      return res.status(404).json({ message: "Lead Partnership not found" });
    }

    return res.status(200).json({
      message: "Lead Partnership deleted successfully.",
    });
  })
);

module.exports = router;
