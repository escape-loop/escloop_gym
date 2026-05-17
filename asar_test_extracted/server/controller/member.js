const MemberModel = require("../models/member");
const StaffModel = require("../models/staff");
const SubscriptionModel = require("../models/subscription");
const BillModel = require("../models/bill");
const path = require("path");
const fs = require("fs");
const cache = require('../services/cacheService');
const tenantStorage = require('../middleware/tenantContext');
const GymSettings = require("../models/GymSettings");
const { sendNewMemberWelcomeMessage } = require('../services/whatsappMessagingService');

// Generate unique numeric-only ID (3-digit, expands to 4-6 if needed)
// Generate linear 4-digit ID (starts at 0001)
const generateNumericId = async () => {
  // Find highest existing 4-digit ID
  const latestMember = await MemberModel.findOne({
    gymId: tenantStorage.getStore(), // Use tenantStorage here as it's a helper called before userauth next() in some flows, but here it's inside addMember
    memberId: { $regex: /^\d{4}$/ }
  }).sort({ memberId: -1 }).lean();

  let nextId = 1;
  if (latestMember && latestMember.memberId) {
    const currentMax = parseInt(latestMember.memberId.replace(/^0+/, ''), 10); // Robust parse
    if (!isNaN(currentMax)) {
      nextId = currentMax + 1;
    }
  }

  // Pad to 4 digits (e.g., 1 -> "0001", 123 -> "0123")
  let idStr = nextId.toString().padStart(4, '0');

  // Double check conflict just in case (though unlikely with linear logic if DB is clean)
  const checkConflict = async (id) => {
    const existInMember = await MemberModel.findOne({ memberId: id, gymId: tenantStorage.getStore() }).lean();
    return !!existInMember;
  };

  // If conflict exists (e.g. manual insertion mess up), keep incrementing
  while (await checkConflict(idStr)) {
    nextId++;
    idStr = nextId.toString().padStart(4, '0');
  }

  return idStr;
};

const generateNumericMemberId = async () => generateNumericId();

