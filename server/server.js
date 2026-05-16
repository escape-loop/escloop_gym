process.env.TZ = 'Asia/Kolkata';
const helmet = require('helmet');
const os = require('os');
// Helmet installed - triggering restart
const express = require('express');
const app = express();
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const cors = require('cors');
const cookieparser = require('cookie-parser');
const Router = require('./routes/userroutes.js');
const plansRouter = require('./routes/plansroutes.js');
const expenseRouter = require('./routes/expenseroutes.js');
const fitnessRouter = require('./routes/fitnessroutes.js');
const equipmentRouter = require('./routes/equipmentroutes.js');
const revenueRouter = require('./routes/revenueroutes.js'); // Import revenue routes
const personalizedPlanRouter = require('./routes/personalizedPlanRoutes.js');
const licenseRouter = require('./routes/license.js');
const branchRouter = require('./routes/branchRoutes.js');
const whatsappRouter = require('./routes/whatsappRoutes.js');
const { connectDB } = require('./database/db.js');
const path = require('path');
const fs = require('fs');
const { runChurnAnalysis } = require('./services/churnService.js');
const { runExpiryReminderAutomation, runLeadFollowUpAutomation, runBirthdayReminderAutomation, runAttendanceReminderAutomation } = require('./services/automationService.js');
const { markStaffPaid } = require('./controller/attendance.js');
const { loadFitnessData } = require('./services/fitnessService.js');
const cron = require('node-cron');

const { connectRedis } = require('./config/redis.js');
const cache = require('./services/cacheService.js');
const tenantStorage = require('./middleware/tenantContext');
const userauth = require('./middleware/userauth.js');
const connectionManager = require('./services/connectionManager.js');
const gymUriCache = require('./services/gymUriCache.js');

connectDB().then(async () => {
  // Load Fitness CSV data on startup
  loadFitnessData();
  // Warm up the gym URI lookup cache
  await gymUriCache.warmCache();
  // Warm up dynamic DB connections per URI
  await connectionManager.warmConnections();
});

// Connect Redis (non-blocking — server works fine without it)
connectRedis();

app.get('/api/local-ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  let ip = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ip = iface.address;
        break;
      }
    }
  }
  res.json({ ip });
});

const PORT = process.env.PORT || 5000;
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    // Allow localhost, local network IPs, and common tunnel services
    const isLocal = origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.match(/^http:\/\/(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[0-1]))/);

    const isTunnel = origin.includes('.ngrok') ||
      origin.includes('.localtunnel.me') ||
      origin.includes('.trycloudflare.com');

    if (isLocal || isTunnel || origin === process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(null, [process.env.FRONTEND_URL]);
    }
  },
  credentials: true
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(cookieparser())

// Serve static files from uploads directory (use absolute path)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from public directory for invoices and other public assets
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use('/gym', Router)

// Direct routes for plans (without /gym prefix)
app.use('/plans', plansRouter);

// Direct routes for expenses (with /gym prefix to match frontend configuration)
app.use('/gym/expenses', expenseRouter);
app.use('/gym/fitness', fitnessRouter);
app.use('/gym/equipment', equipmentRouter);
app.use('/gym/revenue', revenueRouter); // Mount revenue routes
app.use('/gym/personalized-plans', personalizedPlanRouter); // Mount personalized plan routes
app.use('/api/license', licenseRouter);
app.use('/api/branch', branchRouter);
app.use('/gym/whatsapp', whatsappRouter);

// ========================================
// GYM SETTINGS ROUTES
// ========================================
const multer = require('multer');
const GymSettings = require('./models/GymSettings.js');

// Multer setup for gym settings (logo and signature)
const gymSettingsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads', 'gym');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const gymSettingsUpload = multer({
  storage: gymSettingsStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Gym settings routes moved to userroutes.js to avoid duplication and ensure isolation.

// Endpoint to list files in uploads/plans directory
app.get('/api/plans/files', userauth, (req, res) => {
  const plansDir = path.join(__dirname, 'uploads', 'plans');
  fs.readdir(plansDir, (err, files) => {
    if (err) {
      console.error('Error reading plans directory:', err);
      return res.status(500).json({ success: false, message: 'Error reading directory' });
    }
    res.json({ success: true, files });
  });
});

// ========================================
// NOTIFICATIONS & REMINDERS ENDPOINTS
// ========================================

// Endpoint to get members with pending payments
app.get('/gym/notifications/pending-payments', userauth, async (req, res) => {
  try {
    const membersWithPending = await cache.getOrSet(
      cache.KEYS.PENDING_PAYMENTS,
      async () => {
        const SubscriptionModel = require('./models/subscription.js');
        const gymId = req.user.gymId;
        const pendingSubscriptions = await SubscriptionModel.find({
          gymId,
          balanceAmount: { $gt: 0 }
        })
          .populate('memberId', 'fullName balanceAmount phone email profilePhoto memberId')
          .sort({ balanceAmount: -1 });

        return pendingSubscriptions.map(sub => {
          const member = sub.memberId || {};
          return {
            _id: sub._id,
            memberId: member.memberId,
            fullName: member.fullName,
            phone: member.phone,
            email: member.email,
            profilePhoto: member.profilePhoto,
            packageName: sub.packageName,
            membershipType: sub.membershipType,
            amount: sub.amount,
            netPayable: sub.netPayable,
            balanceAmount: sub.balanceAmount,
            discountType: sub.discountType,
            discountValue: sub.discountValue
          };
        });
      },
      cache.HOUR // 1 hour TTL
    );

    res.json({ success: true, members: membersWithPending });
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending payments' });
  }
});

