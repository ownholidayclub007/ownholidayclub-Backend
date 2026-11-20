const test = require("node:test");
const assert = require("node:assert/strict");
const {
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

test("Referral code export excludes influencer credentials", () => {
  const values = toReferralCodeSheetValues([
    {
      code: "DS01",
      referrerName: "Divya Singh",
      membershipCount: 3,
      isActive: true,
      createdAt: "2026-11-20T08:00:00.000Z",
      influencerAccountId: {
        password: "must-not-be-exported",
        encryptedPassword: "encrypted-private-value",
      },
    },
    {
      code: "PS02",
      membershipCount: Number.NaN,
      isActive: false,
      createdAt: "invalid date",
    },
  ]);

  assert.deepEqual(values, [
    ["Referral Code", "VP Name", "Memberships", "Status", "Created On"],
    ["DS01", "Divya Singh", 3, "Active", "2026-11-20T08:00:00.000Z"],
    ["PS02", "", 0, "Inactive", ""],
  ]);
  assert.doesNotMatch(JSON.stringify(values), /password|encrypted-private-value/i);
});
