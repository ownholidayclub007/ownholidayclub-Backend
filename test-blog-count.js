const mongoose = require('mongoose');
require('dotenv').config();
const Blog = require('./models/Blog');

async function test() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to MongoDB');
        
        const totalBlogs = await Blog.countDocuments();
        console.log('totalBlogs (countDocuments):', totalBlogs);
        
        const blogs = await Blog.find();
        console.log('blogs.length (find):', blogs.length);
        
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

test();
