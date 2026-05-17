const express = require('express');
const router = express.Router();
const fitnessController = require('../controller/fitness');
const userauth = require('../middleware/userauth.js');

// Routes for fitness plans
router.get('/overview', userauth, fitnessController.getPlansOverview);
router.get('/list', userauth, fitnessController.getPlansList);
router.post('/create', userauth, fitnessController.createPlan);
router.get('/:id', userauth, fitnessController.getPlanById);
router.put('/:id', userauth, fitnessController.updatePlan);
router.delete('/:id', userauth, fitnessController.deletePlan);
router.post('/:id/enroll', userauth, fitnessController.enrollMember);
router.post('/generate-diet', userauth, fitnessController.generateDiet);
router.post('/generate-workout', userauth, fitnessController.generateWorkout);

module.exports = router;