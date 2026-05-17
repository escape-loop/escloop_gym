const MembershipPlanModel = require("../models/membership");
const SubscriptionModel = require("../models/subscription"); // Import SubscriptionModel
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cache = require('../services/cacheService');

// Add new plan
const addPlan = async (req, res) => {
  try {
    const planData = req.body;

    // Validate required fields
    const required = ["name", "type", "price", "durationDays"];
    const missing = required.filter((field) => !planData[field]);
    if (missing.length > 0) {
      return res.json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    // Check name uniqueness WITHIN THE SAME GYM
    const existing = await MembershipPlanModel.findOne({
      gymId: req.user.gymId,
      name: { $regex: new RegExp(planData.name, "i") },
    });
    if (existing) {
      return res.json({
        success: false,
        message: "Plan name already exists",
      });
    }

    // Handle image upload
    let image = "";
    if (req.file) {
      image = `/uploads/plans/${req.file.filename}`;
    }

    // Normalize features (frontend may send JSON string)
    let features = planData.features || [];
    if (typeof features === 'string') {
      try {
        features = JSON.parse(features);
      } catch (e) {
        // leave as single-string inside array
        features = [features];
      }
    }

    const newPlan = new MembershipPlanModel({
      ...planData,
      gymId: req.user.gymId,
      features,
      image,
    });

    await newPlan.save();

    // Invalidate plans cache
    await cache.invalidatePlans();

    res.json({
      success: true,
      message: "Membership plan created successfully",
      plan: {
        _id: newPlan._id,
        name: newPlan.name,
        planCode: newPlan.planCode,
        type: newPlan.type,
        price: newPlan.price,
        status: newPlan.status,
        offerValid: newPlan.offerValid || null,
      },
    });
  } catch (error) {
    console.error("Add plan error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all plans (cache-all, filter in Node.js)
const getPlans = async (req, res) => {
  try {
    const { status = "Active", type, search, page = 1, limit = 20 } = req.query;

    // Fetch plans specifically for this gym
    const allPlans = await cache.getOrSet(
      cache.KEYS.PLANS_ALL, // Cache key is already gym-prefixed thanks to userauth + tenantStorage
      async () => {
        const gymId = req.user.gymId;
        const plans = await MembershipPlanModel.find({ gymId }).sort({ createdAt: -1 }).select("-__v").lean();
        const planNames = plans.map(p => p.name);

        const memberCounts = await SubscriptionModel.aggregate([
          { $match: { gymId, packageName: { $in: planNames } } },
          { $group: { _id: { packageName: "$packageName", memberId: "$memberId" } } },
          { $group: { _id: "$_id.packageName", count: { $sum: 1 } } }
        ]);

        const countMap = {};
        memberCounts.forEach(c => { countMap[c._id] = c.count; });

        return plans.map(p => ({
          ...p,
          offerValid: p.offerValid ?? "",
          memberCount: countMap[p.name] || 0
        }));
      },
      cache.DAY
    );

    // Filter in Node.js memory
    let filtered = allPlans;
    if (status !== 'all') filtered = filtered.filter(p => p.status === status);
    if (type) filtered = filtered.filter(p => p.type === type);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const lim = parseInt(limit);
    const pg = parseInt(page);
    const plans = filtered.slice((pg - 1) * lim, pg * lim);

    res.json({
      success: true,
      plans,
      pagination: { page: pg, limit: lim, total, pages: Math.ceil(total / lim) },
    });
  } catch (error) {
    console.error('getPlans error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single plan
const getPlanById = async (req, res) => {
  try {
    const plan = await MembershipPlanModel.findOne({ _id: req.params.id, gymId: req.user.gymId });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }
    res.json({ success: true, plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update plan
const updatePlan = async (req, res) => {
  try {
    const plan = await MembershipPlanModel.findOne({ _id: req.params.id, gymId: req.user.gymId });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const updateData = req.body;
    // Normalize features if provided
    if (updateData.features && typeof updateData.features === 'string') {
      try {
        updateData.features = JSON.parse(updateData.features);
      } catch (e) {
        updateData.features = [updateData.features];
      }
    }
    Object.assign(plan, updateData);

    // Handle image update
    if (req.file) {
      // Delete old image if exists
      if (plan.image) {
        const oldImagePath = path.join(__dirname, '..', plan.image);
        if (fs.existsSync(oldImagePath) && fs.lstatSync(oldImagePath).isFile()) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (err) {
            console.error("Error deleting old plan image:", err);
          }
        }
      }
      plan.image = `/uploads/plans/${req.file.filename}`;
    }

    await plan.save();

    // Invalidate plans cache
    await cache.invalidatePlans();

    res.json({
      success: true,
      message: "Plan updated successfully",
      plan,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete plan
const deletePlan = async (req, res) => {
  try {
    const plan = await MembershipPlanModel.findOne({ _id: req.params.id, gymId: req.user.gymId });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const safeUnlink = (filePath) => {
      try {
        if (filePath && typeof filePath === 'string' && filePath.length > 1) {
          const fullPath = path.join(__dirname, '..', filePath);
          if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
            fs.unlinkSync(fullPath);
          }
        }
      } catch (e) { console.error('Safe unlink error:', e); }
    };

    // Delete image if exists
    if (plan.image) safeUnlink(plan.image);

    await MembershipPlanModel.findOneAndDelete({ _id: req.params.id, gymId: req.user.gymId });

    // Invalidate plans cache
    await cache.invalidatePlans();

    res.json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Activate/deactivate plan
const togglePlanStatus = async (req, res) => {
  try {
    const plan = await MembershipPlanModel.findOne({ _id: req.params.id, gymId: req.user.gymId });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    plan.status = plan.status === "Active" ? "Inactive" : "Active";
    await plan.save();

    // Invalidate plans cache
    await cache.invalidatePlans();

    res.json({
      success: true,
      message: `Plan ${plan.status.toLowerCase()}d`,
      status: plan.status,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Set plan status to inactive (for expired offers)
const expirePlan = async (req, res) => {
  try {
    console.log('Expire plan request for ID:', req.params.id);
    const plan = await MembershipPlanModel.findOne({ _id: req.params.id, gymId: req.user.gymId });
    if (!plan) {
      console.log('Plan not found');
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    console.log('Found plan:', plan.name, 'Status:', plan.status);

    // Only update if status is currently Active
    if (plan.status === "Active") {
      console.log('Updating plan status to Inactive');
      plan.status = "Inactive";
      await plan.save();

      console.log('Plan updated successfully');
      res.json({
        success: true,
        message: "Plan offer expired, status set to Inactive",
        status: plan.status,
      });
    } else {
      console.log('Plan was already inactive');
      res.json({
        success: true,
        message: "Plan was already inactive",
        status: plan.status,
      });
    }
  } catch (error) {
    console.error('Error in expirePlan:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Test endpoint to check database connection and data
const testPlans = async (req, res) => {
  try {
    const allPlans = await MembershipPlanModel.find({ gymId: req.user.gymId });
    console.log('All plans in database:', allPlans);
    res.json({
      success: true,
      message: 'Database connection working',
      totalPlans: allPlans.length,
      plans: allPlans
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addPlan,
  getPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  togglePlanStatus,
  expirePlan,
  testPlans,
};