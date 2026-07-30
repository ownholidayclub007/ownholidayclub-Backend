const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      default: "",
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
    },
    proofType: {
      type: String,
      default: "",
      trim: true,
    },
    url: {
      type: String,
      default: "",
      trim: true,
    },
    publicId: {
      type: String,
      default: "",
      trim: true,
    },
    resourceType: {
      type: String,
      default: "",
      trim: true,
    },
    format: {
      type: String,
      default: "",
      trim: true,
    },
    dataUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    houseNo: {
      type: String,
      default: "",
      trim: true,
    },
    addressLine: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    country: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    pin: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const familyMemberSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    relationship: {
      type: String,
      default: "Child",
      trim: true,
    },
    dob: {
      type: String,
      default: "",
      trim: true,
    },
    gender: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const paymentSchema = new mongoose.Schema(
  {
    membershipTierId: {
      type: String,
      default: "",
      trim: true,
    },
    membershipTierName: {
      type: String,
      default: "",
      trim: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "INR",
      trim: true,
      uppercase: true,
    },
    priceLabel: {
      type: String,
      default: "",
      trim: true,
    },
    period: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      default: "created",
      trim: true,
    },
    orderId: {
      type: String,
      default: "",
      trim: true,
    },
    paymentId: {
      type: String,
      default: "",
      trim: true,
    },
    signature: {
      type: String,
      default: "",
      trim: true,
    },
    method: {
      type: String,
      default: "",
      trim: true,
    },
    contact: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    bank: {
      type: String,
      default: "",
      trim: true,
    },
    wallet: {
      type: String,
      default: "",
      trim: true,
    },
    vpa: {
      type: String,
      default: "",
      trim: true,
    },
    fee: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    notes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    membershipInvoiceTerms: {
      type: [String],
      default: [],
    },
    invoiceNumber: {
      type: String,
      default: "",
      trim: true,
    },
    invoice: {
      type: documentSchema,
      default: () => ({}),
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const holidayBookingSchema = new mongoose.Schema(
  {
    slotNumber: {
      type: Number,
      default: null,
      min: 1,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    mobile: {
      type: String,
      default: "",
      trim: true,
    },
    place: {
      type: String,
      default: "",
      trim: true,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      default: "pending",
      enum: ["booking", "booked", "pending", "approved", "rejected"],
      lowercase: true,
      trim: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    adults: {
      type: Number,
      default: 0,
      min: 0,
    },
    kids: {
      type: Number,
      default: 0,
      min: 0,
    },
    adminMessage: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    membershipId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      index: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    dob: {
      type: String,
      default: "",
      trim: true,
    },
    gender: {
      type: String,
      default: "",
      trim: true,
    },
    maritalStatus: {
      type: String,
      default: "",
      trim: true,
    },
    anniversary: {
      type: String,
      default: "",
      trim: true,
    },
    occupation: {
      type: String,
      default: "",
      trim: true,
    },
    residenceAddress: {
      type: addressSchema,
      default: () => ({}),
    },
    correspondenceAddress: {
      type: addressSchema,
      default: () => ({}),
    },
    officeAddress: {
      type: addressSchema,
      default: () => ({}),
    },
    spouse: {
      name: {
        type: String,
        default: "",
        trim: true,
      },
      dob: {
        type: String,
        default: "",
        trim: true,
      },
      email: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
      },
      mobile: {
        type: String,
        default: "",
        trim: true,
      },
    },
    familyMembers: {
      type: [familyMemberSchema],
      default: [],
    },
    documents: {
      profileImage: {
        type: documentSchema,
        default: () => ({}),
      },
      idProof: {
        type: documentSchema,
        default: () => ({}),
      },
      addressProof: {
        type: documentSchema,
        default: () => ({}),
      },
      spouseId: {
        type: documentSchema,
        default: () => ({}),
      },
    },
    membership: {
      tierId: {
        type: String,
        default: "",
      },
      name: {
        type: String,
        default: "",
      },
      status: {
        type: String,
        default: "Inactive",
      },
      duration: {
        type: String,
        default: "",
      },
      baseDurationYears: {
        type: Number,
        default: 0,
      },
      bonusYears: {
        type: Number,
        default: 0,
      },
      totalDurationYears: {
        type: Number,
        default: 0,
      },
      validUntil: {
        type: String,
        default: "",
      },
      nightsPerYear: {
        type: String,
        default: "",
      },
      nightsRemaining: {
        type: Number,
        default: 0,
      },
      purchasedAt: {
        type: Date,
        default: null,
      },
      purchasePrice: {
        type: String,
        default: "",
      },
      cardCode: {
        type: String,
        default: "",
      },
    },
    payments: {
      type: [paymentSchema],
      default: [],
    },
    holidayBookings: {
      type: [holidayBookingSchema],
      default: [],
    },
    emailOtpCode: {
      type: String,
      select: false,
      default: null,
    },
    emailOtpExpiresAt: {
      type: Date,
      select: false,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    resetOtpCode: {
      type: String,
      select: false,
      default: null,
    },
    resetOtpExpiresAt: {
      type: Date,
      select: false,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_, returnedObject) => {
        delete returnedObject.passwordHash;
        delete returnedObject.emailOtpCode;
        delete returnedObject.emailOtpExpiresAt;
        delete returnedObject.resetOtpCode;
        delete returnedObject.resetOtpExpiresAt;
        return returnedObject;
      },
    },
  },
);

module.exports = mongoose.model("User", userSchema);
