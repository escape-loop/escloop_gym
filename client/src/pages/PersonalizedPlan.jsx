import React, { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Download, X, Building, MapPin, Phone, Mail, Globe, Printer, Loader2 } from 'lucide-react';
import { AppContent } from '../context/context.jsx';
import ToggleButton from '../components/ToggleButton.jsx';
import '../styles/dashboard.css';
import '../styles/toggle-button.css';
import '../styles/personalizedplan.css'; // Imported new styles
import { toast } from 'react-toastify';
import { loadImage, drawGymHeader, drawGymFooter } from "../utils/pdfUtils";

export default function PersonalizedPlan() {
    const { backendurl, sidebarOpen, setSidebarOpen, gymSettings } = useContext(AppContent);
    const navigate = useNavigate();
    const location = useLocation();

    const [unitSystem, setUnitSystem] = useState('metric'); // 'metric' or 'us'
    const [formData, setFormData] = useState({
        fullName: '',
        mobileNumber: '',
        age: '',
        gender: 'male',
        height: '',
        weight: '',
        activity: '1.55',
        goal: 'Weight Loss',
        isVeg: 'false', // String 'true'/'false' for select value, converted before sending if needed
        daysPerWeek: 4,
        price: ''
    });

    // Search and Member State
    const [searchId, setSearchId] = useState('');
    const [memberName, setMemberName] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);

    const [result, setResult] = useState(null); // TDEE Result
    const [error, setError] = useState('');
    const [memberDatabaseId, setMemberDatabaseId] = useState(null); // Store the MongoDB _id

    // AI Generation State
    const [loading, setLoading] = useState(false);
    const [dietPlan, setDietPlan] = useState(null);
    const [workoutPlan, setWorkoutPlan] = useState(null);

    // State for Edit Mode
    const [isEditing, setIsEditing] = useState(false);
    const [planId, setPlanId] = useState(null);
    const [amountPaid, setAmountPaid] = useState(0);
    const [paymentStatus, setPaymentStatus] = useState('pending');
    const [packageName, setPackageName] = useState('');
    const [bills, setBills] = useState([]); // State for linked bills
    const [showBillModal, setShowBillModal] = useState(false);
    const [selectedBill, setSelectedBill] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pendingPayment, setPendingPayment] = useState({
        amount: 0,
        mode: 'Cash',
        notes: ''
    });

    // Populate data if editing
    React.useEffect(() => {
        const loadPlanDetails = async () => {
            if (location.state && location.state.isEditing && location.state.plan) {
                const planSummary = location.state.plan;
                setIsEditing(true);
                setPlanId(planSummary.planId);

                try {
                    setLoading(true);
                    const response = await axios.get(`${backendurl}/personalized-plans/${planSummary.planId}`, { withCredentials: true });
                    if (response.data.success) {
                        const plan = response.data.plan;
                        setSearchId(plan.memberId || '');
                        setMemberName(plan.fullName);

                        setFormData({
                            fullName: plan.fullName,
                            mobileNumber: plan.mobileNumber,
                            age: plan.age,
                            gender: plan.gender,
                            height: plan.height,
                            weight: plan.weight,
                            activity: plan.activityLevel,
                            goal: plan.goal,
                            isVeg: String(plan.isVeg),
                            daysPerWeek: plan.daysPerWeek,
                            price: plan.price
                        });

                        setResult(plan.tdee);
                        setDietPlan(plan.dietPlan);
                        setWorkoutPlan(plan.workoutPlan);
                        setAmountPaid(plan.amountPaid || 0);
                        setPaymentStatus(plan.paymentStatus || 'pending');
                        setPackageName(plan.packageName || '');

                        // Use memberDatabaseId from backend (populated memberRef)
                        if (plan.memberDatabaseId) {
                            setMemberDatabaseId(plan.memberDatabaseId);
                        } else if (plan.memberId) {
                            // Fallback for older plans: Search by human ID to get DB _id
                            try {
                                const memRes = await axios.get(`${backendurl}/members`, {
                                    params: { search: plan.memberId },
                                    withCredentials: true
                                });
                                if (memRes.data.success && memRes.data.members.length > 0) {
                                    const member = memRes.data.members.find(m => m.memberId === plan.memberId) || memRes.data.members[0];
                                    setMemberDatabaseId(member._id);
                                }
                            } catch (memErr) {
                                console.error("Error fetching member details fallback:", memErr);
                            }
                        }

                        // Fetch linked bills
                        try {
                            const billsRes = await axios.get(`${backendurl}/bills`, {
                                params: { personalizedPlanId: plan.planId },
                                withCredentials: true
                            });
                            if (billsRes.data.success) {
                                setBills(billsRes.data.bills);
                            }
                        } catch (billErr) {
                            console.error("Error fetching bills:", billErr);
                        }

                        toast.info("Full plan details loaded");
                    }
                } catch (error) {
                    console.error("Error fetching full plan:", error);
                    toast.error("Failed to load plan details");
                } finally {
                    setLoading(false);
                }
            }
        };

        loadPlanDetails();
    }, [location.state]);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (searchId && searchId.length >= 3 && !isEditing) {
                handleSearch();
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [searchId, isEditing]);



    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Only clear results if critical inputs change, or maybe don't clear at all during edit?
        // For now, let's keep behavior consistent but maybe be less aggressive if just name changes.
        if (['age', 'gender', 'height', 'weight', 'activity', 'goal', 'isVeg'].includes(name)) {
            // If these change, TDEE/Plans might be invalid, but user might just want to tweak safely.
            // Let's NOT clear automatically in edit mode to avoid data loss, just let them regenerate if they want.
            // if (result) setResult(null); 
            // if (dietPlan) setDietPlan(null);
            // if (workoutPlan) setWorkoutPlan(null);
        }
    };

    const handleSearch = async () => {
        if (!searchId.trim()) {
            setError('Please enter Member ID or Phone Number to search.');
            return;
        }
        setSearchLoading(true);
        setError('');
        setMemberName('');

        try {
            // Using existing members endpoint with search param
            const response = await axios.get(`${backendurl}/members`, {
                params: { search: searchId },
                withCredentials: true
            });

            if (response.data.success && response.data.members.length > 0) {
                // Find exact match if possible (Member ID or Phone), or take first result
                let member = response.data.members.find(m =>
                    m.memberId === searchId ||
                    m.phone === searchId ||
                    (m.attendanceId && m.attendanceId === searchId) // specific check just in case
                );

                if (!member) member = response.data.members[0]; // Fallback to first result

                setMemberName(member.fullName);
                setMemberDatabaseId(member._id); // Store the actual DB ID

                // CRUCIAL: Sync the searchId field with the official Member ID
                if (member.memberId) {
                    setSearchId(member.memberId);
                }

                // Auto-fill logic
                const newFormData = { ...formData };
                newFormData.fullName = member.fullName || '';
                newFormData.mobileNumber = member.phone || '';

                // 1. Age (Calculate from DOB if possible, else use member.age)
                if (member.dob) {
                    const dob = new Date(member.dob);
                    const today = new Date();
                    let age = today.getFullYear() - dob.getFullYear();
                    const m = today.getMonth() - dob.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
                        age--;
                    }
                    newFormData.age = age;
                } else if (member.age) {
                    newFormData.age = member.age;
                }

                // 2. Gender
                if (member.gender) {
                    newFormData.gender = member.gender.toLowerCase() === 'female' ? 'female' : 'male';
                }

                // 3. Height (Check if exists)
                if (member.height) newFormData.height = member.height;

                // 4. Weight (Check if exists)
                if (member.weight) newFormData.weight = member.weight;

                setFormData(newFormData);
                toast.success(`Member Found: ${member.fullName}`);
            } else {
                setError('No member found with that ID.');
            }
        } catch (err) {
            console.error("Search Error:", err);
            setError('Failed to fetch member details.');
        } finally {
            setSearchLoading(false);
        }
    };

    const calculateTDEEValue = () => {
        // 1. Get Input Values
        const age = parseFloat(formData.age);
        let height = parseFloat(formData.height);
        let weight = parseFloat(formData.weight);
        const gender = formData.gender;
        const activityMultiplier = parseFloat(formData.activity);

        // 2. Basic Validation
        if (!age || !formData.height || !formData.weight) {
            setError('Please fill in Age, Height, and Weight.');
            return null;
        }

        if (isNaN(age) || isNaN(height) || isNaN(weight) || age < 18 || height < 0 || weight < 0) {
            setError('Please enter valid positive numbers. Age must be 18+.');
            return null;
        }

        // Convert US units to Metric if needed
        if (unitSystem === 'us') {
            // Height: inches to cm (1 inch = 2.54 cm)
            height = height * 2.54;
            // Weight: lbs to kg (1 lb = 0.453592 kg)
            weight = weight * 0.453592;
        }

        // 3. Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor Equation
        let baseCalculation = (10 * weight) + (6.25 * height) - (5 * age);
        let bmr;

        if (gender === 'male') {
            bmr = baseCalculation + 5;
        } else {
            bmr = baseCalculation - 161;
        }

        // 4. Calculate TDEE
        const tdee = Math.round(bmr * activityMultiplier);
        return tdee;
    };

    const handleGenerate = async () => {
        setError('');
        const tdee = calculateTDEEValue();
        if (!tdee) return; // Validation failed inside calculateTDEEValue

        setResult(tdee);
        setLoading(true);

        try {
            console.log("Starting AI Generation...");
            // 1. Fetch Diet Plan
            // USER_IS_VEG: If Yes 1, if no 0
            const isVegValue = formData.isVeg === 'true' ? 1 : 0;

            console.log("Calling generate_diet...");
            const dietReq = axios.post(`${backendurl}/fitness/generate-diet`, {
                USER_TDEE: tdee,
                USER_GOAL: formData.goal,
                USER_IS_VEG: isVegValue
            }, { withCredentials: true });

            // 2. Fetch Workout Plan
            console.log("Calling generate_workout...");
            const workoutReq = axios.post(`${backendurl}/fitness/generate-workout`, {
                USER_GENDER: formData.gender === 'male' ? 'Male' : 'Female', // Ensure casing matches what API expects
                USER_GOAL: formData.goal,
                DAYS_PER_WEEK: parseInt(formData.daysPerWeek)
            }, { withCredentials: true });

            // Execute in parallel
            const [dietRes, workoutRes] = await Promise.all([dietReq, workoutReq]);

            console.log("API Calls Successful");
            console.log("Diet Data:", dietRes.data);
            console.log("Workout Data:", workoutRes.data);

            setDietPlan(dietRes.data);
            setWorkoutPlan(workoutRes.data);

        } catch (err) {
            console.error("API Error Details:", err);
            // Don't clear the TDEE result, just show error for AI generation
            setError("Calculated TDEE: " + tdee + ". API Error: " + (err.message || "Failed to connect to local AI"));
        } finally {
            setLoading(false);
        }
    };

    // --- Save Handlers ---
    const handleSave = async (overridePayment = null) => {
        // Validate required fields
        if (!formData.fullName || !formData.mobileNumber || !formData.age || !formData.price) {
            toast.error('Please fill in all required fields including price');
            return;
        }

        if (!dietPlan || !workoutPlan || !result) {
            toast.error('Please generate the plan first before saving');
            return;
        }

        // Check if we are trying to pay for a new plan without a member link
        const currentAmountPaid = overridePayment ? overridePayment.amountPaid : amountPaid;
        if (!isEditing && currentAmountPaid > 0 && !memberDatabaseId) {
            toast.error("Please search and select a member before making a payment.");
            return;
        }

        try {
            const payload = {
                memberId: searchId || null,
                fullName: formData.fullName,
                mobileNumber: formData.mobileNumber,
                age: parseInt(formData.age),
                gender: formData.gender,
                height: parseFloat(formData.height),
                weight: parseFloat(formData.weight),
                activityLevel: parseFloat(formData.activity),
                goal: formData.goal,
                isVeg: formData.isVeg === 'true',
                daysPerWeek: parseInt(formData.daysPerWeek),
                tdee: result,
                dietPlan: dietPlan,
                workoutPlan: workoutPlan,
                price: parseFloat(formData.price),
                // Use override if provided, otherwise fall back to state
                amountPaid: overridePayment ? overridePayment.amountPaid : amountPaid,
                paymentMode: overridePayment ? overridePayment.mode : (pendingPayment.mode || 'Cash'),
                notes: overridePayment ? overridePayment.notes : (pendingPayment.notes || ''),
                memberRef: memberDatabaseId || null // Send actual ID or null
            };

            let response;
            if (isEditing && planId) {
                // Update existing plan
                response = await axios.put(`${backendurl}/personalized-plans/${planId}`, payload, { withCredentials: true });
            } else {
                // Create new plan
                response = await axios.post(`${backendurl}/personalized-plans/save`, payload, { withCredentials: true });
            }

            if (response.data.success) {
                toast.success(isEditing ? 'Plan updated successfully!' : 'Plan saved successfully!');
                setTimeout(() => {
                    navigate('/fitnesslisting');
                }, 1500);
            }
        } catch (error) {
            console.error('Error saving plan:', error);
            toast.error(error.response?.data?.message || 'Failed to save plan');
        }
    };

    const handleSaveAndPay = async () => {
        // Validate required fields
        if (!formData.fullName || !formData.mobileNumber || !formData.age || !formData.price) {
            toast.error('Please fill in all required fields including price');
            return;
        }

        if (!dietPlan || !workoutPlan || !result) {
            toast.error('Please generate the plan first before saving');
            return;
        }

        setShowPaymentModal(true);
    };

    const handleCreatePayment = () => {
        if (!planId) return;
        setShowPaymentModal(true);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-IN');
    };

    const getStatusColor = (status) => {
        const colors = {
            paid: '#10b981',
            partial: '#f59e0b',
            due: '#ef4444',
            overdue: '#7c3aed'
        };
        return colors[status] || '#6b7280';
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

    const generateBillPDF = async (bill) => {
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

        // -- Member & Details --
        const leftX = 15;
        const rightColX = 110;
        let y = yPos;
        const lineHeight = 5.5;

        doc.setFontSize(10);
        doc.setTextColor(0);

        // Member Details Box Header
        doc.setFont("helvetica", "bold");
        doc.setFillColor(...lightBg);
        doc.rect(leftX - 2, y - 5, 80, lineHeight + 1, 'F');
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

        // Plan Section
        doc.setFont("helvetica", "bold");
        doc.setFillColor(...primaryOrange);
        doc.setTextColor(255, 255, 255);
        doc.rect(leftX, y, 180, 6, 'F');
        doc.text("Plan Details", leftX + 2, y + 4.5);
        doc.setTextColor(0);
        y += 9;

        doc.setFont("helvetica", "normal");
        const packageName = bill.packageName || (bill.items && bill.items[0]?.description) || 'Fitness Plan';
        doc.text(`Package: ${packageName}`, leftX, y);
        doc.text(`Type: Fitness Plan`, rightColX, y); y += 12;

        // -- Financial Table --
        // Use logic from Modal: personalizedPlan.price OR fallback to bill total+discount
        const subAmount = bill.personalizedPlan?.price || (bill.totalAmount + (bill.discount || 0));
        const discValue = bill.discount || 0;
        const alreadyPaid = bill.alreadyPaid !== undefined ? bill.alreadyPaid : 0;

        const tableBody = [
            ['Package Base Amount', `Rs. ${subAmount}`],
            ['Discount Amount', `Rs. ${discValue}`],
            ['Already Paid', `Rs. ${alreadyPaid}`],
        ];

        autoTable(doc, {
            startY: y,
            head: [['Description', 'Amount']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: primaryOrange, textColor: 255, fontStyle: 'bold' },
            styles: { cellPadding: 3, fontSize: 10, valign: 'middle' },
            columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, halign: 'right' } }
        });

        let finalY = doc.lastAutoTable.finalY + 10;
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

        // Amount in words
        const words = numberToWords(bill.amountPaid);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const wordsY = finalY + 10;
        doc.text(`Amount Paid (in words):`, 15, wordsY);
        doc.setFont("helvetica", "normal");
        const splitWords = doc.splitTextToSize(`${words}`, 100);
        doc.text(splitWords, 15, wordsY + 7);

        // Terms & Conditions
        const wordsEnd = wordsY + 7 + (splitWords.length * 5);
        const contentEnd = Math.max(finalY, wordsEnd);
        const termsY = contentEnd + 15;
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

    const handleViewBill = async (invoiceId) => {
        try {
            setLoading(true);
            const response = await axios.get(`${backendurl}/bills/${invoiceId}`, { withCredentials: true });
            if (response.data) {
                setSelectedBill(response.data);
                setShowBillModal(true);
            }
        } catch (error) {
            console.error("Error fetching bill details:", error);
            toast.error("Error loading bill details");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!planId) return;

        if (!window.confirm("Are you sure you want to delete this fitness plan? This action cannot be undone.")) {
            return;
        }

        try {
            setLoading(true);
            const response = await axios.delete(`${backendurl}/personalized-plans/${planId}`, { withCredentials: true });
            if (response.data.success) {
                toast.success("Plan deleted successfully");
                navigate('/fitnesslisting');
            }
        } catch (error) {
            console.error("Error deleting plan:", error);
            toast.error(error.response?.data?.message || "Failed to delete plan");
        } finally {
            setLoading(false);
        }
    };


    // --- Edit Handlers ---

    const handleDietEdit = (day, meal, field, value) => {
        setDietPlan(prev => {
            const newPlan = JSON.parse(JSON.stringify(prev));
            if (newPlan.Diet_Plan?.Week_1?.[day]?.[meal]) {
                newPlan.Diet_Plan.Week_1[day][meal][field] = value;
            }
            return newPlan;
        });
    };

    const handleAddDietItem = (day) => {
        setDietPlan(prev => {
            const newPlan = JSON.parse(JSON.stringify(prev));
            if (newPlan.Diet_Plan?.Week_1?.[day]) {
                const currentMeals = Object.keys(newPlan.Diet_Plan.Week_1[day]);
                const newKey = `Meal_${currentMeals.length + 1}`; // Simple unique key
                newPlan.Diet_Plan.Week_1[day][newKey] = { Dish: '', Calories: '' };
            }
            return newPlan;
        });
    };

    const handleDeleteDietItem = (day, meal) => {
        setDietPlan(prev => {
            const newPlan = JSON.parse(JSON.stringify(prev));
            if (newPlan.Diet_Plan?.Week_1?.[day]?.[meal]) {
                delete newPlan.Diet_Plan.Week_1[day][meal];
            }
            return newPlan;
        });
    };

    const handleWorkoutEdit = (day, type, index, field, value) => {
        setWorkoutPlan(prev => {
            const newPlan = JSON.parse(JSON.stringify(prev));
            if (newPlan.Workout_Plan?.Week_1?.[day]) {
                if (type === 'Type') {
                    newPlan.Workout_Plan.Week_1[day].Type = value;
                } else if (type === 'Exercise' && newPlan.Workout_Plan.Week_1[day].Exercises?.[index]) {
                    newPlan.Workout_Plan.Week_1[day].Exercises[index][field] = value;
                }
            }
            return newPlan;
        });
    };

    const handleAddWorkoutItem = (day) => {
        setWorkoutPlan(prev => {
            const newPlan = JSON.parse(JSON.stringify(prev));
            if (newPlan.Workout_Plan?.Week_1?.[day]) {
                if (!newPlan.Workout_Plan.Week_1[day].Exercises) {
                    newPlan.Workout_Plan.Week_1[day].Exercises = [];
                }
                newPlan.Workout_Plan.Week_1[day].Exercises.push({ Exercise: '', Sets_Reps: '' });
            }
            return newPlan;
        });
    };

    const handleDeleteWorkoutItem = (day, index) => {
        setWorkoutPlan(prev => {
            const newPlan = JSON.parse(JSON.stringify(prev));
            if (newPlan.Workout_Plan?.Week_1?.[day]?.Exercises) {
                newPlan.Workout_Plan.Week_1[day].Exercises.splice(index, 1);
            }
            return newPlan;
        });
    };

    const populatePDFDoc = async (doc) => {
        const planTitle = memberName ? `${memberName}'s Health Plan` : "Personalized Health Plan";

        // -- Header with Logo, Name, Address, etc. --
        let yPos = await drawGymHeader(doc, gymSettings, backendurl);

        doc.setFontSize(22);
        doc.setTextColor(255, 122, 26); // Orange (matching app)
        doc.text(planTitle, 14, yPos);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Goal: ${formData.goal} | TDEE: ${result} kcal | Veg: ${formData.isVeg === 'true' ? 'Yes' : 'No'}`, 14, yPos + 8);
        yPos += 20;

        // ==========================================
        // DIET SECTION
        // ==========================================
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Diet Plan (Week 1 Sample)", 14, yPos);
        yPos += 5;

        const dietRows = [];
        const week1Diet = dietPlan.Diet_Plan?.Week_1 || {};

        // Sort Days (Day_1, Day_2...)
        const sortedDietDays = Object.keys(week1Diet).sort((a, b) => {
            const numA = parseInt(a.replace('Day_', '')) || 0;
            const numB = parseInt(b.replace('Day_', '')) || 0;
            return numA - numB;
        });

        const mealOrder = ['Breakfast', 'Snack_1', 'Lunch', 'Snack_2', 'Dinner', 'Bedtime_Snack'];

        sortedDietDays.forEach(day => {
            const meals = week1Diet[day];
            const sortedMeals = Object.keys(meals).sort((a, b) => {
                return mealOrder.indexOf(a) - mealOrder.indexOf(b);
            });

            sortedMeals.forEach(slot => {
                if (slot === 'Total_Calories') return;

                const item = meals[slot];
                if (!item) return;

                // --- MACRO FIX: Check for both 'P' and 'Protein' keys ---
                let macrosStr = '-';
                if (item.Macros) {
                    const p = item.Macros.P || item.Macros.Protein || 0;
                    const c = item.Macros.C || item.Macros.Carbs || 0;
                    const f = item.Macros.F || item.Macros.Fat || 0;
                    macrosStr = `P:${p}g C:${c}g F:${f}g`;
                }

                dietRows.push([
                    day.replace(/_/g, ' '),
                    slot.replace(/_/g, ' '),
                    item.Dish || '-',
                    item.Calories ? `${item.Calories} kcal` : '-',
                    macrosStr
                ]);
            });
            // Add separator row
            dietRows.push([{ content: '', colSpan: 5, styles: { fillColor: [245, 245, 245], minCellHeight: 2 } }]);
        });

        autoTable(doc, {
            startY: yPos,
            head: [['Day', 'Meal', 'Dish', 'Calories', 'Macros']],
            body: dietRows,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
            headStyles: { fillColor: [229, 88, 7], textColor: 255 }, // Dark Orange
            columnStyles: {
                0: { cellWidth: 18 },
                1: { cellWidth: 22 },
                2: { cellWidth: 65 },
                3: { cellWidth: 25 },
                4: { cellWidth: 'auto' }
            }
        });

        // ==========================================
        // WORKOUT SECTION
        // ==========================================
        doc.addPage(); // Force new page for workout
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Workout Plan (Week 1 Sample)", 14, 20);

        const workoutRows = [];
        const week1Workout = workoutPlan.Workout_Plan?.Week_1 || {};

        // Sort Days (Day_1_Upper_A...)
        const sortedWorkoutDays = Object.keys(week1Workout).sort((a, b) => {
            const numA = parseInt(a.replace('Day_', '')) || 0;
            const numB = parseInt(b.replace('Day_', '')) || 0;
            return numA - numB;
        });

        sortedWorkoutDays.forEach(day => {
            const session = week1Workout[day];
            if (!session) return;

            // Clean Header: "Day 1 - Upper A"
            const cleanDay = day.split('_').slice(0, 2).join(' '); // "Day 1"
            const cleanType = session.Type || 'Rest';
            const headerTitle = `${cleanDay} - ${cleanType}`;

            // Add Header Row
            workoutRows.push([{
                content: headerTitle,
                colSpan: 4,
                styles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 0, halign: 'left' }
            }]);

            if (session.Type === 'Rest' || !session.Exercises || session.Exercises.length === 0) {
                workoutRows.push(['Rest Day', 'Rest & Recover', '-', '-']);
            } else {
                session.Exercises.forEach(ex => {
                    workoutRows.push([
                        ex.Exercise || '-',
                        ex.Sets_Reps || '-',
                        ex.Target || '-',
                        ex.Equipment || "None"
                    ]);
                });
            }
        });

        autoTable(doc, {
            startY: 25,
            head: [['Exercise', 'Sets/Reps', 'Target', 'Equipment']],
            body: workoutRows,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3, valign: 'middle' },
            headStyles: { fillColor: [80, 80, 80], textColor: 255 },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 30 },
                2: { cellWidth: 50 },
                3: { cellWidth: 'auto' }
            },
            alternateRowStyles: { fillColor: [255, 255, 255] }
        });

        // Footer
        const footerY = 275;
        drawGymFooter(doc, gymSettings, footerY);
    };

    const sendPlanWebhook = async (planData) => {
        console.log("=== sendPlanWebhook called ===");
        console.log("Plan data:", planData);
        try {
            console.log("Generating PDF for webhook...");
            const doc = new jsPDF();
            await populatePDFDoc(doc);

            // Get Base64 without the prefix
            const pdfBase64 = doc.output('datauristring').split(',')[1];
            console.log("PDF Base64 length:", pdfBase64?.length || 0);

            const payload = {
                member: planData,
                pdf: pdfBase64,
                filename: `${memberName ? memberName.replace(/\s+/g, '_') : formData.goal.replace(/\s+/g, '_')}_Plan.pdf`
            };

            const webhookUrl = `${backendurl}/whatsapp/send-personalized-plan`;
            console.log(`Sending plan to: ${webhookUrl}`);
            const webhookResponse = await axios.post(webhookUrl, payload, {
                withCredentials: true
            });
            console.log("Response:", webhookResponse.data);
            console.log("Plan sent successfully");
            toast.success('Plan sent successfully');
        } catch (error) {
            console.error("Failed to send webhook:", error);
            console.error("Error details:", error.response?.data || error.message);
        }
    };

    const downloadPDF = async () => {
        if (!dietPlan || !workoutPlan) {
            toast.warning("Please generate the plan first!");
            return;
        }

        try {
            const doc = new jsPDF();
            await populatePDFDoc(doc);
            doc.save(`${memberName ? memberName.replace(/\s+/g, '_') : formData.goal.replace(/\s+/g, '_')}_Plan.pdf`);
        } catch (err) {
            console.error("PDF Generation Error:", err);
            toast.error("Failed to generate PDF. Check console for details.");
        }
    };

    return (
        <div className="dash-main">
            <header className="dash-header">
                <div className="dash-header-left">
                    <ToggleButton isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
                    <div className="dash-breadcrumb">
                        Dashboard &gt; Fitness Plans &gt; Personalized Plan
                    </div>
                </div>
                <div className="dash-header-right" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {isEditing && bills.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {bills.map((bill, index) => (
                                <button
                                    key={bill._id}
                                    className="btn-secondary"
                                    style={{
                                        padding: '8px 16px',
                                        background: '#4f46e5',
                                        color: 'white',
                                        borderColor: '#4f46e5',
                                        fontSize: '12px'
                                    }}
                                    onClick={() => handleViewBill(bill.invoiceId)}
                                >
                                    View Bill {index + 1}
                                </button>
                            ))}
                        </div>
                    )}
                    {isEditing && (
                        <button
                            className="btn-primary"
                            style={{
                                padding: '8px 16px',
                                background: paymentStatus === 'pending' ? '#ef4444' : '#94a3b8',
                                borderColor: paymentStatus === 'pending' ? '#ef4444' : '#94a3b8',
                                opacity: paymentStatus === 'pending' ? 1 : 0.6,
                                cursor: paymentStatus === 'pending' ? 'pointer' : 'not-allowed'
                            }}
                            onClick={handleDelete}
                            disabled={paymentStatus !== 'pending' || loading}
                        >
                            Delete Plan
                        </button>
                    )}
                </div>
            </header>

            <div className="dash-content">
                <div className="page-header" style={{ marginBottom: '24px' }}>
                    <h2>{isEditing ? 'Edit Personalized Plan' : 'Personalized Fitness Plan'}</h2>
                    <p>Calculate TDEE and generate a custom AI diet & workout plan.</p>
                </div>

                <div className="pp-split-layout">
                    {/* LEFT COLUMN: Inputs */}
                    <div className="pp-input-column">
                        {/* Auto-Fill Card Restored */}
                        <div className="pp-autofill-section">
                            <h4 className="pp-autofill-title">Search Member (Auto-fills details)</h4>
                            <div className="pp-search-row">
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                        type="text"
                                        className="pp-input"
                                        placeholder="Member ID or Mobile Number"
                                        value={searchId}
                                        onChange={(e) => setSearchId(e.target.value)}
                                        disabled={isEditing}
                                        style={{ paddingRight: searchLoading ? '35px' : '12px' }}
                                    />
                                    {searchLoading && (
                                        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                                            <Loader2 className="animate-spin" size={16} color="#fb923c" />
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="btn-primary"
                                    onClick={handleSearch}
                                    disabled={searchLoading || isEditing}
                                >
                                    Search
                                </button>
                            </div>
                            {memberName && !isEditing && (
                                <div className="pp-member-found">
                                    <span>✓</span> Selected: {memberName}
                                </div>
                            )}
                        </div>

                        <div className="pp-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="pp-unit-toggle">
                                <button
                                    className={`pp-unit-btn ${unitSystem === 'metric' ? 'active' : ''}`}
                                    onClick={() => setUnitSystem('metric')}
                                >
                                    Metric Units
                                </button>
                                <button
                                    className={`pp-unit-btn ${unitSystem === 'us' ? 'active' : ''}`}
                                    onClick={() => setUnitSystem('us')}
                                >
                                    US Units
                                </button>
                            </div>

                            <div style={{ padding: '24px' }}>
                                {/* Main Grid for Inputs */}
                                <div className="pp-form-grid" style={{ marginTop: '0' }}>
                                    <div className="pp-form-group">
                                        <label>Member ID</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                className="pp-input"
                                                placeholder="Member ID"
                                                value={searchId}
                                                onChange={(e) => setSearchId(e.target.value)}
                                                disabled={isEditing}
                                                style={{ paddingRight: searchLoading ? '35px' : '12px' }}
                                            />
                                            {searchLoading && (
                                                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                                                    <Loader2 className="animate-spin" size={16} color="#fb923c" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="pp-form-group">
                                        <label>Full Name</label>
                                        <input
                                            type="text"
                                            className="pp-input"
                                            name="fullName"
                                            value={formData.fullName}
                                            onChange={handleInputChange}
                                            placeholder="Full Name"
                                        />
                                    </div>

                                    <div className="pp-form-group">
                                        <label>Mobile Number</label>
                                        <input
                                            type="tel"
                                            className="pp-input"
                                            name="mobileNumber"
                                            value={formData.mobileNumber}
                                            onChange={handleInputChange}
                                            placeholder="Mobile Number"
                                        />
                                    </div>

                                    <div className="pp-form-group">
                                        <label>Age <span style={{ fontSize: '11px', color: '#6b7280' }}>(18-80)</span></label>
                                        <input
                                            type="number"
                                            className="pp-input"
                                            name="age"
                                            value={formData.age}
                                            onChange={handleInputChange}
                                            placeholder="Years"
                                            min="18" max="80"
                                        />
                                    </div>

                                    <div className="pp-form-group">
                                        <label>Gender</label>
                                        <select
                                            className="pp-select"
                                            name="gender"
                                            value={formData.gender}
                                            onChange={handleInputChange}
                                        >
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                        </select>
                                    </div>

                                    <div className="pp-form-group">
                                        <label>Height</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="number"
                                                className="pp-input"
                                                name="height"
                                                value={formData.height}
                                                onChange={handleInputChange}
                                                placeholder={unitSystem === 'metric' ? "Centimeters" : "Inches"}
                                                style={{ paddingRight: '40px' }}
                                            />
                                            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '12px' }}>
                                                {unitSystem === 'metric' ? 'cm' : 'in'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pp-form-group">
                                        <label>Weight</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="number"
                                                className="pp-input"
                                                name="weight"
                                                value={formData.weight}
                                                onChange={handleInputChange}
                                                placeholder={unitSystem === 'metric' ? "Kilograms" : "Pounds"}
                                                style={{ paddingRight: '40px' }}
                                            />
                                            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '12px' }}>
                                                {unitSystem === 'metric' ? 'kg' : 'lbs'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pp-form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>Activity Level</label>
                                        <select
                                            className="pp-select"
                                            name="activity"
                                            value={formData.activity}
                                            onChange={handleInputChange}
                                        >
                                            <option value="1.2">Sedentary: little or no exercise</option>
                                            <option value="1.375">Light: exercise 1-3 times/week</option>
                                            <option value="1.55">Moderate: exercise 3-5 times/week</option>
                                            <option value="1.725">Very Active: hard exercise 6-7 times/week</option>
                                            <option value="1.9">Extra Active: very hard exercise & physical job</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Preferences Section - Styled differently */}
                                <div className="pp-preferences">
                                    <h4 className="pp-section-title">Plan Preferences</h4>
                                    <div className="pp-form-grid">

                                        <div className="pp-form-group">
                                            <label>Goal</label>
                                            <select
                                                className="pp-select"
                                                name="goal"
                                                value={formData.goal}
                                                onChange={handleInputChange}
                                            >
                                                <option value="Weight Loss">Weight Loss</option>
                                                <option value="Weight Gain">Weight Gain</option>
                                                <option value="Maintenance">Maintenance</option>
                                            </select>
                                        </div>

                                        <div className="pp-form-group">
                                            <label>Diet Type</label>
                                            <select
                                                className="pp-select"
                                                name="isVeg"
                                                value={formData.isVeg}
                                                onChange={handleInputChange}
                                            >
                                                <option value="true">Vegetarian Only</option>
                                                <option value="false">Veg + Non-Veg</option>
                                            </select>
                                        </div>

                                        <div className="pp-form-group">
                                            <label>Workout Days/Week <span style={{ fontSize: '11px', color: '#6b7280' }}>(3-6)</span></label>
                                            <input
                                                type="number"
                                                className="pp-input"
                                                name="daysPerWeek"
                                                value={formData.daysPerWeek}
                                                onChange={handleInputChange}
                                                min="3" max="6"
                                            />
                                        </div>

                                        <div className="pp-form-group">
                                            <label>Price</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type="number"
                                                    className="pp-input"
                                                    name="price"
                                                    value={formData.price}
                                                    onChange={handleInputChange}
                                                    placeholder="Price"
                                                    style={{ paddingLeft: '30px' }}
                                                />
                                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '14px' }}>
                                                    ₹
                                                </span>
                                            </div>
                                        </div>

                                        {isEditing && (
                                            <>
                                                <div className="pp-form-group">
                                                    <label>Amount Already Paid <span style={{ fontSize: '11px', color: amountPaid > 0 ? '#64748b' : '#ef4444' }}>({amountPaid > 0 ? 'Locked' : 'Editable'})</span></label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input
                                                            type="number"
                                                            className="pp-input"
                                                            value={amountPaid}
                                                            onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                                                            style={{ fontWeight: 'bold', color: amountPaid > 0 ? '#64748b' : '#059669', paddingLeft: '25px' }}
                                                            disabled={amountPaid > 0}
                                                        />
                                                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: amountPaid > 0 ? '#64748b' : '#059669', fontWeight: 'bold' }}>₹</span>
                                                    </div>
                                                </div>
                                                <div className="pp-form-group">
                                                    <label>Remaining Balance</label>
                                                    <div className="pp-input" style={{ background: '#f8fafc', fontWeight: 'bold', color: '#dc2626' }}>
                                                        ₹{Math.max(0, parseFloat(formData.price || 0) - amountPaid)}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {error && (
                                    <div className="message error" style={{ marginTop: '20px', marginBottom: '0', background: '#fef2f2', color: '#b91c1c', padding: '10px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                                        {error}
                                    </div>
                                )}

                                <div className="form-actions" style={{ marginTop: '30px', justifyContent: 'center' }}>
                                    <button
                                        className="btn-primary"
                                        style={{
                                            padding: '12px 32px',
                                            fontSize: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            width: '100%',
                                            justifyContent: 'center'
                                        }}
                                        onClick={handleGenerate}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>Processing...</>
                                        ) : (
                                            <>Generate Plan <span style={{ fontSize: '12px' }}>▶</span></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Results */}
                    <div className="pp-results-column">
                        {(result || dietPlan) ? (
                            <div className="pp-results-container" style={{ marginTop: 0 }}>
                                {/* TDEE Header */}
                                <div className="pp-tdee-header">
                                    <h3 className="pp-tdee-title">Your Daily Target</h3>
                                    <div className="pp-tdee-value">
                                        {result}
                                    </div>
                                    <div className="pp-tdee-subtitle">CALORIES PER DAY</div>
                                </div>

                                {/* Plan Preview */}
                                {dietPlan && workoutPlan && (
                                    <div style={{ padding: '30px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
                                            <button
                                                className="btn-primary"
                                                style={{ background: '#059669', border: '1px solid #059669', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 1 }}
                                                onClick={downloadPDF}
                                            >
                                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                Download PDF Plan
                                            </button>
                                        </div>

                                        <div className="pp-preview-grid" style={{ gridTemplateColumns: '1fr', gap: '40px' }}>
                                            {/* FULL DIET PLAN RENDER */}
                                            <div className="pp-preview-card">
                                                <h4 className="pp-preview-title diet">
                                                    Full Diet Plan (Editable)
                                                </h4>
                                                <div className="pp-preview-content">
                                                    {Object.keys(dietPlan.Diet_Plan?.Week_1 || {}).sort((a, b) => parseInt(a.replace('Day_', '')) - parseInt(b.replace('Day_', ''))).map(day => (
                                                        <div key={day} style={{ marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                                <h5 style={{ color: '#ea580c', textTransform: 'capitalize', margin: 0 }}>{day.replace('_', ' ')}</h5>
                                                                <button onClick={() => handleAddDietItem(day)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>+ Add Meal</button>
                                                            </div>
                                                            {/* Render ALL keys except Total_Calories */}
                                                            {Object.keys(dietPlan.Diet_Plan.Week_1[day]).map(meal => {
                                                                if (meal === 'Total_Calories') return null;
                                                                const data = dietPlan.Diet_Plan.Week_1[day][meal];
                                                                if (!data) return null;
                                                                return (
                                                                    <div key={meal} style={{ marginBottom: '10px', display: 'grid', gridTemplateColumns: 'minmax(100px, 120px) 1fr 100px 30px', gap: '10px', alignItems: 'center' }}>
                                                                        <strong style={{ color: '#0f172a', fontSize: '14px' }}>{meal.replace(/_/g, ' ')}:</strong>

                                                                        <input
                                                                            type="text"
                                                                            className="pp-input"
                                                                            style={{ padding: '6px', fontSize: '13px' }}
                                                                            value={data.Dish}
                                                                            onChange={(e) => handleDietEdit(day, meal, 'Dish', e.target.value)}
                                                                        />

                                                                        <div style={{ position: 'relative' }}>
                                                                            <input
                                                                                type="text"
                                                                                className="pp-input"
                                                                                style={{ padding: '6px', fontSize: '13px', paddingRight: '25px' }}
                                                                                value={data.Calories}
                                                                                onChange={(e) => handleDietEdit(day, meal, 'Calories', e.target.value)}
                                                                            />
                                                                            <span style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: '#888' }}>kcal</span>
                                                                        </div>

                                                                        <button
                                                                            onClick={() => handleDeleteDietItem(day, meal)}
                                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }}
                                                                            title="Remove Item"
                                                                        >
                                                                            &times;
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* FULL WORKOUT PLAN RENDER */}
                                            <div className="pp-preview-card">
                                                <h4 className="pp-preview-title workout">
                                                    Full Workout Plan (Editable)
                                                </h4>
                                                <div className="pp-preview-content">
                                                    {Object.keys(workoutPlan.Workout_Plan?.Week_1 || {}).sort((a, b) => parseInt(a.replace('Day_', '')) - parseInt(b.replace('Day_', ''))).map(day => {
                                                        const dayData = workoutPlan.Workout_Plan.Week_1[day];
                                                        return (
                                                            <div key={day} style={{ marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                        <h5 style={{ color: '#0ea5e9', textTransform: 'capitalize', margin: 0 }}>{day.replace('_', ' ')}</h5>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                                        <input
                                                                            type="text"
                                                                            className="pp-input"
                                                                            style={{ width: '150px', padding: '4px 8px', fontSize: '12px' }}
                                                                            value={dayData.Type}
                                                                            onChange={(e) => handleWorkoutEdit(day, 'Type', null, null, e.target.value)}
                                                                        />
                                                                        <button onClick={() => handleAddWorkoutItem(day)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>+ Exercise</button>
                                                                    </div>
                                                                </div>

                                                                {dayData.Exercises?.map((ex, i) => (
                                                                    <div key={i} style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'minmax(20px, auto) 1fr 1fr 30px', gap: '10px', alignItems: 'center' }}>
                                                                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{i + 1}.</span>
                                                                        <input
                                                                            type="text"
                                                                            className="pp-input"
                                                                            style={{ padding: '6px', fontSize: '13px' }}
                                                                            value={ex.Exercise}
                                                                            onChange={(e) => handleWorkoutEdit(day, 'Exercise', i, 'Exercise', e.target.value)}
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            className="pp-input"
                                                                            style={{ padding: '6px', fontSize: '13px' }}
                                                                            value={ex.Sets_Reps}
                                                                            onChange={(e) => handleWorkoutEdit(day, 'Exercise', i, 'Sets_Reps', e.target.value)}
                                                                        />
                                                                        <button
                                                                            onClick={() => handleDeleteWorkoutItem(day, i)}
                                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }}
                                                                            title="Remove Item"
                                                                        >
                                                                            &times;
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="pp-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', textAlign: 'center', color: '#6b7280', borderStyle: 'dashed' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Ready to Generate?</h3>
                                <p style={{ maxWidth: '250px' }}>Fill in your details on the left and click "Generate Plan" to see your personalized fitness plan here.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* BOTTOM ACTION BUTTONS */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '15px',
                    marginTop: '40px',
                    padding: '20px',
                    background: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    <button
                        className="btn-secondary"
                        style={{ padding: '10px 25px' }}
                        onClick={() => navigate('/fitnesslisting')}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn-primary"
                        style={{ padding: '10px 25px', background: '#2563eb', borderColor: '#2563eb' }}
                        onClick={handleSave}
                    >
                        {isEditing ? 'Update Plan' : 'Save'}
                    </button>
                    {isEditing && paymentStatus !== 'paid' && (
                        <button
                            className="btn-primary"
                            style={{ padding: '10px 25px', background: '#ea580c', borderColor: '#ea580c' }}
                            onClick={handleCreatePayment}
                        >
                            Create Payment
                        </button>
                    )}
                    {!isEditing && (
                        <button
                            className="btn-primary"
                            style={{ padding: '10px 25px', background: '#ea580c', borderColor: '#ea580c' }}
                            onClick={handleSaveAndPay}
                        >
                            Save & Pay
                        </button>
                    )}
                </div>
            </div>

            {showBillModal && selectedBill && (
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
                                            await generateBillPDF(selectedBill);
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
                                <button onClick={() => setShowBillModal(false)} style={{ padding: '8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
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
                                    const planInfo = selectedBill.personalizedPlan || {};
                                    const planPrice = planInfo.price || (selectedBill.totalAmount + (selectedBill.discount || 0));
                                    const discValue = selectedBill.discount || 0;
                                    const alreadyPaid = selectedBill.alreadyPaid || 0;

                                    return (
                                        <>
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
                                                            Personalized Fitness Plan
                                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                                                {planInfo.packageName || "Fitness Package"}
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right', padding: '16px 0', color: '#1e293b', fontWeight: 600 }}>
                                                            ₹{planPrice}
                                                        </td>
                                                    </tr>
                                                    {discValue > 0 && (
                                                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '12px 0', color: '#ef4444', fontSize: '0.875rem' }}>Discount Amount</td>
                                                            <td style={{ textAlign: 'right', padding: '12px 0', color: '#ef4444', fontSize: '0.875rem' }}>- ₹{discValue}</td>
                                                        </tr>
                                                    )}
                                                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '12px 0', color: '#10b981', fontSize: '0.875rem' }}>Already Paid</td>
                                                        <td style={{ textAlign: 'right', padding: '12px 0', color: '#10b981', fontSize: '0.875rem' }}>₹{alreadyPaid}</td>
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
                                id="planPaymentModeInput"
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
                                id="planAmountPaidInput"
                                defaultValue={(parseFloat(formData.price) || 0) - amountPaid}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '1.125rem', fontWeight: 700, color: '#10b981' }}
                            />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Notes</label>
                            <textarea
                                id="planPaymentNotesInput"
                                placeholder="Optional notes..."
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '80px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const mode = document.getElementById('planPaymentModeInput').value;
                                    const amount = parseFloat(document.getElementById('planAmountPaidInput').value) || 0;
                                    const notes = document.getElementById('planPaymentNotesInput').value;

                                    const total = parseFloat(formData.price) || 0;
                                    const alreadyPaid = parseFloat(amountPaid) || 0;

                                    if (alreadyPaid + amount > total + 0.01) {
                                        toast.warning(`Total payment (₹${alreadyPaid + amount}) cannot exceed the plan price (₹${total})`);
                                        return;
                                    }

                                    // Update local state first (for UI consistency if user stays on page, though we usually navigate away)
                                    const totalPaid = alreadyPaid + amount;
                                    setAmountPaid(totalPaid);
                                    setPendingPayment({
                                        amount: amount,
                                        mode: mode,
                                        notes: notes
                                    });

                                    setShowPaymentModal(false);

                                    // Trigger Save with explicit values to avoid async state issues
                                    handleSave({
                                        amountPaid: totalPaid,
                                        mode: mode,
                                        notes: notes
                                    });
                                }}
                                className="btn-primary"
                                style={{ background: '#10b981', border: 'none' }}
                            >
                                Confirm & Save Plan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}