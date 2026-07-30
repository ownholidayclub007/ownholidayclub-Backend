const mongoose = require("mongoose");

const serviceEnquirySchema = new mongoose.Schema(
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
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceDetail", // Assuming this is the model for service details
      required: false, // Optional if we just store name
    },
    serviceName: {
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
    subEvent: {
      type: String,
      default: "",
    },
    marriageDate: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("ServiceEnquiry", serviceEnquirySchema);
