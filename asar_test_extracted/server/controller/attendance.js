const Attendance = require('../models/attendance');
const Staff = require('../models/staff');
const Member = require('../models/member');
const StaffSalary = require('../models/staffSalary');
const GymSettings = require('../models/GymSettings');
const { Expense } = require('../models/expense');
const { generateExpenseId } = require('../utils/expenseUtils');
const { sendPayslipMessage } = require('../services/whatsappMessagingService');
const tenantStorage = require('../middleware/tenantContext');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const cache = require('../services/cacheService');
const markAttendance = async (req, res) => {
  try {
    const { type, attendanceId, phoneNo, date } = req.body;
    const now = new Date();

    // Geolocation Verification REMOVED


    let today;
    if (date) {
      today = date;
    } else {
      today = now.getFullYear().toString() + '-' +
        (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
        now.getDate().toString().padStart(2, '0');
    }

    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });  // e.g., 9:35 PM

    let person = null;
    let activeType = type;

    // Helper to find person by multiple potential ID formats
    const findPersonById = async (Model, idField, id) => {
      if (!id) return null;
      id = id.toString().trim();
      const gymId = req.user?.gymId || tenantStorage.getStore();
      
      // Try exact match
      let p = await Model.findOne({ [idField]: id, gymId });
      if (p) return p;

      // If ID is numeric, try padded and unpadded versions
      if (/^\d+$/.test(id)) {
        const numericId = parseInt(id, 10);
        const patterns = [
          numericId.toString(),               // Unpadded (e.g., "1")
          numericId.toString().padStart(3, '0'), // 3-digit (e.g., "001")
          numericId.toString().padStart(4, '0'), // 4-digit (e.g., "0001")
          numericId.toString().padStart(5, '0')  // 5-digit (e.g., "00001")
        ];
        // Remove the one we already tried with the exact match
        const otherPatterns = patterns.filter(pat => pat !== id);
        if (otherPatterns.length > 0) {
          p = await Model.findOne({ [idField]: { $in: otherPatterns }, gymId });
        }
      }
      return p;
    };

    // 1. If type is provided (from Attendance page), use specific search
    if (activeType) {
      const Model = activeType === 'member' ? Member : Staff;
      const idField = activeType === 'member' ? 'memberId' : 'staffId';
      if (attendanceId) {
        // Check cache first
        const cacheKey = activeType === 'member'
          ? cache.KEYS.memberById(attendanceId.toString().trim())
          : cache.KEYS.staffById(attendanceId.toString().trim());
        const cached = await cache.get(cacheKey);
        if (cached) {
          person = cached;
        } else {
          person = await findPersonById(Model, idField, attendanceId);
          if (person) await cache.set(cacheKey, person.toObject ? person.toObject() : person, cache.DAY);
        }
      } else if (phoneNo) {
        // Check phone cache
        const phoneCacheKey = activeType === 'member'
          ? cache.KEYS.memberByPhone(phoneNo)
          : cache.KEYS.staffByPhone(phoneNo);
        const cached = await cache.get(phoneCacheKey);
        if (cached) {
          person = cached;
        } else {
          person = await Model.findOne({ phone: phoneNo, gymId: req.user.gymId });
          if (person) await cache.set(phoneCacheKey, person.toObject ? person.toObject() : person, cache.DAY);
        }
      }
    }

    // 2. If not found or type not provided (Global Keypad), search both (ID first)
    if (!person) {
      // Try Member ID
      person = await findPersonById(Member, 'memberId', attendanceId);
      if (person) {
        activeType = 'member';
      } else {
        // Try Staff ID
        person = await findPersonById(Staff, 'staffId', attendanceId);
        if (person) {
          activeType = 'staff';
        } else {
          // Try Phone match only as absolute fallback
          const phoneToSearch = phoneNo || (attendanceId?.toString().length >= 10 ? attendanceId.toString().trim() : null);
          if (phoneToSearch) {
            // Check for 10 digits, 0+10 digits, 91+10 digits
            const potentialPhones = [
              phoneToSearch,
              '0' + phoneToSearch,
              '91' + phoneToSearch
            ];
            // Also add +91 just in case
            potentialPhones.push('+91' + phoneToSearch);

            person = await Member.findOne({ phone: { $in: potentialPhones }, gymId: req.user.gymId });

            if (person) activeType = 'member';
            else {
              person = await Staff.findOne({ phone: { $in: potentialPhones }, gymId: req.user.gymId });
              if (person) activeType = 'staff';
            }
          }
        }
      }
    }

    if (!person) {
      console.log(`[Attendance] Person not found for ID: ${attendanceId}, Phone: ${phoneNo}`);
      return res.status(404).json({ success: false, message: 'ID/Phone not found', audio: 'invalid' });
    }

    console.log(`[Attendance] Found ${activeType}: ${person.fullName || person.firstName} (Status: ${person.status})`);

    // Status Validation
    if (activeType === 'member') {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      const personName = person.fullName || `${person.firstName} ${person.lastName}`;
      const currentStatus = (person.status || '').toLowerCase().trim();



      // Check for Expired status or date
      const isExpiredByDate = person.endDate && new Date(person.endDate) < todayDate;
      if (currentStatus === 'expired' || isExpiredByDate) {
        // Prevent duplicate expired logging
        const existingExpired = await Attendance.findOne({
          type: activeType,
          date: today,
          entityId: person.memberId || person.staffId,
          status: 'expired'
        });

        if (!existingExpired) {
          // Record the expired attempt in the Attendance collection
          const expiredAttendance = new Attendance({
            type: activeType,
            entityId: person.memberId || person.staffId,
            mobile: person.phone || 'N/A',
            date: today,
            status: 'expired',
            time: currentTime
          });
          try {
            await expiredAttendance.save();
            return res.json({
              success: false,
              message: isExpiredByDate ? `${personName}: Membership expired on ${new Date(person.endDate).toLocaleDateString()}` : `${personName}: Membership status is Expired`,
              audio: 'expired',
              person: person,
              expiredSaved: true,
              data: expiredAttendance
            });
          } catch (e) {
            console.error('Failed to save expired attendance:', e);
          }
        }

        return res.json({
          success: false,
          message: isExpiredByDate ? `${personName}: Membership expired on ${new Date(person.endDate).toLocaleDateString()}` : `${personName}: Membership status is Expired`,
          audio: 'expired',
          person: person
        });
      }

      // Check for other invalid statuses (Cancelled, etc)
      if (currentStatus !== 'active' && currentStatus !== 'pending') {
        return res.json({
          success: false,
          message: `Denied: ${personName} [${activeType.toUpperCase()}] is ${person.status}. (Record: ${person._id.toString().slice(-4)})`,
          audio: 'invalid',
          person: person
        });
      }
    } else if (activeType === 'staff') {
      const currentStatus = (person.status || '').toLowerCase().trim();
      const personName = person.fullName || `${person.firstName} ${person.lastName}`;
      // Staff validation
      if (currentStatus === 'inactive') {
        return res.json({
          success: false,
          message: `Denied: ${personName} [STAFF] is Inactive. (Record: ${person._id.toString().slice(-4)})`,
          audio: 'inactive',
          person: person
        });
      }

      if (currentStatus === 'on leave') {
        return res.json({
          success: false,
          message: `${personName} [STAFF] is currently On Leave. Attendance not recorded.`,
          audio: 'onleave',
          person: person
        });
      }

      if (currentStatus !== 'active') {
        return res.json({
          success: false,
          message: `Denied: ${personName} [STAFF] is ${person.status}. (Record: ${person._id.toString().slice(-4)})`,
          audio: 'invalid',
          person: person
        });
      }
    }

    // Get the correct ID from the person record
    const personId = activeType === 'member' ? person.memberId : person.staffId;

    // 2. Check if attendance already exists for this person today
    const existingAttendance = await Attendance.findOne({
      gymId: req.user.gymId,
      type: activeType,
      date: today,
      entityId: personId
    });

    if (existingAttendance) {
      return res.json({
        success: false, // Standard for error/warning handling
        existing: true, // Flag for frontend
        message: 'Attendance already marked for today',
        person: person, // Send person details back so we can show them
        data: existingAttendance,
        audio: 'successful' // Still count as success for audio feedback
      });
    }

    // 3. Create new attendance if not exists
    const newAttendance = new Attendance({
      type: activeType,
      entityId: personId, // Use memberId or staffId
      mobile: person.phone || 'N/A',
      date: today,
      status: 'present',
      time: currentTime
    });

    await newAttendance.save();

    const gymSettings = await GymSettings.findOne({ gymId: req.user.gymId });
    const gymName = gymSettings?.gymName || "Gym Name";

    res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: newAttendance,
      person: person,
      gymName: gymName,
      audio: 'successful'
    });
  } catch (error) {
    console.error("Attendance Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get daily attendance (GET /api/attendance/daily/:type/:date)
const getDailyAttendance = async (req, res) => {
  try {
    const { type, date } = req.params;

    if (!type || !date) {
      return res.status(400).json({ success: false, message: 'Type and date are required' });
    }

    const queryDate = new Date(date);

    // Find attendance records
    const attendanceRecords = await Attendance.find({
      gymId: req.user.gymId,
      type,
      date: queryDate
    });

    // If no records, return empty list
    if (attendanceRecords.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Populate details from Member or Staff collection
    const Model = type === 'member' ? Member : Staff;

    // Get all entityIds (which are memberId or staffId) and mobile numbers
    const entityIds = attendanceRecords
      .filter(r => r.entityId)
      .map(r => r.entityId);

    const mobileNumbers = attendanceRecords
      .filter(r => r.mobile)
      .map(r => r.mobile);

    // Fetch people details matching EITHER ID OR Phone
    const searchConditions = [];

    if (entityIds.length > 0) {
      if (type === 'member') {
        searchConditions.push({ memberId: { $in: entityIds } });
      } else {
        searchConditions.push({ staffId: { $in: entityIds } });
      }
    }

    if (mobileNumbers.length > 0) {
      searchConditions.push({ phone: { $in: mobileNumbers } });
    }

    let people = [];
    if (searchConditions.length > 0) {
      people = await Model.find({ $or: searchConditions });
    }

    // Map people by BOTH ID AND phone for easy lookup
    const peopleMapById = {};
    const peopleMapByPhone = {};

    people.forEach(person => {
      const id = type === 'member' ? person.memberId : person.staffId;
      if (id) peopleMapById[id] = person;
      if (person.phone) peopleMapByPhone[person.phone] = person;
    });

    // Combine data
    const combinedData = attendanceRecords.map(record => {
      // Try to find person by ID first, then by Phone
      let person = null;
      if (record.entityId && peopleMapById[record.entityId]) {
        person = peopleMapById[record.entityId];
      } else if (record.mobile && peopleMapByPhone[record.mobile]) {
        person = peopleMapByPhone[record.mobile];
      }

      return {
        _id: record._id,
        attendanceId: record.entityId || 'N/A', // Show the ID
        mobile: record.mobile,
        date: record.date,
        time: record.time,
        status: record.status,
        name: person ? (person.fullName || `${person.firstName} ${person.lastName}`) : 'Unknown',
        image: person ? person.profilePhoto : null,
      };
    });

    res.json({ success: true, count: combinedData.length, data: combinedData });

  } catch (error) {
    console.error("Error fetching daily attendance:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete attendance record (DELETE /api/attendance/:id)
const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRecord = await Attendance.findOneAndDelete({
      _id: id,
      gymId: req.user.gymId
    });

    if (!deletedRecord) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }

    res.json({ success: true, message: "Attendance record deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStaffSalaryDetails = async (req, res) => {
  try {
    const { month } = req.query; // format: YYYY-MM
    let startDate, endDate;

    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0); // last day of the month
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // Helper to format date to YYYY-MM-DD
    const formatDate = (date) => {
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;
        return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0');
      } catch (e) {
        return null;
      }
    };

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid month format" });
    }

    const staff = await Staff.find({ gymId: req.user.gymId, status: { $ne: 'Deleted' } });

    // 0. Fetch existing salary records for this month
    const targetMonth = month || formatDate(new Date())?.slice(0, 7) || "";
    const salaryRecords = await StaffSalary.find({ gymId: req.user.gymId, month: targetMonth });
    const salaryStatusMap = {};
    salaryRecords.forEach(rec => {
      if (rec.staffId) salaryStatusMap[rec.staffId] = rec;
    });

    // 1. Fetch all attendance records for the month to identify active gym days
    const allGymAttendance = await Attendance.find({
      gymId: req.user.gymId,
      date: { $gte: startDate, $lte: endDate }
    });

    // 2. Extract unique active dates (YYYY-MM-DD) where at least one staff was present
    const activeDates = new Set();
    allGymAttendance.forEach(a => {
      if (a.type === 'staff' && a.status === 'present') {
        const dStr = formatDate(a.date);
        if (dStr) activeDates.add(dStr);
      }
    });

    const attendanceMap = {};
    allGymAttendance.forEach(record => {
      if (record.type === 'staff' && record.status === 'present' && record.entityId) {
        if (!attendanceMap[record.entityId]) {
          attendanceMap[record.entityId] = 0;
        }
        attendanceMap[record.entityId]++;
      }
    });

    // Robust helper to normalize workDays to an array of strings
    const normalizeWorkDaysArr = (workDays) => {
      if (!workDays) return [];
      let current = workDays;

      // Attempt to unwrap stringified arrays repeatedly if needed
      for (let i = 0; i < 3; i++) {
        if (Array.isArray(current) && current.length === 1 && typeof current[0] === 'string' && current[0].trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(current[0]);
            if (Array.isArray(parsed)) {
              current = parsed;
              continue;
            }
          } catch (e) { }
        }
        if (typeof current === 'string' && current.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(current);
            if (Array.isArray(parsed)) {
              current = parsed;
              continue;
            }
          } catch (e) { }
        }
        break;
      }

      if (Array.isArray(current)) {
        return current.map(s => String(s).trim()).filter(Boolean);
      }
      if (typeof current === 'string') {
        return current.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };

    // Helper to count actual working days (excluding gym holidays)
    const countActualWorkingDays = (year, monthIdx, workDays, activeDates) => {
      const normalized = normalizeWorkDaysArr(workDays);
      if (normalized.length === 0) return 0;

      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      const dayMap = {
        'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
        'Thursday': 4, 'Friday': 5, 'Saturday': 6
      };

      const targetDayIndices = normalized
        .map(d => dayMap[d.trim()])
        .filter(idx => idx !== undefined);

      let count = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const currentDate = new Date(year, monthIdx, d);
        const dayOfWeek = currentDate.getDay();

        if (targetDayIndices.includes(dayOfWeek)) {
          const dateStr = formatDate(currentDate);
          // Consider it a working day ONLY if at least one attendance record exists for the gym that day
          if (dateStr && activeDates.has(dateStr)) {
            count++;
          }
        }
      }
      return count;
    };

    // Helper to get specific absent dates
    const getAbsentDatesList = (year, monthIdx, workDays, activeDates, staffId, attendanceMap) => {
      const normalized = normalizeWorkDaysArr(workDays);
      if (normalized.length === 0) return [];

      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      const dayMap = {
        'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
        'Thursday': 4, 'Friday': 5, 'Saturday': 6
      };

      const targetDayIndices = normalized
        .map(d => dayMap[d.trim()])
        .filter(idx => idx !== undefined);

      const absentDatesList = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const currentDate = new Date(year, monthIdx, d);
        const dayOfWeek = currentDate.getDay();

        if (targetDayIndices.includes(dayOfWeek)) {
          const dateStr = formatDate(currentDate);
          // It's a working day (gym was active)
          if (dateStr && activeDates.has(dateStr)) {
            // Check if THIS staff member was present
            const isPresent = allGymAttendance.some(r =>
              r.entityId === staffId &&
              r.type === 'staff' &&
              r.status === 'present' &&
              formatDate(r.date) === dateStr
            );

            if (!isPresent) {
              absentDatesList.push(dateStr);
            }
          }
        }
      }
      return absentDatesList;
    };

    const year = startDate.getFullYear();
    const monthIdx = startDate.getMonth();

    const staffDetails = staff.map(s => {
      const normalized = normalizeWorkDaysArr(s.workDays);
      const salaryRecord = salaryStatusMap[s.staffId];

      // If record exists, use stored values. Otherwise calculate dynamically.
      const presentDays = salaryRecord ? salaryRecord.presentDays : (attendanceMap[s.staffId] || 0);
      const totalWorkingDays = salaryRecord ? salaryRecord.totalWorkingDays : countActualWorkingDays(year, monthIdx, normalized, activeDates);

      // specific absent dates calculation
      const absentDatesList = salaryRecord ? [] : getAbsentDatesList(year, monthIdx, normalized, activeDates, s.staffId, attendanceMap);
      const absentDays = salaryRecord ? salaryRecord.absentDays : absentDatesList.length;

      const currentSalary = salaryRecord ? salaryRecord.baseSalary : s.salary;

      const currentMonthStr = formatDate(new Date())?.slice(0, 7) || "";
      let paymentStatus = salaryRecord ? salaryRecord.status : 'Unpaid';

      // Logic: Only allow Mark as Paid and Payslip for months that have ENDED
      // If month is current or future, status is "Processing" and actions should be blocked
      const isMonthOver = targetMonth < currentMonthStr;
      if (!salaryRecord && !isMonthOver) {
        paymentStatus = 'Processing';
      }

      return {
        staffId: s.staffId,
        _id: s._id,
        fullName: s.fullName,
        firstName: s.firstName,
        lastName: s.lastName,
        profilePhoto: s.profilePhoto,
        department: s.department,
        role: s.role,
        phone: s.phone,
        salary: currentSalary,
        workDaysInWeek: normalized.length,
        presentDays,
        absentDays,
        totalWorkingDays, // Based on gym active days or stored record
        absentDates: absentDatesList,
        paymentStatus,
        paymentRecordId: salaryRecord ? salaryRecord._id : null,
        isActionable: isMonthOver || !!salaryRecord // Can view payslip if paid, or mark paid if month over
      };
    });

    res.json({
      success: true,
      data: staffDetails,
      month: month || `${year}-${String(monthIdx + 1).padStart(2, '0')}`
    });

  } catch (error) {
    console.error("Error fetching staff salary details:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const markStaffPaid = async (req, res) => {
  try {
    const { staffId, month, finalAmount, presentDays, absentDays, totalWorkingDays, paymentMode } = req.body;

    if (!staffId || !month) {
      return res.status(400).json({ success: false, message: "Staff ID and Month are required" });
    }

    const salary = await StaffSalary.findOneAndUpdate(
      { gymId: req.user.gymId, staffId, month },
      {
        gymId: req.user.gymId,
        staffId,
        month,
        baseSalary: req.body.baseSalary,
        presentDays,
        absentDays,
        totalWorkingDays,
        finalAmount,
        status: 'Paid',
        paymentDate: new Date(),
        paymentMode: paymentMode || 'Cash'
      },
      { upsert: true, new: true }
    );

    // Create Expense Record
    const staff = await Staff.findOne({ gymId: req.user.gymId, staffId });
    const expenseId = await generateExpenseId();
    const monthName = new Date(month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });

    await Expense.create({
      gymId: req.user.gymId,
      invoiceId: `SAL-${staffId}-${month.replace('-', '')}`, // Unique invoice for salary
      title: `Salary Payment - ${staff ? staff.fullName : staffId} (${monthName})`,
      category: 'salaries',
      amount: finalAmount,
      totalWithGst: finalAmount,
      date: new Date(),
      paymentMode: (paymentMode || 'cash').toLowerCase(),
      notes: `Staff Salary for ${monthName}. Present: ${presentDays}, Absent: ${absentDays}`
    });

    // Send salary payslip webhook
    if (staff) {
      console.log(`[Salary] Staff found: ${staff.fullName} (${staff.staffId}). Attempting webhook...`);
      // 1. Get Gym Settings
      let gymSettings = await GymSettings.findOne({ gymId: req.user.gymId });
      if (!gymSettings) {
        gymSettings = {
          gymName: "Stretch Fitness Club",
          address: "117/1 Devi Nagar 8th Street, Salai, Koladi,\nThiruverkadu, Chennai, Tamil Nadu 600077, India",
          mobile: "+91 81221 81669",
          gymLogo: null,
          authorizerSignature: null
        };
      }

      // 2. Generate PDF Buffer
      try {
        const salaryRecordObj = salary.toObject(); // Ensure it's a plain object if needed, but Mongoose doc works
        const pdfBuffer = await generatePayslipPDF(salaryRecordObj, staff, gymSettings);
        const pdfBase64 = pdfBuffer.toString('base64');
        console.log(`[Salary] PDF Generated. Size: ${pdfBase64.length}`);

        // 3. Send WhatsApp Message (if enabled)
        const isSalaryPayslipEnabled = gymSettings?.automationToggles?.salaryPayslip !== false;
        
        if (isSalaryPayslipEnabled) {
          sendPayslipMessage(staff, {
            month,
            baseSalary: req.body.baseSalary,
            finalAmount,
            presentDays,
            absentDays,
            totalWorkingDays,
            paymentMode: paymentMode || 'Cash'
          }, pdfBase64, req.user.gymId).catch(err => {
              console.warn('[WhatsApp][Warning] Payslip message error:', err.message);
          });
        } else {
          console.log(`[Salary] Payslip automation is disabled for gymId: ${req.user.gymId}`);
        }

      } catch (pdfError) {
        console.error("Error generating PDF for whatsapp:", pdfError);
      }
    } else {
      console.error(`[Salary] Staff not found for ID: ${staffId}. Message skipped.`);
    }

    res.json({ success: true, data: salary, message: 'Salary marked as paid and recorded in expenditure' });
  } catch (error) {
    console.error("Error marking staff paid:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper to convert number to words
function numberToWords(amount) {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (amount === 0) return 'Zero';

  const intAmount = Math.floor(amount);

  const toWords = (n) => {
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
    if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + toWords(n % 100) : '');
    if (n < 100000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + toWords(n % 1000) : '');
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + toWords(n % 100000) : '');
    return n.toString();
  };

  return toWords(intAmount) + ' Rupees Only';
}

// Helper to generate Payslip PDF Buffer
const generatePayslipPDF = async (salary, staff, gymSettings) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Theme Colors (Matches Invoice Template)
      const primaryOrange = "#FF7A1A";
      const accentOrange = "#FF5B00";
      const lightBg = "#FFF3E0";
      const borderOrange = "#FFE0BF";
      const darkText = "#1E293B";
      const grayText = "#64748B";
      const greenText = "#10B981";
      const redText = "#EF4444";
      const lightGrayLine = "#F1F5F9";

      // --- Header Section ---
      let yPos = 40;

      // 1. Logo
      if (gymSettings.gymLogo) {
        try {
          const logoFilename = path.basename(gymSettings.gymLogo);
          const logoPath = path.join(process.cwd(), 'uploads', 'gym', logoFilename);

          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 40, yPos, { width: 80, height: 80, fit: [80, 80], align: 'center', valign: 'center' });
          } else {
            doc.roundedRect(40, yPos, 80, 80, 5).strokeColor(primaryOrange).stroke();
            doc.font("Helvetica").fontSize(10).fillColor(primaryOrange).text("LOGO", 65, yPos + 35);
          }
        } catch (e) {
          console.error("Logo Error:", e);
        }
      } else {
        doc.roundedRect(40, yPos, 80, 80, 5).lineWidth(1).strokeColor(primaryOrange).stroke();
        doc.font("Helvetica-Bold").fontSize(20).fillColor(primaryOrange).text("GYM", 60, yPos + 30);
      }

      // 2. Gym Details
      const detailsX = 140;
      doc.font("Helvetica-Bold").fontSize(24).fillColor(primaryOrange).text(gymSettings.gymName || "Stretch Fitness Club", detailsX, yPos + 10);

      doc.font("Helvetica").fontSize(10).fillColor(grayText);
      const address = gymSettings.address || "117/1 Devi Nagar 8th Street, Salai, Koladi,\nThiruverkadu, Chennai, Tamil Nadu 600077, India";
      doc.text(address, detailsX, yPos + 40, { width: 300, lineGap: 2 });

      if (gymSettings.landmark) {
        doc.text(`Landmark: ${gymSettings.landmark}`, detailsX, doc.y);
      }

      if (gymSettings.email) {
        doc.font("Helvetica").fontSize(10).fillColor(grayText).text(`Email: ${gymSettings.email}`, detailsX, doc.y);
      }

      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fillColor(darkText).text(`Mobile: ${gymSettings.mobile || "+91 81221 81669"}`, detailsX, doc.y);

      // 3. Receipt Label
      doc.font("Helvetica-Bold").fontSize(20).fillColor(accentOrange).text("PAYSLIP", 450, yPos + 10, { align: 'right' });
      doc.fontSize(10).fillColor(grayText).text(`# ${salary.staffId}-${salary.month}`, 450, yPos + 35, { align: 'right' });
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 450, yPos + 50, { align: 'right' });

      // Separator Line
      yPos = 140;
      doc.moveTo(40, yPos).lineTo(555, yPos).lineWidth(1.5).strokeColor(primaryOrange).stroke();

      // --- Content Section ---
      yPos += 30;

      const col1X = 40;
      const col2X = 310;
      const boxWidth = 245;
      const boxHeight = 160;

      // Employee Details Box
      doc.roundedRect(col1X, yPos, boxWidth, boxHeight, 5).fill(lightBg);
      doc.rect(col1X, yPos, 5, boxHeight).fill(primaryOrange);

      doc.font("Helvetica-Bold").fontSize(10).fillColor(grayText).text("EMPLOYEE DETAILS", col1X + 15, yPos + 15);
      doc.font("Helvetica-Bold").fontSize(14).fillColor(darkText).text(staff.fullName, col1X + 15, yPos + 30);

      doc.font("Helvetica").fontSize(10).fillColor(grayText).text(`ID: ${staff.staffId}`, col1X + 15, yPos + 55);
      doc.text(`Role: ${staff.role}`, col1X + 15, yPos + 70);
      doc.text(`Department: ${staff.department || 'N/A'}`, col1X + 15, yPos + 85);

      // Payment Summary Box
      doc.roundedRect(col2X, yPos, boxWidth, boxHeight, 5).fill(lightBg);
      doc.rect(col2X, yPos, 5, boxHeight).fill(primaryOrange);

      doc.font("Helvetica-Bold").fontSize(10).fillColor(grayText).text("PAYMENT SUMMARY", col2X + 15, yPos + 15);

      doc.font("Helvetica").fontSize(10).fillColor(grayText).text("Month:", col2X + 15, yPos + 35);
      doc.font("Helvetica-Bold").fillColor(darkText).text(salary.month, col2X + 100, yPos + 35);

      doc.font("Helvetica").fillColor(grayText).text("Payment Mode:", col2X + 15, yPos + 55);
      doc.font("Helvetica-Bold").fillColor(darkText).text(salary.paymentMode, col2X + 100, yPos + 55);

      doc.font("Helvetica").fillColor(grayText).text("Status:", col2X + 15, yPos + 75);
      doc.font("Helvetica-Bold").fillColor(salary.status === 'Paid' ? greenText : redText)
        .text(salary.status.toUpperCase(), col2X + 100, yPos + 75);

      let workDaysCount = 0;
      if (Array.isArray(staff.workDays)) {
        workDaysCount = staff.workDays.length;
      } else if (typeof staff.workDays === 'string') {
        try {
          const parsed = JSON.parse(staff.workDays);
          if (Array.isArray(parsed)) workDaysCount = parsed.length;
          else workDaysCount = staff.workDays.split(',').length;
        } catch (e) {
          workDaysCount = staff.workDays.split(',').length;
        }
      }

      doc.font("Helvetica").fillColor(grayText).text("Work Days/Week:", col2X + 15, yPos + 95);
      doc.font("Helvetica-Bold").fillColor(darkText).text(`${workDaysCount} Days`, col2X + 100, yPos + 95);

      doc.font("Helvetica").fillColor(grayText).text("Total Working:", col2X + 15, yPos + 115);
      doc.font("Helvetica-Bold").fillColor(darkText).text(`${salary.totalWorkingDays} Days`, col2X + 100, yPos + 115);

      doc.font("Helvetica").fillColor(grayText).text("Attendance:", col2X + 15, yPos + 135);
      doc.font("Helvetica-Bold").fillColor(greenText).text(`P: ${salary.presentDays}`, col2X + 100, yPos + 135, { continued: true });
      doc.fillColor(darkText).text(" | ", { continued: true });
      doc.fillColor(redText).text(`A: ${salary.absentDays}`);

      yPos += boxHeight + 30;

      // Table
      doc.font("Helvetica-Bold").fontSize(10).fillColor(grayText);
      doc.text("DESCRIPTION", 40, yPos);
      doc.text("AMOUNT", 450, yPos, { align: 'right' });

      yPos += 15;
      doc.moveTo(40, yPos).lineTo(555, yPos).lineWidth(1).strokeColor(lightGrayLine).stroke();

      // Row 1
      yPos += 15;
      doc.font("Helvetica").fontSize(11).fillColor(darkText).text("Base Monthly Salary", 40, yPos);
      doc.text(`Rs. ${salary.baseSalary?.toLocaleString()}`, 450, yPos, { align: 'right' });
      yPos += 10;
      doc.font("Helvetica").fontSize(9).fillColor(grayText).text(`Total Working Days: ${salary.totalWorkingDays}`, 40, yPos);

      yPos += 15;
      doc.moveTo(40, yPos).lineTo(555, yPos).lineWidth(0.5).strokeColor(lightGrayLine).stroke();

      // Row 2
      yPos += 15;
      const perDaySalary = salary.totalWorkingDays > 0 ? (salary.baseSalary / salary.totalWorkingDays) : 0;
      const deduction = Math.round(perDaySalary * salary.absentDays);

      doc.font("Helvetica").fontSize(11).fillColor(darkText).text("Deductions (Absence)", 40, yPos);
      doc.fillColor(redText).text(`- Rs. ${deduction.toLocaleString()}`, 450, yPos, { align: 'right' });
      yPos += 10;
      doc.font("Helvetica").fontSize(9).fillColor(grayText).text(`Absent Days: ${salary.absentDays} (Present: ${salary.presentDays})`, 40, yPos);

      yPos += 15;
      doc.moveTo(40, yPos).lineTo(555, yPos).lineWidth(0.5).strokeColor(lightGrayLine).stroke();

      // Totals
      yPos += 30;
      const statsX = 350;

      doc.font("Helvetica-Bold").fontSize(12).fillColor(darkText).text("Net Payable:", statsX, yPos);
      doc.text(`Rs. ${salary.finalAmount?.toLocaleString()}`, 450, yPos, { align: 'right' });

      yPos += 20;
      doc.rect(statsX - 10, yPos - 5, 215, 30).fill(lightBg);
      doc.fillColor(accentOrange).fontSize(14).text("Net Paid Amount:", statsX, yPos + 5);
      doc.font("Helvetica-Bold").text(`Rs. ${salary.finalAmount?.toLocaleString()}`, 450, yPos + 5, { align: 'right' });

      // Footer
      const footerY = 700;
      const words = numberToWords(salary.finalAmount);
      doc.font("Helvetica").fontSize(10).fillColor(grayText).text("Amount in words:", 40, footerY - 50);
      doc.font("Helvetica-Oblique").text(words, 40, footerY - 35);

      const sigX = 400;
      if (gymSettings.authorizerSignature) {
        try {
          const sigFilename = path.basename(gymSettings.authorizerSignature);
          const sigPath = path.join(process.cwd(), 'uploads', 'gym', sigFilename);
          if (fs.existsSync(sigPath)) {
            doc.image(sigPath, sigX, footerY - 60, { fit: [150, 40], align: 'center' });
          }
        } catch (e) { }
      }

      doc.moveTo(sigX - 20, footerY - 10).lineTo(sigX + 130, footerY - 10).lineWidth(0.5).strokeColor(grayText).stroke();
      doc.font("Helvetica-Bold").fontSize(10).fillColor(darkText).text("Authorized Signature", sigX, footerY, { align: 'center', width: 110 });

      doc.moveTo(40, 750).lineTo(555, 750).lineWidth(0.5).strokeColor(borderOrange).stroke();
      doc.font("Helvetica").fontSize(9).fillColor(grayText);
      doc.text(`Thank you for being part of ${gymSettings.gymName}!`, 40, 760, { align: 'center', width: 515 });
      doc.text("This is a computer generated payslip.", 40, 775, { align: 'center', width: 515 });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
};

