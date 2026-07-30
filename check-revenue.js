const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function checkRevenue() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to MongoDB');
        
        const users = await User.find({ "payments.status": "captured" });
        users.forEach(u => {
            u.payments.forEach(p => {
                if (p.status === "captured") {
                    console.log(`User: ${u._id}, Payment: ${p.amount}, PaidAt: ${p.paidAt}`);
                }
            });
        });
        
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkRevenue();
