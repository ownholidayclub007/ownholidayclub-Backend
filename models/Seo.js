const mongoose = require("mongoose");

const seoSchema = new mongoose.Schema(
  {
    page: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    metaTitle: {
      type: String,
      trim: true,
      maxlength: 70,
    },
    metaKeywords: {
      type: String,
      trim: true,
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    openGraphTags: {
      type: String, // HTML content/tags
    },
    schemaMarkup: {
      type: String, // JSON-LD string
    },
    canonicalTag: {
      type: String,
    },
    ogImage: {
      type: String, // Cloudinary URL
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: String,
      default: "Admin User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Seo", seoSchema);
