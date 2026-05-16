// pages/RevenueReport.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import '../styles/dashboard.css';
import ToggleButton from '../components/ToggleButton.jsx';
import '../styles/toggle-button.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { loadImage, drawGymHeader, drawGymFooter } from '../utils/pdfUtils';

// Generate dynamic year range from 2020 to current year + 10
const generateYearRange = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = 2020; year <= currentYear + 10; year++) {
    years.push(year);
  }
  return years;
};

const YEAR_OPTIONS = generateYearRange();

export default function RevenueReport() {
  const { isauthenticated, getuserdata, backendurl, sidebarOpen, setSidebarOpen, gymSettings } = useContext(AppContent);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [comparisonLabel, setComparisonLabel] = useState('');


  // Period selection state
  const [periodType, setPeriodType] = useState('daily'); // 'daily', 'monthly', 'yearly'
  const [selectedDate, setSelectedDate] = useState((() => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })()); // Today's date
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // Current month (0-11)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // Current year
  const [currentMetrics, setCurrentMetrics] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalExpense: 0
  });
  const [chartData, setChartData] = useState([]);

  // Get chart title based on period
  // Helper component for comparison badge
  const ComparisonBadge = ({ value }) => {
    if (!value || value === '0.0') return null;
    const numValue = parseFloat(value);
    const isPositive = numValue > 0;

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '600',
        background: isPositive ? '#dcfce7' : '#fee2e2',
        color: isPositive ? '#166534' : '#991b1b'
      }}>
        <span>{isPositive ? '↑' : '↓'}</span>
        <span>{Math.abs(numValue)}%</span>
      </span>
    );
  };

  const getChartTitle = () => {
    if (periodType === 'monthly') {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[selectedMonth]} ${selectedYear} - Daily Revenue Trend`;
    } else if (periodType === 'yearly') {
      return `${selectedYear} - Monthly Revenue Trend`;
    }
    return 'Revenue Trend';
  };

  // Fetch revenue summary (revenue, profit, expense)
  const fetchRevenueSummary = async () => {
    try {
      const params = new URLSearchParams({
        periodType,
        selectedDate,
        selectedMonth: selectedMonth.toString(),
        selectedYear: selectedYear.toString()
      });

      const response = await fetch(`${backendurl}/revenue/summary?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setCurrentMetrics(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch revenue summary:', error);
    }
  };

  // Fetch revenue trend data for chart
  const fetchRevenueTrend = async () => {
    // Only fetch trend for monthly and yearly views
    if (periodType === 'daily') {
      setChartData([]);
      return;
    }

    try {
      const params = new URLSearchParams({
        periodType,
        selectedMonth: selectedMonth.toString(),
        selectedYear: selectedYear.toString()
      });

      const response = await fetch(`${backendurl}/revenue/trend?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.success) {
        setChartData(data.trendData);
      }
    } catch (error) {
      console.error('Failed to fetch revenue trend:', error);
      setChartData([]);
    }
  };

  // Fetch analytics data whenever period changes
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        periodType,
        selectedDate,
        selectedMonth: selectedMonth.toString(),
        selectedYear: selectedYear.toString()
      });

      const response = await fetch(`${backendurl}/revenue/analytics?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();

      console.log('Revenue Analytics Response:', data);

      if (data.success) {
        setAnalytics(data.analytics);
        setComparison(data.comparison || null);
        setComparisonLabel(data.comparisonLabel || '');
        console.log('Analytics data set:', data.analytics);
        console.log('Comparison data:', data.comparison);
      } else {
        console.error('API returned unsuccessful response:', data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isauthenticated) {
      navigate("/");
      return;
    }
    getuserdata();
  }, [isauthenticated, navigate]);

  useEffect(() => {
    if (isauthenticated) {
      fetchRevenueSummary();
      fetchRevenueTrend();
      fetchAnalytics();
    }
  }, [periodType, selectedDate, selectedMonth, selectedYear, isauthenticated]);

  const getStatusClass = (status) => status === 'paid' ? 'status paid' : 'status pending';



   // Generate PDF report for monthly/yearly data
  const generateReportPDF = async (returnBase64 = false) => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const doc = new jsPDF();

    // Theme Colors (matching Billlisting.jsx)
    const primaryOrange = [255, 122, 26];
    const accentOrange = [255, 91, 0];
    const lightBg = [255, 243, 224];
    const borderOrange = [255, 224, 191];

    // -- Header with Logo, Name, Address, etc. --
    let yPos = await drawGymHeader(doc, gymSettings, backendurl);

    // -- Title --
    doc.setFontSize(18);
    doc.setTextColor(...accentOrange);
    let periodText = '';
    if (periodType === 'monthly') {
      periodText = `REVENUE REPORT - ${monthNames[selectedMonth]} ${selectedYear}`;
    } else if (periodType === 'yearly') {
      periodText = `REVENUE REPORT - Year ${selectedYear}`;
    }
    doc.text(periodText, 105, yPos, { align: "center" });

    // Generated date
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, 105, yPos + 8, { align: 'center' });

    yPos += 20;

    // Summary Section with Orange Header
    doc.setFont("helvetica", "bold");
    doc.setFillColor(...primaryOrange);
    doc.setTextColor(255, 255, 255);
    doc.rect(15, yPos - 5, 180, 8, 'F');
    doc.text("Financial Summary", 17, yPos);
    doc.setTextColor(0);
    yPos += 10;

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Amount (Rs.)']],
      body: [
        ['Total Revenue', `Rs. ${currentMetrics.totalRevenue.toLocaleString('en-IN')}`],
        ['Total Expense', `Rs. ${currentMetrics.totalExpense.toLocaleString('en-IN')}`],
        ['Net Profit', `Rs. ${currentMetrics.totalProfit.toLocaleString('en-IN')}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: primaryOrange, textColor: 255, fontStyle: 'bold' },
      styles: { cellPadding: 6, fontSize: 11, valign: 'middle' },
      columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 80, halign: 'right' } }
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // Revenue by Membership Source
    if (analytics?.bySource) {
      doc.setFont("helvetica", "bold");
      doc.setFillColor(...primaryOrange);
      doc.setTextColor(255, 255, 255);
      doc.rect(15, yPos - 5, 180, 8, 'F');
      doc.text("Revenue by Membership Source", 17, yPos);
      doc.setTextColor(0);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['Source', 'Members', 'Revenue (Rs.)']],
        body: [
          ['Yearly Membership', analytics.bySource.yearlyCount || 0, `Rs. ${(analytics.bySource.yearly || 0).toLocaleString('en-IN')}`],
          ['Half Yearly', analytics.bySource.halfYearlyCount || 0, `Rs. ${(analytics.bySource.halfYearly || 0).toLocaleString('en-IN')}`],
          ['Quarterly', analytics.bySource.quarterlyCount || 0, `Rs. ${(analytics.bySource.quarterly || 0).toLocaleString('en-IN')}`],
          ['Monthly', analytics.bySource.monthlyCount || 0, `Rs. ${(analytics.bySource.monthly || 0).toLocaleString('en-IN')}`],
          ['Fitness Plan', analytics.bySource.fitnessPlanCount || 0, `Rs. ${(analytics.bySource.fitnessPlan || 0).toLocaleString('en-IN')}`],
          ['Personal Training', analytics.bySource.personalTrainingCount || 0, `Rs. ${(analytics.bySource.personalTraining || 0).toLocaleString('en-IN')}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: primaryOrange, textColor: 255, fontStyle: 'bold' },
        styles: { cellPadding: 5, fontSize: 10, valign: 'middle' },
        columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 40, halign: 'center' }, 2: { cellWidth: 60, halign: 'right' } }
      });

      yPos = doc.lastAutoTable.finalY + 15;
    }

    // Revenue by Payment Method
    if (analytics?.byPaymentMethod) {
      doc.setFont("helvetica", "bold");
      doc.setFillColor(59, 130, 246);
      doc.setTextColor(255, 255, 255);
      doc.rect(15, yPos - 5, 180, 8, 'F');
      doc.text("Revenue by Payment Method", 17, yPos);
      doc.setTextColor(0);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['Payment Method', 'Amount (Rs.)']],
        body: [
          ['Cash', `Rs. ${(analytics.byPaymentMethod.cash || 0).toLocaleString('en-IN')}`],
          ['UPI', `Rs. ${(analytics.byPaymentMethod.upi || 0).toLocaleString('en-IN')}`],
          ['Card', `Rs. ${(analytics.byPaymentMethod.card || 0).toLocaleString('en-IN')}`],
          ['Bank Transfer', `Rs. ${(analytics.byPaymentMethod.bankTransfer || 0).toLocaleString('en-IN')}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        styles: { cellPadding: 5, fontSize: 10, valign: 'middle' },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 80, halign: 'right' } }
      });

      yPos = doc.lastAutoTable.finalY + 15;
    }

    // Membership Analytics
    if (analytics?.memberships) {
      doc.setFont("helvetica", "bold");
      doc.setFillColor(16, 185, 129);
      doc.setTextColor(255, 255, 255);
      doc.rect(15, yPos - 5, 180, 8, 'F');
      doc.text("Membership Analytics", 17, yPos);
      doc.setTextColor(0);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['Type', 'Count', 'Revenue (Rs.)']],
        body: [
          ['Renewals', analytics.memberships.renewals || 0, `Rs. ${(analytics.memberships.renewalsRevenue || 0).toLocaleString('en-IN')}`],
          ['New Memberships', analytics.memberships.newMemberships || 0, `Rs. ${(analytics.memberships.newMembershipsRevenue || 0).toLocaleString('en-IN')}`],
          ['Total Payments', analytics.paymentStats?.totalPayments || 0, `Rs. ${(analytics.paymentStats?.totalRevenue || 0).toLocaleString('en-IN')}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
        styles: { cellPadding: 5, fontSize: 10, valign: 'middle' },
        columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 40, halign: 'center' }, 2: { cellWidth: 60, halign: 'right' } }
      });

      yPos = doc.lastAutoTable.finalY + 15;
    }

    // Footer
    const footerY = 275;
    doc.setDrawColor(...borderOrange);
    doc.setLineWidth(0.5);
    doc.line(15, footerY - 5, 195, footerY - 5);
    drawGymFooter(doc, gymSettings, footerY);

    // Signature
    if (gymSettings?.authorizerSignature) {
      try {
        const baseUrl = backendurl.replace('/gym', '').replace(/\/+$/, '');
        const sigUrl = `${baseUrl}${gymSettings.authorizerSignature}`;
        const sigData = await loadImage(sigUrl);
        if (sigData) {
          doc.addImage(sigData, 'PNG', 150, yPos + 5, 40, 15);
          doc.setFontSize(9);
          doc.setTextColor(0);
          doc.text("Authorized Signature", 170, yPos + 25, { align: "center" });
        }
      } catch (e) {
        console.error("Signature add failed", e);
      }
    } else {
      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text("Authorized Signature", 170, yPos + 25, { align: "center" });
      doc.setDrawColor(0);
      doc.line(150, yPos + 20, 190, yPos + 20);
    }

    // Page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        105,
        doc.internal.pageSize.getHeight() - 5,
        { align: 'center' }
      );
    }

    // Save the PDF
    const fileName = periodType === 'monthly'
      ? `Revenue_Report_${monthNames[selectedMonth]}_${selectedYear}.pdf`
      : `Revenue_Report_${selectedYear}.pdf`;
    
    if (returnBase64) {
      return doc.output('datauristring').split(',')[1];
    }
    
    doc.save(fileName);
  };

  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const handleSendReportToWhatsApp = async () => {
    try {
      setSendingWhatsapp(true);
      const pdfBase64 = await generateReportPDF(true);
      
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const reportMonth = periodType === 'yearly' ? 'Yearly' : monthNames[selectedMonth];
      const reportYear = selectedYear.toString();

      const response = await fetch(`${backendurl}/whatsapp/send-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pdf: pdfBase64,
          reportMonth,
          reportYear
        }),
        credentials: 'include'
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Report sent successfully to gym owner!`);
      } else {
        toast.error(`Failed to send report: ${data.message}`);
      }
    } catch (error) {
      console.error("Error sending report to WhatsApp:", error);
      toast.error("An error occurred while sending the report.");
    } finally {
      setSendingWhatsapp(false);
    }
  };

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-breadcrumb">
            Dashboard / Revenue Report
          </div>
        </div>
        <div className="dash-header-right">
        </div>
      </header>

      <div className="dash-content">
        {/* Period Type Tabs */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '0'
        }}>
          <button
            onClick={() => setPeriodType('daily')}
            style={{
              padding: '12px 24px',
              background: periodType === 'daily' ? '#f97316' : 'transparent',
              color: periodType === 'daily' ? 'white' : '#6b7280',
              border: 'none',
              borderBottom: periodType === 'daily' ? '3px solid #f97316' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: periodType === 'daily' ? '600' : '500',
              transition: 'all 0.2s',
              borderRadius: '0'
            }}
          >
            Daily
          </button>
          <button
            onClick={() => setPeriodType('monthly')}
            style={{
              padding: '12px 24px',
              background: periodType === 'monthly' ? '#f97316' : 'transparent',
              color: periodType === 'monthly' ? 'white' : '#6b7280',
              border: 'none',
              borderBottom: periodType === 'monthly' ? '3px solid #f97316' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: periodType === 'monthly' ? '600' : '500',
              transition: 'all 0.2s',
              borderRadius: '0'
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setPeriodType('yearly')}
            style={{
              padding: '12px 24px',
              background: periodType === 'yearly' ? '#f97316' : 'transparent',
              color: periodType === 'yearly' ? 'white' : '#6b7280',
              border: 'none',
              borderBottom: periodType === 'yearly' ? '3px solid #f97316' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: periodType === 'yearly' ? '600' : '500',
              transition: 'all 0.2s',
              borderRadius: '0'
            }}
          >
            Yearly
          </button>
        </div>

        {/* Date/Month/Year Selector */}
        <div style={{ marginBottom: '24px' }}>
          {periodType === 'daily' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                Select Date:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#111827',
                  cursor: 'pointer'
                }}
              />
            </div>
          )}

          {periodType === 'monthly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                Select Month:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#111827',
                  cursor: 'pointer',
                  minWidth: '200px'
                }}
              >
                <option value={0}>January</option>
                <option value={1}>February</option>
                <option value={2}>March</option>
                <option value={3}>April</option>
                <option value={4}>May</option>
                <option value={5}>June</option>
                <option value={6}>July</option>
                <option value={7}>August</option>
                <option value={8}>September</option>
                <option value={9}>October</option>
                <option value={10}>November</option>
                <option value={11}>December</option>
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#111827',
                  cursor: 'pointer'
                }}
              >
                {YEAR_OPTIONS.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                onClick={generateReportPDF}
                disabled={loading || !analytics}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: loading || !analytics ? '#d1d5db' : 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: loading || !analytics ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
              >
                Download Report
              </button>
              <button
                onClick={handleSendReportToWhatsApp}
                disabled={loading || !analytics || sendingWhatsapp}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: loading || !analytics || sendingWhatsapp ? '#d1d5db' : '#2563eb', // Blue color for WhatsApp/Share
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: loading || !analytics || sendingWhatsapp ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
              >
                {sendingWhatsapp ? '⏳ Sending...' : '💬 Send to Owner (WhatsApp)'}
              </button>
            </div>
          )}

          {periodType === 'yearly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                Select Year:
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#111827',
                  cursor: 'pointer',
                  minWidth: '200px'
                }}
              >
                {YEAR_OPTIONS.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                onClick={generateReportPDF}
                disabled={loading || !analytics}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: loading || !analytics ? '#d1d5db' : 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: loading || !analytics ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
              >
                Download Report
              </button>
              <button
                onClick={handleSendReportToWhatsApp}
                disabled={loading || !analytics || sendingWhatsapp}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: loading || !analytics || sendingWhatsapp ? '#d1d5db' : '#2563eb',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: loading || !analytics || sendingWhatsapp ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
              >
                {sendingWhatsapp ? '⏳ Sending...' : '💬 Send to Owner (WhatsApp)'}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
          }}>
            <div className="spinner" style={{
              margin: '0 auto 20px',
              width: '40px',
              height: '40px',
              border: '4px solid #f3f4f6',
              borderTopColor: '#f97316',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading revenue data...</p>
          </div>
        ) : (
          <>
            {/* Current Month Metrics - 3 Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              marginBottom: '30px'
            }}>
              {/* Total Revenue Card */}
              <div style={{
                background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                padding: '28px',
                borderRadius: '12px',
                color: 'white',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}>
                <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px', fontWeight: '500' }}>
                  {periodType === 'daily' ? 'Current Day Revenue' :
                    periodType === 'monthly' ? 'Current Month Revenue' :
                      'Current Year Revenue'}
                </p>
                <h2 style={{ fontSize: '36px', fontWeight: '700', margin: '0' }}>
                  ₹{currentMetrics.totalRevenue.toLocaleString()}
                </h2>
              </div>

              {/* Total Profit Card */}
              <div style={{
                background: 'linear-gradient(135deg, #fb923c 0%, #fdba74 100%)',
                padding: '28px',
                borderRadius: '12px',
                color: 'white',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}>
                <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px', fontWeight: '500' }}>
                  {periodType === 'daily' ? 'Day' :
                    periodType === 'monthly' ? 'Month' :
                      'Year'} Total Profit
                </p>
                <h2 style={{ fontSize: '36px', fontWeight: '700', margin: '0' }}>
                  ₹{currentMetrics.totalProfit.toLocaleString()}
                </h2>
              </div>

              {/* Total Expense Card */}
              <div style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                padding: '28px',
                borderRadius: '12px',
                color: 'white',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}>
                <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px', fontWeight: '500' }}>
                  {periodType === 'daily' ? 'Day' :
                    periodType === 'monthly' ? 'Month' :
                      'Year'} Total Expense
                </p>
                <h2 style={{ fontSize: '36px', fontWeight: '700', margin: '0' }}>
                  ₹{currentMetrics.totalExpense.toLocaleString()}
                </h2>
              </div>
            </div>

            {/* Monthly/Yearly Revenue Chart - Only show for monthly and yearly views */}
            {(periodType === 'monthly' || periodType === 'yearly') && chartData.length > 0 && (
              <div style={{
                background: 'white',
                padding: '28px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '24px',
                  marginTop: 0
                }}>
                  {getChartTitle()}
                </h3>

                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey={periodType === 'monthly' ? 'day' : 'month'}
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                      angle={periodType === 'monthly' ? -45 : 0}
                      textAnchor={periodType === 'monthly' ? 'end' : 'middle'}
                      height={periodType === 'monthly' ? 80 : 30}
                    />
                    <YAxis
                      stroke="#6b7280"
                      style={{ fontSize: '14px' }}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']}
                      labelStyle={{ fontWeight: '600', color: '#111827' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f97316"
                      strokeWidth={3}
                      dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Revenue Analytics Sections */}
            {analytics && (
              <>
                {/* Revenue by Source */}
                <div style={{ marginTop: '40px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{
                      fontSize: '20px',
                      fontWeight: '600',
                      color: '#111827',
                      margin: 0
                    }}>
                      Revenue by Membership Source
                    </h3>
                    {comparisonLabel && (
                      <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                        {comparisonLabel}
                      </span>
                    )}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px'
                  }}>
                    <div style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500', margin: 0 }}>Yearly Membership</p>
                          <span style={{
                            display: 'inline-block',
                            marginTop: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: '#fef3c7',
                            color: '#92400e'
                          }}>
                            {analytics?.bySource?.yearlyCount || 0} members
                          </span>
                        </div>
                        {comparison && <ComparisonBadge value={comparison.bySource?.yearly} />}
                      </div>
                      <p style={{ fontSize: '24px', fontWeight: '700', color: '#f97316', margin: 0 }}>₹{analytics?.bySource?.yearly?.toLocaleString() || 0}</p>
                    </div>
                    <div style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500', margin: 0 }}>Half Yearly</p>
                          <span style={{
                            display: 'inline-block',
                            marginTop: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: '#fef3c7',
                            color: '#92400e'
                          }}>
                            {analytics?.bySource?.halfYearlyCount || 0} members
                          </span>
                        </div>
                        {comparison && <ComparisonBadge value={comparison.bySource?.halfYearly} />}
                      </div>
                      <p style={{ fontSize: '24px', fontWeight: '700', color: '#f97316', margin: 0 }}>₹{analytics?.bySource?.halfYearly?.toLocaleString() || 0}</p>
                    </div>
                    <div style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500', margin: 0 }}>Quarterly</p>
                          <span style={{
                            display: 'inline-block',
                            marginTop: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: '#fef3c7',
                            color: '#92400e'
                          }}>
                            {analytics?.bySource?.quarterlyCount || 0} members
                          </span>
                        </div>
                        {comparison && <ComparisonBadge value={comparison.bySource?.quarterly} />}
                      </div>
                      <p style={{ fontSize: '24px', fontWeight: '700', color: '#f97316', margin: 0 }}>₹{analytics?.bySource?.quarterly?.toLocaleString() || 0}</p>
                    </div>
                    <div style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500', margin: 0 }}>Monthly</p>
                          <span style={{
                            display: 'inline-block',
                            marginTop: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: '#fef3c7',
                            color: '#92400e'
                          }}>
                            {analytics?.bySource?.monthlyCount || 0} members
                          </span>
                        </div>
                        {comparison && <ComparisonBadge value={comparison.bySource?.monthly} />}
                      </div>
                      <p style={{ fontSize: '24px', fontWeight: '700', color: '#f97316', margin: 0 }}>₹{analytics?.bySource?.monthly?.toLocaleString() || 0}</p>
                    </div>
                    <div style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500', margin: 0 }}>Fitness Plan</p>
                          <span style={{
                            display: 'inline-block',
                            marginTop: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: '#fef3c7',
                            color: '#92400e'
                          }}>
                            {analytics?.bySource?.fitnessPlanCount || 0} plans
                          </span>
                        </div>
                        {comparison && <ComparisonBadge value={comparison.bySource?.fitnessPlan} />}
                      </div>
                      <p style={{ fontSize: '24px', fontWeight: '700', color: '#f97316', margin: 0 }}>₹{analytics?.bySource?.fitnessPlan?.toLocaleString() || 0}</p>
                    </div>

                    <div style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500', margin: 0 }}>Personal Training</p>
                          <span style={{
                            display: 'inline-block',
                            marginTop: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: '#fef3c7',
                            color: '#92400e'
                          }}>
                            {analytics?.bySource?.personalTrainingCount || 0} members
                          </span>
                        </div>
                        {comparison && <ComparisonBadge value={comparison.bySource?.personalTraining} />}
                      </div>
                      <p style={{ fontSize: '24px', fontWeight: '700', color: '#f97316', margin: 0 }}>₹{analytics?.bySource?.personalTraining?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Revenue by Payment Method */}
                <div style={{ marginTop: '40px' }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '20px'
                  }}>
                    Revenue by Payment Method
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px'
                  }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                      padding: '24px',
                      borderRadius: '12px',
                      color: 'white',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <p style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500', margin: 0 }}>Cash Payments</p>
                        {comparison && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: 'rgba(255,255,255,0.25)',
                            color: 'white'
                          }}>
                            <span>{parseFloat(comparison.byPaymentMethod?.cash || 0) > 0 ? '↑' : '↓'}</span>
                            <span>{Math.abs(parseFloat(comparison.byPaymentMethod?.cash || 0))}%</span>
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>₹{analytics?.byPaymentMethod?.cash?.toLocaleString() || 0}</p>
                    </div>
                    <div style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                      padding: '24px',
                      borderRadius: '12px',
                      color: 'white',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <p style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500', margin: 0 }}>UPI Payments</p>
                        {comparison && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: 'rgba(255,255,255,0.25)',
                            color: 'white'
                          }}>
                            <span>{parseFloat(comparison.byPaymentMethod?.upi || 0) > 0 ? '↑' : '↓'}</span>
                            <span>{Math.abs(parseFloat(comparison.byPaymentMethod?.upi || 0))}%</span>
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>₹{analytics?.byPaymentMethod?.upi?.toLocaleString() || 0}</p>
                    </div>
                    <div style={{
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                      padding: '24px',
                      borderRadius: '12px',
                      color: 'white',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <p style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500', margin: 0 }}>Card Payments</p>
                        {comparison && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: 'rgba(255,255,255,0.25)',
                            color: 'white'
                          }}>
                            <span>{parseFloat(comparison.byPaymentMethod?.card || 0) > 0 ? '↑' : '↓'}</span>
                            <span>{Math.abs(parseFloat(comparison.byPaymentMethod?.card || 0))}%</span>
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>₹{analytics?.byPaymentMethod?.card?.toLocaleString() || 0}</p>
                    </div>
                    <div style={{
                      background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
                      padding: '24px',
                      borderRadius: '12px',
                      color: 'white',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <p style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500', margin: 0 }}>Bank Transfer</p>
                        {comparison && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: 'rgba(255,255,255,0.25)',
                            color: 'white'
                          }}>
                            <span>{parseFloat(comparison.byPaymentMethod?.bankTransfer || 0) > 0 ? '↑' : '↓'}</span>
                            <span>{Math.abs(parseFloat(comparison.byPaymentMethod?.bankTransfer || 0))}%</span>
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>₹{analytics?.byPaymentMethod?.bankTransfer?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Renewals vs New Memberships & Payment Count */}
                <div style={{ marginTop: '40px' }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '20px'
                  }}>
                    Membership Analytics
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '20px'
                  }}>
                    {/* Renewals */}
                    <div style={{
                      background: 'white',
                      padding: '24px',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500', margin: 0 }}>Renewals</p>
                          {comparison && (
                            <ComparisonBadge value={comparison.memberships?.renewals} />
                          )}
                        </div>
                        <span style={{
                          background: '#dcfce7',
                          color: '#166534',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {analytics?.memberships?.renewals || 0} members
                        </span>
                      </div>
                      <p style={{ fontSize: '32px', fontWeight: '700', color: '#10b981', margin: '8px 0' }}>
                        ₹{analytics?.memberships?.renewalsRevenue?.toLocaleString() || 0}
                      </p>
                      <div style={{ marginTop: '12px', background: '#f3f4f6', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
                        <div style={{
                          background: '#10b981',
                          height: '100%',
                          width: `${(analytics?.paymentStats?.totalRevenue || 0) > 0 ? ((analytics?.memberships?.renewalsRevenue || 0) / (analytics?.paymentStats?.totalRevenue || 1) * 100) : 0}%`,
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                        {(analytics?.paymentStats?.totalRevenue || 0) > 0 ? (((analytics?.memberships?.renewalsRevenue || 0) / (analytics?.paymentStats?.totalRevenue || 1) * 100).toFixed(1)) : 0}% of total revenue
                      </p>
                    </div>

                    {/* New Memberships */}
                    <div style={{
                      background: 'white',
                      padding: '24px',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500', margin: 0 }}>New Memberships</p>
                          {comparison && (
                            <ComparisonBadge value={comparison.memberships?.newMemberships} />
                          )}
                        </div>
                        <span style={{
                          background: '#fef3c7',
                          color: '#92400e',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {analytics?.memberships?.newMemberships || 0} members
                        </span>
                      </div>
                      <p style={{ fontSize: '32px', fontWeight: '700', color: '#f97316', margin: '8px 0' }}>
                        ₹{analytics?.memberships?.newMembershipsRevenue?.toLocaleString() || 0}
                      </p>
                      <div style={{ marginTop: '12px', background: '#f3f4f6', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
                        <div style={{
                          background: '#f97316',
                          height: '100%',
                          width: `${(analytics?.paymentStats?.totalRevenue || 0) > 0 ? ((analytics?.memberships?.newMembershipsRevenue || 0) / (analytics?.paymentStats?.totalRevenue || 1) * 100) : 0}%`,
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                        {(analytics?.paymentStats?.totalRevenue || 0) > 0 ? (((analytics?.memberships?.newMembershipsRevenue || 0) / (analytics?.paymentStats?.totalRevenue || 1) * 100).toFixed(1)) : 0}% of total revenue
                      </p>
                    </div>

                    {/* Total Payments Count */}
                    <div style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                      padding: '24px',
                      borderRadius: '12px',
                      color: 'white',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px', fontWeight: '500' }}>Total Payments</p>
                      <p style={{ fontSize: '48px', fontWeight: '700', margin: '8px 0' }}>
                        {analytics?.paymentStats?.totalPayments || 0}
                      </p>
                      <p style={{ fontSize: '13px', opacity: 0.8, margin: 0 }}>
                        Successful transactions
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}