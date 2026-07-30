const mongoose = require("mongoose");

const whyChooseUsItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  otherTravelCompanies: { type: String, required: true },
  ownHolidayClub: { type: String, required: true }
});

const whyChooseUsSchema = new mongoose.Schema({
  page: { type: String, required: true, unique: true }, // e.g., 'home'
  subheading: { type: String },
  heading: { type: String },
  highlightedWord: { type: String },
  mainImage: { type: String },
  items: [whyChooseUsItemSchema]
}, { timestamps: true });

module.exports = mongoose.model("WhyChooseUs", whyChooseUsSchema);
