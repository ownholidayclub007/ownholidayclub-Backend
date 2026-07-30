const mongoose = require('mongoose');
require('dotenv').config();
const Blog = require('./models/Blog');
const ContactEnquiry = require('./models/ContactEnquiry');
const CmsEntry = require('./models/CmsEntry');

async function check() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to MongoDB');
        
        const blogCount = await Blog.countDocuments();
        const contactCount = await ContactEnquiry.countDocuments();
        const cmsCount = await CmsEntry.countDocuments();
        
        const blogs = await Blog.find({}, { title: 1 }).limit(20);
        
        console.log('Blog Count:', blogCount);
        console.log('Contact Enquiry Count:', contactCount);
        console.log('Cms Entry Count:', cmsCount);
        console.log('Blogs (first 20):', blogs.length);
        
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

check();
