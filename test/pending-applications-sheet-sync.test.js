const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const ReferralCode = require("../models/ReferralCode");
const { encryptPassword } = require("../utils/influencerCredentials");
const {
  syncReferralCodesToGoogleSheet,
  toReferralCodeSheetValues,
  toSheetValues,
} = require("../utils/pendingApplicationsSheetSync");

test("Google Sheets export includes only the pending-application columns", () => {
  const values = toSheetValues([
    {
      _id: "application-1",
      name: "Applicant",
      email: "applicant@example.com",
      mobile: "9876543210",
      membership: { name: "Gold" },
      updatedAt: "2026-11-20T08:00:00.000Z",
      passwordHash: "must-not-be-exported",
      documents: { idProof: { url: "private-document-url" } },
    },
    { _id: "application-2", mobile: "9123456780" },
  ]);

  assert.deepEqual(values, [
    ["Application ID", "Name", "Email", "Mobile", "Membership Plan", "Payment Status", "Saved On"],
    [
      "application-1",
      "Applicant",
      "applicant@example.com",
      "9876543210",
      "Gold",
      "Payment Pending",
      "2026-11-20T08:00:00.000Z",
    ],
    ["application-2", "", "", "9123456780", "", "Payment Pending", ""],
  ]);
});

test("Referral code export includes linked passwords and leaves unavailable passwords blank", (t) => {
  const previousKey = process.env.INFLUENCER_CREDENTIALS_ENCRYPTION_KEY;
  t.after(() => {
    if (previousKey === undefined) delete process.env.INFLUENCER_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.INFLUENCER_CREDENTIALS_ENCRYPTION_KEY = previousKey;
  });
  process.env.INFLUENCER_CREDENTIALS_ENCRYPTION_KEY = "a".repeat(64);
  const values = toReferralCodeSheetValues([
    {
      code: "DS01",
      referrerName: "Divya Singh",
      membershipCount: 3,
      isActive: true,
      createdAt: "2026-11-20T08:00:00.000Z",
      influencerAccountId: {
        encryptedPassword: encryptPassword("DS01@secret"),
        passwordHash: "must-not-be-exported",
      },
    },
    {
      code: "PS02",
      membershipCount: Number.NaN,
      isActive: false,
      createdAt: "invalid date",
    },
    { code: "OLD03", influencerAccountId: {} },
  ]);

  assert.deepEqual(values, [
    ["Referral Code", "VP Name", "Password", "Memberships", "Status", "Created On"],
    ["DS01", "Divya Singh", "DS01@secret", 3, "Active", "2026-11-20T08:00:00.000Z"],
    ["PS02", "", "", 0, "Inactive", ""],
    ["OLD03", "", "", 0, "Active", ""],
  ]);
  assert.doesNotMatch(JSON.stringify(values), /must-not-be-exported/);
});

test("Referral sheet sync fetches linked encrypted credentials and posts decrypted passwords", async (t) => {
  const previousEnv = {
    key: process.env.INFLUENCER_CREDENTIALS_ENCRYPTION_KEY,
    url: process.env.PENDING_APPS_SHEET_WEBHOOK_URL,
    secret: process.env.PENDING_APPS_SHEET_SYNC_SECRET,
  };
  t.after(() => {
    for (const [name, value] of Object.entries({
      INFLUENCER_CREDENTIALS_ENCRYPTION_KEY: previousEnv.key,
      PENDING_APPS_SHEET_WEBHOOK_URL: previousEnv.url,
      PENDING_APPS_SHEET_SYNC_SECRET: previousEnv.secret,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  process.env.INFLUENCER_CREDENTIALS_ENCRYPTION_KEY = "a".repeat(64);
  process.env.PENDING_APPS_SHEET_WEBHOOK_URL = "https://example.com/exec";
  process.env.PENDING_APPS_SHEET_SYNC_SECRET = "s".repeat(32);

  const account = { encryptedPassword: encryptPassword("DS01@secret") };
  let populateOptions;
  const find = t.mock.method(ReferralCode, "find", () => ({
    populate(options) {
      populateOptions = options;
      return this;
    },
    sort() { return this; },
    async lean() { return [{ code: "DS01", influencerAccountId: account }]; },
  }));
  const post = t.mock.method(axios, "post", async () => ({ data: { success: true } }));

  assert.deepEqual(await syncReferralCodesToGoogleSheet(), { syncedCount: 1 });
  assert.match(find.mock.calls[0].arguments[1], /\binfluencerAccountId\b/);
  assert.deepEqual(populateOptions, { path: "influencerAccountId", select: "+encryptedPassword" });
  assert.equal(post.mock.calls[0].arguments[1].values[1][2], "DS01@secret");
  assert.equal(post.mock.calls[0].arguments[1].sheetName, "Referral Codes");

  account.encryptedPassword = "invalid";
  await assert.rejects(syncReferralCodesToGoogleSheet(), /invalid format/);
  assert.equal(post.mock.callCount(), 1);
});
