const express = require("express");
const {
  deleteReferralCode,
  generateReferralCodes,
  getReferralCodes,
  validateReferralCode,
} = require("../controllers/referralCodeController");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");

const router = express.Router();

router.get("/", getReferralCodes);
router.post("/generate", requireCmsAdmin, generateReferralCodes);
router.post("/validate", validateReferralCode);
router.delete("/:id", requireCmsAdmin, deleteReferralCode);

module.exports = router;
