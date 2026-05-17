const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const UserModels = require('../models/usermodel');
const GymSettings = require('../models/GymSettings');
const tenantContext = require('../middleware/tenantContext');
const userauth = require('../middleware/userauth');
const bcrypt = require('bcryptjs');
const cache = require('../services/cacheService');
const Attendance = require('../models/attendance');
const Bill = require('../models/bill');
const Equipment = require('../models/equipment');
const { Expense } = require('../models/expense');
const Fitness = require('../models/fitness');
const Lead = require('../models/lead');
const License = require('../models/license');
const Member = require('../models/member');
const Membership = require('../models/membership');
const PersonalizedPlan = require('../models/personalizedPlan');
const Staff = require('../models/staff');
const StaffSalary = require('../models/staffSalary');
const Subscription = require('../models/subscription');
/**
 * GET /api/branch/list
 * Returns all branch settings for the branches owned by the logged-in user.
 */
router.get('/list', userauth, async (req, res) => {
    try {
        const userId = req.user.id;
        let user = null;
        await tenantContext.run(null, async () => {
            user = await UserModels.findById(userId).lean();
        });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const primaryGymId = user.gymId;
        const ownedGymIds = user.ownedGymIds || [];
        const allBranchIds = [primaryGymId, ...ownedGymIds].filter(Boolean);

        // Fetch GymSettings and Stats for each branch using a direct query (bypassing tenant filter)
        const branches = await Promise.all(
            allBranchIds.map(async (gId) => {
                let settings = null;
                let stats = {
                    activeMembers: 0,
                    thisMonthRevenue: 0,
                    staffCount: 0
                };

                await tenantContext.run(null, async () => {
                    settings = await GymSettings.findOne({ gymId: gId }).lean();
                    
                    // Stats for snapshot
                    stats.activeMembers = await Member.countDocuments({ gymId: gId, status: 'Active' });
                    stats.staffCount = await Staff.countDocuments({ gymId: gId });
                    
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0,0,0,0);
                    
                    const bills = await Bill.find({ 
                        gymId: gId, 
                        status: 'paid', 
                        invoiceDate: { $gte: startOfMonth } 
                    }).lean();
                    stats.thisMonthRevenue = bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
                });

                return {
                    gymId: gId,
                    gymName: settings ? settings.gymName : (gId === primaryGymId ? "Main Branch" : gId),
                    address: settings ? settings.address : '',
                    gymLogo: settings ? settings.gymLogo : '',
                    isPrimary: gId === primaryGymId,
                    stats
                };
            })
        );

        return res.json({ success: true, branches, primaryGymId });
    } catch (err) {
        console.error('[Branch List] Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch branches' });
    }
});

/**
 * POST /api/branch/rename
 * Renames a specific branch.
 */
router.post('/rename', userauth, async (req, res) => {
    try {
        const { gymId, newName } = req.body;
        const userId = req.user.id;

        if (!gymId || !newName) {
            return res.status(400).json({ success: false, message: 'Gym ID and new name are required' });
        }

        let user = null;
        await tenantContext.run(null, async () => {
            user = await UserModels.findById(userId).lean();
        });

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const allOwned = [user.gymId, ...(user.ownedGymIds || [])];
        if (!allOwned.includes(gymId)) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not own this branch.' });
        }

        await tenantContext.run(gymId, async () => {
            await GymSettings.updateOne({ gymId }, { gymName: newName.trim() });
            await cache.invalidateGymSettings();
        });

        return res.json({ success: true, message: 'Branch renamed successfully' });
    } catch (err) {
        console.error('[Branch Rename] Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to rename branch' });
    }
});

/**
 * POST /api/branch/create
 * Creates a new branch with a unique gymId, then adds it to user's ownedGymIds.
 * Body: { branchName: string }
 */
