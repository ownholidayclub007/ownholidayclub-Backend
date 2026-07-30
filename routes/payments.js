const crypto = require("crypto");
const express = require("express");
const axios = require("axios");

const CmsEntry = require("../models/CmsEntry");
const EmailVerification = require("../models/EmailVerification");
const MemberSequence = require("../models/MemberSequence");
const MobileVerification = require("../models/MobileVerification");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const {
  uploadDocumentToCloudinary,
  uploadMemberDocuments,
} = require("../utils/cloudinary");
const { generateMembershipInvoicePdf } = require("../utils/invoice");
const { sendWelcomePasswordEmail, sendLeadNotificationEmail } = require("../utils/email");
const {
  buildMembershipId,
  buildMembershipFromTier,
  getDefaultMembershipTiers,
  getStateCode,
  normalizeTier,
  parseTierPriceToPaise,
} = require("../utils/membership");
const {
  hasOtpExpired,
  hashSecret,
  normaliseEmail,
  normaliseMobile,
} = require("../utils/security");

const router = express.Router();

const MEMBERSHIP_COLLECTION = "membership";
const TIERS_KEY = "tiers";
const RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1";

const getRazorpayCredentials = () => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!keyId || !keySecret) {
    return null;
  }

  return { keyId, keySecret };
};

const getRazorpayAuthHeader = () => {
  const credentials = getRazorpayCredentials();

  if (!credentials) {
    return null;
  }

  return `Basic ${Buffer.from(
    `${credentials.keyId}:${credentials.keySecret}`,
  ).toString("base64")}`;
};

const getMembershipTiers = async () => {
  const entry = await CmsEntry.findOne({
    collection: MEMBERSHIP_COLLECTION,
    key: TIERS_KEY,
  });

  if (!Array.isArray(entry?.data) || entry.data.length === 0) {
    return getDefaultMembershipTiers();
  }

  return entry.data.map(normalizeTier);
};

const findMembershipTierById = async (tierId) => {
  const normalizedTierId = String(tierId || "").trim().toLowerCase();
  const tiers = await getMembershipTiers();
  return tiers.find((tier) => tier.id === normalizedTierId) || null;
};

const normalizeDocument = (document = {}) => ({
  name: String(document?.name || "").trim(),
  type: String(document?.type || "").trim(),
  size: Number(document?.size || 0),
  proofType: String(document?.proofType || "").trim(),
  url: String(document?.url || "").trim(),
  publicId: String(document?.publicId || "").trim(),
  resourceType: String(document?.resourceType || "").trim(),
  format: String(document?.format || "").trim(),
  dataUrl: String(document?.dataUrl || "").trim(),
});

const normalizeAddress = (address = {}) => ({
  houseNo: String(address?.houseNo || "").trim(),
  addressLine: String(address?.addressLine || "").trim(),
  city: String(address?.city || "").trim(),
  state: String(address?.state || "").trim(),
  country: String(address?.country || "").trim(),
  phone: String(address?.phone || "").trim(),
  pin: String(address?.pin || "").trim(),
});

const normalizeFamilyMembers = (members = []) =>
  (Array.isArray(members) ? members : [])
    .slice(0, 3)
    .map((member, index) => ({
      id: `child-${index + 1}`,
      name: String(member?.name || "").trim(),
      relationship: "Child",
      dob: String(member?.dob || "").trim(),
      gender: String(member?.gender || "").trim(),
    }))
    .filter((member) => member.name || member.dob || member.gender);

const MEMBER_TITLE_PREFIXES = new Set([
  "mr",
  "mrs",
  "ms",
  "miss",
  "dr",
  "shri",
  "smt",
]);

