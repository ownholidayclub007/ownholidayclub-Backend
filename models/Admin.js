const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: ["super-admin", "admin", "digital-marketing", "developer"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    mobile: {
      type: String,
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
  }
);

module.exports = mongoose.model("Admin", adminSchema);
