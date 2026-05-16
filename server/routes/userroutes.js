const express = require('express');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { register, login, logout, Resetpasswordotp, resetpassword, isauth, userdata, changePassword } = require('../controller/user.js');
const userauth = require('../middleware/userauth.js');
const tenantBinder = require('../middleware/tenantBinder.js');
const Router = express.Router();
// REMOVED: const authenticateToken = require('../middleware/userauth') (It was a duplicate of userauth)
const Member = require('../models/member.js');

// --- HELPER: CENTRALIZED UPLOAD PATH ---
// This ensures images always go to /server/uploads (or /app/uploads in Docker)
// __dirname is '/app/routes', so '..' takes us to '/app'
const BASE_UPLOAD_PATH = path.join(__dirname, '../uploads');

// 1. Multer setup for profile photo
const memberStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // OLD: "uploads/members/"
    // NEW: Robust absolute path
    const uploadPath = path.join(BASE_UPLOAD_PATH, "members");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  },
});

// 2. Multer setup for medical reports
const medicalStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(BASE_UPLOAD_PATH, "members", "medicalReports");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  },
});

const memberUpload = multer({
  storage: memberStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedFields = ['profilePhoto', 'medicalReports'];
    if (!allowedFields.includes(file.fieldname)) {
      return cb(new Error(`Unexpected field: ${file.fieldname}`));
    }
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image and document files (PDF, DOC, DOCX) allowed"));
    }
  },
});

// 3. Multer for plan images
const planStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(BASE_UPLOAD_PATH, "plans");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "plan-" + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  },
});

const planUpload = multer({
  storage: planStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"));
    }
  },
});

// 4. Multer for staff photos
const staffStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(BASE_UPLOAD_PATH, "staff");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "staff-" + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  },
});

const staffUpload = multer({
  storage: staffStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedFields = ['profilePhoto', 'certificates'];
    if (!allowedFields.includes(file.fieldname)) {
      return cb(new Error(`Unexpected field: ${file.fieldname}`));
    }
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image and document files (PDF, DOC, DOCX) allowed"));
    }
  },
});

// 5. Multer setup for gym assets
const gymStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(BASE_UPLOAD_PATH, "gym");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  },
});

const gymUpload = multer({
  storage: gymStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"));
    }
  },
});

// --- Routes Definition ---
Router.post('/register', register);
Router.post('/login', login);
Router.post('/logout', logout);
Router.get('/isauth', userauth, isauth);
Router.get('/data', userauth, userdata);
Router.post('/resetotp', Resetpasswordotp);
Router.post('/resetpassword', resetpassword);
Router.post('/change-password', userauth, changePassword);

// Member Controllers
const {
  addMember, getMembers, getMemberById, updateMember, deleteMember,
  testMemberPhoneSearch, getNextMemberId, syncPendingStatus
} = require("../controller/member");

Router.get("/members/next-id", userauth, getNextMemberId);
Router.get("/members/actions/sync-pending", userauth, syncPendingStatus);
Router.post("/members/add", userauth, memberUpload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'medicalReports', maxCount: 10 }
]), tenantBinder, addMember);
Router.get("/members", userauth, getMembers);
Router.get("/members/:id", userauth, getMemberById);
Router.put("/members/:id", userauth, memberUpload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'medicalReports', maxCount: 10 }
]), tenantBinder, updateMember);
Router.delete("/members/:id", userauth, deleteMember);
Router.get("/members/debug/phone-search", userauth, testMemberPhoneSearch);

// Membership/Plan Controllers
const {
  addPlan, getPlans, getPlanById, updatePlan, deletePlan, togglePlanStatus
} = require("../controller/membership");

Router.post("/plans/add", userauth, planUpload.single("image"), tenantBinder, addPlan);
Router.get("/plans", userauth, getPlans);
Router.get("/plans/:id", userauth, getPlanById);
Router.put("/plans/:id", userauth, planUpload.single("image"), tenantBinder, updatePlan);
Router.delete("/plans/:id", userauth, deletePlan);
Router.patch("/plans/:id/toggle", userauth, togglePlanStatus);

// Lead Controllers
const {
  addLead, getLeads, getLeadById, updateLead, deleteLead,
  convertLeadToMember, updateLeadStatus, getLeadStats
} = require("../controller/lead");

// Subscription Controllers
const {
  addSubscription, getMemberSubscriptions, getAllSubscriptions, updateSubscription, deleteSubscription
} = require("../controller/subscription");