// Endpoint to get members expiring within next 7 days
app.get('/gym/notifications/expiring-soon', userauth, async (req, res) => {
  try {
    const SubscriptionModel = require('./models/subscription.js');
    const gymId = req.user.gymId;

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999); // End of day 7 days from now

    // 1. Get subscriptions ending within next 7 days
    const expiringSubscriptions = await SubscriptionModel.find({
      gymId,
      endDate: { $gte: now, $lte: sevenDaysLater },
      status: { $in: ['Active', 'Pending'] }
    })
      .populate('memberId', 'fullName phone email profilePhoto memberId')
      .sort({ endDate: 1 });

    // 2. Filter out members who have a newer active plan and calculate days left
    const filteredMembers = await Promise.all(expiringSubscriptions.map(async (sub) => {
      const member = sub.memberId;
      if (!member) return null;

      // Check if there's any other subscription for this member that ends AFTER this one
      const newerPlan = await SubscriptionModel.findOne({
        gymId,
        memberId: member._id,
        status: { $in: ['Active', 'Pending'] },
        endDate: { $gt: sub.endDate }
      });

      if (newerPlan) return null; // Hide if they have a newer plan

      // Calculate days left
      const diffTime = sub.endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        _id: sub._id,
        memberId: member.memberId,
        fullName: member.fullName,
        phone: member.phone,
        email: member.email,
        profilePhoto: member.profilePhoto,
        packageName: sub.packageName,
        membershipType: sub.membershipType,
        amount: sub.amount,
        endDate: sub.endDate,
        expiryStatus: diffDays === 0 ? "Expires Today" : `Expires in ${diffDays} day${diffDays > 1 ? 's' : ''}`,
        daysLeft: diffDays
      };
    }));

    res.json({ success: true, members: filteredMembers.filter(m => m !== null) });
  } catch (error) {
    console.error('Error fetching expiring members:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch expiring members' });
  }
});

// Endpoint to get members with finished subscriptions (expired)
app.get('/gym/notifications/subscription-finished', userauth, async (req, res) => {
  try {
    const SubscriptionModel = require('./models/subscription.js');
    const gymId = req.user.gymId;
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    // 1. Get subscriptions whose endDate is in the past
    const finishedSubscriptions = await SubscriptionModel.find({
      gymId,
      endDate: { $lt: now },
      status: { $ne: 'Cancelled' }
    })
      .populate('memberId', 'fullName phone email profilePhoto memberId')
      .sort({ endDate: -1 })
      .limit(100);

    // 2. Filter out members who have an active future plan
    const filteredMembers = await Promise.all(finishedSubscriptions.map(async (sub) => {
      const member = sub.memberId;
      if (!member) return null;

      const activePlan = await SubscriptionModel.findOne({
        gymId,
        memberId: member._id,
        status: { $in: ['Active', 'Pending'] },
        endDate: { $gte: now }
      });

      if (activePlan) return null; // Hide if they have an active plan now

      return {
        _id: sub._id,
        memberId: member.memberId,
        fullName: member.fullName,
        phone: member.phone,
        email: member.email,
        profilePhoto: member.profilePhoto,
        packageName: sub.packageName,
        membershipType: sub.membershipType,
        amount: sub.amount,
        endDate: sub.endDate,
        expiryStatus: "Expired",
        daysLeft: -1
      };
    }));

    res.json({ success: true, members: filteredMembers.filter(m => m !== null) });
  } catch (error) {
    console.error('Error fetching subscription finished members:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subscription finished members' });
  }
});

// Endpoint to get members with birthdays today
app.get('/gym/notifications/birthdays-today', userauth, async (req, res) => {
  try {
    const MemberModel = require('./models/member.js');
    const gymId = req.user.gymId;

    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate(); // 1-31

    // Use aggregation to extract month and day from dob field
    const birthdayMembers = await MemberModel.aggregate([
      { $match: { gymId } },
      {
        $addFields: {
          dobMonth: { $month: "$dob" },
          dobDay: { $dayOfMonth: "$dob" }
        }
      },
      {
        $match: {
          dobMonth: currentMonth,
          dobDay: currentDay,
          dob: { $ne: null }
        }
      },
      {
        $project: {
          memberId: 1,
          fullName: 1,
          dob: 1,
          phone: 1,
          email: 1
        }
      },
      {
        $sort: { fullName: 1 }
      }
    ]);

    res.json({ success: true, members: birthdayMembers });
  } catch (error) {
    console.error('Error fetching birthday members:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch birthday members' });
  }
});

// Endpoint to send birthday reminder webhook for a specific member
app.post('/gym/notifications/send-birthday-reminder/:id', userauth, async (req, res) => {
  try {
    const MemberModel = require('./models/member.js');
    const { id } = req.params;
    const gymId = req.user.gymId;

    const member = await MemberModel.findOne({ _id: id, gymId });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Send birthday reminder webhook
    const GymSettings = require('./models/GymSettings.js');
    const gymSettings = await GymSettings.findOne();
    const gymName = gymSettings ? gymSettings.gymName : 'Stretch Fitness Club';

    await sendBirthdayReminderWebhook(member, gymName);

    // Track that reminder was sent to prevent duplicates
    member.lastBirthdayReminderDate = new Date();
    await member.save();

    res.json({ success: true, message: 'Birthday reminder webhook sent successfully' });
  } catch (error) {
    console.error('Error sending birthday reminder webhook:', error);
    res.status(500).json({ success: false, message: 'Failed to send birthday reminder webhook' });
  }
});

