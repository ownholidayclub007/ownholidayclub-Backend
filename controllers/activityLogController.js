const ActivityLog = require('../models/ActivityLog');

exports.getActivityLogs = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', module = '' } = req.query;
        
        const query = {};
        
        if (module) {
            query.module = module;
        }
        
        if (search) {
            query.$or = [
                { user: { $regex: search, $options: 'i' } },
                { details: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await ActivityLog.countDocuments(query);
        const logs = await ActivityLog.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: logs,
            total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching activity logs',
            error: error.message
        });
    }
};
