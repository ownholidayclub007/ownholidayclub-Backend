const express = require("express");
const router = express.Router();
const {
  getReferralCodes,
  generateReferralCodes,
  validateReferralCode,
  trackReferralInstall,
  deleteReferralCode,
} = require("../controllers/referralCodeController");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");

router.get("/", getReferralCodes);
router.post("/generate", requireCmsAdmin, generateReferralCodes);
router.post("/validate", validateReferralCode);
router.post("/track", trackReferralInstall);
router.delete("/:id", requireCmsAdmin, deleteReferralCode);

module.exports = router;
