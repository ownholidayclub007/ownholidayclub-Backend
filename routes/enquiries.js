const express = require("express");
const mongoose = require("mongoose");
const DestinationEnquiry = require("../models/DestinationEnquiry");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { sendLeadNotificationEmail, sendGenericThankYouEmail } = require("../utils/email");

const router = express.Router();

// @route   POST /api/enquiries
// @desc    Submit a new destination enquiry (public)
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, email, phone, destinationId, destinationName, checkIn, checkOut, adults, kids, message, travelType, budget, location, fromLocation, toLocation } = req.body;

    if (!name || !email || !phone || !destinationId || !destinationName) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const enquiry = await DestinationEnquiry.create({
      name,
      email,
      phone,
      destinationId,
      destinationName,
      checkIn,
      checkOut,
      adults: Number(adults) || 0,
      kids: Number(kids) || 0,
      message,
      travelType,
      budget,
      location,
      fromLocation: fromLocation || "",
      toLocation: toLocation || "",
    });

    try {
      await sendLeadNotificationEmail({
        leadType: "Destination Enquiry",
        leadDetails: {
          "Name": name,
          "Email": email,
          "Phone": phone,
          "From Location": fromLocation || "Not specified",
          "Destination (To)": destinationName,
          "Check-In": checkIn ? new Date(checkIn).toLocaleDateString() : "Not specified",
          "Check-Out": checkOut ? new Date(checkOut).toLocaleDateString() : "Not specified",
          "Adults": adults || 0,
          "Kids": kids || 0,
          "Budget": budget || "Not specified",
        },
        message: message,
      });
    } catch (mailErr) {
      console.error("Failed to send destination enquiry lead email:", mailErr);
    }

    try {
      await sendGenericThankYouEmail({
        to: email,
        name: name,
        type: "Destination"
      });
    } catch (thankYouErr) {
      console.error("Failed to send thank you email:", thankYouErr);
    }

    res.status(201).json({ success: true, message: "Enquiry submitted successfully", data: enquiry });
  })
);

// @route   GET /api/enquiries/admin
// @desc    Get all enquiries with stats (admin)
router.get(
  "/admin",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const enquiries = await DestinationEnquiry.find().sort({ createdAt: -1 });
    
    // Calculate stats
    const stats = {
      total: enquiries.length,
      new: enquiries.filter(e => e.status === 'new').length,
      pending: enquiries.filter(e => e.status === 'pending').length,
      contacted: enquiries.filter(e => e.status === 'contacted').length,
      resolved: enquiries.filter(e => e.status === 'resolved').length
    };

    res.json({ success: true, data: enquiries, stats });
  })
);

router.put(
  "/:id/status",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    if (req.cmsAdmin.role !== "super-admin") {
      return res.status(403).json({ message: "Only super-admins can update status" });
    }
    const { status } = req.body;
    const enquiry = await DestinationEnquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }
    res.json({ success: true, message: "Status updated", data: enquiry });
  })
);

router.delete(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    if (req.cmsAdmin.role !== "super-admin") {
      return res.status(403).json({ message: "Only super-admins can delete data" });
    }
    const enquiry = await DestinationEnquiry.findByIdAndDelete(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }
    res.json({ success: true, message: "Enquiry deleted successfully" });
  })
);

module.exports = router;
