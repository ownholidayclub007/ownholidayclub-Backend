const express = require("express");

const NewsletterSubscriber = require("../models/NewsletterSubscriber");
const asyncHandler = require("../utils/asyncHandler");
const { normaliseEmail } = require("../utils/security");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normaliseSource = (value) =>
  String(value || "footer")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "footer";

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const email = normaliseEmail(req.body.email);
    const source = normaliseSource(req.body.source);

    if (!email || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        message: "A valid email address is required.",
      });
    }

    const existingSubscriber = await NewsletterSubscriber.findOne({ email });

    if (existingSubscriber) {
      existingSubscriber.lastSubmittedAt = new Date();

      if (!existingSubscriber.sources.includes(source)) {
        existingSubscriber.sources.push(source);
      }

      await existingSubscriber.save();

      return res.status(200).json({
        message: "This email is already subscribed.",
        subscriber: existingSubscriber,
      });
    }

    const subscriber = await NewsletterSubscriber.create({
      email,
      sources: [source],
      status: "subscribed",
      subscribedAt: new Date(),
      lastSubmittedAt: new Date(),
    });

    return res.status(201).json({
      message: "Subscribed successfully.",
      subscriber,
    });
  }),
);

module.exports = router;