router.post('/create', userauth, async (req, res) => {
    try {
        const { branchName } = req.body;
        if (!branchName || !branchName.trim()) {
            return res.status(400).json({ success: false, message: 'Branch name is required' });
        }

        const userId = req.user.id;
        let user = null;
        await tenantContext.run(null, async () => {
            user = await UserModels.findById(userId);
        });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Fetch primary gym settings
        let primarySettings = null;
        await tenantContext.run(null, async () => {
            primarySettings = await GymSettings.findOne({ gymId: user.gymId }).lean();
        });

        // Generate a unique gymId for the new branch
        const newGymId = `branch_${crypto.randomBytes(6).toString('hex')}`;

        // Create GymSettings for the new branch (bypassing tenantPlugin by setting gymId directly)
        const settingsCopy = { ...(primarySettings || {}) };
        delete settingsCopy._id;
        delete settingsCopy.createdAt;
        delete settingsCopy.updatedAt;
        delete settingsCopy.__v;

        const newBranchSettings = new GymSettings({
            ...settingsCopy,
            isBranch: true,
            parentGymId: user.gymId,
            gymId: newGymId,
            gymName: branchName.trim() // Use the provided branch name initially
        });

        // Temporarily clear the tenant context so the new GymSettings isn't filtered
        await tenantContext.run(null, async () => {
            await newBranchSettings.save();
        });

        // Add the new gymId to user's ownedGymIds
        if (!user.ownedGymIds.includes(newGymId)) {
            user.ownedGymIds.push(newGymId);
        }
        await user.save();

        // Re-sign JWT with updated ownedGymIds so the middleware recognizes the new branch
        // Ensure ownedGymIds is a clean array of strings to avoid Mongoose serialization issues in the JWT
        const updatedOwnedGymIds = user.ownedGymIds ? user.ownedGymIds.map(String) : [];
        const newToken = jwt.sign(
            { id: user._id, gymId: String(user.gymId), ownedGymIds: updatedOwnedGymIds },
            process.env.JWT_PASS,
            { expiresIn: '7d' }
        );
        res.cookie('token', newToken, {
            httpOnly: true,
            secure: process.env.SECURE === 'production',
            sameSite: process.env.SECURE === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        console.log(`[Branch Create] New branch "${branchName}" (${newGymId}) created by user ${userId}`);

        return res.json({
            success: true,
            message: `Branch "${branchName}" created successfully`,
            branch: {
                gymId: newGymId,
                gymName: branchName.trim(),
                isPrimary: false
            }
        });
    } catch (err) {
        console.error('[Branch Create] Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create branch' });
    }
});

/**
 * POST /api/branch/switch
 * Triggers background automation jobs for the newly switched-to branch.
 * Called by the frontend after a successful context switch.
 * Body: { targetGymId: string }
 */
router.post('/switch', userauth, async (req, res) => {
    try {
        const { targetGymId } = req.body;
        const userId = req.user.id;
        let user = null;
        await tenantContext.run(null, async () => {
            user = await UserModels.findById(userId).lean();
        });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Validate ownership
        const primaryGymId = user.gymId;
        const ownedGymIds = user.ownedGymIds || [];
        const allOwned = [primaryGymId, ...ownedGymIds].filter(Boolean);

        if (!allOwned.includes(targetGymId)) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not own this branch.' });
        }

        // Background jobs are now handled by the external cloud cron server
        // to prevent duplicate executions when multiple laptops are logged in.

        return res.json({ success: true, message: `Switched to branch: ${gymName}` });
    } catch (err) {
        console.error('[Branch Switch] Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to switch branch' });
    }
});

/**
 * POST /api/branch/delete
 * Deletes a branch and all its associated data, provided the correct account password is given.
 * Body: { gymId: string, password: string }
 */
router.post('/delete', userauth, async (req, res) => {
    try {
        const { gymId, password } = req.body;
        if (!gymId || !password) {
            return res.status(400).json({ success: false, message: 'Branch ID and password are required' });
        }

        const userId = req.user.id;
        let user = null;
        await tenantContext.run(null, async () => {
            user = await UserModels.findById(userId);
        });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Incorrect password' });
        }

        // Validate branch ownership and ensure it's not the primary branch
        if (gymId === user.gymId) {
            return res.status(400).json({ success: false, message: 'Cannot delete the primary branch' });
        }
        if (!user.ownedGymIds || !user.ownedGymIds.includes(gymId)) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not own this branch or it does not exist.' });
        }

        // Cascading delete across all relevant models
        // We run these deletes bypassing the tenant filter to ensure we specifically target the gymId
        await tenantContext.run(null, async () => {
            const deleteFilter = { gymId };
            await Promise.all([
                Attendance.deleteMany(deleteFilter),
                Bill.deleteMany(deleteFilter),
                Equipment.deleteMany(deleteFilter),
                Expense.deleteMany(deleteFilter),
                Fitness.deleteMany(deleteFilter),
                GymSettings.deleteMany(deleteFilter),
                Lead.deleteMany(deleteFilter),
                License.deleteMany(deleteFilter),
                Member.deleteMany(deleteFilter),
                Membership.deleteMany(deleteFilter),
                PersonalizedPlan.deleteMany(deleteFilter),
                Staff.deleteMany(deleteFilter),
                StaffSalary.deleteMany(deleteFilter),
                Subscription.deleteMany(deleteFilter),
            ]);
        });

        // Remove the branch from user's ownedGymIds
        user.ownedGymIds = user.ownedGymIds.filter(id => id !== gymId);
        await user.save();

        // Re-sign JWT
        const updatedOwnedGymIds = user.ownedGymIds ? user.ownedGymIds.map(String) : [];
        const newToken = jwt.sign(
            { id: user._id, gymId: String(user.gymId), ownedGymIds: updatedOwnedGymIds },
            process.env.JWT_PASS,
            { expiresIn: '7d' }
        );
        res.cookie('token', newToken, {
            httpOnly: true,
            secure: process.env.SECURE === 'production',
            sameSite: process.env.SECURE === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        console.log(`[Branch Delete] Branch "${gymId}" deleted successfully by user ${userId}`);

        return res.json({ success: true, message: 'Branch deleted successfully' });
    } catch (err) {
        console.error('[Branch Delete] Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete branch' });
    }
});

