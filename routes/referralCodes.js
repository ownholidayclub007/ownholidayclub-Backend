const express = require("express");
const {
  deleteReferralCode,
  generateCustomReferralCode,
  generateReferralCodes,
  getReferralCodes,
  syncReferralCodesToGoogleSheet,
  updateReferralCode,
  validateReferralCode,
} = require("../controllers/referralCodeController");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");

const router = express.Router();

router.get("/", requireCmsAdmin, getReferralCodes);
router.post("/sync-google-sheet", requireCmsAdmin, syncReferralCodesToGoogleSheet);
router.post("/generate", requireCmsAdmin, generateReferralCodes);
router.post("/generate-custom", requireCmsAdmin, generateCustomReferralCode);
router.post("/validate", validateReferralCode);
router.put("/:id", requireCmsAdmin, updateReferralCode);
router.delete("/:id", requireCmsAdmin, deleteReferralCode);

module.exports = router;