// Endpoint to get urgent lead follow-ups
app.get('/gym/notifications/urgent-followups', userauth, async (req, res) => {
  try {
    const LeadModel = require('./models/lead.js');
    const gymId = req.user.gymId;

    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);

    const urgentLeads = await LeadModel.find({
      gymId,
      nextFollowUpDate: { $lte: nextWeek },
      status: { $nin: ['converted', 'lost'] }
    })
      .select('name phone email source lastContactedDate nextFollowUpDate status interestLevel interestedService')
      .sort({ nextFollowUpDate: 1 }); // Oldest first

    res.json({ success: true, leads: urgentLeads });
  } catch (error) {
    console.error('Error fetching urgent followups:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch urgent followups' });
  }
});

// Endpoint to mark lead as contacted
app.post('/gym/notifications/lead-contacted/:id', userauth, async (req, res) => {
  try {
    const LeadModel = require('./models/lead.js');
    const { id } = req.params;
    const { nextFollowUpDate, status } = req.body;
    const gymId = req.user.gymId;

    const lead = await LeadModel.findOne({ _id: id, gymId });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const today = new Date();
    lead.lastContactedDate = today;

    // Update status if provided, otherwise set to 'contacted' if it was 'new'
    if (status) {
      lead.status = status;
    } else if (lead.status === 'new') {
      lead.status = 'contacted';
    }

    // Update next follow-up date if provided
    if (nextFollowUpDate) {
      lead.nextFollowUpDate = new Date(nextFollowUpDate);
    }

    await lead.save();

    res.json({ success: true, message: 'Lead status updated', lead });
  } catch (error) {
    console.error('Error marking lead as contacted:', error);
    res.status(500).json({ success: false, message: 'Failed to mark lead as contacted' });
  }
});

// Endpoint to get equipment maintenance schedule
app.get('/gym/notifications/equipment-maintenance', userauth, async (req, res) => {
  try {
    const EquipmentModel = require('./models/equipment.js');
    const gymId = req.user.gymId;

    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const equipmentList = await EquipmentModel.find({
      gymId,
      maintenanceSchedule: { $lte: nextWeek }
    })
      .select('name category brand model serialNumbers maintenanceSchedule lastServiced statuses maintenanceDays serviceContactNumber')
      .sort({ maintenanceSchedule: 1 }); // Soonest first

    res.json({ success: true, equipment: equipmentList });
  } catch (error) {
    console.error('Error fetching equipment maintenance:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch equipment maintenance' });
  }
});

// Endpoint to mark equipment maintenance as done
app.post('/gym/notifications/maintenance-done/:id', userauth, async (req, res) => {
  try {
    const EquipmentModel = require('./models/equipment.js');
    const { id } = req.params;
    const gymId = req.user.gymId;

    const equipment = await EquipmentModel.findOne({ _id: id, gymId });
    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
    }

    const today = new Date();
    const maintenanceDays = equipment.maintenanceDays || 30; // Default to 30 if not set
    const nextMaintenance = new Date();
    nextMaintenance.setDate(today.getDate() + maintenanceDays);

    equipment.lastServiced = today;
    equipment.maintenanceSchedule = nextMaintenance;

    // Set all statuses to available after maintenance
    if (equipment.statuses && equipment.statuses.length > 0) {
      equipment.statuses = equipment.statuses.map(() => 'available');
    }

    await equipment.save();

    res.json({ success: true, message: 'Maintenance recorded and schedule updated' });
  } catch (error) {
    console.error('Error marking maintenance as done:', error);
    res.status(500).json({ success: false, message: 'Failed to mark maintenance as done' });
  }
});
app.get('/gym/notifications/attendance-alerts', userauth, async (req, res) => {
  try {
    const MemberModel = require('./models/member.js');
    const AttendanceModel = require('./models/attendance.js');
    const gymId = req.user.gymId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(today.getDate() - 5);

    // 1. Get all active & pending members
    const relevantMembers = await MemberModel.find({
      gymId,
      status: { $in: ['Active', 'Pending'] }
    }).select('memberId fullName phone profilePhoto membershipType packageName endDate lastAttendanceCalledDate');

    // 2. Get the last present attendance record for each member
    const absentMembers = await Promise.all(relevantMembers.map(async (m) => {
      const lastAttendance = await AttendanceModel.findOne({
        gymId,
        entityId: m.memberId,
        type: 'member',
        status: 'present'
      }).sort({ date: -1 });

      let daysAbsent = 0;
      if (lastAttendance) {
        const lastDate = new Date(lastAttendance.date);
        const timeDiff = today.getTime() - lastDate.getTime();
        daysAbsent = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      } else {
        // If no attendance recorded, calculate from startDate
        const startDate = m.startDate ? new Date(m.startDate) : new Date(m.createdAt);
        const timeDiff = today.getTime() - startDate.getTime();
        daysAbsent = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      }

      // If they haven't been called in last 5 days AND absent for 5+ days
      if (daysAbsent >= 5) {
        if (m.lastAttendanceCalledDate) {
          const lastCall = new Date(m.lastAttendanceCalledDate);
          const diffTime = Math.abs(today - lastCall);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 5) return null;
        }

        return {
          _id: m._id,
          memberId: m.memberId,
          fullName: m.fullName,
          phone: m.phone,
          profilePhoto: m.profilePhoto,
          membershipType: m.membershipType,
          packageName: m.packageName,
          endDate: m.endDate,
          type: 'Absence Streak',
          daysAbsent: daysAbsent
        };
      }
      return null;
    }));

    res.json({ success: true, members: absentMembers.filter(m => m !== null) });
  } catch (error) {
    console.error('Error fetching attendance alerts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance alerts' });
  }
});

