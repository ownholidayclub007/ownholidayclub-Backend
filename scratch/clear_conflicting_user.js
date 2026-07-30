const mongoose = require("mongoose");
require("../config/database");
const User = require("../models/User");

async function clearUser() {
  const mobile = "9310219283";
  try {
    const result = await User.deleteMany({ mobile });
    console.log(`Deleted ${result.deletedCount} users with mobile ${mobile}`);
    
    // Also check for email if you used one
    const email = "rsyadav.abss1@gmail.com"; // from your screenshot/env
    const emailResult = await User.deleteMany({ email });
    console.log(`Deleted ${emailResult.deletedCount} users with email ${email}`);
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

clearUser();
