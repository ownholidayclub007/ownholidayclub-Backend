const express = require("express");
const router = express.Router();
const appGalleryController = require("../controllers/appGalleryController");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");

// Public API for App Developer
router.get("/", appGalleryController.getFullAppGalleryData);

// Headings API
router.get("/headings", appGalleryController.getHeadings);
router.put("/headings", requireCmsAdmin, appGalleryController.updateHeadings);

// Images API
router.get("/images", appGalleryController.getImages);
router.post("/images", requireCmsAdmin, appGalleryController.createImage);
router.put("/images/reorder", requireCmsAdmin, appGalleryController.reorderImages);
router.put("/images/:id", requireCmsAdmin, appGalleryController.updateImage);
router.delete("/images/:id", requireCmsAdmin, appGalleryController.deleteImage);

module.exports = router;