// Endpoint to mark member as called for attendance
app.post('/gym/notifications/attendance-called/:id', userauth, async (req, res) => {
  try {
    const MemberModel = require('./models/member.js');
    const { id } = req.params;
    const { daysAbsent } = req.body; // Optional: days absent from frontend
    const gymId = req.user.gymId;

    const member = await MemberModel.findOne({ _id: id, gymId });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    member.lastAttendanceCalledDate = new Date();
    await member.save();

    // Send attendance reminder webhook for 5+ days absent members
    if (daysAbsent && daysAbsent >= 5) {
      const GymSettings = require('./models/GymSettings.js');
      const gymSettings = await GymSettings.findOne();
      const gymName = gymSettings ? gymSettings.gymName : 'Stretch Fitness Club';

      sendAttendanceReminderWebhook(member, daysAbsent, gymName);
    }

    res.json({ success: true, message: 'Attendance call recorded' });
  } catch (error) {
    console.error('Error marking attendance as called:', error);
    res.status(500).json({ success: false, message: 'Failed to record attendance call' });
  }
});

// Endpoint to get salary alerts with detailed metrics for the previous month
app.get('/gym/notifications/salary-alerts', userauth, async (req, res) => {
  try {
    const StaffModel = require('./models/staff.js');
    const StaffSalaryModel = require('./models/staffSalary.js');
    const AttendanceModel = require('./models/attendance.js');
    const gymId = req.user.gymId;

    const today = new Date();
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthStr = prevMonthDate.getFullYear() + '-' + (prevMonthDate.getMonth() + 1).toString().padStart(2, '0');
    const [year, month] = prevMonthStr.split('-');

    // 1. Get all active staff
    const activeStaff = await StaffModel.find({ gymId, status: 'Active' })
      .select('staffId fullName salary role department phone profilePhoto workDays');

    // 2. Get salary records for previous month
    const salaryRecords = await StaffSalaryModel.find({ gymId, month: prevMonthStr });
    const salaryStatusMap = {};
    salaryRecords.forEach(r => { salaryStatusMap[r.staffId] = r; });

    // 3. Get attendance for calculation
    const startOfMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    const attendanceRecords = await AttendanceModel.find({
      gymId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
      status: 'present'
    });

    const attendanceMap = {};
    attendanceRecords.forEach(a => {
      attendanceMap[a.entityId] = (attendanceMap[a.entityId] || 0) + 1;
    });

    // 4. Calculate metrics for unpaid staff
    const unpaidStaff = activeStaff.filter(s => !salaryStatusMap[s.staffId] || salaryStatusMap[s.staffId].status !== 'Paid')
      .map(s => {
        const record = salaryStatusMap[s.staffId];

        // Simple calculation logic (similar to attendance controller)
        const daysInMonth = new Date(year, month, 0).getDate();
        // Assume all days are potential work days for now or use staff workDays
        // For accurate count, we'd need gym activity check, but for notifications, we'll simplify
        const totalWorkingDays = record ? record.totalWorkingDays : 26; // Fallback to 26
        const presentDays = record ? record.presentDays : (attendanceMap[s.staffId] || 0);
        const absentDays = record ? record.absentDays : Math.max(0, totalWorkingDays - presentDays);

        // Calculate amount proportional to attendance
        const finalAmount = record ? record.finalAmount : Math.round((s.salary / totalWorkingDays) * presentDays);

        return {
          _id: s._id,
          staffId: s.staffId,
          fullName: s.fullName,
          phone: s.phone,
          profilePhoto: s.profilePhoto,
          month: prevMonthStr,
          year: year,
          monthName: prevMonthDate.toLocaleString('default', { month: 'long' }),
          salary: s.salary,
          finalAmount,
          totalWorkingDays,
          presentDays,
          absentDays,
          role: s.role,
          department: s.department,
          status: record ? record.status : 'Unpaid'
        };
      });

    res.json({ success: true, month: prevMonthStr, staff: unpaidStaff });
  } catch (error) {
    console.error('Error fetching salary alerts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch salary alerts' });
  }
});

// Endpoint to mark staff salary as paid and record in expenditure
app.post('/gym/notifications/salary-paid', userauth, markStaffPaid);

const requireFeature = require('./middleware/planGate');

// Endpoint to get high churn risk members
app.get('/gym/api/insights/high-risk', userauth, requireFeature('aiBusinessInsights'), async (req, res) => {
  try {
    const MemberModel = require('./models/member.js');
    const gymId = req.user.gymId;

    // Fetch members with High Risk status or score > 0.75
    // Sort by highest risk score first
    const highRiskMembers = await MemberModel.find({
      gymId,
      $or: [
        { churnRisk: "High Risk" },
        { churnScore: { $gt: 0.75 } }
      ]
    })
      .select('memberId fullName packageName churnScore churnRisk phone email area city profilePhoto status')
      .sort({ churnScore: -1 })
      .limit(20);

    res.json({ success: true, members: highRiskMembers });
  } catch (error) {
    console.error('Error fetching high risk members:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch high risk members' });
  }
});

// Endpoint to get leads insights (count this month + recent)
app.get('/gym/api/insights/leads', userauth, requireFeature('aiBusinessInsights'), async (req, res) => {
  try {
    const LeadModel = require('./models/lead.js');
    const gymId = req.user.gymId;

    // 1. Calculate start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 2. Count leads created this month
    const leadsThisMonth = await LeadModel.countDocuments({
      gymId,
      createdAt: { $gte: startOfMonth }
    });

    // 3. Get recent leads (e.g., last 10)
    const recentLeads = await LeadModel.find({ gymId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, count: leadsThisMonth, leads: recentLeads });
  } catch (error) {
    console.error('Error fetching leads insights:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leads insights' });
  }
});

