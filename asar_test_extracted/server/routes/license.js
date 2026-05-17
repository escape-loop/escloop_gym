const express = require('express');
const router = express.Router();
const userauth = require('../middleware/userauth');
const licenseController = require('../controller/license');

// Validate a specific license key
router.post('/validate', userauth, licenseController.validateLicense);

// Get the current plan and active features for the gym
router.get('/plan', userauth, licenseController.getPlan);
router.get('/features', userauth, licenseController.getPlan);

// Activate a 7-day trial for a given feature
router.post('/trial', userauth, licenseController.activateTrial);

module.exports = router;
