const axios = require("axios");
const ReferralCode = require("../models/ReferralCode");
const User = require("../models/User");
const { decryptPassword } = require("./influencerCredentials");

const SHEET_HEADERS = [
  "Application ID",
  "Name",
  "Email",
  "Mobile",
  "Membership Plan",
  "Payment Status",
  "Saved On",
];
const REFERRAL_CODE_SHEET_HEADERS = [
  "Referral Code",
  "VP Name",
  "Password",
  "Memberships",
  "Status",
  "Created On",
];
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

const toIsoDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const toSheetValues = (applications) => [
  SHEET_HEADERS,
  ...applications.map((application) => {
    const savedOn = application.updatedAt || application.createdAt;

    return [
      String(application._id || ""),
      String(application.name || ""),
      String(application.email || ""),
      String(application.mobile || ""),
      String(application.membership?.name || ""),
      "Payment Pending",
      toIsoDate(savedOn),
    ];
  }),
];

const toReferralCodeSheetValues = (referralCodes) => [
  REFERRAL_CODE_SHEET_HEADERS,
  ...referralCodes.map((referralCode) => {
    const membershipCount = Number(referralCode.membershipCount);

    return [
      String(referralCode.code || ""),
      String(referralCode.referrerName || ""),
      decryptPassword(referralCode.influencerAccountId?.encryptedPassword) || "",
      Number.isFinite(membershipCount) ? Math.max(0, membershipCount) : 0,
      referralCode.isActive === false ? "Inactive" : "Active",
      toIsoDate(referralCode.createdAt),
    ];
  }),
];

const getConfiguration = () => {
  const url = String(process.env.PENDING_APPS_SHEET_WEBHOOK_URL || "").trim();
  const secret = String(process.env.PENDING_APPS_SHEET_SYNC_SECRET || "").trim();

  if (!url || !secret) {
    const error = new Error("Google Sheets sync is not configured on the backend.");
    error.statusCode = 503;
    throw error;
  }

  if (!url.startsWith("https://") || secret.length < 32) {
    const error = new Error("Google Sheets sync configuration is invalid.");
    error.statusCode = 503;
    throw error;
  }

  return { url, secret };
};

const writeRowsToGoogleSheet = async (sheetName, values, errorMessage) => {
  const { url, secret } = getConfiguration();

  try {
    const response = await axios.post(
      url,
      { secret, sheetName, values },
      { timeout: 20000 },
    );
    const result = typeof response.data === "string"
      ? JSON.parse(response.data)
      : response.data;

    if (!result?.success) {
      throw new Error("Google Sheets did not confirm the update.");
    }

    return { syncedCount: values.length - 1 };
  } catch (cause) {
    const error = new Error(errorMessage);
    error.statusCode = 502;
    error.cause = cause;
    throw error;
  }
};

const syncPendingApplicationsToGoogleSheet = async () => {
  const applications = await User.find(
    {
      "payments.status": "pending",
      $or: [
        { membershipId: { $exists: false } },
        { membershipId: "" },
      ],
    },
    "_id name email mobile membership.name updatedAt createdAt",
  )
    .sort({ updatedAt: -1 })
    .lean();

  return writeRowsToGoogleSheet(
    "Pending Applications",
    toSheetValues(applications),
    "Could not sync pending applications to Google Sheets.",
  );
};

const syncReferralCodesToGoogleSheet = async () => {
  const referralCodes = await ReferralCode.find(
    {},
    "code referrerName influencerAccountId membershipCount isActive createdAt",
  )
    .populate({ path: "influencerAccountId", select: "+encryptedPassword" })
    .sort({ createdAt: -1 })
    .lean();

  return writeRowsToGoogleSheet(
    "Referral Codes",
    toReferralCodeSheetValues(referralCodes),
    "Could not sync referral codes to Google Sheets.",
  );
};

const startGoogleSheetsSync = () => {
  const hasConfiguration = Boolean(
    process.env.PENDING_APPS_SHEET_WEBHOOK_URL ||
    process.env.PENDING_APPS_SHEET_SYNC_SECRET,
  );
  if (!hasConfiguration) return null;

  const syncAndLogErrors = (sync, description) => {
    sync().catch((error) => {
      console.error(`Scheduled ${description} Google Sheets sync failed:`, error.message);
    });
  };

  const syncAllSheets = () => {
    syncAndLogErrors(syncPendingApplicationsToGoogleSheet, "pending applications");
    syncAndLogErrors(syncReferralCodesToGoogleSheet, "referral codes");
  };

  syncAllSheets();
  return setInterval(syncAllSheets, SYNC_INTERVAL_MS);
};

module.exports = {
  startGoogleSheetsSync,
  syncPendingApplicationsToGoogleSheet,
  syncReferralCodesToGoogleSheet,
  toReferralCodeSheetValues,
  toSheetValues,
};
