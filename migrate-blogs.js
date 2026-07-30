const mongoose = require('mongoose');
require('dotenv').config();
const CmsEntry = require('./models/CmsEntry');
const Blog = require('./models/Blog');

async function migrate() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to MongoDB');

        const entry = await CmsEntry.findOne({ collection: 'homepage', key: 'blogposts' });
        if (!entry) {
            console.log('No blogposts found in CmsEntry');
            return;
        }

        const oldPosts = entry.data || [];
        console.log(`Found ${oldPosts.length} old posts`);

        for (const post of oldPosts) {
            // Check if already exists in Blog collection
            const slug = post.id || post.slug || post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const exists = await Blog.findOne({ slug });
            
            if (!exists) {
                console.log(`Migrating: ${post.title}`);
                await Blog.create({
                    title: post.title,
                    h1Title: post.title,
                    slug: slug,
                    excerpt: post.excerpt || post.description || '',
                    content: post.content || post.description || '',
                    category: post.category || 'General',
                    author: post.author?.name || post.author || 'Admin',
                    image: post.image || post.heroImage || '',
                    status: 'published',
                    featured: post.featured || false,
                    metaTitle: post.title,
                    metaDescription: post.excerpt || '',
                });
            } else {
                console.log(`Skipping (exists): ${post.title}`);
            }
        }

        console.log('Migration complete');
        process.exit(0);
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

migrate();
