const express = require("express");
const router = express.Router();
const socialMediaController = require("../controllers/socialMediaController");

router
  .route("/")
  .get(socialMediaController.getSocialMedia)
  .put(socialMediaController.updateSocialMedia);

module.exports = router;