const generateStaffPayslip = async (req, res) => {
  try {
    const { id } = req.params; // StaffSalary record ID
    const salary = await StaffSalary.findOne({ _id: id, gymId: req.user.gymId });
    if (!salary) return res.status(404).json({ success: false, message: "Salary record not found" });

    const staff = await Staff.findOne({ staffId: salary.staffId, gymId: req.user.gymId });
    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });

    // Fetch Gym Settings
    let gymSettings = await GymSettings.findOne({ gymId: req.user.gymId });
    if (!gymSettings) {
      gymSettings = {
        gymName: "Gym Name",
        address: "Gym Address",
        mobile: "Gym Mobile",
        email: "Gym Email",
        gymLogo: null,
        authorizerSignature: null
      };
    }

    const pdfBuffer = await generatePayslipPDF(salary, staff, gymSettings);
    const filename = `Payslip_${salary.staffId}_${salary.month}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error("Error generating payslip:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// Public attendance endpoint for QR-based self-service (NO AUTH REQUIRED)
const markPublicAttendance = async (req, res) => {
  try {
    const { attendanceId, gymId } = req.body;
    const now = new Date();

    // Validate input
    if (!attendanceId || !attendanceId.toString().trim()) {
      return res.status(400).json({
        success: false,
        message: 'Member ID is required',
        audio: 'invalid'
      });
    }

    if (!gymId) {
      return res.status(400).json({
        success: false,
        message: 'Gym ID is required. Please use a valid QR code link.',
        audio: 'invalid'
      });
    }

    // Geolocation Verification REMOVED
    console.log("[Public Attendance] Geolocation check skipped (location removed).");


    // Helper to find person by multiple potential ID formats
    const findPersonById = async (Model, idField, id) => {
      if (!id) return null;
      id = id.toString().trim();
      const currentGymId = gymId; // From outer scope in markPublicAttendance
      
      // Try exact match
      let p = await Model.findOne({ [idField]: id, gymId: currentGymId });
      if (p) return p;

      // If ID is numeric, try padded and unpadded versions
      if (/^\d+$/.test(id)) {
        const numericId = parseInt(id, 10);
        const patterns = [
          numericId.toString(),               // Unpadded (e.g., "1")
          numericId.toString().padStart(3, '0'), // 3-digit (e.g., "001")
          numericId.toString().padStart(4, '0'), // 4-digit (e.g., "0001")
          numericId.toString().padStart(5, '0')  // 5-digit (e.g., "00001")
        ];
        // Remove the one we already tried with the exact match
        const otherPatterns = patterns.filter(pat => pat !== id);
        if (otherPatterns.length > 0) {
          p = await Model.findOne({ [idField]: { $in: otherPatterns }, gymId: currentGymId });
        }
      }
      return p;
    };

    // Security: Only allow MEMBER attendance (not staff) from public endpoint
    let person = null;

    // Run all queries within the provided gymId context
    await tenantStorage.run(gymId, async () => {
      // 1. First try memberId lookup
      person = await findPersonById(Member, 'memberId', attendanceId);

      // 2. If not found, try phone number lookup (if input looks like a phone number)
      if (!person) {
        const phoneToSearch = attendanceId?.toString().length >= 10 ? attendanceId.toString().trim() : null;
        if (phoneToSearch) {
          console.log(`[Public Attendance] Member ID not found, trying phone lookup: ${phoneToSearch}`);

          // Robust Phone Check: 10 digits, 0+10 digits, 91+10 digits
          const potentialPhones = [
            phoneToSearch,
            '0' + phoneToSearch,
            '91' + phoneToSearch
          ];
          // Also add +91 just in case
          potentialPhones.push('+91' + phoneToSearch);

          person = await Member.findOne({ phone: { $in: potentialPhones } });
        }
      }
    });

    if (!person) {
      console.log(`[Public Attendance] Member not found for ID/Phone: ${attendanceId}`);
      return res.status(404).json({
        success: false,
        message: 'Member ID not found. Please check your ID or contact reception.',
        audio: 'invalid'
      });
    }

    console.log(`[Public Attendance] Found member: ${person.fullName || person.firstName} (Status: ${person.status})`);

    // Prepare date and time
    const today = now.getFullYear().toString() + '-' +
      (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
      now.getDate().toString().padStart(2, '0');

    const currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    // Status Validation for Members
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const personName = person.fullName || `${person.firstName} ${person.lastName}`;
    const currentStatus = (person.status || '').toLowerCase().trim();

    // Create a helper for logging status-based attendance (expired/pending)
    const logStatusAttendance = async (statusLabel) => {
      const existing = await Attendance.findOne({
        gymId: person.gymId,
        type: 'member',
        date: today,
        entityId: person.memberId,
        status: statusLabel
      });

      if (!existing) {
        const memberGymId = person.gymId;
        if (memberGymId) {
          await tenantStorage.run(memberGymId, async () => {
            const att = new Attendance({
              type: 'member',
              entityId: person.memberId,
              mobile: person.phone || 'N/A',
              date: today,
              status: statusLabel,
              time: currentTime
            });
            await att.save();
          });
          return true;
        }
      }
      return false;
    };

    // Check for Expired status or date
    const isExpiredByDate = person.endDate && new Date(person.endDate) < todayDate;
    if (currentStatus === 'expired' || isExpiredByDate) {
      await logStatusAttendance('expired');
      return res.json({
        success: false,
        message: isExpiredByDate ?
          `Membership expired on ${new Date(person.endDate).toLocaleDateString()}. Please renew at reception.` :
          `Membership status is Expired. Please contact reception.`,
        audio: 'expired',
        person: person
      });
    }

    // Check for other invalid statuses
    if (currentStatus !== 'active' && currentStatus !== 'pending') {
      return res.json({
        success: false,
        message: `Unable to mark attendance. Membership status: ${person.status}. Please contact reception.`,
        audio: 'invalid',
        person: person
      });
    }

    // Check if attendance already exists for this member today
    const existingAttendance = await Attendance.findOne({
      gymId: person.gymId,
      type: 'member',
      date: today,
      entityId: person.memberId
    });

    if (existingAttendance) {
      return res.json({
        success: false,
        existing: true,
        message: `Attendance already marked for today at ${existingAttendance.time}`,
        person: person,
        data: existingAttendance,
        audio: 'successful' // Still play success sound
      });
    }

    // Create new attendance record
    const memberGymId = person.gymId;
    if (!memberGymId) {
      console.error(`[Public Attendance] Member ${person.memberId} has no gymId — cannot save attendance.`);
      return res.status(500).json({
        success: false,
        message: 'Gym context not found for this member. Please contact reception.',
        audio: 'invalid'
      });
    }

    await tenantStorage.run(memberGymId, async () => {
      const newAttendance = new Attendance({
        type: 'member',
        entityId: person.memberId,
        mobile: person.phone || 'N/A',
        date: today,
        status: 'present',
        time: currentTime
      });

      await newAttendance.save();

      const gymSettings = await GymSettings.findOne({ gymId: memberGymId });
      const gymName = gymSettings?.gymName || "Gym Name";

      res.json({
        success: true,
        message: `Attendance marked successfully! Welcome, ${personName}`,
        data: newAttendance,
        person: person,
        gymName: gymName,
        audio: 'successful'
      });
    });

  } catch (error) {
    console.error("[Public Attendance] Error:", error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again or contact reception.',
      audio: 'invalid'
    });
  }
};

module.exports = {
  markAttendance,
  markPublicAttendance,
  getDailyAttendance,
  deleteAttendance,
  getStaffSalaryDetails,
  markStaffPaid,
  generateStaffPayslip
};
