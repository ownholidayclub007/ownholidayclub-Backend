const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const CmsEntry = require("../models/CmsEntry");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const requireSuperAdmin = require("../middleware/requireSuperAdmin");
const { generateMembershipInvoicePdf } = require("../utils/invoice");
const { sendMembershipInvoiceEmail, sendWelcomePasswordEmail } = require("../utils/email");
const { logActivity } = require("../utils/logger");
const { decryptDocument, encryptDocument } = require("../utils/privateDocuments");
const {
  buildMembershipFromTier,
  buildMembershipId,
  getDefaultMembershipTiers,
  getStateCode,
  normalizeTier,
} = require("../utils/membership");
const { getNextMembershipSequence } = require("../utils/memberSequence");
const {
  hashSecret,
  generateRandomPassword,
  normaliseEmail,
  normaliseMobile,
} = require("../utils/security");

const router = express.Router();

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const MEMBERSHIP_COLLECTION = "membership";
const TIERS_KEY = "tiers";
const MANUAL_PAYMENT_METHODS = new Set([
  "cash",
  "bank transfer",
  "upi",
  "cheque",
  "card",
  "other",
]);
const PRIVATE_DOCUMENT_TYPES = new Set([
  "profileImage",
  "idProof",
  "panCard",
  "addressProof",
  "spouseId",
]);
const MANUAL_DOCUMENT_TYPES = new Set([
  "profileImage",
  "idProof",
  "addressProof",
  "spouseId",
]);
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ID_PROOF_TYPES = new Set([
  "Aadhaar Card",
  "PAN Card",
  "Passport",
  "Voter ID",
  "Driving Licence",
]);
const ADDRESS_PROOF_TYPES = new Set([
  "Aadhaar Card",
  "Passport",
  "Government Employee ID",
  "PAN Card",
  "Driving Licence",
  "Voter ID",
]);
const MAX_DOCUMENT_BYTES = 1.5 * 1024 * 1024;
const MAX_TOTAL_DOCUMENT_BYTES = 8 * 1024 * 1024;

const hasValidFileSignature = (content, contentType) => {
  if (contentType === "application/pdf") {
    return content.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (contentType === "image/jpeg") {
    return content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  }
  if (contentType === "image/png") {
    return content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (contentType === "image/webp") {
    return (
      content.subarray(0, 4).toString("ascii") === "RIFF" &&
      content.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
};

const normalizeAddress = (address = {}) => ({
  houseNo: String(address.houseNo || "").trim(),
  addressLine: String(address.addressLine || "").trim(),
  city: String(address.city || "").trim(),
  state: String(address.state || "").trim(),
  country: String(address.country || "India").trim(),
  phone: String(address.phone || "").replace(/\D/g, "").slice(0, 10),
  pin: String(address.pin || "").replace(/\D/g, "").slice(0, 10),
});

const hasAddressDetails = (address = {}) =>
  ["houseNo", "addressLine", "city", "state", "country", "phone", "pin"].some(
    (field) => String(address[field] || "").trim(),
  );

const isValidDateValue = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
};

const preparePrivateDocuments = (documents = {}, maritalStatus = "") => {
  const prepared = {};
  let totalSize = 0;
  const addressProofType = ADDRESS_PROOF_TYPES.has(documents.addressProofType)
    ? documents.addressProofType
    : "Address Proof";
  const idProofType = ID_PROOF_TYPES.has(documents.idProofType)
    ? documents.idProofType
    : "Aadhaar Card";

  for (const [documentType, document] of Object.entries(documents)) {
    if (
      !MANUAL_DOCUMENT_TYPES.has(documentType) ||
      !document?.dataUrl ||
      (documentType === "spouseId" && maritalStatus === "Single")
    ) {
      continue;
    }

    const dataUrl = String(document.dataUrl);
    const match = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z\d+/]+={0,2})$/);
    if (!match) {
      throw Object.assign(new Error(`Invalid ${documentType} file data.`), {
        statusCode: 400,
      });
    }

    const contentType = match[1].toLowerCase();
    const content = Buffer.from(match[2], "base64");
    const profileImageHasInvalidType =
      documentType === "profileImage" && !contentType.startsWith("image/");
    if (
      !ALLOWED_DOCUMENT_TYPES.has(contentType) ||
      profileImageHasInvalidType ||
      content.length === 0 ||
      content.length > MAX_DOCUMENT_BYTES ||
      !hasValidFileSignature(content, contentType) ||
      content.toString("base64").replace(/=+$/, "") !== match[2].replace(/=+$/, "")
    ) {
      throw Object.assign(
        new Error(`${documentType} must be a PDF, JPEG, PNG, or WebP up to 1.5 MB${documentType === "profileImage" ? " (images only)" : ""}.`),
        { statusCode: 400 },
      );
    }

    totalSize += content.length;
    if (totalSize > MAX_TOTAL_DOCUMENT_BYTES) {
      throw Object.assign(new Error("Uploaded documents exceed the 8 MB total limit."), {
        statusCode: 400,
      });
    }

    const safeName = String(document.name || `${documentType}.file`)
      .replace(/[^\w.-]/g, "_")
      .slice(0, 120);
    const proofType = documentType === "addressProof"
      ? addressProofType
      : documentType === "idProof"
        ? idProofType
        : documentType === "spouseId"
          ? "Spouse ID"
          : "Profile Image";

    prepared[documentType] = {
      name: safeName,
      type: contentType,
      size: content.length,
      proofType,
      url: "",
      publicId: "",
      resourceType: "",
      format: "",
      dataUrl: "",
      ...encryptDocument(content),
    };
  }

  return prepared;
};

