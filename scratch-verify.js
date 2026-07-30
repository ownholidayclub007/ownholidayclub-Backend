const mongoose = require("mongoose");
require("./config/database");
const MobileVerification = require("./models/MobileVerification");

async function run() {
  await MobileVerification.findOneAndUpdate(
    { mobile: "9999999999" },
    { 
      mobile: "9999999999", 
      otpCode: "123456", 
      expiresAt: new Date(Date.now() + 15*60*1000), 
      verifiedAt: new Date() 
    },
    { upsert: true, new: true }
  );
  console.log("Verified mobile record created successfully!");
  process.exit(0);
}

run();
