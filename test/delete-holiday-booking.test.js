const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const Admin = require("../models/Admin");
const User = require("../models/User");
const { signCmsToken } = require("../utils/security");

const loggerPath = require.resolve("../utils/logger");
const auditEntries = [];
require.cache[loggerPath] = {
  id: loggerPath,
  filename: loggerPath,
  loaded: true,
  exports: { logActivity: async (entry) => auditEntries.push(entry) },
};
const routes = require("../routes/members");

test("admin can delete only the specified booking", async (t) => {
  const memberId = "507f1f77bcf86cd799439011";
  const bookingId = "507f1f77bcf86cd799439012";
  const admin = { _id: "507f1f77bcf86cd799439013", username: "test-admin", role: "admin", isActive: true };
  const oldFind = Admin.findById;
  const oldUpdate = User.updateOne;
  let modifiedCount = 1;
  const calls = [];
  Admin.findById = async () => admin;
  User.updateOne = async (...args) => {
    calls.push(args);
    return { modifiedCount };
  };
  t.after(() => { Admin.findById = oldFind; User.updateOne = oldUpdate; });

  const app = express();
  app.use("/api/members", routes);
  app.use((err, req, res, next) => res.status(500).json({ message: err.message }));
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/members`;
  const token = signCmsToken(admin);
  const remove = (user, booking, authenticated = true) => fetch(
    `${base}/${user}/holiday-bookings/${booking}`,
    { method: "DELETE", headers: authenticated ? { Authorization: `Bearer ${token}` } : {} },
  );

  assert.equal((await remove(memberId, bookingId, false)).status, 401);
  assert.equal((await remove("invalid", bookingId)).status, 400);
  assert.equal(calls.length, 0);

  modifiedCount = 0;
  assert.equal((await remove(memberId, bookingId)).status, 404);
  assert.equal(auditEntries.length, 0);

  modifiedCount = 1;
  const response = await remove(memberId, bookingId);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.deepEqual(calls.at(-1), [
    { _id: memberId, "holidayBookings._id": bookingId },
    { $pull: { holidayBookings: { _id: bookingId } } },
  ]);
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].user, "test-admin");
});
