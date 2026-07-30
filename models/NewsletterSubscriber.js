const mongoose = require("mongoose");

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    sources: {
      type: [String],
      default: ["footer"],
    },
    status: {
      type: String,
      default: "subscribed",
      trim: true,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    lastSubmittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.models.NewsletterSubscriber
  || mongoose.model("NewsletterSubscriber", newsletterSubscriberSchema);