/**
 * POST /api/branch/set-credentials
 * Allows an owner to set or update login credentials for a specific branch.
 * Body: { gymId: string, email: string, password: string }
 */
router.post('/set-credentials', userauth, async (req, res) => {
    try {
        const { gymId, email, password } = req.body;
        const ownerId = req.user.id;

        if (!gymId || !email || !password) {
            return res.status(400).json({ success: false, message: 'Gym ID, email, and password are required' });
        }

        let owner = null;
        await tenantContext.run(null, async () => {
            owner = await UserModels.findById(ownerId).lean();
        });

        if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

        // Ensure current user is the owner of this branch
        const primaryGymId = owner.gymId;
        const ownedGymIds = owner.ownedGymIds || [];
        const allOwned = [primaryGymId, ...ownedGymIds].filter(Boolean);

        if (!allOwned.includes(gymId)) {
            return res.status(403).json({ success: false, message: 'Access denied: You do not own this branch.' });
        }

        await tenantContext.run(null, async () => {
            // Check if there's already a user acting as manager for this branch
            const existingManager = await UserModels.findOne({ gymId, role: 'branch_manager' });

            const hashedpassword = await bcrypt.hash(password, 10);

            if (existingManager) {
                // Check if they are trying to update an existing manager but with a new email that belongs to someone else
                if (existingManager.email !== email) {
                     const emailInUse = await UserModels.findOne({ email });
                     if (emailInUse) {
                         return res.status(400).json({ success: false, message: 'Email already in use by another user' });
                     }
                }

                existingManager.email = email;
                existingManager.password = hashedpassword;
                await existingManager.save();
                return res.json({ success: true, message: 'Branch credentials updated successfully' });
            } else {
                 // Check if the provided email is already in use globally
                 const emailInUse = await UserModels.findOne({ email });
                 if (emailInUse) {
                     return res.status(400).json({ success: false, message: 'Email already in use by another user' });
                 }

                 // Create a new branch_manager user
                 const newManager = new UserModels({
                     Name: `Manager (${gymId})`,
                     email,
                     password: hashedpassword,
                     userID: `mgr_${crypto.randomBytes(4).toString('hex')}`,
                     gymId: gymId,
                     ownedGymIds: [],
                     role: 'branch_manager'
                 });
                 await newManager.save();
                 return res.json({ success: true, message: 'Branch credentials created successfully' });
            }
        });
    } catch (err) {
        console.error('[Branch Set Credentials] Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to set branch credentials' });
    }
});

/**
 * POST /api/branch/revenue-overview
 * Aggregates revenue and member data for all owned branches.
 * Requires email and password for identity verification.
 * Body: { email: string, password: string }
 */
router.post('/revenue-overview', userauth, async (req, res) => {
    try {
        const { email, password } = req.body;
        const ownerId = req.user.id;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        let owner = null;
        await tenantContext.run(null, async () => {
            owner = await UserModels.findById(ownerId);
        });

        if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

        // Verify credentials
        const isEmailMatch = owner.email === email;
        const isPasswordMatch = await bcrypt.compare(password, owner.password);

        if (!isEmailMatch || !isPasswordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials. Verification failed.' });
        }

        // Fetch all branch IDs
        const primaryGymId = owner.gymId;
        const ownedGymIds = owner.ownedGymIds || [];
        const allBranchIds = [primaryGymId, ...ownedGymIds].filter(Boolean);

        // Aggregate revenue data for each branch bypassing tenant filter
        const overview = await Promise.all(
            allBranchIds.map(async (gId) => {
                let stats = {
                    gymId: gId,
                    gymName: '',
                    isPrimary: gId === primaryGymId,
                    totalRevenue: 0,
                    totalBills: 0,
                    memberCount: 0
                };

                await tenantContext.run(null, async () => {
                    // Fetch Gym Name
                    const settings = await GymSettings.findOne({ gymId: gId }).lean();
                    stats.gymName = settings ? settings.gymName : (gId === primaryGymId ? "Main Branch" : gId);

                    // Aggregate Paid Bills Revenue
                    const bills = await Bill.find({ gymId: gId, status: 'paid' }).lean();
                    stats.totalRevenue = bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
                    stats.totalBills = bills.length;

                    // Aggregate Expenses
                    const expensesArr = await Expense.find({ gymId: gId }).lean();
                    const generalExpense = expensesArr.reduce((sum, e) => sum + (e.totalWithGst || 0), 0);
                    
                    const salaries = await StaffSalary.find({ gymId: gId, status: 'Paid' }).lean();
                    const salaryExpense = salaries.reduce((sum, s) => sum + (s.finalAmount || 0), 0);
                    
                    stats.totalExpense = generalExpense + salaryExpense;
                    stats.netProfit = stats.totalRevenue - stats.totalExpense;

                    // Count Members
                    stats.memberCount = await Member.countDocuments({ gymId: gId });
                });

                return stats;
            })
        );

        return res.json({ success: true, overview });
    } catch (err) {
        console.error('[Branch Revenue Overview] Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch revenue overview' });
    }
});

module.exports = router;
