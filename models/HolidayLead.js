const mongoose = require("mongoose");

const holidayLeadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    contextType: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    contextName: {
      type: String,
      default: "",
      trim: true,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    adults: {
      type: Number,
      default: 0,
      min: 0,
    },
    kids: {
      type: Number,
      default: 0,
      min: 0,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    searchLocation: {
      type: String,
      default: "",
      trim: true,
    },
    locationType: {
      type: String,
      default: "Domestic",
      trim: true,
    },
    budget: {
      type: String,
      default: "",
      trim: true,
    },
    travelType: {
      type: String,
      default: "",
      trim: true,
    },
    source: {
      type: String,
      default: "home-hero",
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      default: "new",
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model("HolidayLead", holidayLeadSchema);