// Temporary debug endpoint removed for security.

// Endpoint to get Attendance Leaderboard (Top 3 scores this month)
app.get('/gym/api/insights/attendance-leaderboard', userauth, async (req, res) => {
  try {
    const AttendanceModel = require('./models/attendance.js');
    const MemberModel = require('./models/member.js');
    const gymId = req.user.gymId;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. Aggregate attendance counts for members this month
    // Use .collection.aggregate() to bypass the tenantPlugin which would double-inject gymId
    const attendanceCounts = await AttendanceModel.collection.aggregate([
      {
        $match: {
          gymId: gymId,
          type: 'member',
          status: 'present',
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$entityId', // memberId
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    if (!attendanceCounts || attendanceCounts.length === 0) {
      return res.json({ success: true, leaderboard: [] });
    }

    // 2. Find the top 3 unique scores
    const uniqueScores = [...new Set(attendanceCounts.map(item => item.count))].slice(0, 3);

    if (uniqueScores.length === 0) {
      return res.json({ success: true, leaderboard: [] });
    }

    // 3. Filter members who have one of the top 3 scores
    const topPerformers = attendanceCounts.filter(item => uniqueScores.includes(item.count));

    // 4. Fetch details for these members using raw collection to avoid tenant plugin conflicts
    const memberIds = topPerformers.map(item => item._id);

    const members = await MemberModel.collection.find({
      gymId: gymId,
      memberId: { $in: memberIds }
    }).project({ memberId: 1, fullName: 1, packageName: 1, profilePhoto: 1 }).toArray();

    const memberMap = {};
    members.forEach(m => {
      memberMap[m.memberId] = m;
    });

    // 5. Combine and format data
    const leaderboard = topPerformers.map(item => {
      const member = memberMap[item._id];
      return {
        memberId: item._id,
        score: item.count,
        rank: uniqueScores.indexOf(item.count) + 1, // 1st, 2nd, or 3rd top score
        fullName: member ? member.fullName : 'Unknown Member',
        packageName: member ? member.packageName : 'N/A',
        profilePhoto: member ? member.profilePhoto : null
      };
    });

    // Sort by score descending, then alphabetically by name to be consistent
    leaderboard.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.fullName < b.fullName) return -1;
      if (a.fullName > b.fullName) return 1;
      return 0;
    });

    res.json({ success: true, leaderboard });
  } catch (error) {
    console.error('Error fetching attendance leaderboard:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance leaderboard' });
  }
});

// Endpoint to get membership distribution (Active members by plan)
app.get('/gym/api/insights/membership-distribution', userauth, async (req, res) => {
  try {
    const MemberModel = require('./models/member.js');
    const MembershipPlanModel = require('./models/membership.js');
    const gymId = req.user.gymId;

    // 1. Get all active plans to ensure we show even those with 0 members if needed, 
    // or just rely on member aggregation. User asked: "from (active member) members database get every memberships running".

    // 1. Get all active membership plans
    const allPlans = await MembershipPlanModel.find({ gymId, status: 'Active' }).select('name');

    // Create a map of plan names with 0 count
    const planMap = {};
    allPlans.forEach(plan => {
      planMap[plan.name] = 0;
    });

    // 2. Aggregate active members by packageName
    const memberCounts = await MemberModel.aggregate([
      { $match: { gymId, status: 'Active' } },
      {
        $group: {
          _id: "$packageName",
          count: { $sum: 1 }
        }
      }
    ]);

    // 3. Update counts from aggregation
    memberCounts.forEach(item => {
      if (item._id) {
        // If the plan exists in our map (is Active), update count.
        // If not (maybe an old plan or one not in active set), we can decide to include it or not.
        // Let's include it to be safe, ensuring all active members are counted.
        planMap[item._id] = item.count;
      }
    });

    // 4. Convert to array and sort
    const distribution = Object.entries(planMap)
      .map(([name, count]) => ({ _id: name, count }))
      .sort((a, b) => b.count - a.count);

    // Format for frontend
    const formattedData = distribution.map(item => ({
      name: item._id || 'Unknown Plan',
      value: item.count
    }));

    res.json({ success: true, distribution: formattedData });
  } catch (error) {
    console.error('Error fetching membership distribution:', error);
    res.status(500).json({ success: false, message: 'Error fetching distribution' });
  }
});

// Endpoint to get members expiring soon (within next 7 days)
app.get('/gym/api/insights/expiring-soon', userauth, async (req, res) => {
  try {
    const MemberModel = require('./models/member.js');
    const gymId = req.user.gymId;

    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const expiringMembers = await MemberModel.find({
      gymId,
      endDate: { $gte: now, $lte: nextWeek },
      status: { $in: ['Active', 'Pending'] }
    })
      .select('memberId fullName packageName phone email area city profilePhoto status endDate')
      .sort({ endDate: 1 });

    res.json({ success: true, members: expiringMembers });
  } catch (error) {
    console.error('Error fetching expiring members:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch expiring members' });
  }
});

