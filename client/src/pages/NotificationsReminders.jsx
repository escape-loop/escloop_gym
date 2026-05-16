import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    Users,
    Wrench,
    UserPlus,
    DollarSign,
    Clock,
    Heart,
    Cake,
    AlertTriangle,
    Phone,
    MessageCircle,
    CheckCircle2,
    Send,
    Calendar,
    RefreshCcw,
    X,
    IndianRupee
} from 'lucide-react';
import '../styles/notifications-reminders.css';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { AppContent } from '../context/context';

export default function NotificationsReminders() {
    const navigate = useNavigate();
    const { backendurl } = useContext(AppContent);
    const [activeTab, setActiveTab] = useState('payments'); // 'payments' | 'renewals' | 'maintenance' | 'leads' | 'attendance' | 'salary'

    // Standardize profile photo URL construction
    const getProfilePhotoUrl = (member) => {
        if (!member || !member.profilePhoto) return null;
        const photo = member.profilePhoto;
        if (photo.startsWith('http')) return photo;
        if (photo.startsWith('data:')) return photo;

        // Construct the full URL relative to backendurl
        const baseUrl = backendurl.replace('/gym', '').replace(/\/+$/, '');
        const cleanPath = photo.startsWith('/') ? photo : `/${photo}`;
        return `${baseUrl}${cleanPath}`;
    };

    // Helper to get initials or fallback avatar
    const getFallbackImage = (member) => {
        return `https://api.dicebear.com/7.x/initials/svg?seed=${member?.fullName || member?.name || 'User'}&backgroundColor=f97316`;
    };

    // API Data States
    const [pendingPayments, setPendingPayments] = useState([]);
    const [expiringSoon, setExpiringSoon] = useState([]);
    const [subscriptionFinished, setSubscriptionFinished] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state for member details
    const [selectedMember, setSelectedMember] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Lead Alerts state
    const [urgentFollowups, setUrgentFollowups] = useState([]);
    const [leadsLoading, setLeadsLoading] = useState(true);

    // Attendance Alerts state
    const [attendanceAlerts, setAttendanceAlerts] = useState([]);
    const [attendanceLoading, setAttendanceLoading] = useState(true);

    // Salary Alerts state
    const [salaryAlerts, setSalaryAlerts] = useState([]);
    const [salaryLoading, setSalaryLoading] = useState(true);

    // Equipment Maintenance state
    const [equipmentMaintenance, setEquipmentMaintenance] = useState([]);
    const [equipmentLoading, setEquipmentLoading] = useState(true);

    // Bulk selection states for reminders
    const [selectedPayments, setSelectedPayments] = useState(new Set());
    const [selectedRenewals, setSelectedRenewals] = useState(new Set());
    const [selectedAttendance, setSelectedAttendance] = useState(new Set());
    const [sendingReminder, setSendingReminder] = useState(false);
    const [sentPaymentTimestamps, setSentPaymentTimestamps] = useState({}); // id -> timestamp
    const [sentRenewalTimestamps, setSentRenewalTimestamps] = useState({});
    const [sentAttendanceTimestamps, setSentAttendanceTimestamps] = useState({});
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Fetch data from APIs on component mount
    // Gym Settings State for Webhook
    const [gymName, setGymName] = useState('Gym');

    // Helper to check if a member is locked (sent within last 2 mins)
    const isLocked = (id, timestampMap) => {
        const lastSent = timestampMap[id];
        if (!lastSent) return false;
        return (currentTime - lastSent) < 30000; // 30 seconds
    };

    // Effect to update currentTime every 30 seconds to refresh lockout status
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Fetch data from APIs on component mount
    useEffect(() => {

    const fetchNotificationData = async () => {
            setLoading(true);
            setLeadsLoading(true);
            setEquipmentLoading(true);

            try {
                const [
                    pendingRes,
                    expiringRes,
                    finishedRes,
                    leadsRes,
                    equipmentRes,
                    attendanceRes,
                    salaryRes,
                    settingsRes // Fetch settings
                ] = await Promise.all([
                    fetch(`${backendurl}/notifications/pending-payments`, { credentials: 'include' }),
                    fetch(`${backendurl}/notifications/expiring-soon`, { credentials: 'include' }),
                    fetch(`${backendurl}/notifications/subscription-finished`, { credentials: 'include' }),
                    fetch(`${backendurl}/notifications/urgent-followups`, { credentials: 'include' }),
                    fetch(`${backendurl}/notifications/equipment-maintenance`, { credentials: 'include' }),
                    fetch(`${backendurl}/notifications/attendance-alerts`, { credentials: 'include' }),
                    fetch(`${backendurl}/notifications/salary-alerts`, { credentials: 'include' }),
                    fetch(`${backendurl}/gym/settings`, { credentials: 'include' }) // Note: backend route is /gym/settings per server.js logs, or use the one from AccountSettings
                ]);

                // The backend server.js has app.get('/gym/settings', ...) which is userauth protected
                // But wait, AccountSettings uses axios.get(`${backendurl}/settings`)...
                // Let's check server.js again. Line 287: Router.get('/gym/settings', userauth, getGymSettings);
                // And line 39: app.use('/gym', Router). So it is /gym/gym/settings? No.
                // server.js: app.use('/gym', Router);
                // routes/userroutes.js: Router.get('/gym/settings', ...)
                // So path is /gym/gym/settings.
                // BUT wait, AccountSettings uses `${backendurl}/settings`.
                // Let's look at server.js again.
                // Line 86: app.get('/gym/settings', ...)  <-- This is directly on app, not Router.
                // So it is accessible at /gym/settings.
                // Wait, server.js line 287 in userroutes is Router.get('/gym/settings'...). This might be a duplicate or conflict depending on order.
                // server.js line 86 IS defined. So `GET /gym/settings` works.
                // In context.jsx, what is backendurl? usually http://localhost:5000/gym or just http://localhost:5000?
                // In AccountSettings: `${backendurl}/settings`. If backendurl is http://localhost:5000/gym, then it calls http://localhost:5000/gym/settings.
                // Let's assume standard pattern. I will use axios to match `Memberslisting` or fetch consistent with this file.
                // This file uses fetch(`${backendurl}/...`).
                // If backendurl includes /gym, then `${backendurl}/notifications/...` works.
                // I will try to fetch settings using axios separately to be safe or just add to Promise.all if I am sure of path.
                // Let's add a separate fetch for settings to avoid breaking the Promise.all if it fails (e.g. auth issue).

                const pendingData = await pendingRes.json();
                const expiringData = await expiringRes.json();
                const finishedData = await finishedRes.json();
                const leadsData = await leadsRes.json();
                const equipmentData = await equipmentRes.json();
                const attendanceData = await attendanceRes.json();
                const salaryData = await salaryRes.json();
                // const settingsData = await settingsRes.json();

                if (pendingData.success) setPendingPayments(pendingData.members);
                if (expiringData.success || finishedData.success) {
                    const expiring = expiringData.members || [];
                    const finished = finishedData.members || [];
                    setExpiringSoon([...expiring, ...finished]);
                }
                if (leadsData.success) setUrgentFollowups(leadsData.leads);
                if (equipmentData.success) setEquipmentMaintenance(equipmentData.equipment);
                if (attendanceData.success) setAttendanceAlerts(attendanceData.members);
                if (salaryData.success) setSalaryAlerts(salaryData.staff);
            } catch (error) {
                console.error('Failed to fetch notification data:', error);
            } finally {
                setLoading(false);
                setLeadsLoading(false);
                setEquipmentLoading(false);
                setAttendanceLoading(false);
                setSalaryLoading(false);
            }
        };

        const fetchGymSettings = async () => {
            // We need to know the correct endpoint. AccountSettings uses `${backendurl}/settings`.
            // If backendurl is `.../gym`, then it calls `.../gym/settings`.
            // Server has `app.get('/gym/settings', ...)` (Line 86 server.js)
            // So if backendurl ends in /gym, `${backendurl}/settings` -> `/gym/settings`. Correct.
            try {
                // Using fetch explicitly for settings
                // Note: The existing file uses fetch without credentials, but AccountSettings uses axios WITH credentials.
                // The settings endpoint likely needs auth or is public?
                // Server line 86 `app.get('/gym/settings', ...)` does NOT have middleware. It seems open or relies on global.
                // Server line 287 `Router.get('/gym/settings', userauth ...)` DOES have it.
                // Since `app.use('/gym', Router)` is later (line 39), the first one at line 86 might take precedence or they conflict.
                // IMPORTANT: In `Memberslisting.jsx` I used axios with credentials. I should do same here for consistency.
                // But this file uses `fetch` for everything else.
                // I will stick to the existing pattern of this file but add credentials if needed,
                // HOWEVER, `pending-payments` etc don't seem to pass credentials in this file??
                // The `fetch` calls in `useEffect` don't have `{credentials: 'include'}`.
                // If the backend requires auth, these might fail unless there's a global interceptor or the endpoints are open.
                // Checking server.js: `app.get('/gym/notifications/pending-payments', ...)` -> No auth middleware!
                // So these notification endpoints are OPEN.
                // But `/gym/settings` (Line 86) is also OPEN (no middleware args).
                // So I can just fetch it.
                const res = await fetch(`${backendurl}/settings`, { credentials: 'include' });
                const data = await res.json();
                if (data.success && data.settings?.gymName) {
                    setGymName(data.settings.gymName);
                }
            } catch (err) {
                console.error("Failed to fetch gym settings", err);
            }
        };

        fetchNotificationData();
        fetchGymSettings();
    }, []);

    // ... [Rest of code] ...

    // Send notification reminder webhook
    const handleSendReminder = async (type) => {
        let members = [];
        let clearSelection = () => { };

        if (type === 'pending') {
            members = pendingPayments
                .filter(m => selectedPayments.has(m._id || m.memberId))
                .map(m => ({
                    name: m.fullName,
                    phone: m.phone,
                    balanceAmount: m.balanceAmount
                }));
            clearSelection = () => setSelectedPayments(new Set());
        } else if (type === 'expiry') {
            members = expiringSoon
                .filter(m => selectedRenewals.has(m._id))
                .map(m => ({
                    name: m.fullName,
                    phone: m.phone,
                    daysExpired: m.daysLeft <= 0 ? Math.abs(m.daysLeft) : 0,
                    daysLeft: m.daysLeft > 0 ? m.daysLeft : 0
                }));
            clearSelection = () => setSelectedRenewals(new Set());
        } else if (type === 'attendance') {
            members = attendanceAlerts
                .filter(m => selectedAttendance.has(m._id))
                .map(m => ({
                    name: m.fullName,
                    phone: m.phone,
                    daysAbsent: m.daysAbsent
                }));
            clearSelection = () => setSelectedAttendance(new Set());
        }

        if (members.length === 0) {
            toast.error('No members selected');
            return;
        }

        setSendingReminder(true);
        try {
            // Support the old webhook logic by adapting it to the new local backend route
            await fetch(`${backendurl}/whatsapp/send-notification-reminder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    type,
                    members,
                    gymName: gymName
                })
            });
            toast.success(`Reminder sent to ${members.length} member(s)`);
            
            // Track sent timestamps
            const now = Date.now();
            const newTimestamps = {};
            members.forEach(m => {
                newTimestamps[m._id || m.memberId || m.id] = now;
            });

            if (type === 'pending') {
                setSentPaymentTimestamps(prev => ({ ...prev, ...newTimestamps }));
            } else if (type === 'expiry') {
                setSentRenewalTimestamps(prev => ({ ...prev, ...newTimestamps }));
            } else if (type === 'attendance') {
                setSentAttendanceTimestamps(prev => ({ ...prev, ...newTimestamps }));
            }
            
            clearSelection();
        } catch (error) {
            console.error('Failed to send reminder:', error);
            toast.error('Failed to send reminder. Please try again.');
        } finally {
            setSendingReminder(false);
        }
    };

    // -- Missing Handlers --

    const handleSelectAllPayments = (e) => {
        if (e.target.checked) {
            // Only select those NOT currently locked
            const newSet = new Set();
            pendingPayments.forEach(m => {
                const id = m._id || m.memberId;
                if (!isLocked(id, sentPaymentTimestamps)) {
                    newSet.add(id);
                }
            });
            setSelectedPayments(newSet);
        } else {
            setSelectedPayments(new Set());
        }
    };

    const handleSelectPayment = (id) => {
        if (isLocked(id, sentPaymentTimestamps)) return;
        const newSet = new Set(selectedPayments);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPayments(newSet);
    };

    const handleSelectAllRenewals = (e) => {
        if (e.target.checked) {
            const newSet = new Set();
            expiringSoon.forEach(m => {
                if (!isLocked(m._id, sentRenewalTimestamps)) {
                    newSet.add(m._id);
                }
            });
            setSelectedRenewals(newSet);
        } else {
            setSelectedRenewals(new Set());
        }
    };

    const handleSelectRenewal = (id) => {
        if (isLocked(id, sentRenewalTimestamps)) return;
        const newSet = new Set(selectedRenewals);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedRenewals(newSet);
    };

    const handleSelectAllAttendance = (e) => {
        if (e.target.checked) {
            const newSet = new Set();
            attendanceAlerts.forEach(m => {
                if (!isLocked(m._id, sentAttendanceTimestamps)) {
                    newSet.add(m._id);
                }
            });
            setSelectedAttendance(newSet);
        } else {
            setSelectedAttendance(new Set());
        }
    };

    const handleSelectAttendanceAlert = (id) => {
        if (isLocked(id, sentAttendanceTimestamps)) return;
        const newSet = new Set(selectedAttendance);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedAttendance(newSet);
    };

    const handleMemberClick = (member) => {
        setSelectedMember(member);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedMember(null);
    };

    const handleAction = async (action, item) => {
        switch (action) {
            case 'payNow':
                navigate('/billlisting', { state: { memberId: item.memberId } });
                break;
            case 'renewNow':
                navigate('/billlisting', { state: { memberId: item.memberId } });
                break;
            case 'maintenanceDone':
                toast.info(`Marking ${item.name} maintenance as done...`);
                // Add API call here if available, e.g. /equipments/maintenance/:id
                break;
            case 'leadContacted':
                toast.info(`Marking ${item.name} as contacted...`);
                // Add API call here
                break;
            case 'attendanceCalled':
                toast.info(`Marked ${item.fullName} as called.`);
                break;
            case 'salaryPaid':
                toast.info(`Processing salary payment for ${item.fullName}...`);
                navigate('/salary', { state: { staffId: item.staffId } });
                break;
            default:
                console.warn('Unknown action:', action);
        }
    };

    // Styles
    const pageContainerStyle = {
        padding: '2rem',
        backgroundColor: '#f9fafb',
        minHeight: '100vh',
        color: '#1e293b'
    };

    const headerStyle = {
        marginBottom: '1.5rem'
    };

    const titleStyle = {
        fontSize: '1.875rem',
        fontWeight: 700,
        color: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    };

    const subtitleStyle = {
        color: '#64748b',
        marginTop: '0.25rem',
        fontSize: '0.875rem'
    };

    const tabContainerStyle = {
        display: 'flex',
        gap: '1rem',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '2rem',
        overflowX: 'auto',
        paddingBottom: '2px'
    };

    const tabButtonStyle = (isActive) => ({
        padding: '0.75rem 1.25rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        color: isActive ? '#f97316' : '#64748b',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: isActive ? '3px solid #f97316' : '3px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '-2px',
        whiteSpace: 'nowrap'
    });

    const sectionTitleStyle = {
        fontSize: '1rem',
        fontWeight: 600,
        color: '#334155',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    };

    const actionButtonStyle = (color = '#4f46e5', bgColor = '#eff6ff') => ({
        padding: '0.375rem 0.75rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: color,
        backgroundColor: bgColor,
        border: 'none',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem'
    });

    // Helper to render individual cards
    const renderCard = (type) => {
        switch (type) {
            case 'payments':
                return (
                    <div className="nr-card" key="payments">
                        <div className="nr-card-header" style={{ backgroundColor: '#fff7ed', borderBottom: '1px solid #ffedd5' }}>
                            <h3 style={sectionTitleStyle}><DollarSign size={20} color="#f97316" /> Pending Payments</h3>
                            {selectedPayments.size > 0 && (
                                <button
                                    className="nr-action-btn"
                                    style={{ backgroundColor: '#f97316', color: 'white', marginLeft: 'auto' }}
                                    onClick={() => handleSendReminder('pending')}
                                    disabled={sendingReminder}
                                >
                                    <Send size={16} /> {sendingReminder ? 'Sending...' : `Send Reminder (${selectedPayments.size})`}
                                </button>
                            )}
                        </div>
                        <div className="nr-card-body">
                            <div className="nr-table-wrapper">
                                <table className="nr-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={pendingPayments.length > 0 && selectedPayments.size === pendingPayments.length}
                                                    onChange={handleSelectAllPayments}
                                                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                />
                                            </th>
                                            <th>Photo</th>
                                            <th>Member ID</th>
                                            <th>Name</th>
                                            <th>Mobile No</th>
                                            <th>Package Name</th>
                                            <th>Membership Type</th>
                                            <th>Net Payable</th>
                                            <th>Remaining Balance</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingPayments.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                                                    No pending payments found
                                                </td>
                                            </tr>
                                        ) : (
                                            pendingPayments.map((m) => (
                                                <tr key={m.memberId || m._id}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            disabled={isLocked(m._id || m.memberId, sentPaymentTimestamps)}
                                                            checked={selectedPayments.has(m._id || m.memberId)}
                                                            onChange={() => handleSelectPayment(m._id || m.memberId)}
                                                            style={{ cursor: isLocked(m._id || m.memberId, sentPaymentTimestamps) ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div
                                                            className="nr-table-profile-photo"
                                                            onClick={() => handleMemberClick(m)}
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            {m.profilePhoto ? (
                                                                <img
                                                                    src={getProfilePhotoUrl(m) || getFallbackImage(m)}
                                                                    alt={m.fullName}
                                                                    onError={(e) => {
                                                                        if (!e.target.src.includes('dicebear')) {
                                                                            e.target.src = getFallbackImage(m);
                                                                        }
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="nr-photo-placeholder">
                                                                    {m.fullName?.charAt(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ fontWeight: 600, color: '#64748b' }}>{m.memberId}</td>
                                                    <td>
                                                        <div
                                                            className="nr-table-member-info"
                                                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                            onClick={() => handleMemberClick(m)}
                                                        >
                                                            <span>{m.name || m.fullName}</span>
                                                            {isLocked(m._id || m.memberId, sentPaymentTimestamps) && (
                                                                <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '10px', background: '#dcfce7', padding: '1px 4px', borderRadius: '4px' }}>Sent ✓</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ color: '#f97316', fontWeight: 500 }}>{m.phone}</td>
                                                    <td>{m.packageName || 'N/A'}</td>
                                                    <td>{m.membershipType || 'N/A'}</td>
                                                    <td style={{ fontWeight: 600 }}>
                                                        ₹{m.netPayable?.toLocaleString() || (m.amount - (m.discountType === 'percentage' ? (m.amount * (m.discountValue / 100)) : (m.discountValue || 0))).toLocaleString()}
                                                    </td>
                                                    <td style={{ color: '#dc2626', fontWeight: 700 }}>₹{m.balanceAmount?.toLocaleString()}</td>
                                                    <td className="nr-actions">
                                                        <button
                                                            className="nr-action-btn pay"
                                                            style={{ backgroundColor: '#f97316', color: 'white' }}
                                                            onClick={() => handleAction('payNow', m)}
                                                            title="Pay Now"
                                                        >
                                                            <DollarSign size={16} /> Pay
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'renewals':
                return (
                    <div className="nr-card" key="renewals">
                        <div className="nr-card-header" style={{ backgroundColor: '#fff7ed', borderBottom: '1px solid #ffedd5' }}>
                            <h3 style={sectionTitleStyle}>
                                <RefreshCcw size={18} color="#f97316" />
                                Renewals (Upcoming/Expired)
                            </h3>
                            <span className="nr-badge" style={{ backgroundColor: '#ffedd5', color: '#9a3412' }}>
                                {loading ? '...' : expiringSoon.length}
                            </span>
                            {selectedRenewals.size > 0 && (
                                <button
                                    className="nr-action-btn"
                                    style={{ backgroundColor: '#f97316', color: 'white', marginLeft: '1rem' }}
                                    onClick={() => handleSendReminder('expiry')}
                                    disabled={sendingReminder}
                                >
                                    <Send size={16} /> {sendingReminder ? 'Sending...' : `Send Reminder (${selectedRenewals.size})`}
                                </button>
                            )}
                        </div>
                        <div className="nr-card-body">
                            <div className="nr-table-wrapper">
                                <table className="nr-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={expiringSoon.length > 0 && selectedRenewals.size === expiringSoon.length}
                                                    onChange={handleSelectAllRenewals}
                                                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                />
                                            </th>
                                            <th>Photo</th>
                                            <th>Member ID</th>
                                            <th>Member</th>
                                            <th>Mobile No</th>
                                            <th>Membership Type</th>
                                            <th>Package Name</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th>Expiration Date</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={11} align="center">Loading...</td></tr>
                                        ) : expiringSoon.length === 0 ? (
                                            <tr><td colSpan={11} align="center" style={{ color: '#059669' }}>✓ No expiries</td></tr>
                                        ) : (
                                            expiringSoon.map((member) => (
                                                <tr key={member._id}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            disabled={isLocked(member._id, sentRenewalTimestamps)}
                                                            checked={selectedRenewals.has(member._id)}
                                                            onChange={() => handleSelectRenewal(member._id)}
                                                            style={{ cursor: isLocked(member._id, sentRenewalTimestamps) ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div
                                                            className="nr-table-profile-photo"
                                                            onClick={() => handleMemberClick(member)}
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            {member.profilePhoto ? (
                                                                <img
                                                                    src={getProfilePhotoUrl(member) || getFallbackImage(member)}
                                                                    alt={member.fullName}
                                                                    onError={(e) => {
                                                                        if (!e.target.src.includes('dicebear')) {
                                                                            e.target.src = getFallbackImage(member);
                                                                        }
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="nr-photo-placeholder">
                                                                    {member.fullName.charAt(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ fontWeight: 600, color: '#64748b' }}>{member.memberId}</td>
                                                    <td>
                                                        <div
                                                            className="nr-table-member-info"
                                                            style={{ cursor: isLocked(member._id, sentRenewalTimestamps) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                            onClick={() => handleMemberClick(member)}
                                                        >
                                                            <span>{member.fullName || member.name}</span>
                                                            {isLocked(member._id, sentRenewalTimestamps) && (
                                                                <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '10px', background: '#dcfce7', padding: '1px 4px', borderRadius: '4px' }}>Sent ✓</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ color: '#f97316', fontWeight: 500 }}>{member.phone}</td>
                                                    <td>{member.membershipType || 'N/A'}</td>
                                                    <td>{member.packageName || 'N/A'}</td>
                                                    <td style={{ fontWeight: 600 }}>₹{member.amount || 0}</td>
                                                    <td>
                                                        <span className="nr-status-badge" style={{
                                                            backgroundColor: member.daysLeft <= 0 ? '#fef2f2' : (member.daysLeft <= 3 ? '#fff7ed' : '#f0f9ff'),
                                                            color: member.daysLeft <= 0 ? '#991b1b' : (member.daysLeft <= 3 ? '#9a3412' : '#075985'),
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600
                                                        }}>
                                                            {member.expiryStatus}
                                                        </span>
                                                    </td>
                                                    <td>{new Date(member.endDate).toLocaleDateString()}</td>
                                                    <td className="nr-actions">
                                                        <button
                                                            className="nr-action-btn renew"
                                                            style={{ backgroundColor: '#ecfdf5', color: '#059669' }}
                                                            onClick={() => handleAction('renewNow', member)}
                                                            title="Renew Now"
                                                        >
                                                            <RefreshCcw size={16} /> Renew Plan
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'maintenance':
                return (
                    <div className="nr-card" key="maintenance">
                        <div className="nr-card-header" style={{ backgroundColor: '#fff7ed', borderBottom: '1px solid #ffedd5' }}>
                            <h3 style={sectionTitleStyle}>
                                <Wrench size={18} color="#f97316" />
                                Equipment Maintenance
                            </h3>
                            <span className="nr-badge" style={{ backgroundColor: '#ffedd5', color: '#9a3412' }}>
                                {equipmentLoading ? '...' : equipmentMaintenance.length}
                            </span>
                        </div>
                        <div className="nr-card-body">
                            <div className="nr-table-wrapper">
                                <table className="nr-table">
                                    <thead>
                                        <tr>
                                            <th>Equipment Name</th>
                                            <th>Category</th>
                                            <th>Brand & Model</th>
                                            <th>Serial Numbers</th>
                                            <th>Service Contact</th>
                                            <th>Next Maintenance</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {equipmentLoading ? (
                                            <tr><td colSpan={7} align="center">Loading...</td></tr>
                                        ) : equipmentMaintenance.length === 0 ? (
                                            <tr><td colSpan={7} align="center" style={{ color: '#059669' }}>✓ Up to date</td></tr>
                                        ) : (
                                            equipmentMaintenance.map((item) => (
                                                <tr key={item._id}>
                                                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                                                    <td style={{ textTransform: 'capitalize' }}>{item.category}</td>
                                                    <td>{item.brand} - {item.model}</td>
                                                    <td>
                                                        <div style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '200px' }}>
                                                            {item.serialNumbers?.join(', ') || 'N/A'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{ color: '#f97316', fontWeight: 600 }}>
                                                            {item.serviceContactNumber || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td>{new Date(item.maintenanceSchedule).toLocaleDateString()}</td>
                                                    <td className="nr-actions">
                                                        <button
                                                            className="nr-action-btn renew"
                                                            style={{ backgroundColor: '#ecfdf5', color: '#059669' }}
                                                            onClick={() => handleAction('maintenanceDone', item)}
                                                            title="Mark as Done"
                                                        >
                                                            <CheckCircle2 size={16} /> Done
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'leads':
                return (
                    <div className="nr-card" key="leads">
                        <div className="nr-card-header" style={{ backgroundColor: '#fff7ed', borderBottom: '1px solid #ffedd5' }}>
                            <h3 style={sectionTitleStyle}>
                                <UserPlus size={18} color="#f97316" />
                                Lead Alerts (Follow-ups)
                            </h3>
                            <span className="nr-badge" style={{ backgroundColor: '#ffedd5', color: '#9a3412' }}>
                                {leadsLoading ? '...' : urgentFollowups.length}
                            </span>
                        </div>
                        <div className="nr-card-body">
                            <div className="nr-table-wrapper">
                                <table className="nr-table">
                                    <thead>
                                        <tr>
                                            <th>Lead Name</th>
                                            <th>Mobile No</th>
                                            <th>Interested Service</th>
                                            <th>Interest Level</th>
                                            <th>Last Contacted</th>
                                            <th>Source</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leadsLoading ? (
                                            <tr><td colSpan={7} align="center">Loading...</td></tr>
                                        ) : urgentFollowups.length === 0 ? (
                                            <tr><td colSpan={7} align="center" style={{ color: '#059669' }}>✓ No follow-ups</td></tr>
                                        ) : (
                                            urgentFollowups.map((lead) => (
                                                <tr key={lead._id}>
                                                    <td style={{ fontWeight: 600 }}>{lead.name}</td>
                                                    <td>{lead.phone}</td>
                                                    <td>{lead.interestedService || 'N/A'}</td>
                                                    <td>
                                                        <span className="nr-status-badge" style={{
                                                            backgroundColor: lead.interestLevel === 'high' ? '#fef2f2' : lead.interestLevel === 'medium' ? '#fff7ed' : '#f0f9ff',
                                                            color: lead.interestLevel === 'high' ? '#991b1b' : lead.interestLevel === 'medium' ? '#9a3412' : '#075985',
                                                            textTransform: 'capitalize'
                                                        }}>
                                                            {lead.interestLevel}
                                                        </span>
                                                    </td>
                                                    <td>{lead.lastContactedDate ? new Date(lead.lastContactedDate).toLocaleDateString() : 'Never'}</td>
                                                    <td style={{ textTransform: 'capitalize' }}>{lead.source?.replace('_', ' ')}</td>
                                                    <td className="nr-actions">
                                                        <button
                                                            className="nr-action-btn renew"
                                                            style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                                                            onClick={() => handleAction('leadContacted', lead)}
                                                            title="Mark as Contacted"
                                                        >
                                                            <Phone size={16} /> Contacted
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'attendance':
                return (
                    <div className="nr-card" key="attendance">
                        <div className="nr-card-header" style={{ backgroundColor: '#fff7ed', borderBottom: '1px solid #ffedd5' }}>
                            <h3 style={sectionTitleStyle}>
                                <Clock size={18} color="#f97316" />
                                Attendance Alerts (Absence)
                            </h3>
                            <span className="nr-badge" style={{ backgroundColor: '#ffedd5', color: '#9a3412' }}>
                                {attendanceLoading ? '...' : attendanceAlerts.length}
                            </span>
                            {selectedAttendance.size > 0 && (
                                <button
                                    className="nr-action-btn"
                                    style={{ backgroundColor: '#f97316', color: 'white', marginLeft: '1rem' }}
                                    onClick={() => handleSendReminder('attendance')}
                                    disabled={sendingReminder}
                                >
                                    <Send size={16} /> {sendingReminder ? 'Sending...' : `Send Reminder (${selectedAttendance.size})`}
                                </button>
                            )}
                        </div>
                        <div className="nr-card-body">
                            <div className="nr-table-wrapper">
                                <table className="nr-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={attendanceAlerts.length > 0 && selectedAttendance.size === attendanceAlerts.length}
                                                    onChange={handleSelectAllAttendance}
                                                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                />
                                            </th>
                                            <th>Photo</th>
                                            <th>Member Name</th>
                                            <th>Member ID</th>
                                            <th>Mobile No</th>
                                            <th>Membership Type</th>
                                            <th>Package Name</th>
                                            <th>Days Absent</th>
                                            <th>Expire Date</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendanceLoading ? (
                                            <tr><td colSpan={10} align="center">Loading...</td></tr>
                                        ) : attendanceAlerts.length === 0 ? (
                                            <tr><td colSpan={10} align="center" style={{ color: '#10b981' }}>✓ Perfect Attendance</td></tr>
                                        ) : (
                                            attendanceAlerts.map((member) => (
                                                <tr key={member._id}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            disabled={isLocked(member._id, sentAttendanceTimestamps)}
                                                            checked={selectedAttendance.has(member._id)}
                                                            onChange={() => handleSelectAttendanceAlert(member._id)}
                                                            style={{ cursor: isLocked(member._id, sentAttendanceTimestamps) ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="nr-table-profile-photo">
                                                            {member.profilePhoto ? (
                                                                <img
                                                                    src={getProfilePhotoUrl(member) || getFallbackImage(member)}
                                                                    alt={member.fullName}
                                                                    onError={(e) => {
                                                                        if (!e.target.src.includes('dicebear')) {
                                                                            e.target.src = getFallbackImage(member);
                                                                        }
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="nr-photo-placeholder">{member.fullName.charAt(0)}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                       <div
                                                            className="nr-table-member-info"
                                                            style={{ cursor: isLocked(member._id, sentAttendanceTimestamps) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                            onClick={() => handleMemberClick(member)}
                                                        >
                                                            <span style={{ fontWeight: 600 }}>{member.fullName}</span>
                                                            {isLocked(member._id, sentAttendanceTimestamps) && (
                                                                <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '10px', background: '#dcfce7', padding: '1px 4px', borderRadius: '4px' }}>Sent ✓</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>{member.memberId}</td>
                                                    <td>{member.phone}</td>
                                                    <td style={{ textTransform: 'capitalize' }}>{member.membershipType}</td>
                                                    <td>{member.packageName}</td>
                                                    <td>
                                                        <span className="nr-status-badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>
                                                            {member.daysAbsent} Days
                                                        </span>
                                                    </td>
                                                    <td>{member.endDate ? new Date(member.endDate).toLocaleDateString() : 'N/A'}</td>
                                                    <td className="nr-actions">
                                                        <button
                                                            className="nr-action-btn whatsapp"
                                                            style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
                                                            onClick={() => handleAction('attendanceCalled', member)}
                                                            title="Mark as Called"
                                                        >
                                                            <Phone size={16} /> Called
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'salary':
                return (
                    <div className="nr-card" key="salary">
                        <div className="nr-card-header" style={{ backgroundColor: '#fff7ed', borderBottom: '1px solid #ffedd5' }}>
                            <h3 style={sectionTitleStyle}>
                                <IndianRupee size={18} color="#f97316" />
                                Salary Alerts (Unpaid)
                            </h3>
                            <span className="nr-badge" style={{ backgroundColor: '#ffedd5', color: '#9a3412' }}>
                                {salaryLoading ? '...' : salaryAlerts.length}
                            </span>
                        </div>
                        <div className="nr-card-body">
                            <div className="nr-table-wrapper">
                                <table className="nr-table">
                                    <thead>
                                        <tr>
                                            <th>Photo</th>
                                            <th>Staff ID</th>
                                            <th>Name</th>
                                            <th>Mobile No</th>
                                            <th>Working Days</th>
                                            <th>Month / Year</th>
                                            <th>Present / Absent</th>
                                            <th>Amount</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {salaryLoading ? (
                                            <tr><td colSpan={9} align="center">Loading...</td></tr>
                                        ) : salaryAlerts.length === 0 ? (
                                            <tr><td colSpan={9} align="center" style={{ color: '#059669' }}>✓ All paid</td></tr>
                                        ) : (
                                            salaryAlerts.map((staff) => (
                                                <tr key={staff._id || staff.staffId}>
                                                    <td>
                                                        <div className="nr-table-profile-photo">
                                                            {staff.profilePhoto ? (
                                                                <img
                                                                    src={getProfilePhotoUrl(staff) || getFallbackImage(staff)}
                                                                    alt={staff.fullName}
                                                                    onError={(e) => {
                                                                        if (!e.target.src.includes('dicebear')) {
                                                                            e.target.src = getFallbackImage(staff);
                                                                        }
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="nr-photo-placeholder">{staff.fullName?.charAt(0)}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>{staff.staffId}</td>
                                                    <td style={{ fontWeight: 600 }}>{staff.fullName}</td>
                                                    <td>{staff.phone}</td>
                                                    <td>{staff.totalWorkingDays} Days</td>
                                                    <td>{staff.monthName} {staff.year}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <span style={{ color: '#059669', fontWeight: 600 }}>P: {staff.presentDays}</span>
                                                            <span style={{ color: '#dc2626', fontWeight: 600 }}>A: {staff.absentDays}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontWeight: 700, color: '#f97316' }}>₹{staff.salary?.toLocaleString()}</td>
                                                    <td className="nr-actions">
                                                        <button
                                                            className="nr-action-btn renew"
                                                            style={{ backgroundColor: '#ecfdf5', color: '#059669' }}
                                                            onClick={() => handleAction('salaryPaid', staff)}
                                                            title="Mark as Paid"
                                                        >
                                                            <CheckCircle2 size={16} /> Paid
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={pageContainerStyle}>
            {/* Header */}
            <header style={headerStyle}>
                <h1 style={titleStyle}>
                    <Bell size={28} color="#f97316" />
                    Notifications & Reminders
                </h1>
                <p style={subtitleStyle}>
                    Stay on top of critical alerts, member renewals, and follow-ups
                </p>
            </header>

            {/* Navigation Bar */}
            <div style={tabContainerStyle}>
                <button style={tabButtonStyle(activeTab === 'payments')} onClick={() => setActiveTab('payments')}>
                    <DollarSign size={16} /> Payments
                </button>
                <button style={tabButtonStyle(activeTab === 'renewals')} onClick={() => setActiveTab('renewals')}>
                    <RefreshCcw size={16} /> Renewals
                </button>
                <button style={tabButtonStyle(activeTab === 'maintenance')} onClick={() => setActiveTab('maintenance')}>
                    <Wrench size={16} /> Maintenance
                </button>
                <button style={tabButtonStyle(activeTab === 'leads')} onClick={() => setActiveTab('leads')}>
                    <UserPlus size={16} /> Leads
                </button>
                <button style={tabButtonStyle(activeTab === 'attendance')} onClick={() => setActiveTab('attendance')}>
                    <Clock size={16} /> Attendance
                </button>
                <button style={tabButtonStyle(activeTab === 'salary')} onClick={() => setActiveTab('salary')}>
                    <IndianRupee size={16} /> Salary
                </button>
            </div>

            {/* Tab View */}
            <div className="nr-grid-1">
                {renderCard(activeTab)}
            </div>

            {/* Member Detail Modal */}
            {showModal && selectedMember && (
                <div className="nr-modal-overlay" onClick={handleCloseModal}>
                    <div className="nr-modal-card" onClick={(e) => e.stopPropagation()}>
                        <button className="nr-modal-close" onClick={handleCloseModal}>
                            <X size={20} color="#64748b" />
                        </button>

                        <div className="nr-modal-header">
                            {selectedMember.profilePhoto ? (
                                <img
                                    src={getProfilePhotoUrl(selectedMember) || getFallbackImage(selectedMember)}
                                    alt={selectedMember.fullName}
                                    className="nr-modal-profile-photo"
                                    onError={(e) => {
                                        if (!e.target.src.includes('dicebear')) {
                                            e.target.src = getFallbackImage(selectedMember);
                                        }
                                    }}
                                />
                            ) : null}
                            <div
                                className="nr-modal-profile-photo-placeholder"
                                style={{
                                    display: selectedMember.profilePhoto ? 'none' : 'flex',
                                    backgroundColor: '#f97316'
                                }}
                            >
                                {selectedMember.fullName.charAt(0)}
                            </div>
                            <h2 className="nr-modal-name">{selectedMember.fullName}</h2>
                            <div className="nr-modal-member-id">ID: {selectedMember.memberId}</div>
                        </div>

                        <div className="nr-modal-body">
                            <div className="nr-modal-info-grid">
                                <div className="nr-modal-info-item">
                                    <span className="nr-modal-info-label">Contact</span>
                                    <div className="nr-modal-info-value" style={{ color: '#f97316' }}>{selectedMember.phone}</div>
                                    <div className="nr-modal-info-value">{selectedMember.email}</div>
                                </div>
                                <div className="nr-modal-info-item">
                                    <span className="nr-modal-info-label">Balance</span>
                                    <div className="nr-modal-info-value" style={{ color: selectedMember.balanceAmount > 0 ? '#dc2626' : '#059669', fontSize: '1.25rem', fontWeight: 700 }}>
                                        ₹{selectedMember.balanceAmount || 0}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
