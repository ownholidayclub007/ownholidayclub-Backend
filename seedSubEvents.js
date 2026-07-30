const mongoose = require('mongoose');
const fs = require('fs');
const ExploreService = require('./models/ExploreService');
require('dotenv').config();

const uri = process.env.DATABASE_URL;

const eventNameMapping = {
    'Parties': 'PRIVATE PARTIES',
    'Outing': 'OUTINGS',
    'Weddings': 'WEDDINGS',
    'Corporate Events': 'CORPORATE EVENTS'
};

async function seed() {
    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Read JSON file
        const rawData = fs.readFileSync('D:\\download\\sub_event.json', 'utf8');
        const jsonData = JSON.parse(rawData);

        // Find the table data
        const tableData = jsonData.find(item => item.type === 'table' && item.name === 'sub_event');
        if (!tableData || !tableData.data) {
            console.error('Could not find table data in JSON');
            process.exit(1);
        }

        const subEvents = tableData.data;

        // Fetch ExploreService
        const exploreData = await ExploreService.findOne().sort({ createdAt: -1 });
        if (!exploreData) {
            console.error('No ExploreService document found in DB');
            process.exit(1);
        }

        console.log(`Found ExploreService document. Populating ${subEvents.length} sub-events...`);

        // Loop through each sub-event and push it to the matching card
        subEvents.forEach((event, index) => {
            
            const mappedName = eventNameMapping[event.event_name] || event.event_name;

            const matchingCard = exploreData.services.find(card => 
                card.title.toLowerCase() === mappedName.toLowerCase()
            );

            if (matchingCard) {
                // Check if this sub-event already exists to avoid duplicates
                const exists = matchingCard.subServices.find(sub => sub.title === event.sub_event_name);
                
                if (!exists) {
                    matchingCard.subServices.push({
                        title: event.sub_event_name,
                        description: event.description,
                        image: `https://www.ownholidayclub.com/assets/images/event/${event.thumbnail_image}`,
                        altText: event.alt,
                        buttonText: 'PLAN THIS EVENT',
                        buttonUrl: '#',
                        order: index + 1
                    });
                    console.log(`Added: ${event.sub_event_name} -> ${matchingCard.title}`);
                } else {
                    console.log(`Skipped (already exists): ${event.sub_event_name}`);
                }
            } else {
                console.log(`Warning: Could not find matching card for event_name: ${event.event_name} (mapped as: ${mappedName})`);
            }
        });

        await exploreData.save();
        console.log('Successfully saved to database!');
        
    } catch (err) {
        console.error('Error seeding data:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

seed();