// Endpoint to get peak hours data
app.get('/gym/api/insights/peak-hours', userauth, async (req, res) => {
  try {
    const AttendanceModel = require('./models/attendance.js');
    const gymId = req.user.gymId;

    // Get date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const attendanceRecords = await AttendanceModel.find({
      gymId,
      date: { $gte: sevenDaysAgo },
      status: 'present' // assuming we only care about present members
    }).select('time');

    // Helper to extract hour from "HH:MM AM/PM"
    const getHour = (timeStr) => {
      // timeStr example: "06:30 AM" or "6:30 AM"
      if (!timeStr) return null;
      const parts = timeStr.trim().split(' ');
      if (parts.length < 2) return null; // Unexpected format

      const timeParts = parts[0].split(':');
      let hour = parseInt(timeParts[0]);
      const ampm = parts[1].toUpperCase();

      if (ampm === 'PM' && hour !== 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;

      return hour;
    };

    const hourCounts = {};
    attendanceRecords.forEach(record => {
      const hour = getHour(record.time);
      if (hour !== null) {
        // We want to group by display hour e.g. "6AM", "7AM"
        // Let's store as 0-23 first then format
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    // Format for chart: sorted by hour
    const peakHours = Object.keys(hourCounts)
      .map(h => parseInt(h))
      .sort((a, b) => a - b)
      .map(h => {
        let displayHour;
        if (h === 0) displayHour = '12AM';
        else if (h === 12) displayHour = '12PM';
        else if (h > 12) displayHour = `${h - 12}PM`;
        else displayHour = `${h}AM`;

        return {
          hour: displayHour,
          count: hourCounts[h],
          sortKey: h // Internal use if needed, but array is already sorted
        };
      });

    res.json({ success: true, peakHours });
  } catch (error) {
    console.error('Error fetching peak hours:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch peak hours' });
  }
});

// Endpoint to get attendance rate
app.get('/gym/api/insights/attendance-rate', userauth, async (req, res) => {
  try {
    const AttendanceModel = require('./models/attendance.js');
    const MemberModel = require('./models/member.js');
    const gymId = req.user.gymId;

    // Get date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // 1. Get unique members who attended in last 7 days
    const uniqueAttendees = await AttendanceModel.distinct('entityId', {
      gymId,
      date: { $gte: sevenDaysAgo },
      type: 'member',
      status: 'present'
    });

    const uniqueCount = uniqueAttendees.length;

    // 2. Get total active members (not expired or cancelled)
    const totalActiveMembers = await MemberModel.countDocuments({
      gymId,
      status: { $nin: ['Expired', 'Cancelled'] }
    });

    // 3. Calculate rate
    const rate = totalActiveMembers > 0
      ? Math.round((uniqueCount / totalActiveMembers) * 100)
      : 0;

    res.json({
      success: true,
      attendanceRate: rate,
      uniqueAttendees: uniqueCount,
      totalActiveMembers
    });
  } catch (error) {
    console.error('Error fetching attendance rate:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance rate' });
  }
});

