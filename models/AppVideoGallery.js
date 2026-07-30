const mongoose = require("mongoose");

const appVideoHeadingSchema = new mongoose.Schema({
  heading: {
    type: String,
    default: "Trending Shorts",
  },
  subHeading: {
    type: String,
    default: "Powered by Shorts",
  },
  iconWord: {
    type: String,
    default: "Shorts",
  },
  updatedBy: {
    type: String,
    default: "Admin"
  }
}, { timestamps: true });

const appVideoItemSchema = new mongoose.Schema({
  title: {
    type: String,
    default: "", // optional video title
  },
  image: {
    type: String,
    default: "", // custom thumbnail
  },
  videoUrl: {
    type: String,
    required: true,
  },
  views: {
    type: String,
    default: "", // e.g. "722K"
  },
  uploaderName: {
    type: String,
    default: "", // e.g. "Apoorva Rao"
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

const AppVideoHeading = mongoose.model("AppVideoHeading", appVideoHeadingSchema);
const AppVideoItem = mongoose.model("AppVideoItem", appVideoItemSchema);

module.exports = {
  AppVideoHeading,
  AppVideoItem,
};
