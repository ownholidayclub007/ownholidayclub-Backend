const mongoose = require("mongoose");

const destinationHeadingSchema = new mongoose.Schema(
  {
    subheading: {
      type: String,
      default: "Make every moment magical",
    },
    heading: {
      type: String,
      default: "DISCOVER YOUR Destinations.",
    },
    description: {
      type: String,
      default: "A world of your OWN experiences — authenticity and comfort that feels familiar.",
    },
    // Toggle Switch Styles
    toggleBg: {
      type: String,
      default: "#F8FAFC", // slate-50
    },
    toggleTextColor: {
      type: String,
      default: "#64748B", // slate-500
    },
    toggleActiveBg: {
      type: String,
      default: "#F59E0B", // amber-500
    },
    toggleActiveTextColor: {
      type: String,
      default: "#0F172A", // slate-900
    },
    toggleHoverColor: {
        type: String,
        default: "#1E293B", // slate-800
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("DestinationHeading", destinationHeadingSchema);
