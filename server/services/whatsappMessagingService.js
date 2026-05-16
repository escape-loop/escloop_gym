const axios = require('axios');
const fs = require('fs');
const path = require('path');
const GymSettings = require('../models/GymSettings.js');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://host.docker.internal:8083';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'mySecretGlobalApiKey123';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'apikey': EVOLUTION_API_KEY
});

// Helper: Format to 10 digit Indian number with 91 prepended, handle country codes smartly
function _formatPhone(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, '');
    
    // Strip leading 0 if present (common in India for trunk dialing)
    if (digits.startsWith('0')) {
        digits = digits.substring(1);
    }
    
    // If it starts with 91 and has 12 digits, it's correct
    if (digits.length === 12 && digits.startsWith('91')) {
        return digits;
    }
    
    // If it's exactly 10 digits, assume India and prepend 91
    if (digits.length === 10) {
        return `91${digits}`;
    }
    
    // If it's longer than 10 digits and doesn't start with 91, it might be another country code
    if (digits.length > 10) {
        return digits;
    }
    
    return null;
}

// Helper: Random delay for anti-ban
const _delay = (min, max) => {
    const ms = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
    return new Promise(resolve => setTimeout(resolve, ms));
};

async function _getVerifiedInstance(gymId) {
    try {
        let settings = await GymSettings.findOne({ gymId });
        if (!settings || !settings.whatsappInstanceName) {
            console.log(`[WhatsApp Service] Expected instance for gym ${gymId} but not found in settings.`);
            return null; // Gracefully skip
        }

        const instanceName = settings.whatsappInstanceName;

        // Check connection state
        const response = await axios.get(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
            headers: getHeaders()
        });

        // The exact structure from Evolution API is usually response.data.instance.state === 'open' 
        // We will accept 'open' state.
        if (response.data?.instance?.state === 'open') {
            return instanceName;
        } else {
            console.log(`[WhatsApp Service] Instance ${instanceName} is not open (state: ${response.data?.instance?.state}). Skipping message.`);
            return null;
        }
    } catch (error) {
        console.warn(`[WhatsApp Service] Failed to verify instance for gym ${gymId}:`, error.message);
        return null; // Gracefully skip on error
    }
}

async function sendTextMessage(gymId, mobile, text) {
    const instanceName = await _getVerifiedInstance(gymId);
    if (!instanceName) return false;

    const formattedMobile = _formatPhone(mobile);
    if (!formattedMobile) {
        console.warn(`[WhatsApp Service] Invalid mobile number: ${mobile}`);
        return false;
    }

    try {
        const response = await axios.post(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
            number: formattedMobile,
            text
        }, {
            headers: getHeaders()
        });
        console.log(`[WhatsApp Service] Message sent to ${formattedMobile} via ${instanceName}`);
        return response.data;
    } catch (error) {
        console.error(`[WhatsApp Service] Failed to send text to ${formattedMobile}:`, error.message);
        return false;
    }
}

async function sendDocumentMessage(gymId, mobile, base64, fileName, caption = '') {
    const instanceName = await _getVerifiedInstance(gymId);
    if (!instanceName) return false;

    const formattedMobile = _formatPhone(mobile);
    if (!formattedMobile) return false;

    // Evolution API requires pure base64 WITHOUT the data URI prefix
    const mediaData = base64.startsWith('data:') ? base64.split(',')[1] : base64;

    try {
        const response = await axios.post(`${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`, {
            number: formattedMobile,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: caption,
            media: mediaData,
            fileName: fileName
        }, {
            headers: getHeaders()
        });
        console.log(`[WhatsApp Service] Document sent to ${formattedMobile} via ${instanceName}`);
        return response.data;
    } catch (error) {
        const detail = error.response?.data || error.message;
        console.error(`[WhatsApp Service] Failed to send document to ${formattedMobile}:`, JSON.stringify(detail));
        return false;
    }
}

/**
 * 1. Customized Bulk Messaging
 */
