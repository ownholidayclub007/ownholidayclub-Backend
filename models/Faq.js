const mongoose = require("mongoose");

const faqItemSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  image: { type: String },
  altText: { type: String }
});

const faqSchema = new mongoose.Schema({
  page: { type: String, required: true, unique: true }, // e.g., 'membership'
  subheading: { type: String },
  heading: { type: String },
  highlightedWord: { type: String },
  mainImage: { type: String },
  faqs: [faqItemSchema]
}, { timestamps: true });

module.exports = mongoose.model("Faq", faqSchema);
