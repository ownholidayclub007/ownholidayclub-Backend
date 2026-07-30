const mongoose = require('mongoose');

async function checkTestnet() {
    try {
        const testnetUrl = "mongodb+srv://ownholidayclub_db_user:aHp2FqxbyXiMV0zQ@cluster0.6r4ejbd.mongodb.net/ownholidayclub_testnet";
        await mongoose.connect(testnetUrl);
        console.log('Connected to Testnet MongoDB');
        
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`Count for ${col.name}: ${count}`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkTestnet();
