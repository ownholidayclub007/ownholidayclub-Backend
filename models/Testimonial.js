const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {
    tag: { type: String, required: true, trim: true },
    quote: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    image: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Testimonial", testimonialSchema);
