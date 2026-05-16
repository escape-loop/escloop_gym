const axios = require('axios');
const GymSettings = require('../models/GymSettings.js');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://host.docker.internal:8083';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'mySecretGlobalApiKey123';

console.log('[WhatsApp] Evolution API URL:', EVOLUTION_API_URL);

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'apikey': EVOLUTION_API_KEY
});

// Cache for instances we've already verified as existing in the current process life
const verifiedInstances = new Set();

/**
 * Ensures that a WhatsApp instance exists on the Evolution API server.
 * If it doesn't exist, it creates it.
 */
const ensureInstanceExists = async (instanceName) => {
  if (verifiedInstances.has(instanceName)) return;

  try {
    // Check if it exists by fetching connection state
    await axios.get(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
      headers: getHeaders()
    });
    console.log(`[WhatsApp] Instance "${instanceName}" verified.`);
    verifiedInstances.add(instanceName);
  } catch (error) {
    if (error.response?.status === 404) {
      // Instance not found, create it
      console.log(`[WhatsApp] Instance "${instanceName}" not found on Evolution API. Attempting creation...`);
      try {
        const createRes = await axios.post(`${EVOLUTION_API_URL}/instance/create`, {
          instanceName: instanceName,
          token: instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        }, { headers: getHeaders() });
        console.log(`[WhatsApp] Instance "${instanceName}" created successfully:`, createRes.data);
        verifiedInstances.add(instanceName);
      } catch (createError) {
        const status = createError.response?.status;
        const detail = JSON.stringify(createError.response?.data || createError.message);
        console.error(`[WhatsApp] Failed to create instance "${instanceName}" (status ${status}):`, detail);
        
        // If it's 409, it actually exists (maybe a race condition), so ignore
        if (status === 409) {
          verifiedInstances.add(instanceName);
          return;
        }
        throw new Error(`Instance creation failed: ${detail}`);
      }
    } else {
      // Other error (e.g. connection refused, auth error)
      const detail = error.response?.data || error.message;
      console.error(`[WhatsApp] Error verifying instance "${instanceName}":`, detail);
      throw error;
    }
  }
};

/**
 * Helper to get the instance name for a gym and ensure it exists on the Evolution API.
 */
const getVerifiedInstanceName = async (gymId) => {
  let settings = await GymSettings.findOne({ gymId });
  if (!settings) {
    settings = await GymSettings.create({ gymId, gymName: 'My Gym' });
  }

  let instanceName = settings.whatsappInstanceName;
  if (!instanceName) {
    instanceName = `gym-${gymId}`;
    settings.whatsappInstanceName = instanceName;
    await settings.save();
  }

  // Ensure it actually exists in Evolution API
  await ensureInstanceExists(instanceName);

  return instanceName;
};

exports.getInstance = async (req, res) => {
  try {
    const gymId = req.user.gymId;
    const instanceName = await getVerifiedInstanceName(gymId);

    const response = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      headers: getHeaders()
    });

    if (response.status === 200) {
      const instances = response.data;
      const instance = instances.find(inst => inst.name === instanceName || inst.instanceName === instanceName);
      if (instance) {
        return res.json({ success: true, instance });
      }
    }

    res.json({ success: true, instance: { name: instanceName, connectionStatus: 'close' } });

  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('[WhatsApp] getInstance error:', detail);
    res.status(500).json({ success: false, message: typeof detail === 'object' ? JSON.stringify(detail) : String(detail) });
  }
};

