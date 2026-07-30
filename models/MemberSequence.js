const mongoose = require("mongoose");

const memberSequenceSchema = new mongoose.Schema(
  {
    stateCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    nextValue: {
      type: Number,
      default: 10000,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model("MemberSequence", memberSequenceSchema);
