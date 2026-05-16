import React, { useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, PlusCircle, History, Mail, Phone, Calendar, Download, X, Building, MapPin, FileText } from 'lucide-react';
import ToggleButton from '../components/ToggleButton.jsx';
import { AppContent } from '../context/context.jsx';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../styles/dashboard.css';
import { toast } from 'react-toastify';
import { loadImage, drawGymHeader, drawGymFooter } from "../utils/pdfUtils";
import Swal from 'sweetalert2';

const SubscriptionManager = () => {
  const { isauthenticated, getuserdata, userdata, backendurl, gymSettings } = useContext(AppContent);
  const location = useLocation();
  const navigate = useNavigate();

  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [trainers, setTrainers] = useState([]);

  // Helper to construct profile photo URL
  const getProfilePhotoUrl = (photoPath, fullName) => {
    if (!photoPath) return `https://api.dicebear.com/7.x/avataaars/svg?seed=${fullName || 'default'}`;
    if (photoPath.startsWith('http') || photoPath.startsWith('data:')) return photoPath;
    const baseUrl = backendurl ? backendurl.replace('/gym', '').replace(/\/+$/, '') : '';
    return `${baseUrl}${photoPath.startsWith('/') ? '' : '/'}${photoPath}`;
  };
  // Fetch Plans and Trainers from backend



  const [planMemberCounts, setPlanMemberCounts] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingPlans(true);
        const baseUrl = backendurl.replace('/gym', '');

        // Fetch Plans
        const plansRes = await axios.get(`${baseUrl}/plans`, { withCredentials: true });
        if (plansRes.data.success) {
          setPlans(plansRes.data.plans);
          // Fetch member counts for plans
          fetchPlanUsage(plansRes.data.plans);
        }

        // Fetch Staff (Trainers)
        const staffRes = await axios.get(`${backendurl}/staff?status=all`, { withCredentials: true });
        if (staffRes.data.success) {
          const allStaff = staffRes.data.staff || [];
          // Filter for all Trainers (filtering happens at render time)
          const allTrainers = allStaff.filter(s => s.role === 'Trainer');
          setTrainers(allTrainers);
        }


      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingPlans(false);
      }
    };
    if (backendurl) {
      fetchData();

    }
  }, [backendurl]);

  // Fetches usage count for all plans to filter dropdown
  const fetchPlanUsage = async (plansList) => {
    try {
      const response = await axios.get(`${backendurl}/members?page=1&limit=0&status=all&includeInactivePlans=true`, { withCredentials: true });
      if (response.data.success && Array.isArray(response.data.members)) {
        const counts = {};
        plansList.forEach(p => counts[p.name] = 0);

        response.data.members.forEach(member => {
          if (member.packageName) {
            // robust case-insensitive matching, handling comma-separated lists
            const rawPackageNames = member.packageName.split(',').map(s => s.trim().toLowerCase());
            const uniquePackageNames = [...new Set(rawPackageNames)];

            uniquePackageNames.forEach(pkgName => {
              const match = plansList.find(p =>
                p.name.trim().toLowerCase() === pkgName
              );

              if (match) {
                counts[match.name] = (counts[match.name] || 0) + 1;
              }
            });
          }
        });
        console.log('Plan usage counts:', counts);
        setPlanMemberCounts(counts);
      }
    } catch (error) {
      console.error("Error fetching plan usage:", error);
    }
  };

  const [selectedMember, setSelectedMember] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [searching, setSearching] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingSub, setPayingSub] = useState(null); // Track which sub is being paid for

  // Search Members from backend
  useEffect(() => {
    const searchMembers = async () => {
      if (!searchQuery.trim()) {
        setMembers([]);
        return;
      }
      try {
        setSearching(true);
        const response = await axios.get(`${backendurl}/members?search=${searchQuery}`, {
          withCredentials: true,
        });
        if (response.data.success) {
          setMembers(response.data.members);
        }
      } catch (error) {
        console.error('Error searching members:', error);
      } finally {
        setSearching(false);
      }
    };

    const timeoutId = setTimeout(searchMembers, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, backendurl]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN');
  };



  const numberToWords = (amount) => {
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

    // -- Title --
    doc.setFontSize(18);
    doc.setTextColor(...accentOrange);
    doc.text("PAYMENT RECEIPT", 105, yPos, { align: "center" });
    yPos += 15;

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
    const subAmount = sub.amount || (bill.totalAmount + (bill.discount || 0));
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
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await axios.get(`${backendurl}/bills/${invoiceId}`, {
        headers,
        withCredentials: true
      });
      if (response.data) {
        setSelectedBill(response.data);
        setShowModal(true);
      }
    } catch (err) { toast.error('Error loading receipt'); }
  };

  const handleSelectMember = async (member) => {
    console.log("handleSelectMember called with:", member);
    setSelectedMember(member);
    const memberId = member._id || member.id;
    console.log("Derived memberId:", memberId);
    console.log("Backend URL:", backendurl);

    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await axios.get(`${backendurl}/subscriptions/member/${memberId}`, {
        headers,
        withCredentials: true,
      });

      if (response.data.success && response.data.subscriptions.length > 0) {
        // Map backend subscriptions to frontend state
        const loadedSubs = response.data.subscriptions.map(sub => ({
          id: sub._id,
          packageName: sub.packageName,
          type: sub.membershipType || 'Monthly',
          duration: sub.duration || '1',
          startDate: sub.startDate ? (() => { const d = new Date(sub.startDate); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })() : '',
          endDate: sub.endDate ? (() => { const d = new Date(sub.endDate); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })() : '',
          balanceAmount: parseFloat(sub.balanceAmount) || 0,
          pendingPayments: parseFloat(sub.balanceAmount) || 0,
          discountType: sub.discountType || 'amount',
          discountValue: sub.discountValue || 0,
          amount: sub.amount || 0,
          finalAmount: sub.netPayable || sub.amount || (sub.amountPaid + sub.balanceAmount) || 0,
          paidAmount: parseFloat(sub.amountPaid) || 0,
          status: sub.status || 'Active',
          trainerId: sub.trainerId,
          trainerName: sub.trainerName,
          steamSessionsTotal: sub.steamSessionsTotal || 0,
          steamSessionsUsed: sub.steamSessionsUsed || 0,
          ptSessionsTotal: sub.ptSessionsTotal || 0,
          ptSessionsUsed: sub.ptSessionsUsed || 0,
          _isExisting: true
        }));
        setSubscriptions(loadedSubs);
      } else {
        // No existing subscriptions, set a default one
        setSubscriptions([{
          id: Date.now(),
          packageName: '',
          type: 'Monthly',
          duration: '1',
          startDate: '',
          endDate: '',
          amount: 0,
          discountType: 'amount',
          discountValue: 0,
          finalAmount: 0,
          paidAmount: 0,
          status: 'Pending',
          _isExisting: false
        }]);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast.error("Failed to load subscriptions. Please try again.");
      // Fallback to manual entry if API fails
      setSubscriptions([{
        id: Date.now(),
        packageName: '',
        type: 'Monthly',
        duration: '1',
        startDate: '',
        endDate: '',
        amount: 0,
        discountType: 'amount',
        discountValue: 0,
        finalAmount: 0,
        paidAmount: 0,
        status: 'Pending',
        trainerId: '',
        trainerName: '',
        steamSessionsTotal: 0,
        steamSessionsUsed: 0,
        ptSessionsTotal: 0,
        ptSessionsUsed: 0,
        _isExisting: false
      }]);
    }
  };

  // Set selected member from navigation state on component mount
  useEffect(() => {
    if (location.state?.selectedMember) {
      handleSelectMember(location.state.selectedMember);
    }
  }, [location.state]);

  // Join Date calculation (from first subscription start date)
  const getJoinDate = () => {
    if (subscriptions.length > 0) {
      // Use the oldest (last) subscription to determine join date
      const oldestSub = subscriptions[subscriptions.length - 1];
      if (oldestSub.startDate) {
        return new Date(oldestSub.startDate).toLocaleDateString();
      }
    }
    return "Not Started";
  };

  // If no member is selected from navigation, show member list
  const showMemberList = !selectedMember && !location.state?.selectedMember;

  // History Modal State
  const [showHistory, setShowHistory] = useState(false);

  // Calculate if member has any outstanding debt
  const hasDebt = subscriptions.some(s => (s.balanceAmount || 0) > 0);

  // Filter Subscriptions for display based on showHistory state
  const visibleSubscriptions = subscriptions.filter(sub => {
    const isHistoryStatus = ['Expired', 'Cancelled'].includes(sub.status);
    const isNew = !sub._isExisting;

    if (showHistory) {
      return isHistoryStatus && sub._isExisting; // Show only existing history subscriptions
    }
    return !isHistoryStatus || isNew; // Show active/pending or new (unsaved) subscriptions
  });

  const updateSubscription = (id, field, value) => {
    const newSubs = subscriptions.map(sub => {
      if (sub.id !== id) return sub;

      const updatedSub = { ...sub };

      if (field === 'packageName') {
        const selectedPlan = plans.find(p => p.name.trim() === value.trim());
        console.log('Selected Plan:', selectedPlan); // Debug logging
        if (selectedPlan) {
          updatedSub.packageName = selectedPlan.name;
          updatedSub.type = selectedPlan.type;

          // Use durationDays from plan, default to 30 if missing
          const days = selectedPlan.durationDays || 30;
          console.log('Auto-fetching duration:', days); // Debug logging
          updatedSub.duration = days.toString();
          updatedSub.amount = selectedPlan.price;

          // Auto-calculate End Date if Start Date exists
          if (updatedSub.startDate) {
            const start = new Date(updatedSub.startDate);
            const end = new Date(start);
            end.setDate(end.getDate() + days); // Add days instead of months
            updatedSub.endDate = end.getFullYear() + '-' + (end.getMonth() + 1).toString().padStart(2, '0') + '-' + end.getDate().toString().padStart(2, '0');
          }

          // Auto-fill Session Limits
          updatedSub.steamSessionsTotal = selectedPlan.steamSessions || 0;
          updatedSub.ptSessionsTotal = selectedPlan.ptSessions || 0;
          updatedSub.steamSessionsUsed = 0; // Reset usage on plan change
          updatedSub.ptSessionsUsed = 0;

        } else {
          updatedSub.packageName = value;
          updatedSub.duration = '30'; // Default fallback
        }
      } else if (field === 'trainerId') {
        const selectedTrainer = trainers.find(t => t._id === value);
        updatedSub.trainerId = value;
        updatedSub.trainerName = selectedTrainer ? selectedTrainer.fullName : '';
      } else {
        updatedSub[field] = value;
      }

      // Auto-calculate End Date if Start Date or Duration changes
      if ((field === 'startDate' || field === 'duration') && updatedSub.startDate && updatedSub.duration) {
        const start = new Date(updatedSub.startDate);
        const days = parseInt(updatedSub.duration);
        if (!isNaN(start.getTime()) && !isNaN(days)) {
          const end = new Date(start);
          end.setDate(end.getDate() + days); // Add days
          updatedSub.endDate = end.getFullYear() + '-' + (end.getMonth() + 1).toString().padStart(2, '0') + '-' + end.getDate().toString().padStart(2, '0');
        }
      }

      // Auto-calculate Final Amount
      const baseAmount = parseFloat(updatedSub.amount) || 0;
      const dValue = parseFloat(updatedSub.discountValue) || 0;

      let final = baseAmount;
      if (updatedSub.discountType === 'percentage') {
        final = baseAmount - (baseAmount * (dValue / 100));
      } else {
        final = baseAmount - dValue;
      }
      updatedSub.finalAmount = Math.max(0, final);

      // Auto-calculate Status
      if (field === 'paidAmount' || field === 'amount' || field === 'discountValue' || field === 'discountType' || field === 'packageName') {
        const total = parseFloat(updatedSub.finalAmount);
        const paid = parseFloat(updatedSub.paidAmount);
        // Only update status if it's currently Active or Pending (don't resurrect expired automatically unless logic allows)
        updatedSub.status = paid >= total && total > 0 ? 'Active' : 'Pending';
      }

      return updatedSub;
    });

    setSubscriptions(newSubs);
  };

  const handleRenewal = () => {
    if (hasDebt) {
      toast.warning("Please clear all outstanding dues before adding a new subscription.");
      return;
    }
    // Determine default values from the most relevant subscription
    const baseSub = subscriptions.length > 0 ? subscriptions[0] : { amount: 0 };

    // Try to find current plan details to get up-to-date duration and price
    const currentPlan = plans.find(p => p.name === baseSub.packageName);
    const durationDays = currentPlan ? (currentPlan.durationDays || 30) : 30;
    const price = currentPlan ? currentPlan.price : (baseSub.amount || 0);

    const newSub = {
      id: Date.now(), // More unique ID
      packageName: baseSub.packageName || '',
      type: baseSub.type || 'Monthly',
      duration: durationDays.toString(),
      status: 'Pending',
      paidAmount: 0,
      discountType: baseSub.discountType || 'amount',
      discountValue: 0,
      amount: price,
      finalAmount: price,
      startDate: '',
      endDate: '',
      _isExisting: false
    };
    setSubscriptions([newSub, ...subscriptions]);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete this subscription?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete'
    });
    if (!result.isConfirmed) return;

    const subToDelete = subscriptions.find(s => s.id === id);
    if (!subToDelete) return;

    if (subToDelete._isExisting) {
      try {
        const response = await axios.delete(`${backendurl}/subscriptions/${subToDelete.id}`, {
          withCredentials: true,
        });

        if (response.data.success) {
          const newSubs = subscriptions.filter(s => s.id !== id);
          if (newSubs.length === 0) {
            setSubscriptions([]); // Or reset to default empty state if needed
          } else {
            setSubscriptions(newSubs);
          }
          toast.success('Subscription deleted successfully');
        } else {
          toast.error(response.data.message || 'Failed to delete subscription');
        }
      } catch (error) {
        console.error('Error deleting subscription:', error);
        toast.error('Error deleting subscription. Please try again.');
      }
    } else {
      // Just remove from state if it's a new unsaved row
      const newSubs = subscriptions.filter(s => s.id !== id);
      setSubscriptions(newSubs);
    }
  };

  const handleUpdateMember = async (overrideSub = null) => {
    if (!selectedMember || subscriptions.length === 0) return;

    // Use the override if provided, otherwise find first Active/Pending subscription
    const latestSub = overrideSub || (visibleSubscriptions.length > 0 ? visibleSubscriptions[0] : subscriptions[0]);

    if (!latestSub) return;

    // Basic validation
    if (!latestSub.packageName || !latestSub.startDate) {
      toast.warning("Please select a package and start date.");
      return;
    }

    // Validate if Paid Amount > Final Amount(Net Payable)
    // Re-calculate finalAmount to be safe, or trust current state
    const baseVal = parseFloat(latestSub.amount) || 0;
    const dVal = parseFloat(latestSub.discountValue) || 0;
    let netPayable = baseVal;
    if (latestSub.discountType === 'percentage') {
      netPayable = baseVal - (baseVal * (dVal / 100));
    } else {
      netPayable = baseVal - dVal;
    }
    netPayable = Math.max(0, netPayable);

    const paidVal = parseFloat(latestSub.paidAmount) || 0;

    if (paidVal > netPayable) {
      toast.error(`Paid amount (₹${paidVal}) cannot exceed Net Payable (₹${netPayable}). Remaining balance cannot be negative.`);
      return;
    }

    try {
      const memberId = selectedMember._id || selectedMember.id;

      // Prepare data for the backend API
      const subPayload = {
        memberId,
        packageName: latestSub.packageName,
        membershipType: latestSub.type,
        duration: latestSub.duration,
        startDate: latestSub.startDate,
        endDate: latestSub.endDate,
        amount: latestSub.amount,
        discountType: latestSub.discountType,
        discountValue: latestSub.discountValue,
        amountPaid: latestSub.paidAmount,
        balanceAmount: latestSub.finalAmount - latestSub.paidAmount,
        status: latestSub.status,
        trainerId: latestSub.trainerId,
        trainerName: latestSub.trainerName,
        steamSessionsTotal: latestSub.steamSessionsTotal,
        steamSessionsUsed: latestSub.steamSessionsUsed,
        ptSessionsTotal: latestSub.ptSessionsTotal,
        ptSessionsUsed: latestSub.ptSessionsUsed,
        paymentMode: latestSub.paymentMode, // Added for initial payment
        notes: latestSub.notes // Added for initial payment
      };

      let response;
      if (latestSub._isExisting) {
        // Update existing subscription
        response = await axios.put(`${backendurl}/subscriptions/${latestSub.id}`, subPayload, {
          withCredentials: true,
        });
      } else {
        // Add new subscription
        response = await axios.post(`${backendurl}/subscriptions/add`, subPayload, {
          withCredentials: true,
        });
      }

      if (response.data.success) {
        toast.success(latestSub._isExisting ? 'Subscription updated successfully!' : 'New subscription added successfully!');
        // Navigate to subscription listing page as requested
        setTimeout(() => navigate('/subscriptions'), 1500);

        // Return the saved subscription or its ID for chaining
        return response.data.subscription || response.data.newSubscription;
      } else {
        toast.error(response.data.message || 'Failed to save subscription');
        return null;
      }
    } catch (error) {
      console.error('Error saving subscription:', error);
      toast.error('Error saving subscription. Please try again.');
      return null;
    }
  };

  const handleCreatePayment = async (sub) => {
    // First save the subscription to ensure latest data is in DB
    const savedSub = await handleUpdateMember(sub);

    if (savedSub) {
      // If save successful, navigate to billing with the actual DB ID
      navigate('/billing', {
        state: {
          memberId: selectedMember.memberId,
          subscriptionId: savedSub._id,
          autoSelectId: savedSub._id // Force selection in billing dropdown
        }
      });
    }
  };

  const [historySubId, setHistorySubId] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchTransactionHistory = async (subscriptionId) => {
    if (historySubId === subscriptionId) {
      setHistorySubId(null); // Toggle off if already showing
      return;
    }

    try {
      setLoadingHistory(true);
      setHistorySubId(subscriptionId);
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await axios.get(`${backendurl}/bills?subscriptionId=${subscriptionId}`, {
        headers,
        withCredentials: true
      });

      if (response.data.success) {
        setTransactionHistory(response.data.bills);
      } else {
        setTransactionHistory([]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setTransactionHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="dash-root">
      <main className="dash-main">
        {/* Header */}
        <header className="dash-header">
          <div className="dash-header-left">
            <ToggleButton isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
            <div className="dash-breadcrumb" style={{ marginLeft: "40px" }}>
              Dashboard / Members / Subscription Management
            </div>
          </div>
          <div className="dash-header-right" style={{ display: 'flex', gap: '12px' }}>
            {selectedMember && (
              <>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderColor: showHistory ? '#f97316' : '#e2e8f0',
                    backgroundColor: showHistory ? '#fff7ed' : '#fff',
                    color: showHistory ? '#f97316' : '#64748b',
                    fontWeight: 600
                  }}
                >
                  <History size={18} />
                  {showHistory ? 'Active Subscriptions' : 'Subscription History'}
                </button>

                <button
                  onClick={handleRenewal}
                  className="btn-primary"
                  disabled={subscriptions.some(s => !s._isExisting) || hasDebt}
                  title={hasDebt ? "Please clear all outstanding dues before adding a new subscription" : ""}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: (subscriptions.some(s => !s._isExisting) || hasDebt) ? 0.6 : 1,
                    cursor: (subscriptions.some(s => !s._isExisting) || hasDebt) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <PlusCircle size={18} />
                  Add New
                </button>
              </>
            )}
          </div>
        </header>

        <div className="dash-content">
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {hasDebt && !showMemberList && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '12px 20px',
                borderRadius: '10px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: '1px solid #fecaca',
                fontWeight: 600
              }}>
                <div style={{ backgroundColor: '#ef4444', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>!</div>
                Outstanding Dues Found: Please clear all pending payments before adding a new subscription.
              </div>
            )}
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '24px' }}>
              Subscription Manager
            </h1>

            {/* Member List Section - Only show if no member selected */}
            {showMemberList && (
              <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e293b' }}>Select a Member</h2>
                  <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search by Name, ID, or Phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 40px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '14px',
                        outlineColor: '#f97316'
                      }}
                    />
                  </div>
                </div>

                <div style={{ padding: '24px' }}>
                  {searching ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Searching for members...</div>
                  ) : members.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                      <User size={48} strokeWidth={1} style={{ marginBottom: '16px', opacity: 0.5 }} />
                      <p>{searchQuery ? "No members found matching your search." : "Search for a member to start managing their subscriptions."}</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                      {members.map(member => (
                        <div
                          key={member._id}
                          className="dash-alert-item"
                          onClick={() => handleSelectMember(member)}
                          style={{
                            padding: '16px',
                            border: '1px solid #f1f5f9',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <img
                            src={getProfilePhotoUrl(member.profilePhoto, member.fullName)}
                            alt=""
                            style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover' }}
                            onError={(e) => {
                              if (!e.target.src.includes('dicebear')) {
                                e.target.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + member.fullName;
                              }
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{member.fullName}</div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>ID: {member.memberId}</div>
                            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{member.phone}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedMember && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Member Profile Card */}
                <div className="dash-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '24px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <img
                    src={getProfilePhotoUrl(selectedMember.profilePhoto, selectedMember.fullName)}
                    alt="Profile"
                    style={{ width: '80px', height: '80px', borderRadius: '16px', border: '4px solid white', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', objectFit: 'cover' }}
                    onError={(e) => {
                      if (!e.target.src.includes('dicebear')) {
                        e.target.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + selectedMember.fullName;
                      }
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{selectedMember.fullName}</h2>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#f9731615', color: '#f97316', padding: '4px 10px', borderRadius: '99px' }}>
                        ID: {selectedMember.memberId}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.925rem' }}>
                        <Mail size={16} /> {selectedMember.email || 'No email provided'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.925rem' }}>
                        <Phone size={16} /> {selectedMember.phone || selectedMember.mobile}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.925rem' }}>
                        <Calendar size={16} /> Joined: {getJoinDate()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscriptions List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {visibleSubscriptions.length === 0 ? (
                    <div className="dash-card" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', borderStyle: 'dashed' }}>
                      <History size={48} strokeWidth={1} style={{ marginBottom: '16px', opacity: 0.5 }} />
                      <p style={{ fontSize: '1.125rem' }}>{showHistory ? "No subscription history found." : "No active subscriptions found for this member."}</p>
                      {!showHistory && (
                        <button onClick={handleRenewal} className="btn-text" style={{ color: '#f97316', marginTop: '12px', fontWeight: 700 }}>
                          Click here to add one
                        </button>
                      )}
                    </div>
                  ) : (
                    visibleSubscriptions.map((sub, index) => {
                      // Modified: Always allow editing, even for expired/history items per user request
                      const isLocked = false;
                      const globalIndex = subscriptions.findIndex(s => s.id === sub.id);
                      const subNum = globalIndex !== -1 ? subscriptions.length - globalIndex : visibleSubscriptions.length - index;

                      return (
                        <div key={sub.id} className="dash-card" style={{ padding: '0', border: isLocked ? '1px solid #e2e8f0' : '2px solid #f97316', boxShadow: isLocked ? 'none' : '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
                          {/* Card Header */}
                          <div style={{ padding: '20px 24px', background: isLocked ? '#f8fafc' : '#fff7ed', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isLocked ? '#e2e8f0' : '#f97316', color: isLocked ? '#64748b' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
                                {subNum}
                              </div>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                                Subscription Details
                                {!sub._isExisting && <span style={{ marginLeft: '10px', fontSize: '0.75rem', color: '#f97316', background: 'white', border: '1px solid #f97316', padding: '2px 8px', borderRadius: '4px' }}>NEW</span>}
                              </h3>
                              {sub._isExisting && (
                                <button
                                  onClick={() => fetchTransactionHistory(sub.id)}
                                  className="btn-text"
                                  style={{ fontSize: '0.875rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  {historySubId === sub.id ? 'Hide Payments' : 'View Payments'}
                                </button>
                              )}
                            </div>
                            <div className={`status-badge ${sub.status.toLowerCase()}`} style={{ padding: '6px 14px', borderRadius: '8px' }}>
                              {sub.status}
                            </div>
                          </div>

                          {/* Transaction History Sub-Panel */}
                          {historySubId === sub.id && (
                            <div style={{ margin: '16px 24px', padding: '0', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead style={{ background: '#f8fafc' }}>
                                  <tr style={{ textAlign: 'left', color: '#64748b' }}>
                                    <th style={{ padding: '12px 16px' }}>Date</th>
                                    <th style={{ padding: '12px 16px' }}>Invoice ID</th>
                                    <th style={{ padding: '12px 16px' }}>Amount</th>
                                    <th style={{ padding: '12px 16px' }}>Mode</th>
                                    <th style={{ padding: '12px 16px' }}>Receipt</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {loadingHistory ? (
                                    <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Loading history...</td></tr>
                                  ) : transactionHistory.length === 0 ? (
                                    <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No payment records found.</td></tr>
                                  ) : (
                                    transactionHistory.map(tx => (
                                      <tr key={tx._id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 16px' }}>{new Date(tx.invoiceDate).toLocaleDateString()}</td>
                                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#475569' }}>{tx.invoiceId}</td>
                                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>₹{tx.amountPaid}</td>
                                        <td style={{ padding: '12px 16px' }}>{tx.paymentMode}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                          <button
                                            onClick={() => handleViewReceipt(tx.invoiceId)}
                                            style={{
                                              color: '#f97316',
                                              background: 'none',
                                              border: 'none',
                                              padding: 0,
                                              fontSize: '14px',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}
                                          >
                                            <FileText size={14} /> View
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}

                          <div style={{ padding: '24px' }}>
                            {/* Section 1: Plan Details */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                              <div className="nm-field">
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Package</label>
                                <select
                                  value={sub.packageName}
                                  onChange={(e) => updateSubscription(sub.id, 'packageName', e.target.value)}
                                  disabled={isLocked}
                                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: isLocked ? '#f8fafc' : 'white' }}
                                >
                                  <option value="">Select Package</option>
                                  {plans
                                    .filter(plan => {
                                      // Check capacity using calculated counts
                                      const currentCount = planMemberCounts[plan.name] || 0;

                                      // Only filter out if maxMembers is set (>0) and count reached
                                      if (plan.maxMembers > 0 && currentCount >= plan.maxMembers) {
                                        // 1. Allow if it's the ALREADY selected package for this sub instance (editing current sub)
                                        if (sub.packageName === plan.name) return true;

                                        // 2. Grandfather Rule: Allow if the member's LAST package was this plan
                                        // We find the member object to check their history
                                        const currentMember = members.find(m => m._id === sub.memberId);
                                        if (currentMember && currentMember.packageName) {
                                          const lastPackages = currentMember.packageName.split(',').map(s => s.trim().toLowerCase());
                                          // Check if this plan is in their history
                                          if (lastPackages.includes(plan.name.trim().toLowerCase())) {
                                            return true;
                                          }
                                        }

                                        return false;
                                      }
                                      return true;
                                    })
                                    .map(plan => (
                                      <option key={plan._id} value={plan.name}>
                                        {plan.name}
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div className="nm-field">
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Type</label>
                                <input type="text" value={sub.type} readOnly style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }} />
                              </div>
                              <div className="nm-field">
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Duration (Days)</label>
                                <input
                                  type="number"
                                  value={sub.duration}
                                  onChange={(e) => updateSubscription(sub.id, 'duration', e.target.value)}
                                  disabled={isLocked}
                                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: isLocked ? '#f8fafc' : 'white' }}
                                />
                              </div>
                              <div className="nm-field">
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Assigned Trainer</label>
                                <select
                                  value={sub.trainerId || ''}
                                  onChange={(e) => updateSubscription(sub.id, 'trainerId', e.target.value)}
                                  disabled={isLocked}
                                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: isLocked ? '#f8fafc' : 'white' }}
                                >
                                  <option value="">No Trainer</option>
                                  {trainers
                                    .filter(t => t.status === 'Active' || t.status === 'On Leave' || t._id === sub.trainerId)
                                    .map(trainer => (
                                      <option key={trainer._id} value={trainer._id}>{trainer.fullName}</option>
                                    ))}
                                </select>
                              </div>
                            </div>

                            {/* Section 1b: Special Class Options (PT Session & Sauna) */}
                            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', padding: '16px 20px', background: '#fffbeb', borderRadius: '12px', border: '1px dashed #fbbf24', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '240px' }}>
                                <input
                                  type="checkbox"
                                  id={`pt-check-${sub.id}`}
                                  checked={sub.ptSessionsTotal > 0}
                                  onChange={(e) => updateSubscription(sub.id, 'ptSessionsTotal', e.target.checked ? (sub.ptSessionsTotal || 10) : 0)}
                                  style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer', flexShrink: 0 }}
                                />
                                <label htmlFor={`pt-check-${sub.id}`} style={{ fontSize: '0.875rem', fontWeight: 700, color: '#065f46', cursor: 'pointer', flexShrink: 0 }}>
                                  🏋️ PT Sessions
                                </label>
                                {sub.ptSessionsTotal > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                      type="number"
                                      min="1"
                                      max="500"
                                      value={sub.ptSessionsTotal}
                                      onChange={(e) => updateSubscription(sub.id, 'ptSessionsTotal', Math.max(1, parseInt(e.target.value) || 1))}
                                      style={{ width: '80px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #10b981', fontSize: '0.875rem', fontWeight: 700, color: '#065f46', textAlign: 'center' }}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>sessions</span>
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '240px' }}>
                                <input
                                  type="checkbox"
                                  id={`sauna-check-${sub.id}`}
                                  checked={sub.steamSessionsTotal > 0}
                                  onChange={(e) => updateSubscription(sub.id, 'steamSessionsTotal', e.target.checked ? (sub.steamSessionsTotal || 10) : 0)}
                                  style={{ width: '18px', height: '18px', accentColor: '#3b82f6', cursor: 'pointer', flexShrink: 0 }}
                                />
                                <label htmlFor={`sauna-check-${sub.id}`} style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e3a8a', cursor: 'pointer', flexShrink: 0 }}>
                                  🧖 Sauna Sessions
                                </label>
                                {sub.steamSessionsTotal > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                      type="number"
                                      min="1"
                                      max="500"
                                      value={sub.steamSessionsTotal}
                                      onChange={(e) => updateSubscription(sub.id, 'steamSessionsTotal', Math.max(1, parseInt(e.target.value) || 1))}
                                      style={{ width: '80px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #3b82f6', fontSize: '0.875rem', fontWeight: 700, color: '#1e3a8a', textAlign: 'center' }}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>sessions</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Section 2: Timing */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '32px', background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
                              <div className="nm-field">
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Start Date</label>
                                <input
                                  type="date"
                                  value={sub.startDate}
                                  onChange={(e) => updateSubscription(sub.id, 'startDate', e.target.value)}
                                  disabled={isLocked}
                                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                />
                              </div>
                              <div className="nm-field">
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Expiry Date</label>
                                <input type="date" value={sub.endDate} readOnly style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff' }} />
                              </div>
                            </div>

                            {/* Section 3: Financials */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                              <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Base Price</label>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>₹{sub.amount}</div>
                              </div>
                              <div className="nm-field">
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Discount Type</label>
                                <select
                                  value={sub.discountType}
                                  onChange={(e) => updateSubscription(sub.id, 'discountType', e.target.value)}
                                  disabled={isLocked}
                                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                >
                                  <option value="amount">Flat (₹)</option>
                                  <option value="percentage">Percent (%)</option>
                                </select>
                              </div>
                              <div className="nm-field">
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Discount</label>
                                <input
                                  type="number"
                                  value={sub.discountValue}
                                  onChange={(e) => updateSubscription(sub.id, 'discountValue', e.target.value)}
                                  disabled={isLocked}
                                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f97316', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Net Payable</label>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f97316' }}>₹{sub.finalAmount.toFixed(2)}</div>
                              </div>
                            </div>

                            {/* Section 4: Tracking & Usage */}
                            {(sub.steamSessionsTotal > 0 || sub.ptSessionsTotal > 0) && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px', border: '1px solid #f1f5f9', padding: '20px', borderRadius: '12px' }}>
                                {sub.steamSessionsTotal > 0 && (
                                  <div>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '12px' }}>Steam Sessions ({sub.steamSessionsUsed}/{sub.steamSessionsTotal})</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                      {Array.from({ length: sub.steamSessionsTotal }).map((_, i) => (
                                        <input
                                          key={i}
                                          type="checkbox"
                                          checked={i < sub.steamSessionsUsed}
                                          onChange={(e) => {
                                            const newCount = e.target.checked ? sub.steamSessionsUsed + 1 : sub.steamSessionsUsed - 1;
                                            updateSubscription(sub.id, 'steamSessionsUsed', Math.min(Math.max(0, newCount), sub.steamSessionsTotal));
                                          }}
                                          style={{ width: '18px', height: '18px', accentColor: '#3b82f6', cursor: 'pointer' }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {sub.ptSessionsTotal > 0 && (
                                  <div>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#475569', marginBottom: '12px' }}>PT Sessions ({sub.ptSessionsUsed}/{sub.ptSessionsTotal})</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                      {Array.from({ length: sub.ptSessionsTotal }).map((_, i) => (
                                        <input
                                          key={i}
                                          type="checkbox"
                                          checked={i < sub.ptSessionsUsed}
                                          onChange={(e) => {
                                            const newCount = e.target.checked ? sub.ptSessionsUsed + 1 : sub.ptSessionsUsed - 1;
                                            updateSubscription(sub.id, 'ptSessionsUsed', Math.min(Math.max(0, newCount), sub.ptSessionsTotal));
                                          }}
                                          style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Card Footer: Summary & Payment */}
                            <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9', backgroundColor: '#fcfcfc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', gap: '40px' }}>
                                <div>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Already Paid</label>
                                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>₹{sub.paidAmount.toFixed(2)}</div>
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Remaining Balance</label>
                                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (sub.finalAmount - sub.paidAmount) > 0 ? '#ef4444' : '#10b981' }}>
                                    ₹{(sub.finalAmount - sub.paidAmount).toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '12px' }}>
                                {(sub.finalAmount - sub.paidAmount) > 0 && (
                                  <button
                                    onClick={() => {
                                      setPayingSub(sub);
                                      setShowPaymentModal(true);
                                    }}
                                    style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgb(16 185 129 / 0.2)' }}
                                  >
                                    Create Payment
                                  </button>
                                )}
                                {!isLocked && (
                                  <button
                                    onClick={() => handleDelete(sub.id)}
                                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Actions */}
                <div style={{
                  marginTop: '32px',
                  padding: '24px',
                  backgroundColor: '#fff',
                  borderTop: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '16px',
                  boxShadow: '0 -4px 6px -1px rgb(0 0 0 / 0.05)'
                }}>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => navigate('/subscriptions')}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      background: 'white',
                      color: '#64748b',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateMember()}
                    className="btn-primary"
                    style={{
                      padding: '12px 32px',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#f97316',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px -1px rgb(249 115 22 / 0.2)'
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Payment Entry Modal for New Subscriptions */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1100
        }}>
          <div style={{
            backgroundColor: 'white', width: '90%', maxWidth: '500px',
            borderRadius: '12px', padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '24px' }}>
              Confirm Payment
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Payment Mode</label>
              <select
                id="paymentModeInput"
                defaultValue="Cash"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Amount to Pay Now</label>
              <input
                type="number"
                id="amountPaidInput"
                defaultValue={payingSub ? (payingSub.finalAmount - payingSub.paidAmount) : 0}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '1.125rem', fontWeight: 700, color: '#10b981' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Notes</label>
              <textarea
                id="paymentNotesInput"
                placeholder="Optional notes..."
                defaultValue={payingSub?.notes || ''}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '80px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const mode = document.getElementById('paymentModeInput').value;
                  const amount = parseFloat(document.getElementById('amountPaidInput').value) || 0;
                  const notes = document.getElementById('paymentNotesInput').value;

                  if (!payingSub) return;

                  // Update the specific subscription in state with payment details
                  const updatedSubs = subscriptions.map(s => {
                    if (s.id === payingSub.id) {
                      // Add to already paid amount
                      const newPaidTotal = (s.paidAmount || 0) + amount;
                      const total = parseFloat(s.finalAmount) || 0;

                      if (newPaidTotal > total + 0.01) { // allowance for float
                        toast.warning(`Total payment (₹${newPaidTotal}) cannot exceed the net payable amount (₹${total})`);
                        return s;
                      }

                      const newStatus = (newPaidTotal >= total && total > 0) ? 'Active' : 'Pending';

                      return { ...s, paidAmount: newPaidTotal, paymentMode: mode, notes: notes, status: newStatus };
                    }
                    return s;
                  });

                  setSubscriptions(updatedSubs);
                  setShowPaymentModal(false);

                  // Trigger Save for this specific sub
                  const subToSave = updatedSubs.find(s => s.id === payingSub.id);
                  if (subToSave) {
                    handleUpdateMember(subToSave);
                  }
                  setPayingSub(null);
                }}
                style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )
      }

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
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Invoice Details: {selectedBill.invoiceId}</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={async () => {
                    try {
                      await generatePDF(selectedBill);
                    } catch (err) {
                      console.error("PDF generation failed:", err);
                      toast.error("PDF generate error: " + err.message);
                    }
                  }}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
                >
                  <Download size={16} /> Download PDF
                </button>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ padding: '32px', overflowY: 'auto' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '40px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    {gymSettings?.gymLogo ? (
                      <img src={`${backendurl.replace('/gym', '')}${gymSettings.gymLogo}`} alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px' }} />
                    ) : (
                      <div style={{ width: '80px', height: '80px', background: '#f9731610', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building size={40} color="#f97316" />
                      </div>
                    )}
                    <div>
                      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f97316', margin: 0 }}>{gymSettings?.gymName || "Gym Name"}</h1>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.875rem', marginTop: '4px' }}>
                        <MapPin size={14} /> <span>{gymSettings?.landmark ? `${gymSettings.landmark}, ` : ""}{gymSettings?.address?.split('\n')[0]}</span>
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
                      <span style={{ fontWeight: 600, color: '#10b981' }}>{selectedBill.status.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Calculations */}
                {(() => {
                  const sub = selectedBill.subscriptionId || {};
                  const subAmount = sub.amount || (selectedBill.totalAmount + (selectedBill.discount || 0));
                  const discValue = sub.discountValue || selectedBill.discount || 0;
                  const discType = sub.discountType || 'amount';
                  let calculatedDiscount = discValue;
                  if (discType === 'percentage') {
                    calculatedDiscount = (subAmount * discValue) / 100;
                  }

                  return (
                    <>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                        <thead><tr style={{ borderBottom: '2px solid #f1f5f9' }}><th style={{ textAlign: 'left', padding: '12px 0', fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>DESCRIPTION</th><th style={{ textAlign: 'right', padding: '12px 0', fontSize: '0.875rem', color: '#64748b', fontWeight: 700 }}>AMOUNT</th></tr></thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '16px 0', color: '#1e293b', fontWeight: 500 }}>
                              Package Base Amount
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                {sub.packageName || "Membership Plan"}
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: '300px' }}>
                    <p style={{ margin: 0 }}>Amount in words:</p>
                    <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', color: '#64748b' }}>{numberToWords(selectedBill.amountPaid)}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    {gymSettings?.authorizerSignature ? (
                      <img src={`${backendurl.replace('/gym', '')}${gymSettings.authorizerSignature}`} alt="Signature" style={{ height: '60px', width: 'auto', display: 'block', margin: '0 auto 8px' }} />
                    ) : (
                      <div style={{ height: '60px' }}></div>
                    )}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>Authorized Signature</div>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: '32px', color: '#94a3b8', fontSize: '0.875rem' }}>Thank you for choosing {gymSettings?.gymName || "Gym Name"}!</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;