exports.getConnectionState = async (req, res) => {
  try {
    const instanceName = await getVerifiedInstanceName(req.user.gymId);
    const response = await axios.get(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
      headers: getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('[WhatsApp] getConnectionState error:', detail);
    res.status(500).json({ success: false, message: typeof detail === 'object' ? JSON.stringify(detail) : String(detail) });
  }
};

exports.connect = async (req, res) => {
  try {
    const instanceName = await getVerifiedInstanceName(req.user.gymId);
    const response = await axios.get(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
      headers: getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('[WhatsApp] connect error:', detail);
    res.status(500).json({ success: false, message: typeof detail === 'object' ? JSON.stringify(detail) : String(detail) });
  }
};

exports.sendText = async (req, res) => {
  try {
    const instanceName = await getVerifiedInstanceName(req.user.gymId);
    const { number, text } = req.body;

    const response = await axios.post(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      number,
      text
    }, {
      headers: getHeaders()
    });

    res.json(response.data);
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('[WhatsApp] sendText error:', detail);
    res.status(500).json({ success: false, message: typeof detail === 'object' ? JSON.stringify(detail) : String(detail) });
  }
};

exports.restart = async (req, res) => {
  try {
    const instanceName = await getVerifiedInstanceName(req.user.gymId);
    await axios.post(`${EVOLUTION_API_URL}/instance/restart/${instanceName}`, {}, {
      headers: getHeaders()
    });
    res.json({ success: true });
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('[WhatsApp] restart error:', detail);
    res.status(500).json({ success: false, message: typeof detail === 'object' ? JSON.stringify(detail) : String(detail) });
  }
};

exports.logout = async (req, res) => {
  try {
    const instanceName = await getVerifiedInstanceName(req.user.gymId);
    const response = await axios.delete(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
      headers: getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('[WhatsApp] logout error:', detail);
    res.status(500).json({ success: false, message: typeof detail === 'object' ? JSON.stringify(detail) : String(detail) });
  }
};

const whatsappService = require('../services/whatsappMessagingService');

// Helper to check if a specific automation is enabled
async function checkAutomationToggle(gymId, toggleKey) {
    const settings = await GymSettings.findOne({ gymId }).lean();
    if (!settings || !settings.automationToggles) return true; // Default to true if not set
    return settings.automationToggles[toggleKey] !== false;
}

// Helper to get Gym Name
async function getGymName(gymId) {
    const settings = await GymSettings.findOne({ gymId }).lean();
    return settings && settings.gymName ? settings.gymName : 'Stretch Fitness Club';
}

exports.sendNotificationReminder = async (req, res) => {
    try {
        const { type, members } = req.body;
        const gymName = await getGymName(req.user.gymId);
        
        if (!members || !members.length) {
            return res.status(400).json({ success: false, message: 'No members provided' });
        }

        // Map notification type to toggle key
        const typeToToggle = {
            'expiry': 'subscriptionRenewal',
            'renewal': 'subscriptionRenewal',
            'attendance': 'attendanceAlert',
            'birthday': 'birthdayWish',
            'followup': 'enquiryFollowup'
        };

        const toggleKey = typeToToggle[type];
        if (toggleKey) {
            const isEnabled = await checkAutomationToggle(req.user.gymId, toggleKey);
            if (!isEnabled) {
                return res.status(403).json({ 
                    success: false, 
                    message: `WhatsApp automation for ${type} is disabled in Account Settings. Please enable it to proceed.` 
                });
            }
        }

        // Fire asynchronously to prevent frontend timeout for bulk scheduling
        whatsappService.sendNotificationReminderBulk(req.user.gymId, members, type, gymName)
            .catch(err => console.error('[WhatsApp Bulk] sendNotificationReminderBulk error:', err));
        
        res.json({ success: true, message: `Reminders dispatch started for ${members.length} member(s).` });
    } catch (error) {
        console.error('[WhatsApp] sendNotificationReminder error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendCustomText = async (req, res) => {
    try {
        const { members, member, text } = req.body;
        const targetMembers = members || (member ? [member] : []);
        
        if (!targetMembers.length) {
            return res.status(400).json({ success: false, message: 'No members provided' });
        }

        // Send asynchronously to prevent frontend timeout
        whatsappService.sendBulkMessages(req.user.gymId, targetMembers, (m) => text)
            .catch(err => console.error('[WhatsApp Bulk] targetMembers error:', err));
            
        res.json({ success: true, message: `Message string started for ${targetMembers.length} member(s).` });
    } catch (error) {
        console.error('[WhatsApp] sendCustomText error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendPersonalizedPlan = async (req, res) => {
    try {
        const isEnabled = await checkAutomationToggle(req.user.gymId, 'personalizedPlan');
        if (!isEnabled) {
            return res.status(403).json({ 
                success: false, 
                message: 'WhatsApp automation for Personalized Plans is disabled in Account Settings. Please enable it to proceed.' 
            });
        }

        const { pdf, name, mobileNumber, memberId, email } = req.body;
        const gymName = await getGymName(req.user.gymId);
        
        // Construct the member object expected by the service
        const member = {
            fullName: name,
            mobileNumber: mobileNumber,
            memberId: memberId,
            email: email
        };

        await whatsappService.sendPersonalizedPlanMessage(member, pdf, req.user.gymId);
        res.json({ success: true, message: 'Personalized plan sent successfully.' });
    } catch (error) {
        console.error('[WhatsApp] sendPersonalizedPlan error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendReport = async (req, res) => {
    try {
        const { pdf, reportMonth, reportYear } = req.body;
        const gymId = req.user.gymId;

        // Fetch gym settings to get the owner's mobile number
        const settings = await GymSettings.findOne({ gymId }).lean();
        
        if (settings?.automationToggles?.revenueReportToOwner === false) {
            return res.status(403).json({ 
                success: false, 
                message: 'WhatsApp automation for Revenue Reports is disabled in Account Settings. Please enable it to proceed.' 
            });
        }

        if (!settings || !settings.mobile) {
            return res.status(400).json({ success: false, message: 'Gym owner mobile number not found in settings.' });
        }

        const ownerPhone = settings.mobile;
        
        // Wait for the message to be sent to ensure it actually succeeded
        const result = await whatsappService.sendMonthlyReportMessage(ownerPhone, pdf, reportMonth, reportYear, gymId);
        
        if (!result) {
            return res.status(400).json({ success: false, message: 'Failed to send WhatsApp message. Please check if the number is correct or if your WhatsApp instance is connected.' });
        }

        res.json({ success: true, message: `Report for ${reportMonth} ${reportYear} is successfully sent to ${ownerPhone}.` });
    } catch (error) {
        console.error('[WhatsApp] sendReport error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
