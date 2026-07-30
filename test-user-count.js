const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function testUserCount() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to MongoDB');
        
        const totalUsers = await User.countDocuments();
        console.log('Total Users:', totalUsers);
        
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

testUserCount();