const getPasswordNamePart = ({ firstName, fullName }) => {
  const directFirstName = String(firstName || "")
    .replace(/[^a-z]/gi, "")
    .trim();

  if (directFirstName) {
    return directFirstName.toUpperCase().slice(0, 4).padEnd(4, "X");
  }

  const fallbackNamePart = String(fullName || "")
    .split(/\s+/)
    .map((part) => String(part || "").replace(/[^a-z]/gi, "").trim())
    .find(
      (part) =>
        part && !MEMBER_TITLE_PREFIXES.has(String(part || "").toLowerCase()),
    );

  return (fallbackNamePart || "MEMB").toUpperCase().slice(0, 4).padEnd(4, "X");
};

const getPasswordDobPart = (dobValue) => {
  const normalizedDob = String(dobValue || "").trim();
  const yearFirstMatch = normalizedDob.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (yearFirstMatch) {
    return `${yearFirstMatch[3]}${yearFirstMatch[2]}`;
  }

  const dayFirstMatch = normalizedDob.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);

  if (dayFirstMatch) {
    return `${dayFirstMatch[1]}${dayFirstMatch[2]}`;
  }

  const parsedDate = new Date(normalizedDob);

  if (!Number.isNaN(parsedDate.getTime())) {
    const day = String(parsedDate.getDate()).padStart(2, "0");
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    return `${day}${month}`;
  }

  return "0101";
};

const buildMemberPassword = ({ firstName, fullName, dob }) =>
  `${getPasswordNamePart({ firstName, fullName })}${getPasswordDobPart(dob)}`;

const normaliseMemberDetails = (payload = {}) => {
  const personalDetails = payload?.personalDetails || {};
  const familyDetails = payload?.familyDetails || {};
  const documents = payload?.documents || {};

  return {
    personalDetails: {
      firstName: String(personalDetails.firstName || "").trim(),
      fullName: String(personalDetails.fullName || "").trim(),
      email: normaliseEmail(personalDetails.email),
      mobile: normaliseMobile(personalDetails.mobile),
      dob: String(personalDetails.dob || "").trim(),
      occupation: String(personalDetails.occupation || "").trim(),
      gender: String(personalDetails.gender || "").trim(),
      maritalStatus: String(personalDetails.maritalStatus || "").trim(),
      anniversary: String(personalDetails.anniversary || "").trim(),
      residenceAddress: normalizeAddress(personalDetails.residenceAddress),
      correspondenceAddress: normalizeAddress(personalDetails.correspondenceAddress),
      officeAddress: normalizeAddress(personalDetails.officeAddress),
    },
    familyDetails: {
      spouse: {
        name: String(familyDetails?.spouse?.name || "").trim(),
        dob: String(familyDetails?.spouse?.dob || "").trim(),
        email: String(familyDetails?.spouse?.email || "").trim(),
        mobile: String(familyDetails?.spouse?.mobile || "").trim(),
      },
      children: normalizeFamilyMembers(familyDetails?.children),
    },
    documents: {
      profileImage: normalizeDocument(documents?.profileImage),
      idProof: normalizeDocument(documents?.idProof),
      addressProof: normalizeDocument(documents?.addressProof),
      spouseId: normalizeDocument(documents?.spouseId),
    },
    acceptedTerms: Boolean(payload?.acceptedTerms),
  };
};

