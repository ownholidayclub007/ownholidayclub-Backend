const express = require("express");
const router = express.Router();
const {
  submitEnquiry,
  getEnquiries,
  updateStatus,
  deleteEnquiry,
} = require("../controllers/contactEnquiryController");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const requireSuperAdmin = require("../middleware/requireSuperAdmin");

router.post("/", submitEnquiry);

// Admin routes
router.get("/admin", requireCmsAdmin, getEnquiries);
router.put("/:id/status", requireSuperAdmin, updateStatus);
router.delete("/:id", requireSuperAdmin, deleteEnquiry);

module.exports = router;
