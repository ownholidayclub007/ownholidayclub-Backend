const mongoose = require('mongoose');
require('dotenv').config();
const CmsEntry = require('./models/CmsEntry');

async function testTiers() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to MongoDB');
        
        const membershipEntry = await CmsEntry.findOne({ collection: "membership", key: "tiers" });
        console.log('Tiers count:', membershipEntry?.data?.length || 0);
        
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

testTiers();