// Endpoint to get lead conversion rate
app.get('/gym/api/insights/lead-conversion', userauth, async (req, res) => {
  try {
    const LeadModel = require('./models/lead.js');
    const gymId = req.user.gymId;

    const now = new Date();

    // Current 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Previous 30 days (30-60 days ago)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(now.getDate() - 60);
    sixtyDaysAgo.setHours(0, 0, 0, 0);

    // Current period: leads created in last 30 days
    const currentTotalLeads = await LeadModel.countDocuments({
      gymId,
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Current period: leads having status 'converted' and updated in last 30 days
    const currentConvertedLeads = await LeadModel.countDocuments({
      gymId,
      status: 'converted',
      updatedAt: { $gte: thirtyDaysAgo }
    });

    // Previous period: leads having status 'converted' and updated 30-60 days ago
    const previousConvertedLeads = await LeadModel.countDocuments({
      gymId,
      status: 'converted',
      updatedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });

    // Potential leads in previous period (total created)
    const previousTotalLeads = await LeadModel.countDocuments({
      gymId,
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });

    // Calculate conversion rates
    const currentRate = currentTotalLeads > 0
      ? Math.round((currentConvertedLeads / currentTotalLeads) * 100)
      : 0;

    const previousRate = previousTotalLeads > 0
      ? Math.round((previousConvertedLeads / previousTotalLeads) * 100)
      : 0;

    // Calculate improvement
    const improvement = currentRate - previousRate;

    res.json({
      success: true,
      conversionRate: currentRate,
      convertedCount: currentConvertedLeads,
      improvement: improvement,
      currentPeriod: {
        total: currentTotalLeads,
        converted: currentConvertedLeads
      },
      previousPeriod: {
        total: previousTotalLeads,
        converted: previousConvertedLeads
      }
    });
  } catch (error) {
    console.error('Error fetching lead conversion rate:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lead conversion rate' });
  }
});

// Endpoint to get lead sources breakdown
app.get('/gym/api/insights/lead-sources', userauth, async (req, res) => {
  try {
    const LeadModel = require('./models/lead.js');
    const gymId = req.user.gymId;

    // Aggregate leads by source
    const sourceAggregation = await LeadModel.aggregate([
      { $match: { gymId } },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Calculate total leads
    const totalLeads = sourceAggregation.reduce((sum, item) => sum + item.count, 0);

    // Format with percentages and friendly names
    const sourceNames = {
      website: 'Website',
      referral: 'Referrals',
      social_media: 'Facebook/Insta',
      walk_in: 'Walk-in',
      event: 'Event',
      other: 'Other'
    };

    const leadSources = sourceAggregation.map(item => ({
      name: sourceNames[item._id] || item._id || 'Unknown',
      value: totalLeads > 0 ? Math.round((item.count / totalLeads) * 100) : 0,
      count: item.count
    }));

    res.json({
      success: true,
      leadSources,
      totalLeads
    });
  } catch (error) {
    console.error('Error fetching lead sources:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lead sources' });
  }
});

// Endpoint to get dashboard stats
app.get('/gym/dashboard/stats', require('./middleware/userauth'), async (req, res) => {
  try {
    const MemberModel = require('./models/member.js');
    const gymId = req.user.gymId;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const [total, active, expired, pending] = await Promise.all([
      MemberModel.countDocuments({ gymId }),
      MemberModel.countDocuments({ gymId, status: 'Active' }),
      MemberModel.countDocuments({
        gymId,
        $or: [
          { status: 'Expired' },
          { endDate: { $lt: now }, status: { $nin: ['Cancelled', 'Hold'] } }
        ]
      }),
      MemberModel.countDocuments({ gymId, balanceAmount: { $gt: 0 } })
    ]);

    res.json({
      success: true,
      stats: {
        totalMembers: total,
        activeMembers: active,
        expiredMembers: expired,
        pendingPayments: pending
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
});

// Endpoint to get recent alerts for dashboard
app.get('/gym/dashboard/recent-alerts', require('./middleware/userauth'), async (req, res) => {
  try {
    const MemberModel = require('./models/member.js');
    const LeadModel = require('./models/lead.js');
    const EquipmentModel = require('./models/equipment.js');
    const StaffModel = require('./models/staff.js');
    const StaffSalaryModel = require('./models/staffSalary.js');
    const AttendanceModel = require('./models/attendance.js');
    const gymId = req.user.gymId;

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Pending Payments (Top 3) - from Subscriptions
    const SubscriptionModel = require('./models/subscription.js');
    const pendingSubsData = await SubscriptionModel.find({
      gymId,
      balanceAmount: { $gt: 0 }
    }).populate('memberId', 'fullName').sort({ updatedAt: -1 }).limit(3);

    // 2. Expiring Soon (Top 3) - from Subscriptions
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);
    const expiringSoonPotential = await SubscriptionModel.find({
      gymId,
      endDate: { $gte: today, $lte: sevenDaysLater },
      status: { $in: ['Active', 'Pending'] }
    }).populate('memberId', 'fullName').sort({ endDate: 1 });

    const filteredExpiring = [];
    for (const sub of expiringSoonPotential) {
      if (filteredExpiring.length >= 3) break;
      const memIdForCheck = sub.memberId?._id || sub.memberId;
      if (!memIdForCheck) continue;

      const newerPlan = await SubscriptionModel.findOne({
        gymId,
        memberId: memIdForCheck,
        status: { $in: ['Active', 'Pending'] },
        endDate: { $gt: sub.endDate }
      });
      if (!newerPlan) {
        filteredExpiring.push(sub);
      }
    }
    const expiringSoon = filteredExpiring;

    // 3. Urgent Leads (Top 3)
    const urgentLeads = await LeadModel.find({
      gymId,
      nextFollowUpDate: { $lte: sevenDaysLater },
      status: { $nin: ['converted', 'lost'] }
    }).sort({ nextFollowUpDate: 1 }).limit(3);

    // 4. Equipment Maintenance (Top 3)
    const equipment = await EquipmentModel.find({
      gymId,
      maintenanceSchedule: { $lte: sevenDaysLater }
    }).sort({ maintenanceSchedule: 1 }).limit(3);

    // Combine into a flattened list
    const alerts = [
      ...pendingSubsData.map(sub => ({
        id: sub._id,
        type: 'payment',
        title: `Pending Payment: ${sub.memberId?.fullName || 'Member'}`,
        subtitle: `Balance: ₹${sub.balanceAmount}`,
        date: sub.updatedAt,
        icon: 'DollarSign'
      })),
      ...expiringSoon.map(sub => ({
        id: sub._id,
        type: 'renewal',
        title: `Expiring Soon: ${sub.memberId?.fullName || 'Member'}`,
        subtitle: `Ends on: ${new Date(sub.endDate).toLocaleDateString()}`,
        date: sub.endDate,
        icon: 'RefreshCcw'
      })),
      ...urgentLeads.map(l => ({
        id: l._id,
        type: 'lead',
        title: `Follow-up: ${l.name}`,
        subtitle: `Due: ${new Date(l.nextFollowUpDate).toLocaleDateString()}`,
        date: l.nextFollowUpDate,
        icon: 'UserPlus'
      })),
      ...equipment.map(e => ({
        id: e._id,
        type: 'maintenance',
        title: `Maintenance: ${e.name}`,
        subtitle: `Scheduled: ${new Date(e.maintenanceSchedule).toLocaleDateString()}`,
        date: e.maintenanceSchedule,
        icon: 'Wrench'
      }))
    ];

    // Sort by date (most recent first for payment, soonest/oldest for others)
    // For simplicity, just sort by date
    alerts.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, alerts: alerts.slice(0, 10) });
  } catch (error) {
    console.error('Error fetching recent alerts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recent alerts' });
  }
});

// The root route is handled by the React frontend fallback in production mode.

// ========================================
// MANUAL TRIGGER ENDPOINTS (for testing)
// ========================================

// These endpoints accept a gymId via query param for manual testing.
// Example: POST /api/automation/run-expiry-reminder?gymId=xxx&gymName=MyGym

async function getGymInfo(gymId) {
  const gym = await GymSettings.findOne({ gymId }).lean();
  return { gymId, gymName: gym ? gym.gymName : 'Unknown Gym' };
}

app.post('/api/automation/run-expiry-reminder', userauth, async (req, res) => {
  try {
    const gymId = req.user.gymId;
    const { gymName } = await getGymInfo(gymId);
    console.log(`[Expiry Reminder] Manual trigger for gym: ${gymName}`);
    await runExpiryReminderAutomation(gymId, gymName);
    res.json({ success: true, message: 'Expiry reminder completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/automation/run-lead-followup', userauth, async (req, res) => {
  try {
    const gymId = req.user.gymId;
    const { gymName } = await getGymInfo(gymId);
    console.log(`[Lead Follow-up] Manual trigger for gym: ${gymName}`);
    await runLeadFollowUpAutomation(gymId, gymName);
    res.json({ success: true, message: 'Lead follow-up completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/automation/run-birthday-reminder', userauth, async (req, res) => {
  try {
    const gymId = req.user.gymId;
    const { gymName } = await getGymInfo(gymId);
    console.log(`[Birthday Reminder] Manual trigger for gym: ${gymName}`);
    await runBirthdayReminderAutomation(gymId, gymName);
    res.json({ success: true, message: 'Birthday reminder completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// SPECIAL CLASS ROUTES (PT Session & Sauna)
// ========================================
const SubscriptionModelSC = require('./models/subscription.js');
const MemberModelSC = require('./models/member.js');

// GET /gym/special-classes — List members who have PT or Sauna sessions assigned
app.get('/gym/special-classes', userauth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = (req.query.search || '').toLowerCase();
    const type = req.query.type || 'all'; // 'all' | 'pt' | 'sauna'

    // Build filter for subscriptions with PT or Sauna
    let sessionFilter = {};
    if (type === 'pt') sessionFilter = { ptSessionsTotal: { $gt: 0 } };
    else if (type === 'sauna') sessionFilter = { steamSessionsTotal: { $gt: 0 } };
    else sessionFilter = { $or: [{ ptSessionsTotal: { $gt: 0 } }, { steamSessionsTotal: { $gt: 0 } }] };

    const result = await cache.getOrSet(
      `${cache.KEYS.SPECIAL_CLASSES}:${type}:${page}:${limit}:${search}`,
      async () => {
        const activeSubs = await SubscriptionModelSC.find({
          ...sessionFilter,
          gymId: req.user.gymId, // Enforce gym isolation
          status: { $in: ['Active', 'Pending'] }
        })
          .populate('memberId', 'fullName memberId phone profilePhoto')
          .sort({ createdAt: -1 })
          .lean();

        // Filter by search
        let filtered = activeSubs;
        if (search) {
          filtered = activeSubs.filter(sub => {
            const m = sub.memberId;
            if (!m) return false;
            return (
              (m.fullName || '').toLowerCase().includes(search) ||
              (m.memberId || '').toLowerCase().includes(search) ||
              (m.phone || '').includes(search)
            );
          });
        }
        return { filtered };
      },
      cache.HOUR
    );

    const { filtered } = result;

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    const members = paginated.map(sub => {
      const m = sub.memberId || {};
      return {
        _id: m._id,
        _subId: sub._id,
        memberId: m.memberId,
        memberName: m.fullName,
        phone: m.phone,
        profilePhoto: m.profilePhoto,
        plan: sub.packageName,
        status: sub.status,
        trainerId: sub.trainerId,
        trainerName: sub.trainerName,
        ptSessionsTotal: sub.ptSessionsTotal || 0,
        ptSessionsUsed: sub.ptSessionsUsed || 0,
        steamSessionsTotal: sub.steamSessionsTotal || 0,
        steamSessionsUsed: sub.steamSessionsUsed || 0,
      };
    });

    // Stats
    const totalPt = filtered.reduce((s, sub) => s + Math.max(0, (sub.ptSessionsTotal || 0) - (sub.ptSessionsUsed || 0)), 0);
    const totalSauna = filtered.reduce((s, sub) => s + Math.max(0, (sub.steamSessionsTotal || 0) - (sub.steamSessionsUsed || 0)), 0);
    const activeMembers = filtered.length;

    res.json({
      success: true,
      members,
      stats: { totalPt, totalSauna, activeMembers },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('SpecialClass GET error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /gym/special-classes/log — Log one session usage
app.post('/gym/special-classes/log', userauth, async (req, res) => {
  try {
    const { subscriptionId, sessionType } = req.body; // sessionType: 'pt' | 'sauna'

    if (!subscriptionId || !sessionType) {
      return res.status(400).json({ success: false, message: 'subscriptionId and sessionType are required' });
    }

    const sub = await SubscriptionModelSC.findOne({ _id: subscriptionId, gymId: req.user.gymId });
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found or unauthorized' });

    if (sessionType === 'pt') {
      if (sub.ptSessionsUsed >= sub.ptSessionsTotal) {
        return res.status(400).json({ success: false, message: 'All PT sessions already used' });
      }
      sub.ptSessionsUsed = (sub.ptSessionsUsed || 0) + 1;
    } else if (sessionType === 'sauna') {
      if (sub.steamSessionsUsed >= sub.steamSessionsTotal) {
        return res.status(400).json({ success: false, message: 'All Sauna sessions already used' });
      }
      sub.steamSessionsUsed = (sub.steamSessionsUsed || 0) + 1;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid sessionType. Use "pt" or "sauna"' });
    }

    await sub.save();
    
    // Invalidate Special Classes cache
    await cache.invalidateSpecialClasses();

    res.json({ success: true, message: 'Session logged successfully', subscription: sub });
  } catch (error) {
    console.error('SpecialClass LOG error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve static files from the React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  // Use app.use for the catch-all to avoid path-to-regexp 8.x '*' wildcard errors
  app.use((req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/dist', 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('[Automation] Background jobs will now run per-gym when an admin logs in.');
});

server.on('error', (err) => {
  console.error('[Server Error]: Failed to start server:', err);
});