async function sendBulkMessages(gymId, members, buildMessageFn) {
    let count = 0;
    for (const member of members) {
        const phone = member.phone || member.mobileNumber || member.mobile;
        if (!phone) continue;
        
        const name = member.name || member.fullName || 'Member';
        const message = buildMessageFn(member);
        
        console.log(`[WhatsApp Service] Bulk sending to ${name} (${phone})...`);
        const result = await sendTextMessage(gymId, phone, message);
        if (result) count++;

        // Delay between 15-40 seconds
        const waitTime = Math.floor(Math.random() * (40 - 15 + 1) + 15);
        console.log(`[WhatsApp Service] Waiting ${waitTime} seconds before next bulk message...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    }
    return count;
}

/**
 * 2. Staff Pay Slip
 */
async function sendPayslipMessage(staff, paymentDetails, pdfBase64, gymId) {
     const fileName = `${paymentDetails.month}-${staff.fullName}.pdf`.replace(/\s+/g, '_');
     return await sendDocumentMessage(gymId, staff.phone, pdfBase64, fileName, '');
}

/**
 * 3. Personalized Plan Sender
 */
async function sendPersonalizedPlanMessage(member, pdfBase64, gymId) {
    const name = member.name || member.fullName || 'Member';
    const phone = member.phone || member.mobileNumber || member.mobile;
    const fileName = `${name} Personalized Plan.pdf`;
    return await sendDocumentMessage(gymId, phone, pdfBase64, fileName, '');
}

/**
 * 4. Notification Reminder
 */
async function sendNotificationReminderBulk(gymId, members, type, gymName) {
    return await sendBulkMessages(gymId, members, (member) => {
        if (type === 'attendance') {
            return `Hi ${member.name},\nWe noticed you haven't visited ${gymName} for the last few days and just wanted to check in.\nHope everything is okay. Whenever you're ready to come back, we're here to help you get back on track with your workouts and goals.\nIf you've visited recently, please ignore this message.\n- ${gymName}`;
        }
        
        if (type === 'pending') {
            return `Hi ${member.name},\nThis is a reminder from ${gymName} that you have a pending payment of ₹${member.balanceAmount || 0}.\nPlease clear your dues at the front desk at your earliest convenience.\nThank you!\n- ${gymName}`;
        }

        // expiry
        const expiryText = member.expiryDate || member.endDate || 'soon';
        return `Hi ${member.name},\nThis is a friendly reminder that your membership at ${gymName} will expire on ${expiryText}.\nRenew now to continue:\n- Full gym access\n- Classes & sessions\n- Member benefits without interruption\nYou can renew at the front desk or by calling us. If you've already renewed, please ignore this message.\n- ${gymName}`;
    });
}

/**
 * 5. New Subscription
 */
async function sendNewSubscriptionMessage(member, subscription, gymId, gymName) {
    const message = `Hi ${member.fullName || member.name || `${member.firstName} ${member.lastName}`},\n\nYour subscription at ${gymName} is confirmed!\n\nSubscription Details:\nPackage: ${subscription.packageName}\n\nValidity:\nStart: ${new Date(subscription.startDate).toLocaleDateString()}\nEnd: ${new Date(subscription.endDate).toLocaleDateString()}\n\nPayment:\nTotal Amount: Rs.${subscription.amount}\nPaid: Rs.${subscription.amount}\n\nMember ID: ${member.memberId}\n\nWelcome to ${gymName}! We're excited to support your fitness journey.`;
    return await sendTextMessage(gymId, member.phone, message);
}

/**
 * 5b. New Member Welcome (Registration)
 */
async function sendNewMemberWelcomeMessage(member, gymId, gymName) {
    const name = member.fullName || member.name || `${member.firstName} ${member.lastName}`;
    const message = `Hi ${name},\n\nWelcome to ${gymName}! We are thrilled to have you join us.\n\nYour Member ID is ${member.memberId}.\n\nFeel free to reach out if you need any assistance getting started!\n\n- ${gymName} Team`;
    return await sendTextMessage(gymId, member.phone, message);
}

/**
 * 6. Monthly Report to Owner
 */
async function sendMonthlyReportMessage(ownerPhone, pdfBase64, reportMonth, reportYear, gymId) {
    const caption = `Your Monthly report - ${reportMonth} ${reportYear}`;
    const fileName = `${reportMonth}-${reportYear}-report.pdf`;
    return await sendDocumentMessage(gymId, ownerPhone, pdfBase64, fileName, caption);
}

/**
 * 7. Lead Follow-up
 */
async function sendLeadFollowUpMessage(lead, gymId, gymName) {
    const message = `Hi ${lead.name}, this is ${gymName} team.\n\nJust following up about your interest in joining us. We'd love to help you get started with your fitness goals.\n\nWe can schedule:\n- A quick gym visit & tour\n- A trial workout session\n- A short consultation about your goals\n\nAre you free today or tomorrow for a visit? You can reply with:\n1 - Today\n2 - Tomorrow\n3 - Another day`;
    return await sendTextMessage(gymId, lead.phone, message);
}

/**
 * 8. Invoice Sender
 */
