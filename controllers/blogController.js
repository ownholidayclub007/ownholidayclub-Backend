const Blog = require('../models/Blog');
const asyncHandler = require('../utils/asyncHandler');
const { uploadDocumentToCloudinary } = require("../utils/cloudinary");
const { logActivity, getChangedFields } = require("../utils/logger");

// Get all blogs (Public - Published only)
exports.getBlogs = asyncHandler(async (req, res) => {
    const blogs = await Blog.find({ status: 'published' }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: blogs });
});

// Get all blogs (Admin - All)
exports.getAllBlogsAdmin = asyncHandler(async (req, res) => {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: blogs });
});

// Get single blog by slug
exports.getBlogBySlug = asyncHandler(async (req, res) => {
    const blog = await Blog.findOne({ slug: req.params.slug, status: 'published' });
    if (!blog) {
        return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    
    // Increment views
    blog.views += 1;
    await blog.save();

    res.status(200).json({ success: true, data: blog });
});

// Create new blog
exports.createBlog = asyncHandler(async (req, res) => {
    const blogData = req.body;
    
    // Check if slug already exists
    const existingBlog = await Blog.findOne({ slug: blogData.slug });
    if (existingBlog) {
        return res.status(400).json({ success: false, message: 'Slug already exists. Please use a different title or slug.' });
    }

    const blog = await Blog.create(blogData);

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Created",
        module: "Blog",
        details: `Created blog: ${blog.title}`,
        req
    });

    res.status(201).json({ success: true, message: 'Blog created successfully', data: blog });
});

// Update blog
exports.updateBlog = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const oldBlog = await Blog.findById(id);
    if (!oldBlog) {
        return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    const changedInfo = getChangedFields(oldBlog.toObject(), req.body);

    const blog = await Blog.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true
    });

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Updated",
        module: "Blog",
        details: `Updated blog: ${blog.title}${changedInfo}`,
        req
    });

    res.status(200).json({ success: true, message: 'Blog updated successfully', data: blog });
});

// Delete blog
exports.deleteBlog = asyncHandler(async (req, res) => {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
        return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    await logActivity({
        user: req.cmsAdmin.username,
        action: "Deleted",
        module: "Blog",
        details: `Deleted blog: ${blog.title}`,
        req
    });

    res.status(200).json({ success: true, message: 'Blog deleted successfully' });
});

// Upload image (Generic for main image and OG image)
exports.uploadBlogImage = asyncHandler(async (req, res) => {
    const { file, type } = req.body; // type: 'main' or 'og'

    if (!file || !file.dataUrl) {
        return res.status(400).json({ success: false, message: "No file provided" });
    }

    const uploaded = await uploadDocumentToCloudinary({
        file,
        folder: "ownholidayclub/blogs",
        documentType: type === 'og' ? "blog-og-image" : "blog-main-image",
    });

    return res.status(200).json({
        success: true,
        data: {
            url: uploaded.url,
        },
    });
});
