// controllers/fitnessPlanController.js
const FitnessPlan = require('../models/fitness');
const { generatePlanId } = require('../utils/planUtils');

exports.getPlansOverview = async (req, res) => {
  try {
    const stats = await FitnessPlan.aggregate([
      { $match: { gymId: req.user.gymId } },
      {
        $group: {
          _id: null,
          totalPlans: { $sum: 1 },
          activePlans: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalRevenue: { $sum: { $multiply: ['$price', '$membersEnrolled'] } },
          totalEnrolled: { $sum: '$membersEnrolled' }
        }
      }
    ]);

    const overview = stats[0] || {};
    res.json({
      totalPlans: overview.totalPlans || 0,
      activePlans: overview.activePlans || 0,
      totalRevenue: overview.totalRevenue || 0,
      totalEnrolled: overview.totalEnrolled || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPlansList = async (req, res) => {
  try {
    const { page = 1, limit = 12, search, category, status } = req.query;
    const query = { gymId: req.user.gymId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { planId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category && category !== 'all') query.category = category;
    if (status && status !== 'all') query.status = status;

    const plans = await FitnessPlan.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await FitnessPlan.countDocuments(query);

    res.json({
      plans,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const planData = {
      ...req.body,
      gymId: req.user.gymId,
      planId: generatePlanId(),
      membersEnrolled: 0
    };

    const plan = await FitnessPlan.create(planData);
    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPlanById = async (req, res) => {
  try {
    const plan = await FitnessPlan.findOne({ planId: req.params.id, gymId: req.user.gymId });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const plan = await FitnessPlan.findOneAndUpdate(
      { planId: req.params.id, gymId: req.user.gymId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const plan = await FitnessPlan.findOneAndDelete({ planId: req.params.id, gymId: req.user.gymId });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.enrollMember = async (req, res) => {
  try {
    const { memberId } = req.body;
    const plan = await FitnessPlan.findOneAndUpdate(
      { planId: req.params.id, gymId: req.user.gymId },
      { $inc: { membersEnrolled: 1 } },
      { new: true }
    );

    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Also track in member-plan subscription (separate model)
    res.json({ message: 'Member enrolled successfully', plan });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const { generateDietPlan, generateWorkoutPlan } = require('../services/fitnessService');

exports.generateDiet = async (req, res) => {
  try {
    const tdee = parseFloat(req.body.USER_TDEE || 2000);
    const goal = req.body.USER_GOAL || 'Maintenance';
    const isVeg = Boolean(req.body.USER_IS_VEG);

    const plan = generateDietPlan(tdee, goal, isVeg);
    res.json(plan);
  } catch (error) {
    console.error('Error generating diet:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.generateWorkout = async (req, res) => {
  try {
    const gender = req.body.USER_GENDER || 'Unisex';
    const goal = req.body.USER_GOAL || 'General';
    const days = parseInt(req.body.DAYS_PER_WEEK || 4);

    const plan = generateWorkoutPlan(gender, goal, days);
    res.json(plan);
  } catch (error) {
    console.error('Error generating workout:', error);
    res.status(500).json({ error: error.message });
  }
};