async function sendInvoiceMessage(bill, member, pdfBase64, gymId) {
    const name = member.fullName || member.name || `${member.firstName} ${member.lastName}`;
    const fileName = `${name}-${bill.invoiceId}.pdf`.replace(/\s+/g, '_');
    return await sendDocumentMessage(gymId, member.phone, pdfBase64, fileName, '');
}

/**
 * 9. Expiry Date Reminder
 */
async function sendExpiryReminderMessage(member, daysUntilExpiry, gymId, gymName) {
    const name = member.fullName || member.name || `${member.firstName} ${member.lastName}`;
    const expiryText = new Date(member.endDate).toLocaleDateString();
    
    let message = '';
    if (daysUntilExpiry === 7) {
        message = `Hi ${name},\n\nThis is a friendly reminder that your membership at ${gymName} will expire in 7 days, on ${expiryText}.\n\nRenew now to continue:\n- Full gym access\n- Classes & sessions\n- Member benefits without interruption\n\nYou can renew at the front desk or via calling.\nIf you've already renewed, please ignore this message.\n- ${gymName}`;
    } else if (daysUntilExpiry === 3) {
        message = `Hi ${name},\n\nYour membership at ${gymName} will expire in 3 days on ${expiryText}.\n\nTo avoid any interruption in your workouts and classes, please renew your membership as soon as possible.\nYou can renew at the Front desk or via calling.\nIf you've already renewed, please ignore this message.`;
    } else if (daysUntilExpiry === 1) {
        message = `Hi ${name},\n\nLast reminder - your membership at ${gymName} expires tomorrow (${expiryText}).\n\nRenew today to keep your access active without any break.\nYou can renew at the Front desk or via calling.\nIf you've already renewed, please ignore this message.\n- ${gymName}`;
    } else if (daysUntilExpiry === -1) {
        message = `Hi ${name},\n\nJust a quick reminder that your membership at ${gymName} expired yesterday, on ${expiryText}.\n\nIf you'd like to continue your workouts without a long break, you can renew your membership today at the front desk or by calling us.\nWe'd be happy to help you restart your routine.\nIf you've already renewed, please ignore this message.\n- ${gymName}`;
    } else if (daysUntilExpiry === -5) {
        message = `Hi ${name},\n\nOur records show that your membership at ${gymName} expired 5 days ago, on ${expiryText}.\n\nIf you'd like to continue your fitness journey with us, you can still renew your membership and restore your access.\n- ${gymName}`;
    } else if (daysUntilExpiry === -15) {
        message = `Hi ${name},\n\nIt's been about 2 weeks since your membership at ${gymName} expired on ${expiryText}.\n\nWe'd really love to see you back in the gym and continuing your progress. You can reactivate your membership anytime at the front desk or by calling us.\nIf you've already renewed, please ignore this message.\n- ${gymName}`;
    }

    if (!message) return false;
    return await sendTextMessage(gymId, member.phone, message);
}

/**
 * 10. Birthday Reminder
 */
async function sendBirthdayReminderMessage(member, gymId, gymName) {
    const name = member.fullName || member.name || `${member.firstName} ${member.lastName}`;
    const message = `Hi ${name},\n\nHappy Birthday from all of us at ${gymName}!\n\nWishing you a year full of:\n- Stronger workouts\n- Better health\n- More energy and confidence\n\nWe're glad to have you as part of our fitness family and would love to see you at the club today!\n- ${gymName}`;
    return await sendTextMessage(gymId, member.phone, message);
}

/**
 * 11. Attendance Enquiry
 */
async function sendAttendanceReminderMessage(member, daysAbsent, gymId, gymName) {
    const name = member.fullName || member.name || `${member.firstName} ${member.lastName}`;
    const message = `Hi ${name},\n\nWe noticed you've been absent for the last ${daysAbsent} days and just wanted to check in with you.\n\nHope everything is okay on your side. If there's anything we should know or any support you need, please feel free to let us know.\n\nWhenever you're ready to come back, we'll be here to help you get back on track.\n- ${gymName}`;
    return await sendTextMessage(gymId, member.phone, message);
}

module.exports = {
    _getVerifiedInstance,
    sendTextMessage,
    sendDocumentMessage,
    sendBulkMessages,
    sendPayslipMessage,
    sendPersonalizedPlanMessage,
    sendNotificationReminderBulk,
    sendNewSubscriptionMessage,
    sendMonthlyReportMessage,
    sendLeadFollowUpMessage,
    sendInvoiceMessage,
    sendExpiryReminderMessage,
    sendBirthdayReminderMessage,
    sendAttendanceReminderMessage,
    sendNewMemberWelcomeMessage
};
