import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppContent } from '../context/context.jsx';
import axios from 'axios';
import { Search, Loader2, Save, X, FileText, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import "../styles/dashboard.css";
import { toast } from 'react-toastify';
import { loadImage, drawGymHeader, drawGymFooter } from "../utils/pdfUtils";

export default function Billing() {
    const { backendurl, isauthenticated, gymSettings } = useContext(AppContent);
    const navigate = useNavigate();
    const location = useLocation();

    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [searchId, setSearchId] = useState("");
    const [memberSubscriptions, setMemberSubscriptions] = useState([]);
    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState({
        invoiceId: "Auto-generated",
        memberId: "",
        _id: "", // MongoDB internal ID for ref
        memberName: "",
        mobile: "",
        packageName: "",
        membershipType: "",
        totalAmount: 0,
        payingNow: 0,
        balance: 0,
        paymentMode: "Cash",
        notes: "",
        subscriptionId: "",
        personalizedPlanId: "",
        isPersonalizedPlan: false
    });

    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEffect(() => {
        if (!isauthenticated) {
            navigate("/");
        }
    }, [isauthenticated, navigate]);

    // ... existing useEffects ...

    // ... fetch logic ...

    // ... search logic ...

    // ... submit logic ...

    // Updated delete handler - opens modal
    const handleDelete = () => {
        setShowDeleteModal(true);
    };

    // Actual delete logic called from modal
    const confirmDelete = async () => {
        try {
            setLoading(true);
            const response = await axios.delete(`${backendurl}/bills/${formData.invoiceId}`, {
                withCredentials: true
            });

            if (response.data.success) {
                toast.success("Bill deleted successfully");
                navigate('/billlisting');
            }
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete bill");
        } finally {
            setLoading(false);
            setShowDeleteModal(false);
        }
    };

    useEffect(() => {
        if (location.state?.memberId) {
            setSearchId(location.state.memberId);
        }

        // Handle Personalized Plan Payment
        if (location.state?.type === 'personalizedPlan') {
            const { planId, memberId, memberDatabaseId, fullName, mobileNumber, price, amountPaid, paymentStatus, packageName, membershipType, balanceAmount } = location.state;
            const balance = balanceAmount !== undefined ? balanceAmount : (parseFloat(price) || 0) - (parseFloat(amountPaid) || 0);

            setSearchId(memberId || '');
            setFormData(prev => ({
                ...prev,
                _id: memberDatabaseId || '',
                memberId: memberId || '',
                invoiceId: 'Auto-generated',
                memberName: fullName || '',
                mobile: mobileNumber || '',
                packageName: packageName || 'Personalized Fitness Plan',
                membershipType: membershipType || 'Fitness Plan',
                totalAmount: balance,
                payingNow: balance,
                balance: 0,
                personalizedPlanId: planId, // This is the string ID (e.g. PPLAN...)
                isPersonalizedPlan: true,
                subscriptionId: ""
            }));

            // Fetch other subscriptions for this member
            if (memberDatabaseId) {
                fetchMemberLinks(memberDatabaseId, memberId);
            }
        }
        // View Mode: Fetch existing bill
        else if (location.state?.billId) {
            if (location.state?.mode === 'edit') {
                setIsEditing(true);
            }
            fetchBillDetails(location.state.billId);
        }
    }, [location.state]);

    const fetchBillDetails = async (billId) => {
        try {
            setLoading(true);
            const response = await axios.get(`${backendurl}/bills/${billId}`, { withCredentials: true });
            if (response.data) {
                const bill = response.data;

                // Handle populated memberId
                const memberObj = bill.memberId || {};
                const mDbId = memberObj._id || bill.memberId; // Fallback if not populated (though usage suggests it is)
                const mIdStr = memberObj.memberId || '';

                setSearchId(mIdStr); // Populate the search input

                setFormData({
                    _id: mDbId,
                    invoiceId: bill.invoiceId,
                    memberName: bill.memberName,
                    memberId: mIdStr,
                    mobile: memberObj.phone || 'N/A',
                    packageName: bill.items[0]?.description || '',
                    membershipType: '', // This might be hard to recover if not stored on bill, but we'll try to get it from sub
                    totalAmount: bill.totalAmount,
                    payingNow: bill.amountPaid,
                    balance: bill.balance,
                    paymentMode: bill.paymentMode,
                    notes: bill.notes,
                    billDate: bill.invoiceDate,
                    subscriptionId: bill.subscriptionId ? (bill.subscriptionId._id || bill.subscriptionId) : "",
                    personalizedPlanId: bill.personalizedPlanId ? (bill.personalizedPlanId._id || bill.personalizedPlanId) : "",
                    isPersonalizedPlan: !!bill.personalizedPlanId
                });

                // Fetch subscriptions to populate dropdown
                if (mDbId) {
                    // Pass the subscription/plan ID as autoSelectId to ensure it gets selected/recognized
                    const currentSubId = bill.subscriptionId ? (bill.subscriptionId._id || bill.subscriptionId) : (bill.personalizedPlanId ? (bill.personalizedPlanId._id || bill.personalizedPlanId) : null);
                    // Pass true for skipFormUpdate so we don't overwrite the bill details with subscription defaults
                    fetchMemberLinks(mDbId, mIdStr, false, null, currentSubId, true);
                }
            }
        } catch (error) {
            console.error("Error fetching bill:", error);
            toast.error("Failed to load bill details");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        const doc = new jsPDF();

        // -- Header with Logo, Name, Address, etc. --
        let y = await drawGymHeader(doc, gymSettings, backendurl);

        // Sub-Header
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text("GYM RECEIPT", 105, y, { align: "center" });
        y += 15;



        // Bill Details
        doc.setFontSize(10);
        doc.setTextColor(0);

        const leftX = 14;
        const rightX = 140;

        doc.text(`Invoice #: ${formData.invoiceId}`, leftX, y);
        const dateStr = formData.billDate ? new Date(formData.billDate).toLocaleDateString() : new Date().toLocaleDateString();
        doc.text(`Date: ${dateStr}`, rightX, y);
        y += 8;
        doc.text(`Member: ${formData.memberName}`, leftX, y);
        // doc.text(`Mobile: ${formData.mobile}`, rightX, y); 

        // Items Table
        autoTable(doc, {
            startY: y + 15,
            head: [['Description', 'Amount']],
            body: [
                [formData.packageName || 'Membership Payment', `INR ${formData.totalAmount}`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [66, 66, 66] }
        });

        // Totals
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.text(`Total Amount: INR ${formData.totalAmount}`, rightX, finalY);
        doc.text(`Amount Paid: INR ${formData.payingNow}`, rightX, finalY + 6);
        doc.text(`Balance Due: INR ${formData.balance}`, rightX, finalY + 12);

        const contentEnd = finalY + 20;

        // -- Terms & Conditions --
        const termsY = contentEnd + 10; // Dynamic start
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100);
        doc.text("Terms & Conditions", 14, termsY);
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
            doc.text(`• ${term}`, 14, tY);
            tY += 3.5;
        });

        const footerY = Math.max(280, tY + 10);

        // Footer
        drawGymFooter(doc, gymSettings, footerY);

        doc.save(`${formData.invoiceId}.pdf`);
    };

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchId.trim().length >= 3) {
                handleMemberSearch(searchId);
            } else if (searchId.trim().length === 0) {
                resetForm();
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [searchId]);

    const handleMemberSearch = async (id) => {
        try {
            setSearching(true);
            const response = await axios.get(`${backendurl}/members?search=${id}`, {
                withCredentials: true,
            });

            if (response.data.success && response.data.members.length > 0) {
                // Look for exact match on memberId
                const member = response.data.members.find(m => m.memberId === id) || response.data.members[0];

                // If we are already handling a personalized plan from state, don't overwrite the main form but still fetch links
                if (location.state?.type === 'personalizedPlan') {
                    fetchMemberLinks(member._id, member.memberId, false, null, location.state.planId);
                    setSearching(false);
                    return;
                }

                // Fetch subscriptions and pending fitness plans
                // Fix: prevent overwriting form data if we are in Edit mode and the member hasn't changed
                // (This happens when fetchBillDetails sets searchId, triggering this effect)
                const isSameMember = formData.memberId === member.memberId;
                const shouldUpdate = !isEditing || !isSameMember;

                // Check for auto-select ID from navigation state
                const autoSelectId = location.state?.autoSelectId || location.state?.subscriptionId || null;

                await fetchMemberLinks(member._id, member.memberId, shouldUpdate, member, autoSelectId);
            } else {
                // Only alert if the ID is a complete 3-digit ID
                if (id.length >= 3) {
                    console.log("No member found with Member ID:", id);
                }
            }
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setSearching(false);
        }
    };

    const fetchMemberLinks = async (mDbId, mId, shouldUpdateForm = false, memberObj = null, autoSelectId = null, skipFormUpdate = false) => {
        try {
            const subReq = axios.get(`${backendurl}/subscriptions/member/${mDbId}`, { withCredentials: true });
            const plansReq = axios.get(`${backendurl}/personalized-plans/list`, {
                params: { search: mId }, // Remove status filter to include partials
                withCredentials: true
            });

            const [subRes, plansRes] = await Promise.all([subReq, plansReq]);

            let allSubs = [];

            // Regular Subscriptions
            if (subRes.data.success && subRes.data.subscriptions.length > 0) {
                const balanceSubs = subRes.data.subscriptions
                    .filter(sub => {
                        // Always include if it matches the current selection (autoSelectId)
                        if (autoSelectId && sub._id === autoSelectId) return true;

                        const status = sub.status?.toLowerCase();
                        const balance = sub.balanceAmount !== undefined ? sub.balanceAmount : (sub.netPayable || sub.amount) - (sub.amountPaid || 0);
                        // Otherwise default logic: pending/active with balance
                        return (status === 'pending' || status === 'active') && balance > 0;
                    })
                    .map(sub => ({ ...sub, type: 'subscription' }));
                allSubs = [...allSubs, ...balanceSubs];
            }

            // Fitness Plans
            if (plansRes.data.success && plansRes.data.plans.length > 0) {
                const nonPaidPlans = plansRes.data.plans
                    .filter(p => {
                        // Always include if it matches the current selection (autoSelectId)
                        if (autoSelectId && p.planId === autoSelectId) return true;

                        // Note: p.planId is usually the _id from the plans list endpoint or we need to check how it's returned
                        // In fetchMemberLinks (previous code): _id: p.planId
                        // Let's check `getPlans` returns mapped objects?
                        // Assuming p.planId is the unique ref.

                        return p.paymentStatus !== 'paid';
                    })
                    .map(p => ({
                        _id: p.planId,
                        packageName: p.packageName,
                        startDate: p.createdAt,
                        status: p.paymentStatus,
                        balanceAmount: (parseFloat(p.price) || 0) - (parseFloat(p.amountPaid) || 0),
                        type: 'fitnessPlan'
                    }));
                allSubs = [...allSubs, ...nonPaidPlans];
            }

            setMemberSubscriptions(allSubs);

            if (shouldUpdateForm && memberObj) {
                // Auto-select logic: If exactly one item exists, select it
                if (allSubs.length === 1) {
                    const targetSub = allSubs[0];
                    const pendingAmount = targetSub.balanceAmount !== undefined ? targetSub.balanceAmount : (targetSub.netPayable || targetSub.amount) - (targetSub.amountPaid || 0);

                    setFormData(prev => ({
                        ...prev,
                        _id: memberObj._id,
                        memberId: memberObj.memberId,
                        memberName: memberObj.fullName,
                        mobile: memberObj.phone,
                        subscriptionId: targetSub.type === 'subscription' ? targetSub._id : '',
                        personalizedPlanId: targetSub.type === 'fitnessPlan' ? targetSub._id : '',
                        isPersonalizedPlan: targetSub.type === 'fitnessPlan',
                        packageName: targetSub.packageName,
                        membershipType: targetSub.type === 'fitnessPlan' ? "Fitness Plan" : (targetSub.membershipType || "Monthly"),
                        totalAmount: pendingAmount >= 0 ? pendingAmount : 0,
                        payingNow: pendingAmount >= 0 ? pendingAmount : 0,
                        balance: 0
                    }));
                } else {
                    setFormData(prev => ({
                        ...prev,
                        _id: memberObj._id,
                        memberId: memberObj.memberId,
                        memberName: memberObj.fullName,
                        mobile: memberObj.phone,
                        packageName: memberObj.packageName || "N/A",
                        membershipType: memberObj.type || "N/A",
                        totalAmount: memberObj.balanceAmount || 0,
                        payingNow: memberObj.balanceAmount || 0,
                        balance: 0,
                        subscriptionId: ""
                    }));
                }
            } else if (autoSelectId && !skipFormUpdate) {
                // Specific selection for navigation scenario
                const targetSub = allSubs.find(s => s._id === autoSelectId);
                if (targetSub) {
                    const pendingAmount = targetSub.balanceAmount !== undefined ? targetSub.balanceAmount : ((parseFloat(targetSub.netPayable) || parseFloat(targetSub.amount) || 0) - (parseFloat(targetSub.amountPaid) || 0));
                    setFormData(prev => ({
                        ...prev,
                        subscriptionId: targetSub.type === 'subscription' ? targetSub._id : '',
                        personalizedPlanId: targetSub.type === 'fitnessPlan' ? targetSub._id : '',
                        isPersonalizedPlan: targetSub.type === 'fitnessPlan',
                        packageName: targetSub.packageName,
                        membershipType: targetSub.type === 'fitnessPlan' ? "Fitness Plan" : (targetSub.membershipType || "Monthly"),
                        totalAmount: pendingAmount >= 0 ? pendingAmount : 0,
                        payingNow: pendingAmount >= 0 ? pendingAmount : 0,
                        balance: 0
                    }));
                }
            }
        } catch (err) {
            console.error("Error fetching links:", err);
            setMemberSubscriptions([]);
        }
    };

    const resetForm = () => {
        setFormData({
            invoiceId: "Auto-generated",
            memberId: "",
            _id: "",
            memberName: "",
            mobile: "",
            packageName: "",
            membershipType: "",
            totalAmount: 0,
            payingNow: 0,
            balance: 0,
            paymentMode: "Cash",
            notes: "",
            subscriptionId: "",
            personalizedPlanId: "",
            isPersonalizedPlan: false
        });
    };

    const handlePayingNowChange = (val) => {
        const paid = parseFloat(val) || 0;
        if (paid > formData.totalAmount) {
            toast.warning(`Payment cannot exceed the balance amount (₹${formData.totalAmount})`);
            setFormData(prev => ({
                ...prev,
                payingNow: prev.totalAmount,
                balance: 0
            }));
            return;
        }
        setFormData(prev => ({
            ...prev,
            payingNow: paid,
            balance: Math.max(0, prev.totalAmount - paid)
        }));
    };

    const handleSubscriptionChange = (id) => {
        const selected = memberSubscriptions.find(s => s._id === id);
        if (selected) {
            const pendingAmount = selected.balanceAmount !== undefined ? selected.balanceAmount : ((parseFloat(selected.netPayable) || parseFloat(selected.amount) || 0) - (parseFloat(selected.amountPaid) || 0));
            setFormData(prev => ({
                ...prev,
                subscriptionId: selected.type === 'subscription' ? id : "",
                personalizedPlanId: selected.type === 'fitnessPlan' ? id : "",
                isPersonalizedPlan: selected.type === 'fitnessPlan',
                packageName: selected.packageName,
                membershipType: selected.type === 'fitnessPlan' ? "Fitness Plan" : (selected.membershipType || "Monthly"),
                totalAmount: pendingAmount >= 0 ? pendingAmount : 0,
                payingNow: pendingAmount >= 0 ? pendingAmount : 0,
                balance: 0
            }));
        } else {
            // Reset if 'Select Subscription' chosen
            setFormData(prev => ({
                ...prev,
                subscriptionId: "",
                personalizedPlanId: "",
                isPersonalizedPlan: false,
                packageName: "",
                membershipType: "",
                totalAmount: 0,
                payingNow: 0,
                balance: 0
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Create or Update Bill record
        try {
            setLoading(true);

            // Common Bill Data
            const billData = {
                memberId: formData._id,
                subscriptionId: formData.subscriptionId || null,
                personalizedPlanId: formData.personalizedPlanId || null,
                invoiceDate: isEditing && formData.billDate ? new Date(formData.billDate) : new Date(),
                dueDate: isEditing && formData.billDate ? new Date(formData.billDate) : new Date(), // Keep due date same as invoice for now or preserve
                items: [{
                    description: formData.packageName ? `${formData.packageName} ${formData.isPersonalizedPlan ? 'Plan' : 'Subscription'} Payment` : 'General Payment',
                    quantity: 1,
                    rate: formData.totalAmount,
                    amount: formData.totalAmount
                }],
                discount: 0,
                taxRate: 0,
                paymentMode: formData.paymentMode,
                amountPaid: formData.payingNow,
                notes: formData.notes
            };

            let response;
            if (isEditing) {
                // Update existing bill
                response = await axios.put(`${backendurl}/bills/${formData.invoiceId}`, billData, {
                    withCredentials: true,
                });
            } else {
                // Create new bill
                response = await axios.post(`${backendurl}/bills`, billData, {
                    withCredentials: true,
                });
            }

            if (response.status === 201 || response.status === 200 || response.data.success) {
                toast.success(isEditing ? "Bill updated successfully!" : "Bill created successfully!");
                setTimeout(() => navigate(formData.isPersonalizedPlan ? "/fitnesslisting" : "/billlisting"), 1500);
            }
        } catch (error) {
            console.error("Submit error:", error);
            toast.error(error.response?.data?.error || "Error saving bill.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dash-main">
            <header className="dash-header">
                <div className="dash-header-left">
                    <div className="dash-breadcrumb">Dashboard / {isEditing ? 'Edit Bill' : 'Create New Bill'}</div>
                </div>
                <div className="dash-header-right" style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="btn-secondary" onClick={() => navigate('/billlisting')}>
                        <X size={18} style={{ marginRight: '8px' }} /> Cancel
                    </button>
                    <button type="button" className="btn-primary" onClick={handleSubmit} disabled={loading || !formData._id}>
                        {loading ? <Loader2 className="animate-spin" /> : <Save size={18} style={{ marginRight: '8px' }} />}
                        {isEditing ? 'Update Bill' : 'Save Bill'}
                    </button>

                    {isEditing ? (
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleDelete}
                            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none' }}
                        >
                            <Trash2 size={18} style={{ marginRight: '8px' }} />
                            Delete Bill
                        </button>
                    ) : (
                        formData.invoiceId !== "Auto-generated" && (
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleDownloadPDF}
                                style={{ backgroundColor: '#4f46e5', color: 'white', border: 'none' }}
                            >
                                <FileText size={18} style={{ marginRight: '8px' }} />
                                Download PDF
                            </button>
                        )
                    )}
                </div>
            </header>

            <div className="dash-content new-member-page">
                <h1 className="dash-page-title">{isEditing ? 'Edit Member Invoice' : 'Generate Member Invoice'}</h1>

                <div className="nm-card">
                    <div className="nm-card-header">
                        <h2>Billing Details</h2>

                    </div>

                    <form className="nm-form" onSubmit={handleSubmit} style={{ padding: '20px' }}>
                        <div className="nm-grid">
                            <div className="nm-field">
                                <label>Member ID</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        value={searchId}
                                        onChange={(e) => setSearchId(e.target.value)}
                                        placeholder="Enter Member ID (e.g. 101)"
                                        style={{ paddingRight: '40px' }}
                                    />
                                    {searching && (
                                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                                            <Loader2 className="animate-spin" size={18} color="#9ca3af" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="nm-field">
                                <label>Invoice Number</label>
                                <input type="text" value={formData.invoiceId} readOnly style={{ background: '#f9fafb' }} />
                            </div>

                            <div className="nm-field">
                                <label>Full Name</label>
                                <input type="text" value={formData.memberName} readOnly style={{ background: '#f9fafb' }} />
                            </div>

                            <div className="nm-field">
                                <label>Mobile Number</label>
                                <input type="text" value={formData.mobile} readOnly style={{ background: '#f9fafb' }} />
                            </div>

                            <div className="nm-field">
                                <label>Link Subscription <span style={{ color: '#ef4444' }}>*</span></label>
                                <select
                                    value={formData.isPersonalizedPlan ? formData.personalizedPlanId : (formData.subscriptionId || "")}
                                    onChange={(e) => handleSubscriptionChange(e.target.value)}
                                    style={{
                                        background: memberSubscriptions.length > 0 ? 'white' : '#f3f4f6',
                                        border: !(formData.subscriptionId || formData.personalizedPlanId) && memberSubscriptions.length > 0 ? '2px solid #ef4444' : '1px solid #e2e8f0'
                                    }}
                                    disabled={memberSubscriptions.length === 0}
                                    required
                                >
                                    <option value="">-- Select Subscription/Plan --</option>
                                    {memberSubscriptions.map(sub => (
                                        <option key={sub._id} value={sub._id}>
                                            {sub.type === 'fitnessPlan' ? '[FITNESS] ' : ''}{sub.packageName} ({new Date(sub.startDate).toLocaleDateString()} - {sub.status})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="nm-field">
                                <label>Member ID</label>
                                <input type="text" value={formData.memberId} readOnly style={{ background: '#f9fafb' }} />
                            </div>

                            <div className="nm-field">
                                <label>Package Name</label>
                                <input type="text" value={formData.packageName} readOnly style={{ background: '#f9fafb' }} />
                            </div>

                            <div className="nm-field">
                                <label>Membership Type</label>
                                <input type="text" value={formData.membershipType} readOnly style={{ background: '#f9fafb' }} />
                            </div>

                            <div className="nm-field">
                                <label>Total Amount (₹)</label>
                                <input type="number" value={formData.totalAmount} readOnly style={{ background: '#f3f4f6', fontWeight: 'bold' }} />
                            </div>

                            <div className="nm-field">
                                <label>Paying Now (₹)</label>
                                <input
                                    type="number"
                                    value={formData.payingNow}
                                    onChange={(e) => handlePayingNowChange(e.target.value)}
                                    style={{ border: '2px solid #fb923c' }}
                                />
                            </div>

                            <div className="nm-field">
                                <label>Balance Amount (₹)</label>
                                <input
                                    type="number"
                                    value={formData.balance}
                                    readOnly
                                    style={{ background: '#fef2f2', color: formData.balance > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}
                                />
                            </div>

                            <div className="nm-field">
                                <label>Payment Mode</label>
                                <select value={formData.paymentMode} onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}>
                                    <option value="Cash">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Card">Card</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                </select>
                            </div>

                            <div className="nm-field" style={{ gridColumn: 'span 2' }}>
                                <label>Notes (Optional)</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="2"
                                    placeholder="Additional payment horizontal/remarks..."
                                />
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '24px',
                        borderRadius: '12px',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#111827', fontSize: '1.25rem', fontWeight: 600 }}>Confirm Deletion</h3>
                        <p style={{ color: '#4b5563', marginBottom: '24px' }}>
                            Are you sure you want to delete this bill? This action cannot be undone and will <strong>revert the payment amount</strong> from the member's record.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    backgroundColor: 'white',
                                    color: '#374151',
                                    cursor: 'pointer',
                                    fontWeight: 500
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 500
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}