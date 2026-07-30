const express = require("express");
const router = express.Router();
const { getStats } = require("../controllers/dashboardController");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");

router.get("/stats", getStats);

module.exports = router;
