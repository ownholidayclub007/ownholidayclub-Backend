const mongoose = require("mongoose");
require("../config/database");
const User = require("../models/User");

async function listUsers() {
  try {
    const users = await User.find({}, { mobile: 1, email: 1, membershipId: 1 }).limit(10);
    console.log("Recent Users:", JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

listUsers();