const getMembershipTiers = async () => {
  const entry = await CmsEntry.findOne({
    collection: MEMBERSHIP_COLLECTION,
    key: TIERS_KEY,
  });
  return Array.isArray(entry?.data) && entry.data.length > 0
    ? entry.data.map(normalizeTier)
    : getDefaultMembershipTiers();
};

const createInvoiceAttachment = async (user, payment) => {
  const invoicePdf = await generateMembershipInvoicePdf({
    user: {
      membershipId: user.membershipId,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      residenceAddress: user.residenceAddress,
    },
    membership: user.membership,
    payment,
  });
  payment.invoice = {
    name: invoicePdf.fileName,
    type: invoicePdf.contentType,
    size: invoicePdf.buffer.length,
    proofType: "membership-invoice",
    dataUrl: `data:${invoicePdf.contentType};base64,${invoicePdf.buffer.toString("base64")}`,
  };
  payment.invoiceNumber = invoicePdf.invoiceNumber;
  return invoicePdf;
};

router.post(
  "/manual-memberships",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const fullName = String(req.body.fullName || "").trim();
    const email = normaliseEmail(req.body.email);
    const mobile = normaliseMobile(req.body.mobile);
    const dob = String(req.body.dob || "").trim();
    const gender = String(req.body.gender || "").trim();
    const occupation = String(req.body.occupation || "").trim();
    const maritalStatus = String(req.body.maritalStatus || "").trim();
    const anniversary = String(req.body.anniversary || "").trim();
    const spouseInput = req.body.spouse && typeof req.body.spouse === "object"
      ? req.body.spouse
      : {};
    const spouseMobileInput = String(spouseInput.mobile || "").replace(/\D/g, "");
    const spouse = {
      name: String(spouseInput.name || "").trim(),
      dob: String(spouseInput.dob || "").trim(),
      email: normaliseEmail(spouseInput.email),
      mobile: spouseMobileInput.slice(0, 10),
    };
    const familyMembers = (Array.isArray(req.body.familyMembers) ? req.body.familyMembers : [])
      .filter((member) => member && typeof member === "object")
      .map((member) => ({
        id: crypto.randomBytes(12).toString("hex"),
        name: String(member.name || "").trim(),
        relationship: "Child",
        dob: String(member.dob || "").trim(),
        gender: String(member.gender || "").trim(),
      }))
      .filter((member) => member.name || member.dob || member.gender);
    const preparedDocuments = preparePrivateDocuments(
      req.body.documents && typeof req.body.documents === "object" ? req.body.documents : {},
      maritalStatus,
    );
    const correspondenceAddressInput = req.body.correspondenceAddress || {};
    const officeAddressInput = req.body.officeAddress || {};
    const tierId = String(req.body.tierId || "").trim().toLowerCase();
    const addressInput = req.body.residenceAddress || {
      city: req.body.city,
      state: req.body.state,
      country: "India",
    };
    const residenceAddress = normalizeAddress(
      addressInput,
    );
    const city = residenceAddress.city;
    const state = residenceAddress.state;
    const method = String(req.body.paymentMethod || "").trim().toLowerCase();
    const razorpayOrderId = String(
      req.body.razorpayOrderId || req.body.paymentReference || "",
    ).trim();
    const razorpayPaymentId = String(req.body.razorpayPaymentId || "").trim();
    const paidAmountRupees = Number(req.body.paidAmountRupees);
    const paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();

    if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: "A customer name and valid email address are required.",
      });
    }

    if (
      mobile.length !== 10 ||
      !tierId ||
      !residenceAddress.city ||
      !residenceAddress.state ||
      !residenceAddress.addressLine ||
      !residenceAddress.pin
    ) {
      return res.status(400).json({
        message: "A valid mobile, membership plan, permanent address, city, state, and postal code are required.",
      });
    }

    if (!MANUAL_PAYMENT_METHODS.has(method)) {
      return res.status(400).json({ message: "Select a valid manual payment method." });
    }

    if (
      fullName.length > 120 ||
      razorpayOrderId.length > 120 ||
      razorpayPaymentId.length > 120
    ) {
      return res.status(400).json({ message: "Name or Razorpay payment identifier is too long." });
    }

    if (dob) {
      if (!isValidDateValue(dob) || new Date(`${dob}T00:00:00.000Z`).getTime() > Date.now()) {
        return res.status(400).json({ message: "Enter a valid date of birth that is not in the future." });
      }
    }

    if (gender.length > 40) {
      return res.status(400).json({ message: "Gender must be 40 characters or fewer." });
    }
    if (occupation.length > 120 || maritalStatus.length > 40) {
      return res.status(400).json({ message: "Occupation or marital status is too long." });
    }
    if (anniversary && !isValidDateValue(anniversary)) {
      return res.status(400).json({ message: "Enter a valid anniversary date." });
    }
    if (maritalStatus === "Single" && (anniversary || spouse.name || spouse.dob || spouse.email || spouse.mobile)) {
      return res.status(400).json({ message: "Spouse and anniversary details should be omitted for a single member." });
    }
    if (
      spouse.dob &&
      (!isValidDateValue(spouse.dob) || new Date(`${spouse.dob}T00:00:00.000Z`).getTime() > Date.now())
    ) {
      return res.status(400).json({ message: "Enter a valid spouse date of birth that is not in the future." });
    }
    if (spouse.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(spouse.email)) {
      return res.status(400).json({ message: "Enter a valid spouse email address." });
    }
    if (spouseMobileInput && spouseMobileInput.length !== 10) {
      return res.status(400).json({ message: "Enter a valid 10-digit spouse mobile number." });
    }
    if (familyMembers.some((member) => member.dob && (!isValidDateValue(member.dob) || new Date(`${member.dob}T00:00:00.000Z`).getTime() > Date.now()))) {
      return res.status(400).json({ message: "Enter valid child dates of birth that are not in the future." });
    }
    if (
      [
        ...familyMembers.flatMap((member) => [member.name, member.gender]),
        gender,
        spouse.name,
        occupation,
      ]
        .some((value) => value.length > 120)
    ) {
      return res.status(400).json({ message: "One or more member details are too long." });
    }

    if (!Number.isFinite(paidAmountRupees) || paidAmountRupees <= 0 || paidAmountRupees > 100000000) {
      return res.status(400).json({ message: "Enter a valid payment amount in rupees." });
    }

    if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now()) {
      return res.status(400).json({ message: "Enter a valid payment date that is not in the future." });
    }

    if (getStateCode(state) === "NA") {
      return res.status(400).json({ message: "Select a valid Indian state." });
    }
    if (getStateCode(residenceAddress.state) === "NA") {
      return res.status(400).json({ message: "Select a valid Indian state for the permanent address." });
    }
    const tier = (await getMembershipTiers()).find((item) => item.id === tierId);
    if (!tier) {
      return res.status(404).json({ message: "Membership plan not found." });
    }

    const matchingUsers = await User.find({
      $or: [{ email }, { mobile }],
    }).select("+passwordHash");
    const existingUser = matchingUsers.find(
      (item) => item.email === email && item.mobile === mobile,
    );

    if (
      matchingUsers.length > 1 ||
      (matchingUsers.length === 1 && !existingUser)
    ) {
      return res.status(409).json({
        message: "This email and mobile number belong to different accounts.",
      });
    }

    if (existingUser?.membershipId) {
      return res.status(409).json({
        message: "This customer already has a membership. Use the existing member profile to send an invoice.",
      });
    }

    const temporaryPassword = generateRandomPassword(12);
    const user = existingUser || new User({ email, mobile });
    user.name = fullName;
    user.email = email;
    user.mobile = mobile;
    user.passwordHash = hashSecret(temporaryPassword);
    user.residenceAddress = residenceAddress;
    user.documents = {
      ...(user.documents?.toObject?.() || user.documents || {}),
      ...preparedDocuments,
    };
    if (dob) user.dob = dob;
    if (gender) user.gender = gender;
    if (occupation) user.occupation = occupation;
    if (maritalStatus) user.maritalStatus = maritalStatus;
    if (maritalStatus === "Single") {
      user.anniversary = "";
      user.spouse = { name: "", dob: "", email: "", mobile: "" };
      user.familyMembers = [];
    } else {
      if (anniversary) user.anniversary = anniversary;
      if (spouse.name || spouse.dob || spouse.email || spouse.mobile) user.spouse = spouse;
    }
    if (maritalStatus !== "Single" && familyMembers.length > 0) {
      user.familyMembers = familyMembers;
    }
    if (hasAddressDetails(correspondenceAddressInput)) {
      user.correspondenceAddress = normalizeAddress(correspondenceAddressInput);
    }
    if (hasAddressDetails(officeAddressInput)) {
      user.officeAddress = normalizeAddress(officeAddressInput);
    }
    const membership = buildMembershipFromTier(tier);
    const sequenceNumber = await getNextMembershipSequence(state);
    user.membershipId = buildMembershipId({
      tier,
      city,
      state,
      sequenceNumber,
    });
    user.membership = membership;

    const manualPaymentId = `MANUAL-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const paymentId = razorpayPaymentId || manualPaymentId;
    const amount = Math.round(paidAmountRupees * 100);
    const adminFeeRupees = Math.min(
      Number(String(tier.adminFee || "").replace(/[^\d]/g, "")) || 0,
      Math.round(paidAmountRupees),
    );
    user.payments.unshift({
      membershipTierId: tier.id,
      membershipTierName: tier.name,
      amount,
      currency: "INR",
      priceLabel: String(tier.price || ""),
      period: membership.duration || tier.period,
      status: "captured",
      orderId: razorpayOrderId,
      paymentId,
      method,
      contact: mobile,
      email,
      notes: {
        source: "admin_manual",
        razorpayOrderId,
        ...(razorpayPaymentId ? { razorpayPaymentId, manualPaymentId } : {}),
        adminFeeRupees,
        membershipFeeRupees: Math.max(0, Math.round(paidAmountRupees) - adminFeeRupees),
        invoiceEmailStatus: "pending",
        recordedBy: req.cmsAdmin.username,
      },
      membershipInvoiceTerms: Array.isArray(tier.invoiceTerms) ? tier.invoiceTerms : [],
      paidAt,
    });

    const payment = user.payments[0];
    const invoicePdf = await createInvoiceAttachment(user, payment);
    await user.save();

    let emailSent = false;
    let emailError = "";
    try {
      await sendWelcomePasswordEmail({
        to: email,
        fullName,
        membershipId: user.membershipId,
        password: temporaryPassword,
        invoiceAttachment: {
          filename: invoicePdf.fileName,
          content: invoicePdf.buffer,
          contentType: invoicePdf.contentType,
        },
      });
      payment.notes = {
        ...payment.notes,
        invoiceEmailStatus: "sent",
        invoiceSentAt: new Date(),
      };
      emailSent = true;
    } catch (error) {
      console.error("[members] Manual membership saved, invoice email failed:", error);
      emailError = "Membership was saved, but the invoice email could not be sent. Use Send Invoice from the member profile to retry.";
      payment.notes = {
        ...payment.notes,
        invoiceEmailStatus: "failed",
      };
    }
    await user.save();

    await logActivity({
      user: req.cmsAdmin.username,
      action: "Created",
      module: "Manual Membership",
      details: `Created manual membership ${user.membershipId}; invoice email ${emailSent ? "sent" : "failed"}.`,
      req,
    });

    return res.status(201).json({
      success: true,
      emailSent,
      ...(emailError ? { emailError } : {}),
      membershipId: user.membershipId,
      userId: user._id,
      paymentId,
      message: emailSent
        ? "Manual membership saved and invoice emailed successfully."
        : emailError,
    });
  }),
);

router.post(
  "/:userId/payments/:paymentId/invoice/send",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { userId, paymentId } = req.params;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid member ID." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Member not found." });
    }

    const payment = user.payments.find(
      (item) =>
        String(item.paymentId || "") === paymentId ||
        String(item._id || "") === paymentId,
    );
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found." });
    }
    if (String(payment.status || "").toLowerCase() !== "captured") {
      return res.status(400).json({
        message: "An invoice can only be sent for a confirmed, captured payment.",
      });
    }
    if (!user.email) {
      return res.status(400).json({ message: "The member does not have an email address." });
    }

    const invoicePdf = await createInvoiceAttachment(user, payment);
    await user.save();

    try {
      await sendMembershipInvoiceEmail({
        to: user.email,
        fullName: user.name,
        membershipId: user.membershipId,
        invoiceAttachment: {
          filename: invoicePdf.fileName,
          content: invoicePdf.buffer,
          contentType: invoicePdf.contentType,
        },
      });
    } catch (error) {
      payment.notes = {
        ...(payment.notes || {}),
        invoiceEmailStatus: "failed",
      };
      await user.save();
      console.error("[members] Invoice email retry failed:", error);
      return res.status(502).json({
        message: "Invoice was generated, but the email could not be delivered. Please retry.",
      });
    }

    payment.notes = {
      ...(payment.notes || {}),
      invoiceEmailStatus: "sent",
      invoiceSentAt: new Date(),
      invoiceSentBy: req.cmsAdmin.username,
    };
    await user.save();
    await logActivity({
      user: req.cmsAdmin.username,
      action: "Sent",
      module: "Membership Invoice",
      details: `Sent invoice ${payment.invoiceNumber} to ${user.email}.`,
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Invoice sent to ${user.email}.`,
      invoiceNumber: payment.invoiceNumber,
      email: user.email,
    });
  }),
);

