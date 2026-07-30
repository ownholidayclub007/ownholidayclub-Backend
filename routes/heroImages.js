const express = require("express");
const router = express.Router();
const heroImageController = require("../controllers/heroImageController");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");

router.post("/create", requireCmsAdmin, heroImageController.createHeroImage);
router.get("/", heroImageController.getAllHeroImages);
router.get("/:id", heroImageController.getHeroImageById);
router.get("/page/:pageName", heroImageController.getHeroImageByPageName);
router.put("/update/:id", requireCmsAdmin, heroImageController.updateHeroImage);
router.delete("/delete/:id", requireCmsAdmin, heroImageController.deleteHeroImage);

module.exports = router;
