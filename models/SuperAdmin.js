const mongoose = require("mongoose");

const superAdminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    pendingEmail: {
      type: String,
      default: null,
      select: false,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    resetOtpCode: {
      type: String,
      default: null,
      select: false,
    },
    resetOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    profileOtpCode: {
      type: String,
      default: null,
      select: false,
    },
    profileOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    emailOtpCode: {
      type: String,
      default: null,
      select: false,
    },
    emailOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_, returnedObject) => {
        delete returnedObject.passwordHash;
        delete returnedObject.resetOtpCode;
        delete returnedObject.resetOtpExpiresAt;
        delete returnedObject.profileOtpCode;
        delete returnedObject.profileOtpExpiresAt;
        delete returnedObject.pendingEmail;
        delete returnedObject.emailOtpCode;
        delete returnedObject.emailOtpExpiresAt;
        return returnedObject;
      },
    },
  }
);

module.exports = mongoose.model("SuperAdmin", superAdminSchema);
