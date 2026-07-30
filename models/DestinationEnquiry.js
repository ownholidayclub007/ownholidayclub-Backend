const mongoose = require("mongoose");

const destinationEnquirySchema = new mongoose.Schema(
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
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    destinationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Destination",
      required: true,
    },
    destinationName: {
      type: String,
      required: true,
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
    },
    kids: {
      type: Number,
      default: 0,
    },
    message: {
      type: String,
      default: "",
    },
    travelType: {
      type: String,
      default: "",
    },
    budget: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      default: "new", // new, pending, contacted, resolved
      enum: ["new", "pending", "contacted", "resolved"],
      lowercase: true,
    },
    location: {
      type: String,
      default: "",
    },
    fromLocation: {
      type: String,
      default: "",
    },
    toLocation: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("DestinationEnquiry", destinationEnquirySchema);
