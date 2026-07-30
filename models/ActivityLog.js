const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
    user: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: ['Created', 'Updated', 'Deleted', 'Logged In', 'Logged Out']
    },
    module: {
        type: String,
        required: true
    },
    details: {
        type: String,
        required: true
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