Router.post("/leads/add", userauth, addLead);
Router.get("/leads", userauth, getLeads);
Router.get("/leads/test", (req, res) => {
  res.json({ success: true, message: "Leads API is working", timestamp: new Date().toISOString() });
});
Router.get("/leads/stats", userauth, getLeadStats);
Router.get("/leads/:id", userauth, getLeadById);
Router.put("/leads/:id", userauth, updateLead);
Router.delete("/leads/:id", userauth, deleteLead);
Router.post("/leads/:id/convert", userauth, convertLeadToMember);
Router.patch("/leads/:id/status", userauth, updateLeadStatus);

Router.post("/subscriptions/add", userauth, addSubscription);
Router.get("/subscriptions", userauth, getAllSubscriptions);

Router.get("/subscriptions/member/:memberId", userauth, getMemberSubscriptions);
Router.put("/subscriptions/:id", userauth, updateSubscription);
Router.delete("/subscriptions/:id", userauth, deleteSubscription);

// Staff Controllers
const {
  addStaff, getStaff, getStaffById, updateStaff, deleteStaff,
  toggleStaffStatus, getStaffWithReferrals, getAssignedMembers, testStaffPhoneSearch
} = require("../controller/staff");

Router.post("/staff/add", userauth, staffUpload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'certificates', maxCount: 10 }
]), tenantBinder, addStaff);
Router.get("/staff", userauth, getStaff);
Router.get("/staff/:id", userauth, getStaffById);
Router.get("/staff/referrals", userauth, getStaffWithReferrals);
Router.get("/staff/:id/assigned-members", userauth, getAssignedMembers);
Router.put("/staff/:id", userauth, staffUpload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'certificates', maxCount: 10 }
]), tenantBinder, updateStaff);
Router.delete("/staff/:id", userauth, deleteStaff);
Router.patch("/staff/:id/toggle", userauth, toggleStaffStatus);
Router.get("/staff/debug/phone-search", userauth, testStaffPhoneSearch);

// Bill & Revenue Controllers
const billController = require('../controller/bill');
const revenueController = require('../controller/revenue');

// Replaced authenticateToken with userauth to match consistency
Router.get('/bills/overview', userauth, billController.getBillsOverview);
Router.get('/bills', userauth, billController.getBillsList);
Router.post('/bills', userauth, billController.createBill);
Router.get('/bills/:id', userauth, billController.getBillById);
Router.patch('/bills/:id/payment', userauth, billController.updateBillPayment);
Router.get('/bills/:id/pdf', userauth, billController.generateInvoicePDF);
Router.put('/bills/:id', userauth, billController.updateBill);
Router.delete('/bills/:id', userauth, billController.deleteBill);

Router.get('/revenue/summary', userauth, revenueController.getRevenueSummary);
Router.get('/revenue/trend', userauth, revenueController.getRevenueTrend);
Router.get('/revenue/analytics', userauth, revenueController.getRevenueAnalytics);

// Attendance Controllers
const { markAttendance, markPublicAttendance, getDailyAttendance, deleteAttendance, getStaffSalaryDetails, markStaffPaid, generateStaffPayslip } = require('../controller/attendance');

// Public attendance endpoint (NO AUTH) for QR-based self-service
Router.post('/public-check', markPublicAttendance);
Router.post('/check', userauth, tenantBinder, markAttendance);
Router.get('/attendance/staff/salary-details', userauth, getStaffSalaryDetails);
Router.post('/attendance/staff/pay', userauth, markStaffPaid);
Router.get('/attendance/staff/payslip/:id', userauth, generateStaffPayslip);
Router.get('/attendance/:type/:date', userauth, getDailyAttendance);
Router.delete('/attendance/:id', userauth, deleteAttendance);

// Gym Settings Controllers
const { getGymSettings, updateGymSettings, getPublicGymSettings, getAutomationToggles, updateAutomationToggles } = require('../controller/gymSettings');

Router.get('/settings/:gymId', getPublicGymSettings); // Public branding
Router.get('/settings', userauth, tenantBinder, getGymSettings);
Router.post('/settings', userauth, gymUpload.fields([
  { name: 'gymLogo', maxCount: 1 },
  { name: 'authorizerSignature', maxCount: 1 }
]), tenantBinder, updateGymSettings);

// Automation Toggle Routes
Router.get('/automation-toggles', userauth, tenantBinder, getAutomationToggles);
Router.put('/automation-toggles', userauth, tenantBinder, updateAutomationToggles);

module.exports = Router;