const validateMemberDetails = (memberDetails) => {
  const errors = [];
  const personalDetails = memberDetails.personalDetails;
  const residenceAddress = personalDetails.residenceAddress;

  if (!personalDetails.fullName) errors.push("Full name is required.");
  if (!personalDetails.email) errors.push("Email is required.");
  if (!personalDetails.mobile) errors.push("Mobile is required.");
  if (!personalDetails.dob) errors.push("Date of birth is required.");
  if (!personalDetails.occupation) errors.push("Occupation is required.");
  if (!personalDetails.gender) errors.push("Gender is required.");
  if (!personalDetails.maritalStatus) errors.push("Marital status is required.");
  if (!residenceAddress.addressLine)
    errors.push("Residence address is required.");
  if (!residenceAddress.city) errors.push("Residence city is required.");
  if (!residenceAddress.state) errors.push("Residence state is required.");
  if (
    residenceAddress.state &&
    getStateCode(residenceAddress.state) === "NA"
  ) {
    errors.push(
      "Please select a valid Indian state or union territory for the residence address.",
    );
  }
  if (!residenceAddress.country)
    errors.push("Residence country is required.");
  if (
    personalDetails.officeAddress?.state &&
    getStateCode(personalDetails.officeAddress.state) === "NA"
  ) {
    errors.push(
      "Please select a valid Indian state or union territory for the office address.",
    );
  }
  if (!memberDetails.documents.idProof?.proofType && !memberDetails.documents.idProofType)
    errors.push("Aadhaar card type is required.");
  if (!memberDetails.documents.idProof?.dataUrl && !memberDetails.documents.idProof?.url)
    errors.push("Aadhaar card is required.");
  if (!memberDetails.documents.addressProof?.proofType)
    errors.push("Additional ID type is required.");
  if (!memberDetails.documents.addressProof?.dataUrl && !memberDetails.documents.addressProof?.url)
    errors.push("Additional ID document is required.");
  if (!memberDetails.acceptedTerms)
    errors.push("You must accept the terms and conditions.");

  return errors;
};

const ensureEmailVerified = async (email) => {
  const verification = await EmailVerification.findOne({ email });

  if (
    !verification ||
    !verification.verifiedAt ||
    hasOtpExpired(verification.expiresAt)
  ) {
    return false;
  }

  return true;
};

const ensureMobileVerified = async (mobile) => {
  const verification = await MobileVerification.findOne({ mobile });

  if (
    !verification ||
    !verification.verifiedAt ||
    hasOtpExpired(verification.expiresAt)
  ) {
    return false;
  }

  return true;
};

const findExistingUserForPurchase = async ({ email, mobile }) =>
  User.findOne({
    $or: [{ email }, { mobile }],
  });

const buildRazorpayOrderNotes = ({
  mobile,
  email,
  fullName,
  tier,
  membershipFeeAmount,
  adminFeeAmount,
}) => ({
  mobile: String(mobile || "").trim(),
  email: String(email || "").trim(),
  fullName: String(fullName || "").trim(),
  membershipTierId: String(tier?.id || "").trim(),
  membershipTierName: String(tier?.name || "").trim(),
  membershipFeeRupees: String(Math.round(Number(membershipFeeAmount || 0) / 100)),
  adminFeeRupees: String(Math.round(Number(adminFeeAmount || 0) / 100)),
});

const getAxiosErrorMessage = (error, fallbackMessage) => {
  const apiDescription = String(
    error?.response?.data?.error?.description ||
      error?.response?.data?.error?.reason ||
      error?.response?.data?.error?.field ||
      error?.response?.data?.message ||
      "",
  ).trim();

  if (apiDescription) {
    return apiDescription;
  }

  return fallbackMessage;
};

const getNextMembershipSequence = async (state) => {
  const stateCode = getStateCode(state);
  const existingSequence = await MemberSequence.findOneAndUpdate(
    { stateCode },
    {
      $inc: {
        nextValue: 1,
      },
    },
    {
      new: true,
    },
  );

  if (existingSequence) {
    return existingSequence.nextValue;
  }

  try {
    const createdSequence = await MemberSequence.create({
      stateCode,
      nextValue: 10001,
    });

    return createdSequence.nextValue;
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const retrySequence = await MemberSequence.findOneAndUpdate(
      { stateCode },
      {
        $inc: {
          nextValue: 1,
        },
      },
      {
        new: true,
      },
    );

    return retrySequence?.nextValue || 10001;
  }
};

