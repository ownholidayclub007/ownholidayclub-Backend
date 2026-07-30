const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    title: { type: String, required: true },
    h1Title: { type: String },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, required: true },
    author: { type: String, default: 'admin' },
    tags: [{ type: String }],
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    featured: { type: Boolean, default: false },
    image: { type: String },
    imageAlt: { type: String },
    metaTitle: { type: String },
    metaDescription: { type: String },
    metaKeywords: { type: String },
    ogTitle: { type: String },
    ogDescription: { type: String },
    ogImage: { type: String },
    canonicalTag: { type: String },
    schemaMarkup: { type: String },
    openGraphTags: { type: String },
    readTime: { type: String },
    views: { type: Number, default: 0 },
    updatedBy: { type: String },
    publishedAt: { type: Date }
}, { timestamps: true });

// Pre-save hook to update publishedAt when status changes to published
blogSchema.pre('save', function(next) {
    if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
        this.publishedAt = new Date();
    }
    next();
});

module.exports = mongoose.model('Blog', blogSchema);
