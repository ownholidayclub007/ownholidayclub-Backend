const mongoose = require("mongoose");

const cmsEntrySchema = new mongoose.Schema(
  {
    collection: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

cmsEntrySchema.index({ collection: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("CmsEntry", cmsEntrySchema);