router.get(
  "/:userId/private-documents/:documentType",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { userId, documentType } = req.params;
    if (!isValidObjectId(userId) || !PRIVATE_DOCUMENT_TYPES.has(documentType)) {
      return res.status(400).json({ message: "Invalid member or document type." });
    }

    const user = await User.findById(userId).select(
      `+documents.${documentType}.encryptedData +documents.${documentType}.encryptionIv +documents.${documentType}.encryptionAuthTag`,
    );
    const document = user?.documents?.[documentType];
    if (!document?.encryptedData || !document?.encryptionIv || !document?.encryptionAuthTag) {
      return res.status(404).json({ message: "Private document not found." });
    }

    const content = decryptDocument({
      encryptedData: document.encryptedData,
      encryptionIv: document.encryptionIv,
      encryptionAuthTag: document.encryptionAuthTag,
    });
    res.set({
      "Content-Type": document.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${String(document.name || "member-document").replace(/["\\\r\n]/g, "_")}"`,
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    return res.status(200).send(content);
  }),
);

// GET ALL MEMBERS
router.get(
  "/",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const members = await User.find({
      $or: [
        { membershipId: { $exists: true, $nin: [null, ""] } },
        { "payments.status": "captured" },
      ],
    }).sort({ createdAt: -1 });

    res.status(200).json({
      message: "Members fetched successfully.",
      members,
    });
  })
);

// GET MEMBERSHIP APPLICATIONS SAVED WITHOUT COMPLETED PAYMENT
router.get(
  "/pending-applications",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const applications = await User.find({
      "payments.status": "pending",
      $or: [
        { membershipId: { $exists: false } },
        { membershipId: "" },
      ],
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      message: "Pending membership applications fetched successfully.",
      applications,
    });
  })
);

// GET ALL HOLIDAY BOOKINGS
router.get(
  "/all-holiday-bookings",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    // Find users with non-empty holidayBookings
    const users = await User.find(
      { "holidayBookings.0": { $exists: true } },
      "name email mobile membershipId holidayBookings"
    ).lean();

    let allBookings = [];
    users.forEach((user) => {
      user.holidayBookings.forEach((booking) => {
        allBookings.push({
          ...booking,
          userId: user._id,
          userName: booking.name || user.name,
          userEmail: booking.email || user.email,
          userMobile: booking.mobile || user.mobile,
          membershipId: user.membershipId,
        });
      });
    });

    // Sort by requestedAt descending
    allBookings.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    res.status(200).json({
      success: true,
      message: "Holiday bookings fetched successfully.",
      bookings: allBookings,
    });
  })
);

// GET SINGLE MEMBER
router.get(
  "/:id",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid member ID." });
    }

    const member = await User.findById(id);

    if (!member) {
      return res.status(404).json({ message: "Member not found." });
    }

    res.status(200).json({
      message: "Member fetched successfully.",
      member,
    });
  })
);

// DELETE MEMBER
router.get(
  "/delete/:id", // Supporting both GET/DELETE just in case, but standard is DELETE
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid member ID." });
    }

    const deletedMember = await User.findByIdAndDelete(id);

    if (!deletedMember) {
      return res.status(404).json({ message: "Member not found." });
    }

    res.status(200).json({
      message: "Member deleted successfully.",
    });
  })
);

router.delete(
  "/:id",
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid member ID." });
    }

    const deletedMember = await User.findByIdAndDelete(id);

    if (!deletedMember) {
      return res.status(404).json({ message: "Member not found." });
    }

    res.status(200).json({
      message: "Member deleted successfully.",
    });
  })
);


// UPDATE HOLIDAY BOOKING STATUS
router.put(
  "/:userId/holiday-bookings/:bookingId/status",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const { userId, bookingId } = req.params;
    const { status, adminMessage } = req.body;

    if (!isValidObjectId(userId) || !isValidObjectId(bookingId)) {
      return res.status(400).json({ message: "Invalid ID(s) provided." });
    }

    const validStatuses = ["booking", "booked", "pending", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const booking = user.holidayBookings.id(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    booking.status = status;
    if (adminMessage !== undefined) {
      booking.adminMessage = adminMessage;
    }
    
    if (status === "approved" || status === "booked") {
      booking.confirmedAt = new Date();
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Booking status updated successfully.",
      booking,
    });
  })
);

module.exports = router;
