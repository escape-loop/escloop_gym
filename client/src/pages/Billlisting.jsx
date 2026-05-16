import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import '../styles/dashboard.css';

import ToggleButton from '../components/ToggleButton.jsx';
import Sidebar from '../components/Sidebar.jsx';
import '../styles/sidebar.css';
import '../styles/toggle-button.css';
import axios from 'axios';
import { FileText, Loader2, Download, X, Printer, Mail, Building, Phone, MapPin, Globe } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { loadImage, drawGymHeader, drawGymFooter } from "../utils/pdfUtils";

export default function BillListing() {
  const { isauthenticated, getuserdata, userdata, backendurl, gymSettings } = useContext(AppContent);
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBills, setTotalBills] = useState(0);
  const [limit] = useState(50);
  const [stats, setStats] = useState({
    totalBills: 0,
    revenueThisMonth: 0,
    outstanding: 0
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN');
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${backendurl}/bills/overview`, { withCredentials: true });
      if (response.data) {
        setStats({
          totalBills: response.data.totalBills || 0,
          revenueThisMonth: response.data.revenueThisMonth || 0,
          outstanding: response.data.outstanding || 0
        });
      }
    } catch (error) {
      console.error("Error fetching bill stats:", error);
    }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await axios.get(`${backendurl}/bills`, {
        headers,
        params: {
          page: currentPage,
          limit: limit,
          search: searchName || undefined,
          status: filterStatus !== 'all' ? filterStatus : undefined
        },
        withCredentials: true,
      });

      if (response.data.success) {
        setBills(response.data.bills || []);
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.pages);
          setTotalBills(response.data.pagination.total);
        }
      } else {
        throw new Error(response.data.message || 'Failed to fetch bills');
      }
    } catch (err) {
      console.error('Error fetching bills:', err);
      setError(err.message);
      setBills([]);
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
    fetchStats();
    fetchBills();
    window.scrollTo(0, 0);
  }, [isauthenticated, navigate, currentPage, searchName, filterStatus]); // Debouncing might be good for search, but direct dependency works for now

  // Helper: check if a date is in current month
  // (Left for reference or other uses, but stats use backend now)
  const isCurrentMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  // No longer filtering on client side
  const filteredBills = bills;

  const getStatusColor = (status) => {
    const colors = {
      paid: '#10b981',
      partial: '#f59e0b',
      due: '#ef4444',
      overdue: '#7c3aed'
    };
    return colors[status] || '#6b7280';
  };



  const handleViewReceipt = async (invoiceId) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await axios.get(`${backendurl}/bills/${invoiceId}`, {
        headers,
        withCredentials: true,
      });

      if (response.data) {
        setSelectedBill(response.data);
        setShowModal(true);
      } else {
        toast.error('Failed to fetch bill details');
      }
    } catch (err) {
      console.error('Error fetching bill details:', err);
      toast.error('Error loading receipt');
    }
  };

  const numberToWords = (amount) => {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (amount === 0) return 'Zero';

    // Simple integer part for amount in words
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
  };

  const generatePDF = async (bill) => {
    const doc = new jsPDF();

    // Theme Colors
    const primaryOrange = [255, 122, 26];
    const accentOrange = [255, 91, 0];
    const lightBg = [255, 243, 224];
    const borderOrange = [255, 224, 191];

    // -- Header with Logo, Name, Address, etc. --
    let yPos = await drawGymHeader(doc, gymSettings, backendurl);

    // -- Receipt Title --
    doc.setFontSize(18);
    doc.setTextColor(...accentOrange);
    doc.text("PAYMENT RECEIPT", 105, yPos, { align: "center" });

    // Generated date
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })}`, 105, yPos + 8, { align: 'center' });

    yPos += 20;

    // -- Member & Subscription Details --
    const leftX = 15;
    const rightColX = 110;
    let y = yPos;
    const lineHeight = 5.5; // Reduced from 7

    doc.setFontSize(10);
    doc.setTextColor(0);

    // Member Details Box Header
    doc.setFont("helvetica", "bold");
    doc.setFillColor(...lightBg);
    doc.rect(leftX - 2, y - 5, 80, lineHeight + 1, 'F'); // Adjusted rect height
    doc.text("Member Details:", leftX, y);
    y += lineHeight + 3;

    doc.setFont("helvetica", "normal");
    const memIdDisplay = bill.memberId ? (bill.memberId.memberId || bill.memberId) : 'N/A';
    const mobileDisplay = bill.memberId && bill.memberId.phone ? bill.memberId.phone : (bill.mobile || 'N/A');

    doc.text(`Name: ${bill.memberName}`, leftX, y); y += lineHeight;
    doc.text(`Member ID: ${memIdDisplay}`, leftX, y); y += lineHeight;
    doc.text(`Mobile: ${mobileDisplay}`, leftX, y); y += lineHeight;

    // Invoice Details Box Header
    let yRight = yPos;
    doc.setFont("helvetica", "bold");
    doc.setFillColor(...lightBg);
    doc.rect(rightColX - 2, yRight - 5, 80, lineHeight + 1, 'F');
    doc.text("Invoice Details:", rightColX, yRight);
    yRight += lineHeight + 3;

    doc.setFont("helvetica", "normal");
    doc.text(`Invoice No: ${bill.invoiceId}`, rightColX, yRight); yRight += lineHeight;
    const dateStr = bill.invoiceDate ? new Date(bill.invoiceDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
    doc.text(`Date: ${dateStr}`, rightColX, yRight); yRight += lineHeight;
    doc.text(`Mode: ${bill.paymentMode}`, rightColX, yRight); yRight += lineHeight;

    y = Math.max(y, yRight) + 5;

    // Subscription Section with Main Orange Background
    doc.setFont("helvetica", "bold");
    doc.setFillColor(...primaryOrange);
    doc.setTextColor(255, 255, 255);
    doc.rect(leftX, y, 180, 6, 'F'); // Reduced height from 8 to 6
    doc.text("Subscription Details", leftX + 2, y + 4.5); // Adjusted text Y
    doc.setTextColor(0);
    y += 9; // Reduced spacing from 12

    doc.setFont("helvetica", "normal");
    const sub = bill.subscriptionId || {};
    const packageName = sub.packageName || (bill.items[0]?.description) || 'Membership';
    const type = sub.membershipType || 'N/A';
    const duration = sub.duration ? `${sub.duration} Days` : 'N/A';
    const startDate = sub.startDate ? new Date(sub.startDate).toLocaleDateString('en-IN') : 'N/A';
    const endDate = sub.endDate ? new Date(sub.endDate).toLocaleDateString('en-IN') : 'N/A';

    doc.text(`Package: ${packageName}`, leftX, y);
    doc.text(`Type: ${type}`, rightColX, y); y += lineHeight;
    doc.text(`Duration: ${duration}`, leftX, y);
    doc.text(`Validity: ${startDate} to ${endDate}`, rightColX, y); y += 10; // Reduced from 12

    // -- Financial Table --
    const subAmount = sub.amount || (bill.personalizedPlan && bill.personalizedPlan.price) || (bill.totalAmount + (bill.discount || 0));
    const amountPaidNow = bill.amountPaid || 0;

    // Use the pre-calculated alreadyPaid from backend if available
    const alreadyPaid = bill.alreadyPaid !== undefined ? bill.alreadyPaid : Math.max(0, (sub.amountPaid || bill.subscriptionId?.amountPaid || 0) - amountPaidNow);

    const discValue = sub.discountValue || bill.discount || 0;
    const discType = sub.discountType || 'amount';
    let discountAmount = discValue;
    if (discType === 'percentage') {
      discountAmount = (subAmount * discValue) / 100;
    }

    const tableBody = [
      ['Package Base Amount', `Rs. ${subAmount}`],
      ['Discount Amount', `Rs. ${discountAmount}`],
      ['Already Paid', `Rs. ${alreadyPaid}`],
    ];

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Amount']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: primaryOrange, textColor: 255, fontStyle: 'bold' },
      styles: { cellPadding: 3, fontSize: 10, valign: 'middle' }, // Reduced padding from 6 to 3
      columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, halign: 'right' } }
    });

    let finalY = doc.lastAutoTable.finalY + 10;

    // -- Summary Section --
    const summaryX = 130;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);

    doc.text(`Total Payable:`, summaryX, finalY);
    doc.text(`Rs. ${bill.totalAmount}`, 195, finalY, { align: 'right' });
    finalY += 8;

    doc.setTextColor(...accentOrange);
    doc.text(`Amount Paid:`, summaryX, finalY);
    doc.text(`Rs. ${bill.amountPaid}`, 195, finalY, { align: 'right' });
    finalY += 8;

    doc.setTextColor(0);
    if (bill.balance > 0) {
      doc.setTextColor(220, 0, 0);
    } else {
      doc.setTextColor(0, 150, 0);
    }
    doc.text(`Balance Due:`, summaryX, finalY);
    doc.text(`Rs. ${bill.balance}`, 195, finalY, { align: 'right' });
    doc.setTextColor(0);

    // Amount in Words
    const words = numberToWords(bill.amountPaid);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const wordsY = finalY + 10; // Start words section after summary
    doc.text(`Amount Paid (in words):`, 15, wordsY);
    doc.setFont("helvetica", "normal");
    const splitWords = doc.splitTextToSize(`${words}`, 100);
    // jsPDF text usually doesn't return height directly unless using advanced APIs, but we can estimate line count.
    doc.text(splitWords, 15, wordsY + 7);

    // Calculate start Y for Terms based on content
    // finalY (from summary section above) holds the Y position after Balance Due
    const wordsEnd = wordsY + 7 + (splitWords.length * 5); // Estimate 5 units per line for words
    const contentEnd = Math.max(finalY, wordsEnd);

    // -- Terms & Conditions --
    const termsY = contentEnd + 15; // Dynamic start
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    doc.text("Terms & Conditions", 15, termsY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    const terms = [
      "Payments & Refunds: All fees are non-refundable and non-transferable. Late payments incur a fee.",
      "Cancellation: A 30-day written notice is required for membership cancellation.",
      "Conduct: Proper gym attire and clean indoor shoes are mandatory. Always re-rack weights and wipe down equipment after use.",
      "Safety: Members use the facility at their own risk. The gym is not liable for injuries or lost/stolen personal property.",
      "Right of Admission: Management reserves the right to terminate membership for misconduct or violation of house rules without refund.",
      "Health: By paying this invoice, you confirm you are medically fit for physical exercise."
    ];

    let tY = termsY + 4;
    terms.forEach(term => {
      doc.text(`• ${term}`, 15, tY);
      tY += 3.5;
    });

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
          // Position relative to footer or terms? 
          // Previous code put it at finalY + 5 which caused overlap.
          // Let's put it on the right, aligned with Terms or slightly below summary.
          // If we put it at the bottom right, it should be near the footer.
          // Let's replicate the position: Above "Authorized Signature" label.

          doc.addImage(sigData, 'PNG', 150, footerY - 25, 40, 15);
          doc.setFontSize(9);
          doc.setTextColor(0);
          doc.text("Authorized Signature", 170, footerY - 5, { align: "center" });
        }
      } catch (e) {
        console.error("Signature add failed", e);
      }
    } else {
      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text("Authorized Signature", 170, footerY - 5, { align: "center" });
    }

    window.open(doc.output('bloburl'), '_blank');
  };

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-breadcrumb">
            Dashboard / Bill Listing
          </div>
        </div>
        <div className="dash-header-right">
          <button
            className="btn-primary"
            onClick={() => navigate('/billing')}
          >
            + New Bill
          </button>
        </div>
      </header>
      <main>
        <div className="dash-content">
          <div className="members-listing">
            {/* Stats Cards */}
            <div className="overview-stats">
              <div className="stat-card total">
                <h3>{stats.totalBills}</h3>
                <p>Total Bills</p>
                <span className="stat-change positive">All Time</span>
              </div>
              <div className="stat-card active">
                <h3>₹{stats.revenueThisMonth.toLocaleString()}</h3>
                <p>Total Received (This Month)</p>
                <span className="stat-change positive">Revenue</span>
              </div>
              <div className="stat-card inactive">
                <h3>₹{stats.outstanding.toLocaleString()}</h3>
                <p>Total Outstanding</p>
                <span className="stat-change warning">Due/Partial</span>
              </div>
            </div>

            {/* Filters */}
            <div className="listing-filters">
              <div className="search-controls">
                <input
                  className="dash-search"
                  placeholder="Search Invoice ID, Name, Mobile, Member ID..."
                  value={searchName}
                  onChange={(e) => {
                    setSearchName(e.target.value);
                    setCurrentPage(1); // Reset to page 1 on search
                  }}
                  style={{ width: '350px' }}
                />
              </div>
              <select
                className="status-filter"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1); // Reset to page 1 on filter
                }}
                style={{ zIndex: 1, position: 'relative' }}
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="due">Due</option>
                <option value="overdue">Overdue</option>
              </select>

            </div>

            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading bills...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <h3>Error Loading Bills</h3>
                <p>{error}</p>
                <button className="btn-primary" onClick={() => { fetchStats(); fetchBills(); }}>Try Again</button>
              </div>
            ) : bills.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No bills found</h3>
                <p>Try adjusting your search or filters.</p>
                <button className="btn-primary" onClick={() => navigate('/billing')}>+ New Bill</button>
              </div>
            ) : (
              <div className="members-table-container">
                <table className="members-table">
                  <thead>
                    <tr>
                      <th>Bill #</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Total Amount</th>
                      <th>Paid Amount</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => (
                      <tr key={bill._id}>
                        <td><span className="attendance-id-badge">{bill.invoiceId}</span></td>
                        <td><div className="member-name">{bill.memberName}</div></td>
                        <td>{formatDate(bill.invoiceDate)}</td>
                        <td>₹{bill.totalAmount.toLocaleString()}</td>
                        <td>₹{bill.amountPaid.toLocaleString()}</td>
                        <td>
                          <span className={`balance-amount ${bill.balance === 0 ? 'zero' : 'pending'}`}>
                            ₹{bill.balance.toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${bill.status}`}
                            style={{ backgroundColor: getStatusColor(bill.status) + '20', color: getStatusColor(bill.status) }}
                          >
                            {bill.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              className="btn-edit"
                              onClick={() => handleViewReceipt(bill.invoiceId)}
                              title="View Receipt"
                              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <FileText size={14} /> View
                            </button>
                            <button
                              className="btn-edit"
                              onClick={() => navigate('/billing', { state: { billId: bill.invoiceId, mode: 'edit' } })}
                              title="Edit Bill"
                              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <FileText size={14} /> Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-controls" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {currentPage} of {totalPages} • Total: {totalBills}
                </span>
                <button
                  className="btn-secondary"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Invoice View Modal */}
      {showModal && selectedBill && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white', width: '100%', maxWidth: '800px',
            maxHeight: '90vh', borderRadius: '12px', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#f8fafc'
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                Invoice Details: {selectedBill.invoiceId}
              </h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => generatePDF(selectedBill)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px', background: '#f97316', color: 'white',
                    border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <Download size={16} /> Download PDF
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '8px', background: '#f1f5f9', color: '#64748b',
                    border: 'none', borderRadius: '6px', cursor: 'pointer'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body - Styled Receipt View */}
            <div style={{ padding: '32px', overflowY: 'auto' }}>
              <div style={{
                border: '1px solid #e2e8f0', borderRadius: '8px', padding: '40px',
                background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                {/* Receipt Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    {gymSettings?.gymLogo ? (
                      <img
                        src={`${backendurl.replace('/gym', '')}${gymSettings.gymLogo}`}
                        alt="Logo"
                        style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px' }}
                      />
                    ) : (
                      <div style={{ width: '80px', height: '80px', background: '#f9731610', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building size={40} color="#f97316" />
                      </div>
                    )}
                    <div>
                      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f97316', margin: 0 }}>
                        {gymSettings?.gymName || "Gym Name"}
                      </h1>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.875rem', marginTop: '4px' }}>
                        <MapPin size={14} /> <span>{gymSettings?.landmark ? `${gymSettings.landmark}, ` : ""}{gymSettings?.address?.split('\n')[0]}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.875rem' }}>
                        <Phone size={14} /> <span>{gymSettings?.mobile || "Gym Mobile"}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ff5b00' }}>RECEIPT</div>
                    <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}># {selectedBill.invoiceId}</div>
                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Date: {formatDate(selectedBill.invoiceDate)}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #f97316' }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>Member Details</h3>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>{selectedBill.memberName}</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '4px' }}>ID: {selectedBill.memberId?.memberId || selectedBill.memberId}</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Phone: {selectedBill.memberId?.phone || selectedBill.mobile || "N/A"}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #f97316' }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>Payment Summary</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Mode:</span>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{selectedBill.paymentMode}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Status:</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                        backgroundColor: getStatusColor(selectedBill.status) + '20',
                        color: getStatusColor(selectedBill.status)
                      }}>{selectedBill.status.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
                {/* Financial Calculations */}
                {(() => {
                  const sub = selectedBill.subscriptionId || {};
                  const subAmount = sub.amount || (selectedBill.personalizedPlan && selectedBill.personalizedPlan.price) || (selectedBill.totalAmount + (selectedBill.discount || 0));
                  const discValue = sub.discountValue || selectedBill.discount || 0;
                  const discType = sub.discountType || 'amount';
                  let calculatedDiscount = discValue;
                  if (discType === 'percentage') {
                    calculatedDiscount = (subAmount * discValue) / 100;
                  }

                  return (
                    <>
                      {/* Table */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                            <th style={{ textAlign: 'left', padding: '12px 0', fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>DESCRIPTION</th>
                            <th style={{ textAlign: 'right', padding: '12px 0', fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '16px 0', color: '#1e293b', fontWeight: 500 }}>
                              Package Base Amount
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                {sub.packageName || selectedBill.items?.[0]?.description || "Membership Plan"}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', padding: '16px 0', color: '#1e293b', fontWeight: 600 }}>
                              ₹{subAmount}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 0', color: '#ef4444', fontSize: '0.875rem' }}>Discount Amount</td>
                            <td style={{ textAlign: 'right', padding: '12px 0', color: '#ef4444', fontSize: '0.875rem' }}>- ₹{calculatedDiscount || 0}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 0', color: '#10b981', fontSize: '0.875rem' }}>Already Paid</td>
                            <td style={{ textAlign: 'right', padding: '12px 0', color: '#10b981', fontSize: '0.875rem' }}>₹{selectedBill.alreadyPaid || 0}</td>
                          </tr>
                        </tbody>
                      </table>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
                        <div style={{ width: '220px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Total Payable:</span>
                            <span style={{ color: '#1e293b', fontWeight: 700 }}>₹{selectedBill.totalAmount}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', background: '#f973160a' }}>
                            <span style={{ color: '#f97316', fontWeight: 700 }}>Amount Paid Now:</span>
                            <span style={{ color: '#f97316', fontWeight: 800 }}>₹{selectedBill.amountPaid}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                            <span style={{ color: selectedBill.balance > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>Balance Due:</span>
                            <span style={{ color: selectedBill.balance > 0 ? '#ef4444' : '#10b981', fontWeight: 800 }}>₹{selectedBill.balance}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Signature & Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: '300px' }}>
                    <p style={{ margin: 0 }}>Amount in words:</p>
                    <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', color: '#64748b' }}>{numberToWords(selectedBill.amountPaid)}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    {gymSettings?.authorizerSignature ? (
                      <img
                        src={`${backendurl.replace('/gym', '')}${gymSettings.authorizerSignature}`}
                        alt="Signature"
                        style={{ height: '60px', width: 'auto', display: 'block', margin: '0 auto 8px' }}
                      />
                    ) : (
                      <div style={{ height: '60px' }}></div>
                    )}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>
                      Authorized Signature
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '32px', color: '#94a3b8', fontSize: '0.875rem' }}>
                Thank you for choosing {gymSettings?.gymName || "Gym Name"}!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}