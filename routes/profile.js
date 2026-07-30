const express = require("express");

const User = require("../models/User");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const asyncHandler = require("../utils/asyncHandler");
const { generateMembershipInvoicePdf } = require("../utils/invoice");
const { getTierBaseDurationYears, getTierBonusYears } = require("../utils/membership");
const { sendHolidayBookingAdminEmail } = require("../utils/email");

const router = express.Router();

const normaliseDocument = (document = {}) => ({
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

const normaliseAddress = (address = {}) => ({
  houseNo: String(address?.houseNo || "").trim(),
  addressLine: String(address?.addressLine || "").trim(),
  city: String(address?.city || "").trim(),
  state: String(address?.state || "").trim(),
  country: String(address?.country || "").trim(),
  phone: String(address?.phone || "").trim(),
  pin: String(address?.pin || "").trim(),
});

const normaliseFamilyMembers = (members = []) =>
  (Array.isArray(members) ? members : []).map((member, index) => ({
    id: String(member?.id || `member-${Date.now()}-${index}`),
    name: String(member?.name || "").trim(),
    relationship: String(member?.relationship || "Child").trim(),
    dob: String(member?.dob || "").trim(),
    gender: String(member?.gender || "").trim(),
  }));

const getYearsFromText = (value) =>
  Number(String(value || "").match(/(\d+)/)?.[1] || 0);

const getHolidayQuota = (membership = {}) =>
  Number(membership?.totalDurationYears || 0) ||
  getYearsFromText(membership?.duration);

const parseStayAllowance = (value) => {
  const match = String(value || "").match(/(\d+)\s*Nights?\s*\/\s*(\d+)\s*Days?/i);

  if (!match) {
    return {
      nights: 6,
      days: 7,
      label: "6 Nights / 7 Days",
    };
  }

  return {
    nights: Number(match[1]) || 6,
    days: Number(match[2]) || 7,
    label: `${Number(match[1]) || 6} Nights / ${Number(match[2]) || 7} Days`,
  };
};

const getStayAllowance = (membership = {}, slotNumber = 1) => {
  if (Array.isArray(membership.features) && membership.features.length >= 1) {
    const parseFeature = (f) => {
      const match = String(f).match(/(\d+)\s*Nights?\s*\/\s*(\d+)\s*Days?(?:\s*for\s*(\d+)\s*Years?)?/i);
      if (!match) return null;
      return {
        nights: Number(match[1]),
        days: Number(match[2]),
        years: Number(match[3]) || 1,
        label: `${Number(match[1])} Nights / ${Number(match[2])} Days`
      };
    };

    const p1 = parseFeature(membership.features[0]);
    const p2 = parseFeature(membership.features[1]);

    if (p1) {
      if (slotNumber <= p1.years) return p1;
      if (p2 && slotNumber <= (p1.years + p2.years)) return p2;
      return p2 || p1;
    }
  }

  const tierId = String(membership?.tierId || "").trim().toLowerCase();
  const tierName = String(membership?.name || "").trim().toLowerCase();

  if (tierId === "ohc-privilege" || tierName.includes("privilege")) {
    if (slotNumber <= 3) {
      return {
        nights: 3,
        days: 4,
        label: "3 Nights / 4 Days",
      };
    }

    return {
      nights: 4,
      days: 5,
      label: "4 Nights / 5 Days",
    };
  }

  return parseStayAllowance(membership?.nightsPerYear);
};

const getMatchingPaymentForMembership = (membership = {}, payments = []) => {
  const membershipTierId = String(membership?.tierId || "").trim().toLowerCase();
  const membershipName = String(membership?.name || "").trim().toLowerCase();

  return (Array.isArray(payments) ? payments : []).find((payment) => {
    const paymentPeriod = String(payment?.period || "").trim();
    const paymentTierId = String(payment?.membershipTierId || "").trim().toLowerCase();
    const paymentTierName = String(payment?.membershipTierName || "").trim().toLowerCase();

    if (!paymentPeriod) {
      return false;
    }

    return (membershipTierId && paymentTierId === membershipTierId) ||
      (membershipName && paymentTierName === membershipName);
  }) || (Array.isArray(payments) ? payments : []).find((payment) => String(payment?.period || "").trim());
};

const getValidDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getMembershipStartDate = (membership = {}, payments = []) =>
  getValidDate(membership?.purchasedAt) ||
  getValidDate(getMatchingPaymentForMembership(membership, payments)?.paidAt) ||
  getValidDate((Array.isArray(payments) ? payments : [])[0]?.paidAt);

const getHolidaySlots = (membership = {}, payments = []) => {
  const holidayQuota = getHolidayQuota(membership);
  const membershipStartDate = getMembershipStartDate(membership, payments);

  if (holidayQuota <= 0 || !membershipStartDate) {
    return [];
  }

  return Array.from({ length: holidayQuota }, (_, index) => {
    const validFrom = new Date(membershipStartDate);
    validFrom.setFullYear(validFrom.getFullYear() + index);

    const validTo = new Date(membershipStartDate);
    validTo.setFullYear(validTo.getFullYear() + index + 1);

    return {
      slotNumber: index + 1,
      validFrom,
      validTo,
    };
  });
};

const getHolidayBookingEffectiveDate = (booking = {}) =>
  getValidDate(booking?.checkIn) ||
  getValidDate(booking?.requestedAt) ||
  getValidDate(booking?.createdAt);

const mapHolidayBookingsToSlots = (holidayBookings = [], holidaySlots = []) => {
  const bookings = Array.isArray(holidayBookings) ? holidayBookings : [];
  const slots = Array.isArray(holidaySlots) ? holidaySlots : [];
  const validSlotNumbers = new Set(slots.map((slot) => slot.slotNumber));
  const assignments = new Array(bookings.length).fill(null);
  const usedSlotNumbers = new Set();

  const claimSlot = (slotNumber, bookingIndex) => {
    if (
      !Number.isInteger(slotNumber) ||
      slotNumber <= 0 ||
      !validSlotNumbers.has(slotNumber) ||
      usedSlotNumbers.has(slotNumber)
    ) {
      return false;
    }

    assignments[bookingIndex] = slotNumber;
    usedSlotNumbers.add(slotNumber);
    return true;
  };

  bookings.forEach((booking, index) => {
    claimSlot(Number(booking?.slotNumber || 0), index);
  });

  bookings
    .map((booking, index) => ({
      booking,
      index,
      effectiveDate: getHolidayBookingEffectiveDate(booking),
    }))
    .filter((entry) => !assignments[entry.index] && entry.effectiveDate)
    .sort((left, right) => left.effectiveDate.getTime() - right.effectiveDate.getTime())
    .forEach((entry) => {
      const matchingSlot = slots.find(
        (slot) =>
          !usedSlotNumbers.has(slot.slotNumber) &&
          entry.effectiveDate >= slot.validFrom &&
          entry.effectiveDate < slot.validTo,
      );

      if (matchingSlot) {
        claimSlot(matchingSlot.slotNumber, entry.index);
      }
    });

  const remainingSlotNumbers = slots
    .map((slot) => slot.slotNumber)
    .filter((slotNumber) => !usedSlotNumbers.has(slotNumber));

  bookings.forEach((_, index) => {
    if (assignments[index] || remainingSlotNumbers.length === 0) {
      return;
    }

    claimSlot(remainingSlotNumbers.shift(), index);
  });

  return bookings.map((booking, index) => ({
    booking,
    slotNumber: assignments[index] || null,
  }));
};

const hasMembershipChanges = (currentMembership = {}, nextMembership = {}) =>
  [
    "duration",
    "baseDurationYears",
    "bonusYears",
    "totalDurationYears",
    "validUntil",
  ].some(
    (field) =>
      String(currentMembership?.[field] ?? "") !== String(nextMembership?.[field] ?? ""),
  );

const enrichMembership = (membership = {}, payments = []) => {
  const nextMembership = { ...(membership?.toObject ? membership.toObject() : membership) };
  const savedTotalDurationYears = Number(nextMembership.totalDurationYears || 0) || 0;
  const parsedDurationYears = getYearsFromText(nextMembership.duration);
  const savedBaseDurationYears = Number(nextMembership.baseDurationYears || 0) || 0;

  const bonusYears = getTierBonusYears({
    id: nextMembership.tierId,
    name: nextMembership.name,
    bonusYears: nextMembership.bonusYears,
  });

  const matchingPayment = getMatchingPaymentForMembership(nextMembership, payments);
  const paymentDurationYears = getYearsFromText(matchingPayment?.period);
  const knownTierBaseDurationYears = getTierBaseDurationYears({
    id: nextMembership.tierId,
    name: nextMembership.name,
    period: nextMembership.period,
  });
  const baseDurationYears =
    savedBaseDurationYears ||
    paymentDurationYears ||
    knownTierBaseDurationYears ||
    (savedTotalDurationYears > 0 ? Math.max(savedTotalDurationYears - bonusYears, 0) : 0) ||
    parsedDurationYears;
  const totalDurationYears =
    baseDurationYears > 0
      ? baseDurationYears + bonusYears
      : savedTotalDurationYears || parsedDurationYears;

  if (totalDurationYears <= 0) {
    return nextMembership;
  }

  nextMembership.baseDurationYears = baseDurationYears;
  nextMembership.bonusYears = bonusYears;
  nextMembership.totalDurationYears = totalDurationYears;
  nextMembership.duration = `${totalDurationYears} Years`;

  const purchasedAt = nextMembership.purchasedAt ? new Date(nextMembership.purchasedAt) : null;
  if (purchasedAt && !Number.isNaN(purchasedAt.getTime())) {
    const validUntilDate = new Date(purchasedAt);
    validUntilDate.setFullYear(validUntilDate.getFullYear() + totalDurationYears);
    nextMembership.validUntil = validUntilDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  return nextMembership;
};

router.get(
  "/:userId",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();

    if (!userId) {
      return res.status(400).json({ message: "Valid user id is required." });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Profile not found." });
    }

    return res.status(200).json({
      message: "Profile fetched successfully.",
      user: {
        ...user.toObject(),
        membership: await (async () => {
          const currentMembership = user.membership?.toObject
            ? user.membership.toObject()
            : (user.membership || {});
          const enrichedMembership = enrichMembership(currentMembership, user.payments);

          if (hasMembershipChanges(currentMembership, enrichedMembership)) {
            user.membership = {
              ...currentMembership,
              ...enrichedMembership,
            };
            user.save().catch(() => {});
          }

          try {
            const CmsEntry = require("../models/CmsEntry");
            const entry = await CmsEntry.findOne({ collection: "membership", key: "tiers" });
            const tiers = entry?.data || [];
            const matchingTier = tiers.find(t => t.id === enrichedMembership.tierId || String(t.name).toLowerCase() === String(enrichedMembership.name).toLowerCase());
            enrichedMembership.features = matchingTier?.features || [];
          } catch (error) {
            enrichedMembership.features = [];
          }

          return enrichedMembership;
        })(),
      },
    });
  })
);

router.post(
  "/:userId/holiday-bookings",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    const slotNumber = Number(req.body?.slotNumber || 0);
    const place = String(req.body?.place || "").trim();
    const checkInInput = String(req.body?.checkIn || "").trim();
    const checkOutInput = String(req.body?.checkOut || "").trim();
    const adults = Number(req.body?.adults || 0);
    const kids = Number(req.body?.kids || 0);
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const mobile = String(req.body?.mobile || "").trim();

    if (!userId) {
      return res.status(400).json({ message: "Valid user id is required." });
    }

    if (!Number.isInteger(slotNumber) || slotNumber <= 0) {
      return res.status(400).json({
        message: "A valid holiday slot number is required.",
      });
    }

    if (!name || !mobile || !email) {
      return res.status(400).json({ message: "Name, email, and mobile number are required." });
    }

    if (!place) {
      return res.status(400).json({ message: "Place is required." });
    }

    if (!Number.isInteger(adults) || adults <= 0) {
      return res.status(400).json({
        message: "Please provide a valid adult count.",
      });
    }

    if (!Number.isInteger(kids) || kids < 0) {
      return res.status(400).json({
        message: "Please provide a valid kids count.",
      });
    }

    if (!checkInInput || !checkOutInput) {
      return res.status(400).json({
        message: "Check-in and check-out date/time are required.",
      });
    }

    const checkIn = new Date(checkInInput);
    const checkOut = new Date(checkOutInput);

    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      return res.status(400).json({
        message: "Please provide valid check-in and check-out date/time.",
      });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        message: "Check-out must be later than check-in.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Profile not found." });
    }

    const enrichedMembership = enrichMembership(user.membership, user.payments);
    const holidayQuota = getHolidayQuota(enrichedMembership);
    const holidaySlots = getHolidaySlots(enrichedMembership, user.payments);
    const existingHolidayBookings = (Array.isArray(user.holidayBookings) ? user.holidayBookings : [])
      .filter(b => String(b.status || "").toLowerCase() !== "rejected");

    if (!enrichedMembership?.name || holidayQuota <= 0) {
      console.log("Error 400: An active membership is required before booking a holiday.");
      return res.status(400).json({
        message: "An active membership is required before booking a holiday.",
      });
    }

    if (holidaySlots.length === 0) {
      console.log("Error 400: Membership start date is missing for holiday access.");
      return res.status(400).json({
        message: "Membership start date is missing for holiday access.",
      });
    }

    const requestedSlot = holidaySlots.find((slot) => slot.slotNumber === slotNumber);

    if (!requestedSlot) {
      console.log("Error 400: Selected holiday slot is not valid for this membership.");
      return res.status(400).json({
        message: "Selected holiday slot is not valid for this membership.",
      });
    }

    if (existingHolidayBookings.length >= holidayQuota) {
      console.log("Error 400: Your holiday booking quota has been fully used.");
      return res.status(400).json({
        message: "Your holiday booking quota has been fully used.",
      });
    }

    const mappedHolidayBookings = mapHolidayBookingsToSlots(
      existingHolidayBookings,
      holidaySlots,
    );

    if (mappedHolidayBookings.some((entry) => entry.slotNumber === slotNumber)) {
      console.log("Error 400: This holiday access has already been requested or used.");
      return res.status(400).json({
        message: "This holiday access has already been requested or used.",
      });
    }

    const now = new Date();

    if (now >= requestedSlot.validTo) {
      console.log("Error 400: This holiday access has already expired.");
      return res.status(400).json({
        message: "This holiday access has already expired.",
      });
    }

    // Date constraints removed as per requirement
    /*
    if (checkIn < requestedSlot.validFrom || checkIn >= requestedSlot.validTo) {
      console.log("Error 400: Check-in must be within the selected holiday access period.", { checkIn, validFrom: requestedSlot.validFrom, validTo: requestedSlot.validTo });
      return res.status(400).json({
        message: "Check-in must be within the selected holiday access period.",
      });
    }

    if (checkOut > requestedSlot.validTo) {
      console.log("Error 400: Check-out must be within the selected holiday access period.");
      return res.status(400).json({
        message: "Check-out must be within the selected holiday access period.",
      });
    }
    */

    const stayAllowance = getStayAllowance(
      enrichedMembership,
      slotNumber,
    );
    const bookingDurationMs = checkOut.getTime() - checkIn.getTime();
    const maxDurationMs = stayAllowance.days * 24 * 60 * 60 * 1000;

    /*
    if (bookingDurationMs > maxDurationMs) {
      console.log("Error 400: Exceeds package limit", { bookingDurationMs, maxDurationMs, label: stayAllowance.label });
      return res.status(400).json({
        message: `This booking exceeds your package limit of ${stayAllowance.label}.`,
      });
    }
    */

    user.holidayBookings.unshift({
      slotNumber,
      name,
      email,
      mobile,
      place,
      checkIn,
      checkOut,
      status: "pending",
      requestedAt: new Date(),
      adults,
      kids,
    });

    await user.save();

    // Send email notification to admin asynchronously
    sendHolidayBookingAdminEmail({
      user,
      booking: user.holidayBookings[0],
      stayAllowance,
      validFrom: requestedSlot.validFrom,
      validTo: requestedSlot.validTo
    }).catch(err => console.error("Failed to send admin holiday booking email:", err));

    return res.status(201).json({
      message:
        "Own Holiday Club team will contact you within 12 hours. Congratulations, your holiday is booked.",
      user: {
        ...user.toObject(),
        membership: enrichedMembership,
      },
    });
  }),
);

