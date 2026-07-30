const mongoose = require("mongoose");

const appGalleryHeadingSchema = new mongoose.Schema({
  featuredTitle: {
    type: String,
    default: "Featured Experiences",
  },
  fullGalleryTitle: {
    type: String,
    default: "FULL GALLERY",
  },
  fullGallerySubtitle: {
    type: String,
    default: "A glimpse into our luxurious experiences",
  },
  updatedBy: {
    type: String,
    default: "Admin"
  }
}, { timestamps: true });

const appGalleryImageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["featured", "full"],
    required: true,
  },
  image: {
    public_id: { type: String, required: true },
    url: { type: String, required: true },
  },
  text: {
    type: String,
    default: "", // Optional text
  },
  order: {
    type: Number,
    default: 0,
  },
  updatedBy: {
    type: String,
    default: "Admin"
  }
}, { timestamps: true });

const AppGalleryHeading = mongoose.model("AppGalleryHeading", appGalleryHeadingSchema);
const AppGalleryImage = mongoose.model("AppGalleryImage", appGalleryImageSchema);

module.exports = {
  AppGalleryHeading,
  AppGalleryImage,
};
