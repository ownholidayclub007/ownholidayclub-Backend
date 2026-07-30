const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const requireCmsAdmin = require('../middleware/requireCmsAdmin');

// Public routes
router.get('/', blogController.getBlogs);
router.get('/post/:slug', blogController.getBlogBySlug);

// Admin routes
router.get('/admin/all', requireCmsAdmin, blogController.getAllBlogsAdmin);
router.post('/', requireCmsAdmin, blogController.createBlog);
router.put('/:id', requireCmsAdmin, blogController.updateBlog);
router.delete('/:id', requireCmsAdmin, blogController.deleteBlog);
router.post('/images', requireCmsAdmin, blogController.uploadBlogImage);

module.exports = router;
