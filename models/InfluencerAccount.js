const mongoose = require("mongoose");

const influencerAccountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 50,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    encryptedPassword: {
      type: String,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      default: "Admin",
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_, returnedObject) => {
        delete returnedObject.passwordHash;
        return returnedObject;
      },
    },
  },
);

module.exports = mongoose.model("InfluencerAccount", influencerAccountSchema);
