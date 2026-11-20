const axios = require("axios");
const User = require("../models/User");

const SHEET_HEADERS = [
  "Application ID",
  "Name",
  "Email",
  "Mobile",
  "Membership Plan",
  "Payment Status",
  "Saved On",
];
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

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
      savedOn && !Number.isNaN(new Date(savedOn).getTime())
        ? new Date(savedOn).toISOString()
        : "",
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

const syncPendingApplicationsToGoogleSheet = async () => {
  const { url, secret } = getConfiguration();
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

  try {
    const response = await axios.post(
      url,
      { secret, values: toSheetValues(applications) },
      { timeout: 20000 },
    );
    const result = typeof response.data === "string"
      ? JSON.parse(response.data)
      : response.data;

    if (!result?.success) {
      throw new Error("Google Sheets did not confirm the update.");
    }

    return { syncedCount: applications.length };
  } catch (cause) {
    const error = new Error("Could not sync pending applications to Google Sheets.");
    error.statusCode = 502;
    error.cause = cause;
    throw error;
  }
};

const startPendingApplicationsSheetSync = () => {
  const hasConfiguration = Boolean(
    process.env.PENDING_APPS_SHEET_WEBHOOK_URL ||
    process.env.PENDING_APPS_SHEET_SYNC_SECRET,
  );
  if (!hasConfiguration) return null;

  const syncAndLogErrors = () => {
    syncPendingApplicationsToGoogleSheet().catch((error) => {
      console.error("Scheduled pending applications sheet sync failed:", error.message);
    });
  };

  syncAndLogErrors();
  return setInterval(syncAndLogErrors, SYNC_INTERVAL_MS);
};

module.exports = {
  startPendingApplicationsSheetSync,
  syncPendingApplicationsToGoogleSheet,
  toSheetValues,
};
