const ActivityLog = require('../models/ActivityLog');

const logActivity = async ({ user, action, module, details, req }) => {
    try {
        const log = new ActivityLog({
            user: user || 'System',
            action,
            module,
            details,
            ipAddress: req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null,
            userAgent: req ? req.headers['user-agent'] : null
        });
        await log.save();
    } catch (error) {
        console.error('Error logging activity:', error);
    }
};

const getChangedFields = (oldObj, newObj, ignoreFields = ['_id', 'updatedAt', 'createdAt', '__v']) => {
    const changed = [];
    for (const key in newObj) {
        if (ignoreFields.includes(key)) continue;
        
        const oldVal = oldObj[key];
        const newVal = newObj[key];

        // Handle simple equality check
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            // Convert camelCase to Space Case for better readability
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            changed.push(label);
        }
    }
    return changed.length > 0 ? ` (${changed.join(', ')} changed)` : '';
};

module.exports = { logActivity, getChangedFields };
