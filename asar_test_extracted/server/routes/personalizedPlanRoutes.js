const express = require('express');
const router = express.Router();
const personalizedPlanController = require('../controller/personalizedPlan');
const userauth = require('../middleware/userauth.js');

// Routes for personalized plans
router.post('/save', userauth, personalizedPlanController.savePlan);
router.get('/list', userauth, personalizedPlanController.getAllPlans);
router.get('/:planId', userauth, personalizedPlanController.getPlanById);
router.put('/:planId', userauth, personalizedPlanController.updatePlan);
router.put('/:planId/payment', userauth, personalizedPlanController.updatePayment);
router.delete('/:planId', userauth, personalizedPlanController.deletePlan);

module.exports = router;