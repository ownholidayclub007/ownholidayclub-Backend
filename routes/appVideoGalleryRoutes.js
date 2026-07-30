const express = require("express");
const router = express.Router();
const appVideoGalleryController = require("../controllers/appVideoGalleryController");
const requireCmsAdmin = require("../middleware/requireCmsAdmin");

// Public API for App Developer
router.get("/", appVideoGalleryController.getFullVideoGalleryData);

// Headings API
router.get("/headings", appVideoGalleryController.getHeadings);
router.put("/headings", requireCmsAdmin, appVideoGalleryController.updateHeadings);

// Videos API
router.get("/videos", appVideoGalleryController.getVideos);
router.post("/videos", requireCmsAdmin, appVideoGalleryController.addVideo);
router.post("/upload", requireCmsAdmin, appVideoGalleryController.uploadVideo);
router.put("/videos/reorder", requireCmsAdmin, appVideoGalleryController.reorderVideos);
router.put("/videos/:id", requireCmsAdmin, appVideoGalleryController.updateVideo);
router.delete("/videos/:id", requireCmsAdmin, appVideoGalleryController.deleteVideo);

module.exports = router;
