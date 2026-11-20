const test = require("node:test");
const assert = require("node:assert/strict");
const { toSheetValues } = require("../utils/pendingApplicationsSheetSync");

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
