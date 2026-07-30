const express = require('express');
const router = express.Router();
const seoController = require('../controllers/seoController');
const requireCmsAdmin = require('../middleware/requireCmsAdmin');

// Public
router.get('/page/:page', seoController.getSeoByPage);

// Admin
router.get('/all', requireCmsAdmin, seoController.getAllSeo);
router.post('/create', requireCmsAdmin, seoController.createSeo);
router.put('/update/:id', requireCmsAdmin, seoController.updateSeo);
router.delete('/delete/:id', requireCmsAdmin, seoController.deleteSeo);

module.exports = router;