router.post(
  "/membership/order",
  asyncHandler(async (req, res) => {
    const credentials = getRazorpayCredentials();

    if (!credentials) {
      return res.status(500).json({
        message: "Razorpay is not configured on the backend.",
      });
    }

    const tierId = String(req.body.tierId || "")
      .trim()
      .toLowerCase();
    const memberDetails = normaliseMemberDetails(req.body.memberDetails);

    if (!tierId) {
      return res.status(400).json({
        message: "tierId is required.",
      });
    }

    const validationErrors = validateMemberDetails(memberDetails);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: validationErrors[0],
        errors: validationErrors,
      });
    }

    const { email, mobile, fullName } = memberDetails.personalDetails;
    const emailVerified = await ensureEmailVerified(email);
    const mobileVerified = await ensureMobileVerified(mobile);

    if (!emailVerified) {
      return res.status(400).json({
        message: "Please verify the email address before proceeding.",
      });
    }

    if (!mobileVerified) {
      return res.status(400).json({
        message: "Please verify the mobile number before proceeding.",
      });
    }

    const existingUser = await findExistingUserForPurchase({ email, mobile });

    if (existingUser?.membershipId) {
      return res.status(409).json({
        message:
          "A member account already exists with this email or mobile number.",
      });
    }

    const tier = await findMembershipTierById(tierId);

    if (!tier) {
      return res.status(404).json({
        message: "Membership tier not found.",
      });
    }

    const membershipFeeAmount = parseTierPriceToPaise(tier.price);
    const adminFeeAmount = parseTierPriceToPaise(tier.adminFee);
    const amount = membershipFeeAmount + adminFeeAmount;

    if (!amount) {
      return res.status(400).json({
        message: "Invalid tier price configured for payment.",
      });
    }

    const receipt = `ohc_${mobile}_${Date.now()}`;
    const authHeader = getRazorpayAuthHeader();

    let orderResponse;

    try {
      orderResponse = await axios.post(
        `${RAZORPAY_API_BASE_URL}/orders`,
        {
          amount,
          currency: "INR",
          receipt,
          notes: buildRazorpayOrderNotes({
            mobile,
            email,
            fullName,
            tier,
            membershipFeeAmount,
            adminFeeAmount,
          }),
        },
        {
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
        },
      );
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "[payments] Razorpay order create failed:",
          error?.response?.data || error,
        );
      }

      return res.status(error?.response?.status || 400).json({
        message: getAxiosErrorMessage(
          error,
          "Unable to create Razorpay order right now.",
        ),
      });
    }

    return res.status(200).json({
      message: "Membership payment order created successfully.",
      key: credentials.keyId,
      order: orderResponse.data,
      tier,
      user: {
        name: fullName,
        email,
        mobile,
      },
    });
  }),
);

