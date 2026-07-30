const mongoose = require("mongoose");

const DestinationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    region: {
      type: String,
      enum: ["Domestic", "International"],
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    tagline: {
      type: String,
    },
    tag: {
      type: String,
    },
    count: {
      type: String,
    },
    location: {
      type: String,
    },
    image: {
      type: String,
      required: true,
    },
    altText: {
      type: String,
    },
    shortDescription: {
      type: String,
    },
    fullDescription: {
      type: String,
    },
    travelStats: {
      bestTime: String,
      temp: String,
      flight: String,
      timezone: String,
    },
    gallery: [String],
    highlights: [String],
    properties: [
      {
        name: String,
        type: String,
        rating: String,
        image: String,
      },
    ],
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Destination", DestinationSchema);
