const mongoose = require("mongoose");

const serviceCardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    altText: {
      type: String,
      default: "",
    },
    icon: {
      type: String,
      default: "ShoppingBag",
    },
    buttonText: {
      type: String,
      default: "Learn More",
    },
    buttonUrl: {
      type: String,
      default: "#",
    },
    number: {
      type: String,
      default: "01",
    },
    order: {
      type: Number,
      default: 0,
    },
    subServicesConfig: {
      heading: { type: String, default: "" },
      description: { type: String, default: "" },
    },
    subServices: [
      {
        title: { type: String, required: true },
        description: { type: String, required: true },
        image: { type: String, required: true },
        altText: { type: String, default: "" },
        buttonText: { type: String, default: "PLAN THIS EVENT" },
        buttonUrl: { type: String, default: "#" },
        order: { type: Number, default: 0 },
      }
    ]
  },
  { timestamps: true }
);

const exploreServicesSchema = new mongoose.Schema(
  {
    subheading: {
      type: String,
      default: "The OWN Membership Experience",
    },
    heading: {
      type: String,
      default: "Explore Our Services.",
    },
    description: {
      type: String,
      default:
        "Elevate your lifestyle with exclusive services designed to create unforgettable family moments and premium holiday experiences.",
    },
    services: [serviceCardSchema],
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExploreService", exploreServicesSchema);