router.post(
  "/membership/verify",
  asyncHandler(async (req, res) => {
    const credentials = getRazorpayCredentials();

    if (!credentials) {
      return res.status(500).json({
        message: "Razorpay is not configured on the backend.",
      });
    }

    const tierId = String(req.body.tierId || "")
      .trim()
      .toLowerCase();
    const memberDetails = normaliseMemberDetails(req.body.memberDetails);
    const orderId = String(req.body.razorpay_order_id || "").trim();
    const paymentId = String(req.body.razorpay_payment_id || "").trim();
    const signature = String(req.body.razorpay_signature || "").trim();
    const { firstName, fullName, email, mobile, dob, gender, maritalStatus, occupation, anniversary, residenceAddress, correspondenceAddress, officeAddress } =
      memberDetails.personalDetails;

    if (!tierId || !orderId || !paymentId || !signature) {
      return res.status(400).json({
        message:
          "tierId, razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
      });
    }

    const validationErrors = validateMemberDetails(memberDetails);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: validationErrors[0],
        errors: validationErrors,
      });
    }

    const emailVerified = await ensureEmailVerified(email);
    const mobileVerified = await ensureMobileVerified(mobile);

    if (!emailVerified) {
      return res.status(400).json({
        message: "Please verify the email address before proceeding.",
      });
    }

    if (!mobileVerified) {
      return res.status(400).json({
        message: "Please verify the mobile number before proceeding.",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", credentials.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({
        message: "Payment signature verification failed.",
      });
    }

    const tier = await findMembershipTierById(tierId);

    if (!tier) {
      return res.status(404).json({
        message: "Membership tier not found.",
      });
    }

    const membershipFeeAmount = parseTierPriceToPaise(tier.price);
    const adminFeeAmount = parseTierPriceToPaise(tier.adminFee);
    const totalAmount = membershipFeeAmount + adminFeeAmount;
    const membershipDetails = buildMembershipFromTier(tier);

    let user = await findExistingUserForPurchase({ email, mobile });

    if (user?.membershipId) {
      return res.status(409).json({
        message: "A member account already exists for this purchase data.",
      });
    }

    const authHeader = getRazorpayAuthHeader();
    let paymentDetails = {};

    try {
      const paymentDetailsResponse = await axios.get(
        `${RAZORPAY_API_BASE_URL}/payments/${paymentId}`,
        {
          headers: {
            Authorization: authHeader,
          },
        },
      );

      paymentDetails = paymentDetailsResponse.data || {};
    } catch (error) {
      paymentDetails = {
        amount: totalAmount,
        currency: "INR",
        status: "captured",
        notes: {
          membershipFeeRupees: Math.round(membershipFeeAmount / 100),
          adminFeeRupees: Math.round(adminFeeAmount / 100),
          invoiceTerms: Array.isArray(tier.invoiceTerms) ? tier.invoiceTerms : [],
        },
      };
    }
    const temporaryPassword = buildMemberPassword({
      firstName,
      fullName,
      dob,
    });
    const sequenceNumber = await getNextMembershipSequence(residenceAddress.state);
    const membershipId = buildMembershipId({
      tier,
      city: residenceAddress.city,
      state: residenceAddress.state,
      sequenceNumber,
    });

    if (!user) {
      user = new User({
        mobile,
        email,
        name: fullName,
        passwordHash: hashSecret(temporaryPassword),
      });
    } else {
      user.passwordHash = hashSecret(temporaryPassword);
    }

    const paymentNotes =
      paymentDetails?.notes && typeof paymentDetails.notes === "object"
        ? paymentDetails.notes
        : {};

    const alreadyExists = (user.payments || []).some(
      (payment) => payment.paymentId === paymentId,
    );

    if (!alreadyExists) {
      user.payments.unshift({
        membershipTierId: tier.id,
        membershipTierName: tier.name,
        amount: Number(paymentDetails.amount || totalAmount),
        currency: String(paymentDetails.currency || "INR"),
        priceLabel: tier.price,
        period: membershipDetails.duration || tier.period,
        status: String(paymentDetails.status || "captured"),
        orderId,
        paymentId,
        signature,
        method: String(paymentDetails.method || "").trim(),
        contact: String(paymentDetails.contact || "").trim(),
        email: String(paymentDetails.email || "").trim().toLowerCase(),
        bank: String(paymentDetails.bank || "").trim(),
        wallet: String(paymentDetails.wallet || "").trim(),
        vpa: String(paymentDetails.vpa || "").trim(),
        fee: Number(paymentDetails.fee || 0),
        tax: Number(paymentDetails.tax || 0),
        notes: {
          ...paymentNotes,
          membershipFeeRupees:
            Number(paymentNotes.membershipFeeRupees) ||
            Math.round(membershipFeeAmount / 100),
          adminFeeRupees:
            Number(paymentNotes.adminFeeRupees) ||
            Math.round(adminFeeAmount / 100),
          invoiceTerms:
            Array.isArray(paymentNotes.invoiceTerms) && paymentNotes.invoiceTerms.length > 0
              ? paymentNotes.invoiceTerms
              : (Array.isArray(tier.invoiceTerms) ? tier.invoiceTerms : []),
        },
        membershipInvoiceTerms: Array.isArray(tier.invoiceTerms) ? tier.invoiceTerms : [],
        paidAt: paymentDetails.created_at
          ? new Date(Number(paymentDetails.created_at) * 1000)
          : new Date(),
      });
    }

    const paymentRecord =
      user.payments.find((payment) => payment.paymentId === paymentId) ||
      user.payments[0];

    const uploadedDocuments = await uploadMemberDocuments(memberDetails.documents);

    user.name = fullName;
    user.email = email;
    user.mobile = mobile;
    user.dob = dob;
    user.gender = gender;
    user.maritalStatus = maritalStatus;
    user.anniversary = anniversary;
    user.occupation = occupation;
    user.residenceAddress = residenceAddress;
    user.correspondenceAddress = correspondenceAddress;
    user.officeAddress = officeAddress;
    user.spouse = memberDetails.familyDetails.spouse;
    user.familyMembers = memberDetails.familyDetails.children;
    user.documents = uploadedDocuments;
    user.membershipId = membershipId;
    user.emailVerified = true;
    user.membership = membershipDetails;

    await user.save();
    await EmailVerification.deleteOne({ email });
    await MobileVerification.deleteOne({ mobile });
    let emailDeliveryMessage = "";
    let invoicePdf = null;

    if (paymentRecord) {
      try {
        invoicePdf = await generateMembershipInvoicePdf({
          user: {
            membershipId,
            name: fullName,
            email,
            mobile,
            residenceAddress,
          },
          membership: user.membership,
          payment: paymentRecord,
        });

        paymentRecord.invoiceNumber = invoicePdf.invoiceNumber;
        const invoiceDataUrl = `data:${invoicePdf.contentType};base64,${invoicePdf.buffer.toString("base64")}`;
        const uploadedInvoice = await uploadDocumentToCloudinary({
          file: {
            name: invoicePdf.fileName,
            type: invoicePdf.contentType,
            size: invoicePdf.buffer.length,
            proofType: "membership-invoice",
            dataUrl: invoiceDataUrl,
          },
          folder: "ownholidayclub/invoices",
          documentType: invoicePdf.invoiceNumber,
        });
        paymentRecord.invoice = {
          ...uploadedInvoice,
          dataUrl: invoiceDataUrl,
        };

        await user.save();
      } catch (error) {
        emailDeliveryMessage =
          " Payment was successful, but the invoice could not be generated right now.";
      }
    }

    try {
      await sendWelcomePasswordEmail({
        to: email,
        fullName,
        membershipId,
        password: temporaryPassword,
        ...(invoicePdf
          ? {
              invoiceAttachment: {
                filename: invoicePdf.fileName,
                content: invoicePdf.buffer,
                contentType: invoicePdf.contentType,
              },
            }
          : {}),
      });
    } catch (error) {
      emailDeliveryMessage =
        " Payment was successful, but the password email with invoice could not be sent right now.";
    }

    /* Commented out as requested - admin does not want lead notification emails on successful membership purchase
    try {
      await sendLeadNotificationEmail({
        leadType: "Membership Purchase",
        leadDetails: {
          "Membership ID": membershipId,
          "Plan Name": tier.name,
          "Price Paid": tier.price,
          "Admin Fee": tier.adminFee,
          "Name": fullName,
          "Email": email,
          "Phone": mobile,
          "State": residenceAddress.state,
          "City": residenceAddress.city,
          "Marital Status": maritalStatus,
          ...(maritalStatus?.toLowerCase() === "married"
            ? {
                "Spouse Name": memberDetails.familyDetails?.spouse?.name || "—",
                "No. of Children": String(memberDetails.familyDetails?.children?.length || 0),
              }
            : {}),
          "Transaction ID": paymentId,
          "Order ID": orderId,
        },
        message: `A new member has purchased the ${tier.name} membership. Account created and welcome credentials dispatched.`,
      });
    } catch (mailErr) {
      console.error("Failed to send membership purchase lead notification email:", mailErr);
    }
    */

    return res.status(200).json({
      message: `Membership payment verified successfully.${emailDeliveryMessage}`,
      user,
    });
  }),
);

module.exports = router;
