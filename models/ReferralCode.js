const mongoose = require("mongoose");

const referralCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    customNumber: {
      type: Number,
      min: 0,
      max: 99,
      unique: true,
      sparse: true,
      select: false,
    },
    membershipCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      default: "Admin",
    },
    referrerName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ReferralCode", referralCodeSchema);