// Add new member
const addMember = async (req, res) => {
  try {
    const memberData = req.body;

    // Validate required fields
    const required = ["firstName", "phone"];
    const missing = required.filter((field) => !memberData[field]);
    if (missing.length > 0) {
      return res.json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    // Auto-generate numeric member ID if not provided
    if (!memberData.memberId) {
      memberData.memberId = await generateNumericId(); // Passing through the context
    }

    // Auto-generate fullName
    memberData.fullName = `${memberData.firstName} ${memberData.lastName}`.trim();

    // Check phone uniqueness only WITHIN THE SAME GYM
    console.log(`[MemberCheck] Checking duplicate for phone: ${memberData.phone} in gymId: ${req.user.gymId}`);
    const existing = await MemberModel.findOne({ phone: memberData.phone, gymId: req.user.gymId });

    if (existing) {
      console.log(`[MemberCheck] Found existing member: ${existing._id} in gym: ${existing.gymId}`);
      return res.json({ success: false, message: "Phone number already registered" });
    }

    // Handle file uploads
    let profilePhoto = "";
    let medicalReports = "";

    if (req.files) {
      if (req.files.profilePhoto && req.files.profilePhoto[0]) {
        profilePhoto = `/uploads/members/${req.files.profilePhoto[0].filename}`;
      }
      if (req.files.medicalReports && req.files.medicalReports[0]) {
        medicalReports = `/uploads/members/${req.files.medicalReports[0].filename}`;
      }
    }

    const newMember = new MemberModel({
      ...memberData,
      gymId: req.user.gymId,
      profilePhoto,
      medicalReports,
      createdAt: new Date(),
    });

    await newMember.save();

    // Invalidate members cache after adding
    await cache.invalidateMembers();

    // Check if New Registration automation is enabled
    try {
      const gymSettings = await GymSettings.findOne({ gymId: req.user.gymId });
      const gymName = gymSettings?.gymName || 'Gym';
      const isAutomationEnabled = gymSettings?.automationToggles?.newRegistration !== false;

      if (isAutomationEnabled) {
        // Run in background without blocking the response
        sendNewMemberWelcomeMessage(newMember, req.user.gymId, gymName).catch(err => {
          console.error('[Member] WhatsApp Welcome Message trigger failed:', err.message);
        });
      }
    } catch (e) {
      console.error('[Member] Error checking automation settings for WhatsApp:', e.message);
    }

    res.json({
      success: true,
      message: "Member added successfully",
      member: newMember,
    });
  } catch (error) {
    console.error("Add member error:", error);
    res.json({ success: false, message: error.message });
  }
};

// Get all members (paginated)
const getMembers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    let limit = 10;
    if (req.query.limit !== undefined) {
      const parsedLimit = parseInt(req.query.limit);
      if (!isNaN(parsedLimit)) {
        limit = parsedLimit;
      }
    }

    const search = req.query.search || "";
    const status = req.query.status || "";
    const flatten = req.query.flatten === 'true';

    const query = { gymId: req.user.gymId };
    if (status && status !== 'all') {
      if (!flatten) {
        query.status = status;
      }
    }
    // Helper to escape special characters for regex
    const escapeRegex = (text) => {
      return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    };

    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { fullName: { $regex: escapedSearch, $options: "i" } },
        { memberId: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
        { phone: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    // --- AGGREGATION FOR FLATTENED VIEW (Subscriptions Page) ---
    if (flatten) {
      const now = new Date();
      const pipeline = [
        { $match: query },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "memberId",
            as: "subs"
          }
        },
        { $unwind: { path: "$subs", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "bills",
            let: { subId: "$subs._id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$subscriptionId", "$$subId"] }, gymId: req.user.gymId } },
              { $project: { amountPaid: 1 } }
            ],
            as: "bills"
          }
        },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            fullName: 1,
            email: 1,
            phone: 1,
            profilePhoto: 1,
            memberId: 1,
            createdAt: 1,
            attendanceId: 1,
            packageName: "$subs.packageName",
            membershipType: "$subs.membershipType",
            startDate: "$subs.startDate",
            endDate: "$subs.endDate",
            subStatus: "$subs.status",
            netPayable: { $ifNull: ["$subs.netPayable", "$subs.amount"] },
            amount: { $ifNull: ["$subs.netPayable", "$subs.amount"] },
            totalPaid: {
              $max: [{ $sum: "$bills.amountPaid" }, { $ifNull: ["$subs.amountPaid", 0] }]
            },
            trainerId: "$subs.trainerId",
            trainerName: "$subs.trainerName",
            _subId: "$subs._id"
          }
        }
      ];

      pipeline.push({
        $addFields: {
          status: {
            $cond: {
              if: { $gt: [{ $subtract: ["$amount", "$totalPaid"] }, 0] },
              then: "Pending",
              else: {
                $cond: {
                  if: {
                    $and: [
                      { $ifNull: ["$endDate", false] },
                      { $lt: ["$endDate", now] }
                    ]
                  },
                  then: "Expired",
                  else: "$subStatus"
                }
              }
            }
          },
          balanceAmount: {
            $max: [0, { $subtract: ["$amount", "$totalPaid"] }]
          },
          pendingPayments: {
            $max: [0, { $subtract: ["$amount", "$totalPaid"] }]
          }
        }
      });

      // --- MOVED STATUS FILTER INTO FACETS TO ALLOW GLOBAL STATS ---

      const statusFilter = (status && status !== 'all')
        ? { status: { $regex: new RegExp(`^${status}$`, 'i') } }
        : {};

      // Use $facet to get stats (all statuses), metadata (filtered), and data (filtered & paginated)
      pipeline.push({
        $facet: {
          stats: [
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ],
          metadata: [
            { $match: statusFilter },
            { $count: "total" }
          ],
          data: [
            { $match: statusFilter },
            (limit > 0) ? { $skip: (page - 1) * limit } : { $skip: 0 },
            (limit > 0) ? { $limit: limit } : { $match: {} } // No-op if limit is 0, but cleaner to just skip limit stage. simplifying:
          ].filter(s => s) // Filter out nulls if any (though logic above is ternary expressions in array)
        }
      });

      // Fix limit logic in facet data array
      const dataPipeline = [
        { $match: statusFilter }
      ];
      if (limit > 0) {
        dataPipeline.push({ $skip: (page - 1) * limit });
        dataPipeline.push({ $limit: limit });
      }

      // Overwrite the pipeline push to be cleaner
      pipeline.pop();
      pipeline.push({
        $facet: {
          stats: [
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ],
          metadata: [
            { $match: statusFilter },
            { $count: "total" }
          ],
          data: dataPipeline
        }
      });

      const aggregationResult = await MemberModel.aggregate(pipeline);

      const resultMembers = aggregationResult[0].data;
      const total = aggregationResult[0].metadata[0] ? aggregationResult[0].metadata[0].total : 0;

      // Process stats
      const rawStats = aggregationResult[0].stats;
      const statsObj = { active: 0, expired: 0, pending: 0, total: 0 };

      // Calculate total from ALL records (respecting search but ignoring status filter)
      let globalTotal = 0;

      rawStats.forEach(s => {
        const key = (s._id || 'unknown').toLowerCase();
        if (statsObj.hasOwnProperty(key)) {
          statsObj[key] = s.count;
        }
        globalTotal += s.count;
      });
      statsObj.total = globalTotal;

      res.json({
        success: true,
        members: resultMembers,
        pagination: {
          page,
          limit,
          total, // This is total of FILTERED results
          pages: limit > 0 ? Math.ceil(total / limit) : 1
        },
        stats: statsObj // Stats of ALL results (matching search)
      });
      return;
    }


    // --- STANDARD PAGINATED FETCH (Cache-All + In-Memory Filter) ---
    const allMembers = await cache.getOrSet(
      cache.KEYS.MEMBERS_ALL,
      async () => {
        return await MemberModel.find({ gymId: req.user.gymId }).sort({ createdAt: -1 }).lean();
      },
      cache.DAY
    );

    // Filter in Node.js memory
    let filtered = allMembers;
    if (status && status !== 'all') {
      filtered = filtered.filter(m => (m.status || '').toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(m =>
        (m.fullName || '').toLowerCase().includes(q) ||
        (m.memberId || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const members = limit > 0 ? filtered.slice((page - 1) * limit, page * limit) : filtered;

    if (members.length === 0 && total === 0) {
      return res.json({
        success: true,
        members: [],
        pagination: { page, limit, total: 0, pages: 1 },
        stats: { active: 0, expired: 0, pending: 0, total: 0 }
      });
    }

    // --- BATCH FETCHING TO SOLVE N+1 ---
    const memberIds = members.map(m => m._id);
    const SubscriptionModelLocal = require("../models/subscription");

    const includeInactivePlans = req.query.includeInactivePlans === 'true';
    const allSubs = await SubscriptionModelLocal.find({ memberId: { $in: memberIds }, gymId: req.user.gymId }).lean();

    // 2. Fetch all bills related to these subscriptions
    const subIds = allSubs.map(s => s._id);
    const allBills = await BillModel.find({ subscriptionId: { $in: subIds }, gymId: req.user.gymId }).lean();

    // 3. Process data in memory
    // Group subs by member
    const subsByMember = {};
    allSubs.forEach(sub => {
      if (!subsByMember[sub.memberId]) subsByMember[sub.memberId] = [];
      subsByMember[sub.memberId].push(sub);
    });

    // Group bills by subscription
    const billsBySub = {};
    allBills.forEach(bill => {
      // bill.subscriptionId might be string or ObjectId
      const sId = bill.subscriptionId.toString();
      if (!billsBySub[sId]) billsBySub[sId] = [];
      billsBySub[sId].push(bill);
    });

    const resultMembers = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const member of members) {
      // Sort subs for this member: latest startDate first (mirroring .sort({ startDate: -1 }))
      const memberSubs = (subsByMember[member._id] || []).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

      // Filter based on includeInactivePlans if needed, though original logic did a query level filter.
      // Original: if !includeInactivePlans -> query.status in ['Active', 'Pending']
      // BUT if that returned empty, it fell back to finding latest sub regardless of status (see logic below "else")
      // So effectively we need "Active/Pending" ones first.

      const activePendingSubs = !includeInactivePlans
        ? memberSubs.filter(s => ['Active', 'Pending'].includes(s.status))
        : memberSubs;

      if (activePendingSubs.length > 0) {
        // Consolidated view logic
        let totalNet = 0;
        let totalPaid = 0;
        const packageNames = new Set();
        const membershipTypes = new Set();
        let latestEnd = activePendingSubs[0].endDate;
        let primaryStatus = member.status || 'Active';

        if (primaryStatus === 'Active' || primaryStatus === 'Pending') {
          let hasActiveDateMatch = false;

          for (const sub of activePendingSubs) {
            const subBills = billsBySub[sub._id.toString()] || [];
            const billPaid = subBills.reduce((sum, b) => sum + (b.amountPaid || 0), 0);

            totalPaid += Math.max(billPaid, sub.amountPaid || 0);
            totalNet += (sub.netPayable !== undefined ? sub.netPayable : sub.amount || 0);

            if (sub.status === 'Active' || sub.status === 'Pending') {
              packageNames.add(sub.packageName);
              membershipTypes.add(sub.membershipType || 'Monthly');
            }

            if (sub.endDate > latestEnd) latestEnd = sub.endDate;
            if (sub.endDate && new Date(sub.endDate) >= now) {
              hasActiveDateMatch = true;
            }
          }

          if (!hasActiveDateMatch && activePendingSubs.length > 0) {
            primaryStatus = 'Expired';
          }
          if ((totalNet - totalPaid) > 0) {
            primaryStatus = 'Pending';
          }
        }

        resultMembers.push({
          ...member,
          packageName: Array.from(packageNames).join(', '),
          membershipType: Array.from(membershipTypes).join(', '),
          startDate: activePendingSubs[0]?.startDate,
          endDate: latestEnd,
          balanceAmount: Math.max(0, totalNet - totalPaid),
          pendingPayments: Math.max(0, totalNet - totalPaid),
          status: primaryStatus,
          netPayable: totalNet,
          amount: totalNet,
          trainerId: activePendingSubs[0].trainerId,
          trainerName: activePendingSubs[0].trainerName
        });
      } else {
        // No Active/Pending subs (or requested inactive). Fallback to latest sub of ANY status.
        // Logic: "Use latest inactive if available or just member data"
        // In our sorted 'memberSubs', the first one is the latest by startDate. 
        // We should probably check CreatedAt if startDate is ambiguous, but original used sort by createdAt for one fallback
        // The original "else" block did: findOne(...).sort({ createdAt: -1 })

        // Let's re-sort by createdAt for fallback to match original EXACTLY
        const allSubsByCreated = (subsByMember[member._id] || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const latestSub = allSubsByCreated[0];

        if (latestSub) {
          const subBills = billsBySub[latestSub._id.toString()] || [];
          const billPaid = subBills.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
          const subPaid = Math.max(billPaid, latestSub.amountPaid || 0);
          const subNet = latestSub.netPayable !== undefined ? latestSub.netPayable : latestSub.amount || 0;
          const subBalance = Math.max(0, subNet - subPaid);

          let effectiveStatus = member.status || latestSub.status;
          if (latestSub.endDate && new Date(latestSub.endDate) < now) effectiveStatus = 'Expired';

          const hideData = !includeInactivePlans && ['Hold'].includes(effectiveStatus);

          resultMembers.push({
            ...member,
            packageName: hideData ? "" : latestSub.packageName,
            membershipType: hideData ? "" : latestSub.membershipType,
            startDate: latestSub.startDate,
            endDate: latestSub.endDate,
            balanceAmount: hideData ? 0 : subBalance,
            pendingPayments: hideData ? 0 : subBalance,
            status: effectiveStatus,
            netPayable: hideData ? 0 : subNet,
            amount: hideData ? 0 : subNet,
            trainerId: latestSub.trainerId,
            trainerName: latestSub.trainerName,
            _subId: latestSub._id
          });
        } else {
          resultMembers.push({
            ...member,
            packageName: "",
            status: member.status || "Active",
            balanceAmount: 0,
            pendingPayments: 0
          });
        }
      }
    }

    // --- Calculate Stats (Global) ---
    // These are separate counts, they remain separate queries but are fast (indexed)
    const countPending = await MemberModel.countDocuments({ gymId: req.user.gymId, status: 'Pending' });

    const countExpired = await MemberModel.countDocuments({
      gymId: req.user.gymId,
      status: { $nin: ['Pending', 'Hold', 'Cancelled'] },
      endDate: { $lt: now }
    });

    const countActive = await MemberModel.countDocuments({
      gymId: req.user.gymId,
      status: 'Active',
      $or: [{ endDate: { $gte: now } }, { endDate: null }]
    });

    res.json({
      success: true,
      members: resultMembers,
      pagination: { page, limit, total, pages: limit > 0 ? Math.ceil(total / limit) : 1 },
      stats: {
        active: countActive,
        expired: countExpired,
        pending: countPending,
        total
      }
    });
  } catch (error) {
    console.error("Get members error:", error);
    res.json({ success: false, message: error.message });
  }
};

// Get single member (Unchanged)
const getMemberById = async (req, res) => {
  try {
    const id = req.params.id;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const query = isValidObjectId
      ? { $or: [{ memberId: id }, { _id: id }] }
      : { memberId: id };

    const member = await MemberModel.findOne({ ...query, gymId: req.user.gymId });
    if (!member) {
      return res.json({ success: false, message: "Member not found" });
    }

    res.json({ success: true, member });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Update member (Unchanged key logic)
const updateMember = async (req, res) => {
  try {
    const updateData = req.body;
    const member = await MemberModel.findOne({
      gymId: req.user.gymId,
      $or: [{ memberId: req.params.id }, { _id: req.params.id }],
    });
    if (!member) {
      return res.json({ success: false, message: "Member not found" });
    }

    // Handle name updates
    if (updateData.firstName || updateData.lastName) {
      const fn = updateData.firstName || member.firstName;
      const ln = updateData.lastName || member.lastName;
      updateData.fullName = `${fn} ${ln}`.trim();
    }

    // Handle file uploads
    if (req.files) {
      if (req.files.profilePhoto && req.files.profilePhoto[0]) {
        if (member.profilePhoto) {
          const oldPhotoPath = path.join(__dirname, '..', member.profilePhoto);
          if (fs.existsSync(oldPhotoPath) && fs.lstatSync(oldPhotoPath).isFile()) {
            try {
              fs.unlinkSync(oldPhotoPath);
            } catch (err) {
              console.error("Error deleting old profile photo:", err);
            }
          }
        }
        updateData.profilePhoto = `/uploads/members/${req.files.profilePhoto[0].filename}`;
      }

      // Handle Medical Reports (Multiple)
      let finalMedicalReports = member.medicalReports || [];
      if (typeof finalMedicalReports === 'string') finalMedicalReports = [finalMedicalReports];

      if (updateData.existingMedicalReports) {
        try {
          const retained = JSON.parse(updateData.existingMedicalReports);
          if (Array.isArray(retained)) {
            const filesToRemove = finalMedicalReports.filter(p => !retained.includes(p));
            filesToRemove.forEach(fPath => {
              const fullPath = path.join(__dirname, '..', fPath);
              if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
                try { fs.unlinkSync(fullPath); } catch (e) { console.error('Error deleting file:', e); }
              }
            });
            finalMedicalReports = retained;
          }
        } catch (e) { console.error("Error parsing existingMedicalReports:", e); }
      }

      if (req.files.medicalReports) {
        const newPaths = req.files.medicalReports.map(file => `/uploads/members/${file.filename}`);
        finalMedicalReports = [...finalMedicalReports, ...newPaths];
      }
      updateData.medicalReports = finalMedicalReports;
    } else if (updateData.existingMedicalReports) {
      let finalMedicalReports = member.medicalReports || [];
      if (typeof finalMedicalReports === 'string') finalMedicalReports = [finalMedicalReports];
      try {
        const retained = JSON.parse(updateData.existingMedicalReports);
        if (Array.isArray(retained)) {
          const filesToRemove = finalMedicalReports.filter(p => !retained.includes(p));
          filesToRemove.forEach(fPath => {
            const fullPath = path.join(__dirname, '..', fPath);
            if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
              try { fs.unlinkSync(fullPath); } catch (e) { console.error('Error deleting file:', e); }
            }
          });
          updateData.medicalReports = retained;
        }
      } catch (e) { console.error("Error processing retention:", e); }
    }

    if (updateData.memberId && updateData.memberId !== member.memberId) {
      const conflictMember = await MemberModel.findOne({ memberId: updateData.memberId, gymId: req.user.gymId }).lean();
      const conflictStaff = await StaffModel.findOne({ staffId: updateData.memberId, gymId: req.user.gymId }).lean();
      if (conflictMember || conflictStaff) {
        return res.json({ success: false, message: 'Member ID already in use' });
      }
    }

    Object.assign(member, updateData);
    await member.save();

    // Invalidate caches
    await cache.invalidateMembers();
    await cache.invalidateMemberById(member.memberId, member.phone);

    res.json({ success: true, message: "Member updated successfully", member });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Delete member
const deleteMember = async (req, res) => {
  try {
    const member = await MemberModel.findOneAndDelete({
      gymId: req.user.gymId,
      $or: [{ memberId: req.params.id }, { _id: req.params.id }],
    });
    if (!member) return res.json({ success: false, message: "Member not found" });

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

    if (member.profilePhoto) safeUnlink(member.profilePhoto);

    if (member.medicalReports) {
      if (Array.isArray(member.medicalReports)) {
        member.medicalReports.forEach(report => safeUnlink(report));
      } else {
        safeUnlink(member.medicalReports);
      }
    }

    // Invalidate caches
    await cache.invalidateMembers();
    await cache.invalidateMemberById(member.memberId, member.phone);

    res.json({ success: true, message: "Member deleted successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Test member phone search
const testMemberPhoneSearch = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.json({ success: false, message: "Phone number is required" });
    const members = await MemberModel.find({ phone: { $regex: phone, $options: "i" }, gymId: req.user.gymId }).limit(10);
    res.json({ success: true, members });
  } catch (error) { res.json({ success: false, message: error.message }); }
};

// Get next member ID
const getNextMemberId = async (req, res) => {
  try {
    const nextId = await generateNumericId();
    res.json({ success: true, nextId });
  } catch (error) { res.json({ success: false, message: error.message }); }
};

// Sync Pending Status Manually
const syncPendingStatus = async (req, res) => {
  try {
    const members = await MemberModel.find({ gymId: req.user.gymId });
    let count = 0;
    let fixed = 0;

    for (const member of members) {
      const subs = await SubscriptionModel.find({ memberId: member._id, gymId: req.user.gymId });
      if (subs.length > 0) {
        let totalNet = 0;
        let totalPaid = 0;

        for (const sub of subs) {
          const linkedBills = await BillModel.find({ subscriptionId: sub._id, gymId: req.user.gymId });
          const billPaid = linkedBills.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
          totalPaid += Math.max(billPaid, sub.amountPaid || 0);
          totalNet += (sub.netPayable !== undefined ? sub.netPayable : sub.amount || 0);
        }

        const balance = Math.max(0, totalNet - totalPaid);

        if (balance > 0) {
          if (member.status !== 'Pending') {
            member.status = 'Pending';
            await member.save();
            fixed++;
          }
          count++;
        }
      }
    }
    res.json({ success: true, message: `Synced. Found ${count} pending members. Updated status for ${fixed}.` });
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addMember,
  getMembers,
  getMemberById,
  updateMember,
  deleteMember,
  testMemberPhoneSearch,
  getNextMemberId,
  syncPendingStatus
};