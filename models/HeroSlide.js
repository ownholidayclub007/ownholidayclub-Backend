const mongoose = require("mongoose");

const heroSlideSchema = new mongoose.Schema(
  {
    subtitle: {
      type: String,
      default: "Welcome to Luxury",
    },
    title1: {
      type: String,
      default: "Stay & Celebration",
    },
    title2: {
      type: String,
      default: "on Earth",
    },
    description: {
      type: String,
      default: "Experience the pinnacle of luxury with our exclusive members-only holiday packages.",
    },
    image: {
      type: String,
      required: true,
    },
    altText: {
      type: String,
      default: "",
    },
    button1Text: {
      type: String,
      default: "",
    },
    button1Link: {
      type: String,
      default: "",
    },
    button2Text: {
      type: String,
      default: "",
    },
    button2Link: {
      type: String,
      default: "",
    },
    button3Text: {
      type: String,
      default: "",
    },
    button3Link: {
      type: String,
      default: "",
    },
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

module.exports = mongoose.model("HeroSlide", heroSlideSchema);
