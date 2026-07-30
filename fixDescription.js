const mongoose = require('mongoose');
const ExploreService = require('./models/ExploreService');
require('dotenv').config();

const uri = process.env.DATABASE_URL;

async function fixDescriptions() {
    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        const exploreData = await ExploreService.findOne().sort({ createdAt: -1 });
        if (!exploreData) {
            console.error('No ExploreService document found in DB');
            process.exit(1);
        }

        let updatedCount = 0;

        exploreData.services.forEach(card => {
            card.subServices.forEach(sub => {
                if (sub.description) {
                    // The description looks like: <p><span style="font-size:40px">They</span> imply...
                    // We want to replace <span style="font-size:40px">word</span> with just "word"
                    const original = sub.description;
                    const fixed = original.replace(/<span style="font-size:40px">(.*?)<\/span>/g, '$1');
                    
                    if (original !== fixed) {
                        sub.description = fixed;
                        updatedCount++;
                    }
                }
            });
        });

        if (updatedCount > 0) {
            await exploreData.save();
            console.log(`Successfully fixed ${updatedCount} descriptions!`);
        } else {
            console.log('No descriptions needed fixing.');
        }
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

fixDescriptions();
