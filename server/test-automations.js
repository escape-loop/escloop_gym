require('dotenv').config();
const mongoose = require('mongoose');
const {
  sendNewMemberWelcomeMessage,
  sendNewSubscriptionMessage,
  sendInvoiceMessage,
  sendPayslipMessage,
  sendPersonalizedPlanMessage,
  sendExpiryReminderMessage,
  sendBirthdayReminderMessage,
  sendAttendanceReminderMessage,
  sendMonthlyReportMessage
} = require('./services/whatsappMessagingService');

const fs = require('fs');
const path = require('path');

const dbUri = process.env.MONGODB_URI || 'mongodb://admin:YourSuperSecretPassword@localhost:27018/gym_software?authSource=admin';
const gymId = '69998321026d47aed367b6be'; // From terminal logs
const gymName = 'Rose Fitness';
const testPhone = '7358546188';

// Create a dummy PDF base64
const dummyPdfPath = path.join(__dirname, 'dummy.pdf');
if (!fs.existsSync(dummyPdfPath)) {
  const { jsPDF } = require('jspdf');
  const doc = new jsPDF();
  doc.text("This is a test PDF for WhatsApp automation.", 10, 10);
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(dummyPdfPath, pdfBuffer);
}
const pdfBase64 = fs.readFileSync(dummyPdfPath).toString('base64');

const mockMember = {
  memberId: 'MEM123',
  firstName: 'Test',
  lastName: 'User',
  fullName: 'Test User',
  name: 'Test User',
  phone: testPhone,
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
};

const mockSubscription = {
  packageName: 'Annual Premium',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  amount: 15000
};

const mockBill = {
  invoiceId: 'INV-TEST-001'
};

const mockStaff = {
  fullName: 'Staff Member',
  phone: testPhone
};

const mockPaymentDetails = {
  month: 'May 2026'
};

async function testAll() {
  try {
    await mongoose.connect(dbUri);
    console.log('Connected to DB');

    console.log('1. Testing New Member Welcome...');
    await sendNewMemberWelcomeMessage(mockMember, gymId, gymName);

    console.log('2. Testing New Subscription...');
    await sendNewSubscriptionMessage(mockMember, mockSubscription, gymId, gymName);

    console.log('3. Testing Invoice...');
    await sendInvoiceMessage(mockBill, mockMember, pdfBase64, gymId);

    console.log('4. Testing Payslip...');
    await sendPayslipMessage(mockStaff, mockPaymentDetails, pdfBase64, gymId);

    console.log('5. Testing Personalized Plan...');
    await sendPersonalizedPlanMessage(mockMember, pdfBase64, gymId);

    console.log('6. Testing Expiry Reminder (7 days)...');
    await sendExpiryReminderMessage(mockMember, 7, gymId, gymName);

    console.log('7. Testing Birthday Reminder...');
    await sendBirthdayReminderMessage(mockMember, gymId, gymName);

    console.log('8. Testing Monthly Report...');
    await sendMonthlyReportMessage(testPhone, pdfBase64, 'May', '2026', gymId);

    console.log('9. Testing Attendance Reminder...');
    if (sendAttendanceReminderMessage) {
        await sendAttendanceReminderMessage(mockMember, 5, gymId, gymName);
    }

    console.log('All tests completed.');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

testAll();
