const { jsPDF } = require('jspdf');
const autoTableModule = require('jspdf-autotable');
const autoTable = autoTableModule.default || autoTableModule;
const fs = require('fs');
const path = require('path');
const GymSettings = require('../models/GymSettings');

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

async function generateInvoicePDF(bill) {
  const gymSettings = (await GymSettings.findOne({ gymId: bill.gymId })) || {
    gymName: "Stretch Fitness Club",
    address: "117/1 Devi Nagar 8th Street, Salai, Koladi,\nThiruverkadu, Chennai, Tamil Nadu 600077, India",
    mobile: "+91 81221 81669",
    landmark: "Near Ramalaya Palace"
  };

  try {
    const doc = new jsPDF();
    const filename = `invoices/${bill.invoiceId}.pdf`;
    const filePath = path.join(__dirname, '..', 'public', filename);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // Theme Colors
    const primaryOrange = [255, 122, 26];
    const accentOrange = [255, 91, 0];
    const lightBg = [255, 243, 224];
    const borderOrange = [255, 224, 191];

    // Hardcoded Base64 Logo
    const logoBase64 = "data:image/jpeg;base64,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";

    // -- Header --
    if (gymSettings.gymLogo) {
      try {
        const logoPath = path.join(__dirname, '..', gymSettings.gymLogo);
        if (fs.existsSync(logoPath)) {
          const logoData = fs.readFileSync(logoPath).toString('base64');
          const ext = path.extname(logoPath).substring(1).toUpperCase() || 'JPEG';
          doc.addImage(logoData, ext === 'JPG' ? 'JPEG' : ext, 15, 10, 30, 30);
        } else {
          doc.addImage(logoBase64, 'JPEG', 15, 10, 30, 30);
        }
      } catch (e) {
        console.error("Logo add failed", e);
        doc.addImage(logoBase64, 'JPEG', 15, 10, 30, 30);
      }
    } else {
      try {
        doc.addImage(logoBase64, 'JPEG', 15, 10, 30, 30);
      } catch (e) {
        console.error("Logo add failed", e);
      }
    }

    // Gym Name & Address
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(...primaryOrange);
    doc.text(gymSettings.gymName || "Stretch Fitness Club", 55, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);

    const fullAddress = gymSettings.address || "117/1 Devi Nagar 8th Street, Salai, Koladi,\nThiruverkadu, Chennai, Tamil Nadu 600077, India";
    const addressLines = fullAddress.split('\n');
    let addressY = 28;
    addressLines.forEach(line => {
      doc.text(line, 55, addressY);
      addressY += 5;
    });

    if (gymSettings.landmark) {
      doc.text(`Landmark: ${gymSettings.landmark}`, 55, addressY);
      addressY += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`Mobile: ${gymSettings.mobile || "+91 81221 81669"}`, 55, addressY + 2);

    // Main Separator
    doc.setLineWidth(1);
    doc.setDrawColor(...primaryOrange);
    doc.line(15, 55, 195, 55);

    // -- Title --
    doc.setFontSize(18);
    doc.setTextColor(...accentOrange);
    doc.text("PAYMENT RECEIPT", 105, 70, { align: "center" });

    // -- Member & Subscription Details --
    const leftX = 15;
    const rightColX = 110;
    let y = 85;
    const lineHeight = 7;

    doc.setFontSize(10);
    doc.setTextColor(0);

    // Member Details Box Header
    doc.setFont("helvetica", "bold");
    doc.setFillColor(...lightBg);
    doc.rect(leftX - 2, y - 5, 80, lineHeight, 'F');
    doc.text("Member Details:", leftX, y);
    y += lineHeight + 3;

    doc.setFont("helvetica", "normal");
    const memIdDisplay = bill.memberId ? (bill.memberId.memberId || bill.memberId) : 'N/A';
    const mobileDisplay = bill.memberId && bill.memberId.phone ? bill.memberId.phone : 'N/A';

    doc.text(`Name: ${bill.memberName}`, leftX, y); y += lineHeight;
    doc.text(`Member ID: ${memIdDisplay}`, leftX, y); y += lineHeight;
    doc.text(`Mobile: ${mobileDisplay}`, leftX, y); y += lineHeight;

    // Invoice Details Box Header
    let yRight = 85;
    doc.setFont("helvetica", "bold");
    doc.setFillColor(...lightBg);
    doc.rect(rightColX - 2, yRight - 5, 80, lineHeight, 'F');
    doc.text("Invoice Details:", rightColX, yRight);
    yRight += lineHeight + 3;

    doc.setFont("helvetica", "normal");
    doc.text(`Invoice No: ${bill.invoiceId}`, rightColX, yRight); yRight += lineHeight;
    doc.text(`Invoice Date: ${new Date(bill.invoiceDate).toLocaleDateString()}`, rightColX, yRight); yRight += lineHeight;
    doc.text(`Due Date: ${new Date(bill.dueDate).toLocaleDateString()}`, rightColX, yRight); yRight += lineHeight;
    doc.text(`Payment Mode: ${bill.paymentMode || 'Cash'}`, rightColX, yRight); yRight += lineHeight;

    // Optional Details (Subscription or Plan)
    if (bill.subscriptionId && bill.subscriptionId.packageName) {
      doc.text(`Package: ${bill.subscriptionId.packageName}`, leftX, y); y += lineHeight;
      doc.text(`Duration: ${bill.subscriptionId.duration} months`, leftX, y); y += lineHeight;
      if (bill.subscriptionId.startDate && bill.subscriptionId.endDate) {
        doc.text(`Validity: ${new Date(bill.subscriptionId.startDate).toLocaleDateString()} to ${new Date(bill.subscriptionId.endDate).toLocaleDateString()}`, leftX, y); y += lineHeight;
      }
    } else if (bill.personalizedPlan) {
      doc.text(`Plan Name: ${bill.personalizedPlan.planName}`, leftX, y); y += lineHeight;
      doc.text(`Duration: ${bill.personalizedPlan.durationMonths} months`, leftX, y); y += lineHeight;
    }

    // Align y for table
    y = Math.max(y, yRight) + 10;

    // -- Table --
    const tableHeaders = [['Description', 'Rate', 'Amount']];
    const tableBody = [];

    // Main Item
    let itemDesc = "Payment";
    if (bill.subscriptionId && bill.subscriptionId.packageName) {
      itemDesc = `Subscription: ${bill.subscriptionId.packageName}`;
    } else if (bill.personalizedPlan) {
      itemDesc = `Plan: ${bill.personalizedPlan.planName}`;
    }

    const rate = bill.subtotal;
    const amount = bill.totalAmount;

    tableBody.push([
      itemDesc,
      `Rs. ${rate}`,
      `Rs. ${amount}`
    ]);

    autoTable(doc, {
      startY: y,
      head: tableHeaders,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: primaryOrange, textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { halign: 'right', cellWidth: 45 },
        2: { halign: 'right', cellWidth: 45 }
      },
      margin: { left: 15, right: 15 },
    });

    // -- Totals --
    y = doc.lastAutoTable.finalY + 10;
    const rightMargin = 195;

    doc.setFont("helvetica", "normal");
    doc.text("Sub Total:", 150, y);
    doc.text(`Rs. ${bill.subtotal}`, rightMargin, y, { align: "right" });
    y += 8;

    if (bill.discount && bill.discount > 0) {
      doc.text("Discount:", 150, y);
      doc.text(`- Rs. ${bill.discount}`, rightMargin, y, { align: "right" });
      y += 8;
    }

    if (bill.taxAmount && bill.taxAmount > 0) {
      doc.text(`Tax (${bill.taxRate}%):`, 150, y);
      doc.text(`Rs. ${bill.taxAmount}`, rightMargin, y, { align: "right" });
      y += 8;
    }

    doc.setFont("helvetica", "bold");
    doc.setFillColor(...lightBg);
    doc.rect(145, y - 5, 50, 8, 'F');
    doc.text("Total Paid:", 150, y);
    doc.text(`Rs. ${bill.amountPaid}`, rightMargin, y, { align: "right" });
    y += 8;

    if (bill.balance > 0) {
      doc.setTextColor(220, 53, 69); // Red for balance
      doc.text("Balance Due:", 150, y);
      doc.text(`Rs. ${bill.balance}`, rightMargin, y, { align: "right" });
    } else {
      doc.setTextColor(40, 167, 69); // Green for paid
      doc.text("Balance Due:", 150, y);
      doc.text(`Rs. 0`, rightMargin, y, { align: "right" });
    }
    y += 15;

    // -- Amount in Words --
    doc.setTextColor(0);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Amount in Words: ${numberToWords(bill.amountPaid)}`, 15, y);
    y += 15;

    // -- Notes --
    if (bill.notes) {
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", 15, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.text(bill.notes, 15, y);
      y += 10;
    }

    // -- Terms & Conditions Box --
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(...borderOrange);
    doc.roundedRect(15, y, 180, 25, 3, 3, 'FD');

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Terms & Conditions:", 20, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("1. Fees once paid are non-refundable and non-transferable under any circumstances.", 20, y); y += 4;
    doc.text("2. Management is not responsible for the loss of personal belongings.", 20, y); y += 4;
    doc.text("3. This is a computer generated invoice and does not require a physical signature.", 20, y);

    // Save
    doc.save(filePath);

    // Return url
    return `/public/${filename}`;

  } catch (error) {
    console.error("PDF Generation Error:", error);
    throw error;
  }
}

module.exports = {
  generateInvoicePDF
};