router.patch(
  "/:userId/holiday-bookings/:bookingId/status",
  requireCmsAdmin,
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    const bookingId = String(req.params.bookingId || "").trim();
    const nextStatus = String(req.body?.status || "").trim().toLowerCase();

    if (!userId || !bookingId) {
      return res.status(400).json({
        message: "Valid user id and booking id are required.",
      });
    }

    if (!["booking", "booked"].includes(nextStatus)) {
      return res.status(400).json({
        message: "Status must be either booking or booked.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Profile not found." });
    }

    const booking = (user.holidayBookings || []).find(
      (entry) => String(entry?._id || "") === bookingId,
    );

    if (!booking) {
      return res.status(404).json({ message: "Holiday booking not found." });
    }

    booking.status = nextStatus;
    booking.confirmedAt = nextStatus === "booked" ? new Date() : null;

    await user.save();

    return res.status(200).json({
      message: "Holiday booking status updated successfully.",
      booking,
    });
  }),
);

router.get(
  "/:userId/payments/:paymentId/invoice",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();
    const paymentId = String(req.params.paymentId || "").trim();

    if (!userId || !paymentId) {
      return res.status(400).json({
        message: "Valid user id and payment id are required.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Profile not found." });
    }

    const payment = (user.payments || []).find(
      (entry) =>
        String(entry.paymentId || "") === paymentId ||
        String(entry._id || "") === paymentId,
    );

    const enrichedMembership = enrichMembership(user.membership, user.payments);

    try {
      const invoicePdf = await generateMembershipInvoicePdf({
        user: {
          membershipId: user.membershipId,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          residenceAddress: user.residenceAddress,
        },
        membership: enrichedMembership,
        payment,
      });

      res.setHeader("Content-Type", invoicePdf.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${invoicePdf.fileName || payment?.invoice?.name || "membership-invoice.pdf"}"`,
      );
      return res.status(200).send(invoicePdf.buffer);
    } catch (error) {
      // Fall back to the stored invoice if regeneration fails for any reason.
    }

    if (!payment?.invoice?.url && !payment?.invoice?.dataUrl) {
      return res.status(404).json({
        message: "Invoice not found for this payment.",
      });
    }

    if (payment.invoice.dataUrl) {
      const matches = String(payment.invoice.dataUrl).match(/^data:([^;]+);base64,(.+)$/);

      if (!matches) {
        return res.status(404).json({
          message: "Invoice file is not available.",
        });
      }

      res.setHeader("Content-Type", matches[1] || "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${payment.invoice.name || "membership-invoice.pdf"}"`,
      );
      return res.status(200).send(Buffer.from(matches[2], "base64"));
    }

    if (payment.invoice.url) {
      return res.redirect(payment.invoice.url);
    }

    return res.status(404).json({
      message: "Invoice file is not available.",
    });
  }),
);

router.put(
  "/:userId",
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId || "").trim();

    if (!userId) {
      return res.status(400).json({ message: "Valid user id is required." });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Profile not found." });
    }

    const updates = {
      name: String(req.body.name || "").trim(),
      email: String(req.body.email || "").trim().toLowerCase(),
      dob: String(req.body.dob || "").trim(),
      gender: String(req.body.gender || "").trim(),
      maritalStatus: String(req.body.maritalStatus || "").trim(),
      anniversary: String(req.body.anniversary || "").trim(),
      occupation: String(req.body.occupation || "").trim(),
      residenceAddress: normaliseAddress(req.body.residenceAddress),
      officeAddress: normaliseAddress(req.body.officeAddress),
      spouse: {
        name: String(req.body?.spouse?.name || "").trim(),
        dob: String(req.body?.spouse?.dob || "").trim(),
      },
      familyMembers: normaliseFamilyMembers(req.body.familyMembers),
      documents: {
        profileImage: normaliseDocument(req.body?.documents?.profileImage),
        idProof: normaliseDocument(req.body?.documents?.idProof),
        addressProof: normaliseDocument(req.body?.documents?.addressProof),
      },
    };

    Object.assign(user, updates);
    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully.",
      user,
    });
  })
);

module.exports = router;
