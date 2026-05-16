// utils/planUtils.js
const FitnessPlan = require('../models/fitness');
const PersonalizedPlan = require('../models/personalizedPlan');
const tenantStorage = require('../middleware/tenantContext');

exports.generatePlanId = async () => {
  const date = new Date();
  const today = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  let random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  let planId = `PLAN${today}${random}`;
  
  const gymId = tenantStorage.getStore();
  let exists = await FitnessPlan.findOne({ gymId, planId });
  
  while (exists) {
    random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    planId = `PLAN${today}${random}`;
    exists = await FitnessPlan.findOne({ gymId, planId });
  }
  
  return planId;
};

exports.generatePersonalizedPlanId = async () => {
  const date = new Date();
  const today = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  let random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  let planId = `PPLAN${today}${random}`;
  
  const gymId = tenantStorage.getStore();
  let exists = await PersonalizedPlan.findOne({ gymId, planId });
  
  while (exists) {
    random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    planId = `PPLAN${today}${random}`;
    exists = await PersonalizedPlan.findOne({ gymId, planId });
  }

  return planId;
};