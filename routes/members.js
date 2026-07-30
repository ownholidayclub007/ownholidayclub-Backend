const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const requireSuperAdmin = require("../middleware/requireSuperAdmin");

const router = express.Router();

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET ALL MEMBERS
router.get(
  "/",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const members = await User.find().sort({ createdAt: -1 });

    res.status(200).json({
      message: "Members fetched successfully.",
      members,
    });
  })
);

// GET ALL HOLIDAY BOOKINGS
router.get(
  "/all-holiday-bookings",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    // Find users with non-empty holidayBookings
    const users = await User.find(
      { "holidayBookings.0": { $exists: true } },
      "name email mobile membershipId holidayBookings"
    ).lean();

    let allBookings = [];
    users.forEach((user) => {
      user.holidayBookings.forEach((booking) => {
        allBookings.push({
          ...booking,
          userId: user._id,
          userName: booking.name || user.name,
          userEmail: booking.email || user.email,
          userMobile: booking.mobile || user.mobile,
          membershipId: user.membershipId,
        });
      });
    });

    // Sort by requestedAt descending
    allBookings.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    res.status(200).json({
      success: true,
      message: "Holiday bookings fetched successfully.",
      bookings: allBookings,
    });
  })
);

// GET SINGLE MEMBER
router.get(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid member ID." });
    }

    const member = await User.findById(id);

    if (!member) {
      return res.status(404).json({ message: "Member not found." });
    }

    res.status(200).json({
      message: "Member fetched successfully.",
      member,
    });
  })
);

// DELETE MEMBER
router.get(
  "/delete/:id", // Supporting both GET/DELETE just in case, but standard is DELETE
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid member ID." });
    }

    const deletedMember = await User.findByIdAndDelete(id);

    if (!deletedMember) {
      return res.status(404).json({ message: "Member not found." });
    }

    res.status(200).json({
      message: "Member deleted successfully.",
    });
  })
);

router.delete(
  "/:id",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid member ID." });
    }

    const deletedMember = await User.findByIdAndDelete(id);

    if (!deletedMember) {
      return res.status(404).json({ message: "Member not found." });
    }

    res.status(200).json({
      message: "Member deleted successfully.",
    });
  })
);


// UPDATE HOLIDAY BOOKING STATUS
router.put(
  "/:userId/holiday-bookings/:bookingId/status",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { userId, bookingId } = req.params;
    const { status, adminMessage } = req.body;

    if (!isValidObjectId(userId) || !isValidObjectId(bookingId)) {
      return res.status(400).json({ message: "Invalid ID(s) provided." });
    }

    const validStatuses = ["booking", "booked", "pending", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const booking = user.holidayBookings.id(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    booking.status = status;
    if (adminMessage !== undefined) {
      booking.adminMessage = adminMessage;
    }
    
    if (status === "approved" || status === "booked") {
      booking.confirmedAt = new Date();
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Booking status updated successfully.",
      booking,
    });
  })
);

module.exports = router;
