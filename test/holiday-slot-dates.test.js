const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const User = require("../models/User");

const emailPath = require.resolve("../utils/email");
require.cache[emailPath] = {
  id: emailPath,
  filename: emailPath,
  loaded: true,
  exports: { sendHolidayBookingAdminEmail: async () => {} },
};

const profileRoutes = require("../routes/profile");

test("booking endpoint enforces the selected financial year", async (t) => {
  const year = new Date().getUTCFullYear() + 3;
  const user = {
    membership: { name: "Test", totalDurationYears: 1, purchasedAt: `${year - 1}-11-17T00:00:00+05:30` },
    payments: [],
    holidayBookings: [],
    save: async () => {},
    toObject() { return { membership: this.membership, holidayBookings: this.holidayBookings }; },
  };
  const originalFindById = User.findById;
  User.findById = async () => user;
  t.after(() => { User.findById = originalFindById; });

  const app = express();
  app.use(express.json());
  app.use("/api/profile", profileRoutes);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/profile/test/holiday-bookings`;
  const request = async (checkIn, checkOut) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotNumber: 1, name: "Test", email: "test@example.com", mobile: "123", place: "Test", adults: 1, kids: 0, checkIn, checkOut }),
    });
    return response.status;
  };

  assert.equal(await request(`${year - 1}-11-17T10:00:00+05:30`, `${year}-04-02T10:00:00+05:30`), 400);
  assert.equal(await request(`${year}-04-01T00:00:00+05:30`, `${year + 1}-04-01T00:00:00+05:30`), 400);
  assert.equal(await request(`${year + 1}-03-31T10:00:00+05:30`, `${year + 1}-03-31T23:59:00+05:30`), 201);
});
