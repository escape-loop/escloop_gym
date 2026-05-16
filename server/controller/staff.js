const StaffModel = require("../models/staff");
const MemberModel = require("../models/member");
const SubscriptionModel = require("../models/subscription");
const path = require("path");
const fs = require("fs");
const cache = require('../services/cacheService');
const tenantStorage = require('../middleware/tenantContext');

// Generate unique codes if needed
const generateUniqueId = (prefix) => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}${timestamp}${random}`;
};

// Helper to check if ID exists in Staff or Member
const checkConflict = async (id, gymId) => {
    const existInMember = await MemberModel.findOne({ memberId: id, gymId }).lean();
    const existInStaff = await StaffModel.findOne({ staffId: id, gymId }).lean();
    return existInMember || existInStaff;
};

// Generate unique numeric-only ID (4-digit, expands to 5-6 if needed)
const generateNumericId = async () => {
  const gymId = tenantStorage.getStore();

  // Try 3-digit
  for (let i = 0; i < 50; i++) {
    const candidate = (Math.floor(Math.random() * 900) + 100).toString();
    if (!(await checkConflict(candidate, gymId))) return candidate;
  }

  // Try 4-digit
  for (let i = 0; i < 50; i++) {
    const candidate = (Math.floor(Math.random() * 9000) + 1000).toString();
    if (!(await checkConflict(candidate, gymId))) return candidate;
  }

  // Fallback to 5-digit
  for (let i = 0; i < 50; i++) {
    const candidate = (Math.floor(Math.random() * 90000) + 10000).toString();
    if (!(await checkConflict(candidate, gymId))) return candidate;
  }

  // Fallback to 6-digit (or timestamp if all else fails)
  for (let i = 0; i < 50; i++) {
    const candidate = (Math.floor(Math.random() * 900000) + 100000).toString();
    if (!(await checkConflict(candidate, gymId))) return candidate;
  }

  return Date.now().toString().slice(-6);
};

// Add new staff
const addStaff = async (req, res) => {
  try {
    const staffData = req.body;

    // Validate required fields
    const required = [
      "firstName",
      "phone",
      "gender",
      "role",
      "salary",
      "shiftType",
      "workHoursStart",
      "workHoursEnd",
      "workDays",
    ];
    const missing = required.filter((field) => !staffData[field]);
    if (missing.length > 0) {
      return res.json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    // Check email/phone uniqueness
    const duplicateChecks = [{ phone: staffData.phone }];
    if (staffData.email) duplicateChecks.push({ email: staffData.email });

    const existing = await StaffModel.findOne({
      gymId: req.user.gymId,
      $or: duplicateChecks,
    });
    if (existing) {
      return res.json({
        success: false,
        message: "Email or phone already registered for staff",
      });
    }

    // Handle profile photo
    let profilePhoto = "";
    if (req.files && req.files.profilePhoto) {
      profilePhoto = `/uploads/staff/${req.files.profilePhoto[0].filename}`;
    } else if (req.file) {
      // Fallback for single file upload if route config changes
      profilePhoto = `/uploads/staff/${req.file.filename}`;
    }

    // Handle certificates
    let certificates = [];
    if (req.files && req.files.certificates) {
      certificates = req.files.certificates.map(file => `/uploads/staff/${file.filename}`);
    }

    // Auto-generate staffId if not provided
    if (!staffData.staffId) {
      staffData.staffId = await generateNumericId();
    }

    // Auto-generate fullName
    staffData.fullName = `${staffData.firstName} ${staffData.lastName || ''}`.trim();
    staffData.updatedAt = Date.now();

    // Auto-generate referral code for trainers if not provided
    if (!staffData.referralCode && staffData.role === 'Trainer') {
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      staffData.referralCode = `REF-${staffData.staffId}-${randomCode}`;
    }

    // Normalize assignedMembers: accept JSON string, array of ids, or array of objects
    let assignedMembers = [];
    try {
      if (staffData.assignedMembers) {
        let raw = staffData.assignedMembers;
        if (typeof raw === 'string') {
          raw = JSON.parse(raw);
        }
        if (Array.isArray(raw)) {
          for (const item of raw) {
            if (typeof item === 'string') {
              // treat as member id
              const m = await MemberModel.findOne({ _id: item, gymId: req.user.gymId }).lean();
              if (m) {
                const used = Array.isArray(m.ptSessionsUsed) ? m.ptSessionsUsed.filter(Boolean).length : 0;
                assignedMembers.push({
                  memberId: m._id.toString(),
                  name: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
                  fitnessGoal: m.goal || '',
                  ptSessionsRemaining: (m.ptSessions || 0) - used,
                  membershipType: m.membershipType || m.packageName || '',
                });
              }
            } else if (typeof item === 'object' && item !== null) {
              // accept provided object but ensure fields exist
              assignedMembers.push({
                memberId: item.memberId || item._id || '',
                name: item.name || item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : item.name || '',
                fitnessGoal: item.fitnessGoal || item.goal || '',
                ptSessionsRemaining: typeof item.ptSessionsRemaining === 'number' ? item.ptSessionsRemaining : (item.ptSessionsRemaining ? Number(item.ptSessionsRemaining) : 0),
                membershipType: item.membershipType || item.membershipType || '',
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Unable to normalize assignedMembers:', e);
    }

    // Robust normalization for workDays
    let normalizedWorkDays = [];
    try {
      let current = staffData.workDays;
      // Attempt to unwrap stringified arrays repeatedly if needed
      for (let i = 0; i < 3; i++) {
        if (Array.isArray(current) && current.length === 1 && typeof current[0] === 'string' && current[0].trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(current[0]);
            if (Array.isArray(parsed)) { current = parsed; continue; }
          } catch (e) { }
        }
        if (typeof current === 'string' && current.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(current);
            if (Array.isArray(parsed)) { current = parsed; continue; }
          } catch (e) { }
        }
        break;
      }

      if (Array.isArray(current)) {
        normalizedWorkDays = current.map(s => String(s).trim()).filter(Boolean);
      } else if (typeof current === 'string') {
        normalizedWorkDays = current.split(',').map(s => s.trim()).filter(Boolean);
      }
    } catch (e) {
      console.warn('Error normalizing workDays in addStaff:', e);
      normalizedWorkDays = [];
    }

    if (staffData.department === "") {
      delete staffData.department;
    }

    const newStaff = new StaffModel({
      ...staffData,
      gymId: req.user.gymId,
      workDays: normalizedWorkDays,
      assignedBatches: Array.isArray(staffData.assignedBatches)
        ? staffData.assignedBatches
        : (staffData.assignedBatches ? staffData.assignedBatches.split(",").map((b) => b.trim()) : []),
      assignedMembers,
      profilePhoto,
      certificates,
    });

    await newStaff.save();

    // Invalidate staff cache
    await cache.invalidateStaff();

    res.json({
      success: true,
      message: "Staff member added successfully",
      staffId: newStaff.staffId,
      staff: {
        staffId: newStaff.staffId,
        fullName: newStaff.fullName,
        role: newStaff.role,
        status: newStaff.status,
      },
    });
  } catch (error) {
    console.error("Add staff error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all staff (cache-all, filter in Node.js)
const getStaff = async (req, res) => {
  try {
    const {
      role,
      status = "Active",
      department,
      search,
      page = 1,
      limit = 15,
    } = req.query;

    // Fetch all staff from cache or DB
    const allStaff = await cache.getOrSet(
      cache.KEYS.STAFF_ALL, // Cache key already has gymId prefix
      async () => {
        return await StaffModel.find({ gymId: req.user.gymId }).sort({ joinDate: -1 })
          .select("-panNumber -aadhaarNumber -bankAccount").lean();
      },
      cache.DAY
    );

    // Filter in Node.js memory
    let filtered = allStaff;
    if (status !== 'all') filtered = filtered.filter(s => s.status === status);
    if (role) filtered = filtered.filter(s => s.role === role);
    if (department) filtered = filtered.filter(s => s.department === department);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s =>
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.staffId || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const lim = parseInt(limit);
    const pg = parseInt(page);
    const staff = filtered.slice((pg - 1) * lim, pg * lim);

    res.json({
      success: true,
      staff,
      pagination: {
        page: pg,
        limit: lim,
        total,
        pages: Math.ceil(total / lim),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single staff
const getStaffById = async (req, res) => {
  try {
    const id = req.params.id;

    // Check if the ID looks like a valid ObjectId (24 hex characters)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    // Build query - only include _id if it's a valid ObjectId
    const query = isValidObjectId
      ? { $or: [{ staffId: id }, { _id: id }], gymId: req.user.gymId }
      : { staffId: id, gymId: req.user.gymId };

    // Return full staff document for edit operations (includes panNumber, aadhaarNumber)
    const staff = await StaffModel.findOne(query);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }
    res.json({ success: true, staff });
  } catch (error) {
    console.error('Error in getStaffById:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get assigned members for a trainer from subscriptions
const getAssignedMembers = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate staff exists and is a trainer
    const staff = await StaffModel.findOne({ _id: id, gymId: req.user.gymId });
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    // Find active/valid subscriptions for this trainer
    // We want to fetch members who have a currently active subscription with this trainer.
    // We can also include 'Pending' if that's desired, but usually 'Active' is what matters for assignment.
    // Based on user request "assigned members from subscription model", we'll check trainerId match.
    // Let's include Active, Pending, and potentially recently Expired/Cancelled if logical, but stick to Active/Pending for now.

    // Find subscriptions where trainerId matches
    const subscriptions = await SubscriptionModel.find({
      gymId: req.user.gymId,
      trainerId: id,
      status: { $in: ['Active', 'Pending'] } // Filter by relevant statuses
    }).populate('memberId', 'memberId firstName lastName phone email profilePhoto status goal packageName ptSessions ptSessionsUsed membershipType');

    // Extract unique members from subscriptions
    const uniqueMembersMap = new Map();

    subscriptions.forEach(sub => {
      if (sub.memberId) {
        // memberId field is now the populated Member document due to populate()
        const member = sub.memberId;
        if (!uniqueMembersMap.has(member._id.toString())) {
          // Add subscription details to the member object for frontend display if needed
          const memberObj = member.toObject();
          memberObj.subscription = {
            packageName: sub.packageName,
            startDate: sub.startDate,
            endDate: sub.endDate,
            ptSessionsTotal: sub.ptSessionsTotal,
            ptSessionsUsed: sub.ptSessionsUsed,
            status: sub.status
          };
          // Ensure we have fields expected by Addstaff.jsx table
          // Table expects: firstName, lastName, memberId, phone, batch (?), packageName, ptSessions (?), fitnessGoal, membershipType, status
          memberObj.batch = ''; // Subscription doesn't strictly have batch unless we infer from somewhere
          memberObj.fitnessGoal = member.goal; // Map 'goal' to 'fitnessGoal'
          // Used ptSessions from member record or subscription? 
          // Member record has global PT stats, Subscription has specific. 
          // Addstaff table logic uses member.ptSessionsUsed array length vs member.ptSessions count.
          // We'll pass the member object as is, which has the core fields.

          // Inject trainer ID and name so the frontend filter logic accepts this member
          // The frontend checks: member.trainer === staffId OR member.trainerAssigned === staffName
          memberObj.trainer = id;
          memberObj.trainerAssigned = staff.fullName;

          uniqueMembersMap.set(member._id.toString(), memberObj);
        }
      }
    });

    const members = Array.from(uniqueMembersMap.values());

    res.json({
      success: true,
      members
    });

  } catch (error) {
    console.error("Get assigned members error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update staff
const updateStaff = async (req, res) => {
  try {
    const staff = await StaffModel.findOne({
      gymId: req.user.gymId,
      $or: [{ staffId: req.params.id }, { _id: req.params.id }],
    });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    const updateData = req.body;
    if (updateData.department === "") {
      delete updateData.department;
      // If we need to explicitly unset it in DB, we might need to set it to undefined or use $unset, 
      // but for Mongoose save(), verifying if 'undefined' works or if we need to set property to undefined on the doc.
      // Since we use Object.assign(staff, updateData), deleting it from updateData prevents overwriting with "" 
      // BUT if the intention was to CLEAR the department, we should probably set it to null?
      // Mongoose 6+ checks casting. Enum validation runs on save.
      // If staff.department was "Sales" and updateData doesn't have it, it stays "Sales".
      // If user selected "Select" (empty), they probably want to clear it.
      // So we should set it to null or undefined.
      // Let's set it to undefined which Mongoose typically treats as unset for new docs but maybe not updates.
      // Actually, setting to null is safer for clearing a field if the schema allows nullable. 
      // But schema type is String. null might fail?
      // Mongoose usually allows null for non-required.
      // Let's try deleting it first to solve the "invalid enum value" crash.
    }

    // Normalize assignedMembers on update as well
    if (updateData.assignedMembers) {
      try {
        let raw = updateData.assignedMembers;
        if (typeof raw === 'string') raw = JSON.parse(raw);
        const normalized = [];
        if (Array.isArray(raw)) {
          for (const item of raw) {
            if (typeof item === 'string') {
              const m = await MemberModel.findOne({ _id: item, gymId: req.user.gymId }).lean();
              if (m) {
                const used = Array.isArray(m.ptSessionsUsed) ? m.ptSessionsUsed.filter(Boolean).length : 0;
                normalized.push({
                  memberId: m._id.toString(),
                  name: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
                  fitnessGoal: m.goal || '',
                  ptSessionsRemaining: (m.ptSessions || 0) - used,
                  membershipType: m.membershipType || m.packageName || '',
                });
              }
            } else if (typeof item === 'object' && item !== null) {
              normalized.push({
                memberId: item.memberId || item._id || '',
                name: item.name || '',
                fitnessGoal: item.fitnessGoal || item.goal || '',
                ptSessionsRemaining: typeof item.ptSessionsRemaining === 'number' ? item.ptSessionsRemaining : (item.ptSessionsRemaining ? Number(item.ptSessionsRemaining) : 0),
                membershipType: item.membershipType || '',
              });
            }
          }
        }
        updateData.assignedMembers = normalized;
      } catch (e) {
        console.warn('Unable to normalize assignedMembers on update:', e);
      }
    }

    // Handle workDays normalization for update
    if (updateData.workDays !== undefined) {
      try {
        let current = updateData.workDays;
        for (let i = 0; i < 3; i++) {
          if (Array.isArray(current) && current.length === 1 && typeof current[0] === 'string' && current[0].trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(current[0]);
              if (Array.isArray(parsed)) { current = parsed; continue; }
            } catch (e) { }
          }
          if (typeof current === 'string' && current.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(current);
              if (Array.isArray(parsed)) { current = parsed; continue; }
            } catch (e) { }
          }
          break;
        }

        if (Array.isArray(current)) {
          staff.workDays = current.map(s => String(s).trim()).filter(Boolean);
        } else if (typeof current === 'string') {
          staff.workDays = current.split(',').map(s => s.trim()).filter(Boolean);
        } else {
          staff.workDays = [];
        }
      } catch (e) {
        console.warn('Error normalizing workDays on update:', e);
        staff.workDays = [];
      }
    }

    // Handle assignedBatches normalization for update
    if (updateData.assignedBatches !== undefined) {
      if (Array.isArray(updateData.assignedBatches)) {
        staff.assignedBatches = updateData.assignedBatches;
      } else if (typeof updateData.assignedBatches === 'string') {
        staff.assignedBatches = updateData.assignedBatches.split(",").map((b) => b.trim());
      } else {
        staff.assignedBatches = [];
      }
    }

    Object.assign(staff, updateData);

    // If staffId is provided on update, ensure it's unique across staff and members
    if (updateData.staffId !== undefined) {
      const newId = String(updateData.staffId || "");
      if (newId !== (staff.staffId || "")) {
        const conflictStaff = await StaffModel.findOne({ staffId: newId, gymId: req.user.gymId }).lean();
        const conflictMember = await MemberModel.findOne({ memberId: newId, gymId: req.user.gymId }).lean();
        if ((conflictStaff && String(conflictStaff._id) !== String(staff._id)) || (conflictMember)) {
          return res.status(400).json({ success: false, message: 'staffId already in use' });
        }
      }
      staff.staffId = newId;
    }

    // Handle photo update
    if (req.files && req.files.profilePhoto) {
      if (staff.profilePhoto) {
        const oldPhotoPath = path.join(__dirname, '..', staff.profilePhoto);
        if (fs.existsSync(oldPhotoPath) && fs.lstatSync(oldPhotoPath).isFile()) {
          try {
            fs.unlinkSync(oldPhotoPath);
          } catch (err) {
            console.error("Error deleting old staff profile photo:", err);
          }
        }
      }
      staff.profilePhoto = `/uploads/staff/${req.files.profilePhoto[0].filename}`;
    } else if (req.file) {
      // Fallback
      if (staff.profilePhoto) {
        const oldPhotoPath = path.join(__dirname, '..', staff.profilePhoto);
        if (fs.existsSync(oldPhotoPath) && fs.lstatSync(oldPhotoPath).isFile()) {
          try { fs.unlinkSync(oldPhotoPath); } catch (e) { }
        }
      }
      staff.profilePhoto = `/uploads/staff/${req.file.filename}`;
    }

    // Handle certificates update
    let existingCertificates = [];
    try {
      if (updateData.existingCertificates) {
        existingCertificates = JSON.parse(updateData.existingCertificates);
        if (!Array.isArray(existingCertificates)) existingCertificates = [];
      } else if (staff.certificates) {
        // If no existingCertificates field is sent, assume we keep existing ones?
        // Or if the frontend always sends existingCertificates, rely on that.
        // Frontend sends 'existingCertificates' as JSON string of array.
        // If it's missing, it usually means no change or standard update, but our frontend sends it.
      }
    } catch (e) {
      console.warn('Error parsing existingCertificates:', e);
      existingCertificates = [];
    }

    // Combine existing and new certificates
    let newCertificates = [];
    if (req.files && req.files.certificates) {
      newCertificates = req.files.certificates.map(file => `/uploads/staff/${file.filename}`);
    }

    // If existingCertificates was sent, we use that + new ones.
    // Note: If existingCertificates is sent, it represents the complete list of *old* files to keep.
    // Any file in staff.certificates that is NOT in existingCertificates should ideally be deleted.

    // Cleanup removed certificates
    if (updateData.existingCertificates && staff.certificates) {
      staff.certificates.forEach(oldCert => {
        if (!existingCertificates.includes(oldCert)) {
          const oldCertPath = path.join(__dirname, '..', oldCert);
          if (fs.existsSync(oldCertPath) && fs.lstatSync(oldCertPath).isFile()) {
            try { fs.unlinkSync(oldCertPath); } catch (e) { console.error('Error deleting old cert:', e); }
          }
        }
      });
      staff.certificates = [...existingCertificates, ...newCertificates];
    } else {
      // If existingCertificates not sent, just append? Or replace? 
      // Safe bet: append if no array logic provided, but for this app typical flow is replace/managed list.
      // With our frontend, we strictly send existingCertificates.
      if (newCertificates.length > 0) {
        if (!staff.certificates) staff.certificates = [];
        staff.certificates = [...staff.certificates, ...newCertificates];
      }
    }

    await staff.save();

    // Invalidate staff cache
    await cache.invalidateStaff();
    await cache.invalidateStaffById(staff.staffId, staff.phone);

    res.json({
      success: true,
      message: "Staff updated successfully",
      staff,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete staff
const deleteStaff = async (req, res) => {
  try {
    const staff = await StaffModel.findOneAndDelete({
      gymId: req.user.gymId,
      $or: [{ staffId: req.params.id }, { _id: req.params.id }],
    });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
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

    // Delete photo
    if (staff.profilePhoto) safeUnlink(staff.profilePhoto);

    // Delete certificates
    if (staff.certificates && Array.isArray(staff.certificates)) {
      staff.certificates.forEach(cert => safeUnlink(cert));
    }

    // Invalidate staff cache
    await cache.invalidateStaff();
    await cache.invalidateStaffById(staff.staffId, staff.phone);

    res.json({
      success: true,
      message: "Staff deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle staff status
const toggleStaffStatus = async (req, res) => {
  try {
    const staff = await StaffModel.findOne({
      gymId: req.user.gymId,
      $or: [{ staffId: req.params.id }, { _id: req.params.id }],
    });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    staff.status =
      staff.status === "Active" ? "Inactive" : "Active";
    await staff.save();

    // Invalidate staff cache
    await cache.invalidateStaff();

    res.json({
      success: true,
      message: `Staff ${staff.status.toLowerCase()}d`,
      status: staff.status,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get staff with referral codes for member registration
const getStaffWithReferrals = async (req, res) => {
  try {
    const staff = await StaffModel.find({
      gymId: req.user.gymId,
      role: 'Trainer',
      status: 'Active',
      referralCode: { $exists: true, $ne: null }
    })
      .select('staffId fullName role referralCode referralDiscountPercentage')
      .sort({ fullName: 1 });

    res.json({
      success: true,
      staff
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// Debug endpoint to test staff phone search directly
const testStaffPhoneSearch = async (req, res) => {
  try {
    const { phone } = req.query;
    console.log('Debug: Testing staff phone search for:', phone);

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number required' });
    }

    // Test exact match first
    const exactMatch = await StaffModel.findOne({ phone: phone, gymId: req.user.gymId });
    console.log('Debug: Exact match result:', exactMatch);

    // Test regex match
    const regexMatch = await StaffModel.findOne({ phone: { $regex: phone, $options: "i" }, gymId: req.user.gymId });
    console.log('Debug: Regex match result:', regexMatch);

    // Test all staff with phone field
    const allStaffWithPhone = await StaffModel.find({ phone: { $exists: true, $ne: null }, gymId: req.user.gymId }).limit(5);
    console.log('Debug: Sample staff with phone:', allStaffWithPhone.map(s => ({ id: s._id, phone: s.phone, fullName: s.fullName })));

    res.json({
      success: true,
      phone: phone,
      exactMatch: exactMatch ? { id: exactMatch._id, fullName: exactMatch.fullName, phone: exactMatch.phone } : null,
      regexMatch: regexMatch ? { id: regexMatch._id, fullName: regexMatch.fullName, phone: regexMatch.phone } : null,
      sampleStaff: allStaffWithPhone.map(s => ({ id: s._id, phone: s.phone, fullName: s.fullName }))
    });
  } catch (error) {
    console.error('Debug: Staff phone search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = {
  addStaff,
  getStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
  toggleStaffStatus,
  getStaffWithReferrals,
  getAssignedMembers,
  testStaffPhoneSearch,
};
