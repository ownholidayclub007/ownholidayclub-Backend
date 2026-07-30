const mongoose = require("mongoose");

const ServiceDetailSchema = new mongoose.Schema(
  {
    serviceTitle: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
    },
    shortDescription: {
      type: String,
    },
    quickStats: {
      bestTime: String,
      temp: String,
      flight: String,
      timezone: String,
    },
    fullDescription: {
      type: String,
    },
    highlights: [String],
    gallery: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceDetail", ServiceDetailSchema);
