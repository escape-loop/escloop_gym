// routes/revenueroutes.js
const express = require('express');
const router = express.Router();
const revenueController = require('../controller/revenue');
const userauth = require('../middleware/userauth');

// Apply authentication
router.use(userauth);

// Revenue Endpoints
router.get('/summary', revenueController.getRevenueSummary);
router.get('/trend', revenueController.getRevenueTrend);
router.get('/analytics', revenueController.getRevenueAnalytics);

module.exports = router;
