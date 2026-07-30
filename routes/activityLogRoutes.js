const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityLogController');
const requireCmsAdmin = require('../middleware/requireCmsAdmin');

router.get('/', requireCmsAdmin, getActivityLogs);

module.exports = router;
