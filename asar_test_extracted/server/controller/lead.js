const LeadModel = require("../models/lead");
const { sendLeadFollowUpMessage } = require("../services/whatsappMessagingService");

// Add new lead
const addLead = async (req, res) => {
  try {
    console.log('addLead called with body:', req.body);
    console.log('Request headers:', req.headers['content-type']);

    const leadData = req.body;

    // Validate required fields
    const required = ["name", "phone"];
    const missing = required.filter((field) => !leadData[field]);
    if (missing.length > 0) {
      console.log('Missing required fields:', missing);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    console.log('Lead data received:', leadData);
    console.log('Lead data source:', leadData.source);
    console.log('Lead data status:', leadData.status);

    // Check if lead with same email or phone already exists in THIS gym
    if (leadData.email || leadData.phone) {
      const existingLead = await LeadModel.findOne({
        gymId: req.user.gymId,
        $or: [
          ...(leadData.email ? [{ email: leadData.email }] : []),
          ...(leadData.phone ? [{ phone: leadData.phone }] : [])
        ],
      });

      if (existingLead) {
        console.log('Existing lead found:', existingLead);
        return res.status(400).json({
          success: false,
          message: "Lead with this email or phone already exists",
        });
      }
    }

    const lead = new LeadModel({ ...leadData, gymId: req.user.gymId });
    console.log('Creating lead with data:', leadData);
    console.log('Lead data keys:', Object.keys(leadData));
    console.log('Lead data source:', leadData.source);
    console.log('Lead data status:', leadData.status);

    await lead.save();
    console.log('Lead saved successfully:', {
      _id: lead._id,
      name: lead.name,
      source: lead.source,
      status: lead.status,
      leadId: lead.leadId
    });

    // Check if nextFollowUpDate is today and send webhook
    if (lead.nextFollowUpDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const followUpDate = new Date(lead.nextFollowUpDate);
      followUpDate.setHours(0, 0, 0, 0);

      if (followUpDate.getTime() === today.getTime()) {
        const GymSettings = require('../models/GymSettings');
        const gymSettings = await GymSettings.findOne({ gymId: req.user.gymId });
        const gymName = gymSettings ? gymSettings.gymName : 'Stretch Fitness Club';

        console.log(`[Lead] nextFollowUpDate is today, sending whatsapp message for ${lead.name}`);
        sendLeadFollowUpMessage(lead, req.user.gymId, gymName).catch(err => {
          console.warn('[WhatsApp][Warning] Lead follow-up message error:', err.message);
        });
        // Mark as reminded to prevent duplicate from scheduled job
        lead.lastFollowUpReminderDate = new Date();
        await lead.save();
      }
    }

    res.status(201).json({
      success: true,
      message: "Lead added successfully",
      lead: {
        _id: lead._id,
        leadId: lead.leadId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        createdAt: lead.createdAt,
      },
    });
  } catch (error) {
    console.error("Error adding lead:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all leads (with pagination and filtering)
const getLeads = async (req, res) => {
  try {
    console.log('getLeads called with query:', req.query);
    console.log('User from auth:', req.user);

    const {
      status = "all",
      source,
      interestLevel,
      search,
      page = 1,
      limit = 15,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { gymId: req.user.gymId };
    if (status !== "all") query.status = status;
    if (source && source !== "all") query.source = source;
    if (interestLevel && interestLevel !== "all") query.interestLevel = interestLevel;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    console.log('Final query object:', query);

    const leads = await LeadModel.find(query)
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await LeadModel.countDocuments(query);

    // Debug: Check what's actually in the database for this gym
    const allLeads = await LeadModel.find({ gymId: req.user.gymId }).limit(10);
    console.log('All leads in database:', allLeads.map(l => ({
      _id: l._id,
      name: l.name,
      source: l.source,
      status: l.status,
      createdAt: l.createdAt
    })));

    // Debug: Check if there are any leads at all for this gym
    const totalLeadsCount = await LeadModel.countDocuments({ gymId: req.user.gymId });
    console.log('Total leads in database:', totalLeadsCount);

    console.log('Query:', query);
    console.log('Leads found:', leads);
    console.log('Total count:', total);

    res.json({
      success: true,
      leads,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalLeads: total,
        hasNextPage: parseInt(page) * parseInt(limit) < total,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get lead by ID
const getLeadById = async (req, res) => {
  try {
    const lead = await LeadModel.findOne({
      gymId: req.user.gymId,
      $or: [{ leadId: req.params.id }, { _id: req.params.id }],
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    console.log('Lead data being sent to frontend:', {
      _id: lead._id,
      name: lead.name,
      nextFollowUpDate: lead.nextFollowUpDate,
      nextFollowUpDateType: typeof lead.nextFollowUpDate,
      nextFollowUpDateValue: lead.nextFollowUpDate
    });

    res.json({ success: true, lead });
  } catch (error) {
    console.error("Error fetching lead:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update lead
const updateLead = async (req, res) => {
  try {
    const lead = await LeadModel.findOne({
      gymId: req.user.gymId,
      $or: [{ leadId: req.params.id }, { _id: req.params.id }],
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const updateData = req.body;
    Object.assign(lead, updateData);
    await lead.save();

    res.json({
      success: true,
      message: "Lead updated successfully",
      lead: {
        _id: lead._id,
        leadId: lead.leadId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        updatedAt: lead.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating lead:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete lead
const deleteLead = async (req, res) => {
  try {
    const lead = await LeadModel.findOne({
      gymId: req.user.gymId,
      $or: [{ leadId: req.params.id }, { _id: req.params.id }],
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    await lead.deleteOne();

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Convert lead to member
const convertLeadToMember = async (req, res) => {
  try {
    const lead = await LeadModel.findOne({
      gymId: req.user.gymId,
      $or: [{ leadId: req.params.id }, { _id: req.params.id }],
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    if (lead.convertedToMember) {
      return res.status(400).json({
        success: false,
        message: "Lead already converted to member",
      });
    }

    // Mark lead as converted
    lead.convertedToMember = true;
    lead.convertedAt = new Date();
    lead.convertedBy = req.user?.id; // Assuming user is authenticated
    await lead.save();

    res.json({
      success: true,
      message: "Lead converted to member successfully",
      lead: {
        _id: lead._id,
        leadId: lead.leadId,
        name: lead.name,
        convertedToMember: lead.convertedToMember,
        convertedAt: lead.convertedAt,
      },
    });
  } catch (error) {
    console.error("Error converting lead to member:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update lead status
const updateLeadStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["new", "contacted", "follow_up", "converted", "lost"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const lead = await LeadModel.findOne({
      gymId: req.user.gymId,
      $or: [{ leadId: req.params.id }, { _id: req.params.id }],
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    lead.status = status;
    await lead.save();

    res.json({
      success: true,
      message: "Lead status updated successfully",
      lead: {
        _id: lead._id,
        leadId: lead.leadId,
        name: lead.name,
        status: lead.status,
        updatedAt: lead.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating lead status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get lead statistics
const getLeadStats = async (req, res) => {
  try {
    const stats = await LeadModel.aggregate([
      { $match: { gymId: req.user.gymId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalLeads = await LeadModel.countDocuments({ gymId: req.user.gymId });
    const convertedLeads = await LeadModel.countDocuments({ gymId: req.user.gymId, convertedToMember: true });

    res.json({
      success: true,
      stats: {
        totalLeads,
        convertedLeads,
        conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : 0,
        byStatus: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Error fetching lead stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  addLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  convertLeadToMember,
  updateLeadStatus,
  getLeadStats,
};