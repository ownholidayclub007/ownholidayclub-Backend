const express = require("express");
const router = express.Router();
const { getSettings, updateSettings } = require("../controllers/settingsController");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");

router.get("/", getSettings);
router.put("/", requireCmsAdmin, updateSettings);

module.exports = router;
