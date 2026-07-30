const mongoose = require("mongoose");
require("dotenv").config();

const removeLegacyAdminIndexes = async () => {
  try {
    const adminsCollection = mongoose.connection.collection("admins");
    const indexes = await adminsCollection.indexes();
    const hasLegacyMobileIndex = indexes.some((index) => index.name === "mobile_1");

    if (hasLegacyMobileIndex) {
      await adminsCollection.dropIndex("mobile_1");
      console.log("Removed legacy admins.mobile_1 index");
    }
  } catch (error) {
    console.log("Could not clean up legacy admin indexes", error.message || error);
  }
};

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is missing from the environment variables.");
} else {
  mongoose
    .connect(process.env.DATABASE_URL)
    .then(async () => {
      console.log("✅ Connection is successful with Database 🗄️");
      await removeLegacyAdminIndexes();
    })
    .catch((e) => {
      console.log("Could not connect with Database", e);
    });
}
