const express = require("express");
const app = express();
const cors = require("cors");

// ─── Database Connection ────────────────────────────────────────────────────────
require("./config/database");

// ─── Models (dummy for test routes) ───────────────────────────────────────────
const dummy = require("./models/dummy");

// ─── Routes ────────────────────────────────────────────────────────────────────
const adminRoutes                  = require("./routes/admins");
const superAdminRoutes             = require("./routes/superAdmin");
const cmsAuthRoutes                = require("./routes/cmsAuth");
const cmsPagesRoutes               = require("./routes/cmsPages");
const cmsEntriesRoutes             = require("./routes/cmsEntries");
const membershipRoutes             = require("./routes/membership");
const paymentRoutes                = require("./routes/payments");
const authRoutes                   = require("./routes/auth");
const profileRoutes                = require("./routes/profile");
const propertyListingRoutes        = require("./routes/propertyListings");
const newsletterSubscriptionRoutes = require("./routes/newsletterSubscriptions");
const holidayLeadRoutes            = require("./routes/holidayLeads");
const socialMediaRoutes           = require("./routes/socialMedia");
const memberRoutes                = require("./routes/members");
const exploreServicesRoutes       = require("./routes/exploreServices");
const heroSlidesRoutes          = require("./routes/heroSlides");
const destinationsRoutes        = require("./routes/destinations");
const enquiriesRoutes           = require("./routes/enquiries");
const contactEnquiriesRoutes    = require("./routes/contactEnquiries");
const settingsRoutes            = require("./routes/settings");
const faqRoutes                 = require("./routes/faqs");
const heroImageRoutes           = require("./routes/heroImages");
const serviceDetailRoutes       = require("./routes/serviceDetails");
const blogRoutes                = require("./routes/blogs");
const seoRoutes                 = require("./routes/seo");
const serviceEnquiryRoutes     = require("./routes/serviceEnquiryRoutes");
const dashboardRoutes          = require("./routes/dashboardRoutes");
const activityLogRoutes        = require("./routes/activityLogRoutes");
const whyChooseUsRoutes        = require("./routes/whyChooseUs");
const appGalleryRoutes         = require("./routes/appGalleryRoutes");
const appVideoGalleryRoutes    = require("./routes/appVideoGalleryRoutes");
const budgetRoutes             = require("./routes/budgetRoutes");

// ─── Port ──────────────────────────────────────────────────────────────────────
const port = process.env.PORT || 8081;

// ─── Core Middleware ───────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://portal.ownholidayclub.com",
  "http://localhost:3000",
  "https://ownholidayclub.com",
  "https://www.ownholidayclub.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/admins",                  adminRoutes);
app.use("/api/super-admin",             superAdminRoutes);
app.use("/api/cms/auth",                cmsAuthRoutes);
app.use("/api/cms/pages",               cmsPagesRoutes);
app.use("/api/cms/entries",             cmsEntriesRoutes);
app.use("/api/membership",              membershipRoutes);
app.use("/api/payments",               paymentRoutes);
app.use("/api/auth",                    authRoutes);
app.use("/api/profile",                profileRoutes);
app.use("/api/property-listings",       propertyListingRoutes);
app.use("/api/newsletter-subscriptions",newsletterSubscriptionRoutes);
app.use("/api/holiday-leads",           holidayLeadRoutes);
app.use("/api/social-media",            socialMediaRoutes);
app.use("/api/members",                 memberRoutes);
app.use("/api/explore-services",        exploreServicesRoutes);
app.use("/api/hero-slides",             heroSlidesRoutes);
app.use("/api/destinations",            destinationsRoutes);
app.use("/api/enquiries",               enquiriesRoutes);
app.use("/api/contact-enquiries",       contactEnquiriesRoutes);
app.use("/api/settings",                settingsRoutes);
app.use("/api/faq",                     faqRoutes);
app.use("/api/hero-images",             heroImageRoutes);
app.use("/api/service-details",         serviceDetailRoutes);
app.use("/api/blogs",                   blogRoutes);
app.use("/api/seo",                     seoRoutes);
app.use("/api/service-enquiries",       serviceEnquiryRoutes);
app.use("/api/dashboard",               dashboardRoutes);
app.use("/api/activity-logs",           activityLogRoutes);
app.use("/api/why-choose-us",           whyChooseUsRoutes);
app.use("/api/app-gallery",             appGalleryRoutes);
app.use("/api/app-video-gallery",       appVideoGalleryRoutes);
app.use("/api/budgets",                 budgetRoutes);


// ─── Test Routes (remove in production) ───────────────────────────────────────
app.get("/hello", async (req, res) => {
  try {
    res.status(200).send("hii...");
  } catch (error) {
    console.log(error);
  }
});

app.post("/post", async (req, res) => {
  try {
    const data = new dummy(req.body);
    await data.save();
    res.status(200).send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});

app.get("/get", async (req, res) => {
  try {
    const data = await dummy.find();
    res.status(200).send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});

app.get("/get/:id", async (req, res) => {
  try {
    const data = await dummy.findById(req.params.id);
    res.status(200).send(data);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.put("/update/:id", async (req, res) => {
  try {
    const updatedData = await dummy.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.status(200).send(updatedData);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.delete("/delete/:id", async (req, res) => {
  try {
    await dummy.findByIdAndDelete(req.params.id);
    res.status(200).send("Data deleted successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((error, req, res, next) => {
  console.log(error);

  if (error?.code === 11000) {
    const duplicateField = Object.keys(error.keyValue || {})[0] || "field";
    return res.status(409).json({ message: `${duplicateField} already exists.` });
  }

  if (error?.name === "ValidationError") {
    return res.status(400).json({ message: error.message });
  }

  if (
    Number.isInteger(error?.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode < 600
  ) {
    const payload = { message: error.message || "Request failed." };
    if (process.env.NODE_ENV !== "production" && error?.details) {
      payload.details = error.details;
    }
    return res.status(error.statusCode).json(payload);
  }

  return res.status(500).json({ message: "Something went wrong on the server." });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`✅ server is listening at ${port} 🚀`);
  });
}

module.exports = app;
