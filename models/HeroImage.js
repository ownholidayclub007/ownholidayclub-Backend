const mongoose = require("mongoose");

const heroImageSchema = new mongoose.Schema(
  {
    pageName: {
      type: String,
      required: true,
      unique: true,
    },
    backgroundImage: {
      type: String,
      required: true,
    },
    imageAltText: {
      type: String,
    },
    title: {
      type: String,
    },
    highlightedText: {
      type: String,
    },
    shortDescription: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    updatedBy: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HeroImage", heroImageSchema);
