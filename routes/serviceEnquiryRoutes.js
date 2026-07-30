const express = require("express");
const router = express.Router();
const {
  createEnquiry,
  getAllEnquiries,
  updateStatus,
  deleteEnquiry,
} = require("../controllers/serviceEnquiryController");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");
const requireSuperAdmin = require("../middleware/requireSuperAdmin");

router.post("/", createEnquiry);
router.get("/admin", requireCmsAdmin, getAllEnquiries);
router.put("/:id/status", requireSuperAdmin, updateStatus);
router.delete("/:id", requireSuperAdmin, deleteEnquiry);

module.exports = router;
