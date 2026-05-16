import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import ToggleButton from '../components/ToggleButton.jsx';
import Sidebar from '../components/Sidebar.jsx';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { loadImage, drawGymHeader, drawGymFooter } from "../utils/pdfUtils";
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts';
import {
    TrendingUp,
    Users,
    DollarSign,
    Activity,
    Target,
} from 'lucide-react';
import '../styles/business-insights.css';
import '../styles/dashboard.css';
import '../styles/toggle-button.css';

/**
 * MOCK DATA OBJECT
 */
const mockData = {
    financial: {
        mrr: 450000,
        mrrGrowth: 12.5,
        revenueVsExpenses: [
            { month: 'Aug', revenue: 380000, expenses: 200000 },
            { month: 'Sep', revenue: 410000, expenses: 210000 },
            { month: 'Oct', revenue: 395000, expenses: 205000 },
            { month: 'Nov', revenue: 420000, expenses: 220000 },
            { month: 'Dec', revenue: 460000, expenses: 230000 },
            { month: 'Jan', revenue: 450000, expenses: 215000 },
        ],
        breakdown: [
            { name: 'Memberships', value: 315000 },
            { name: 'Personal Training', value: 90000 },
            { name: 'Merchandise', value: 45000 },
        ],
        arpu: 1850,
        arpuGrowth: 5.2,
    },
    memberHealth: {
        churnData: [
            { month: 'Aug', rate: 4.2 },
            { month: 'Sep', rate: 3.8 },
            { month: 'Oct', rate: 4.1 },
            { month: 'Nov', rate: 3.5 },
            { month: 'Dec', rate: 2.9 },
            { month: 'Jan', rate: 2.5 },
        ],
        newLeads: 84,
        leadsGrowth: 15,
        distribution: [
            { name: '1 Month', value: 45 },
            { name: '6 Month', value: 30 },
            { name: 'Annual', value: 25 },
        ],
        lowRiskMembers: [
            { id: 1, name: 'Arjun Verma', plan: 'Annual Gold', riskScore: 12 },
            { id: 2, name: 'Priya Sharma', plan: '6 Month Silver', riskScore: 15 },
            { id: 3, name: 'Rohan Mehra', plan: 'Annual Platinum', riskScore: 8 },
            { id: 4, name: 'Sneha Patel', plan: '1 Month Bronze', riskScore: 22 },
            { id: 5, name: 'Vikram Singh', plan: '6 Month Gold', riskScore: 18 },
        ],
    },
    operations: {
        peakHours: [
            { hour: '6AM', count: 45 },
            { hour: '8AM', count: 68 },
            { hour: '10AM', count: 35 },
            { hour: '12PM', count: 20 },
            { hour: '4PM', count: 30 },
            { hour: '6PM', count: 85 },
            { hour: '8PM', count: 60 },
            { hour: '10PM', count: 25 },
        ],
        attendanceRate: 78,
    },
    sales: {
        conversionRate: 24,
        conversionTrend: +2.4,
        leadSources: [
            { name: 'Website', value: 45 },
            { name: 'Google Maps', value: 25 },
            { name: 'Facebook/Insta', value: 20 },
            { name: 'Referrals', value: 10 },
        ],
    },
};

const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa'];

export default function BusinessInsights() {
    const { isauthenticated, getuserdata, sidebarOpen, setSidebarOpen, backendurl, gymSettings } = useContext(AppContent);
    const navigate = useNavigate();

    // State for high risk members
    const [highRiskMembers, setHighRiskMembers] = React.useState([]);
    const [loadingRisk, setLoadingRisk] = React.useState(true);

    // State for attendance leaderboard
    const [leaderboard, setLeaderboard] = React.useState([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = React.useState(true);

    // State for membership distribution
    const [membershipData, setMembershipData] = React.useState([]);

    // State for operational insights
    const [peakHours, setPeakHours] = React.useState([]);
    const [loadingOperations, setLoadingOperations] = React.useState(true);

    // State for sales & funnel
    const [leadConversion, setLeadConversion] = React.useState({ rate: 0, improvement: 0, convertedCount: 0 });
    const [leadSources, setLeadSources] = React.useState([]);
    const [loadingSales, setLoadingSales] = React.useState(true);

    // State for modal
    const [selectedItem, setSelectedItem] = React.useState(null); // { type: 'member' | 'lead', data: ... }
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [sendingWhatsapp, setSendingWhatsapp] = React.useState(false);

    const openModal = (type, data) => {
        setSelectedItem({ type, data });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedItem(null);
    };

    useEffect(() => {
        if (!isauthenticated) {
            navigate("/");
            return;
        }
        getuserdata();
    }, [isauthenticated, navigate]);

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch High Risk Members
                const riskRes = await axios.get(`${backendurl}/api/insights/high-risk`, { withCredentials: true });
                const riskData = riskRes.data;
                if (riskData.success) {
                    setHighRiskMembers(riskData.members);
                }

                // Fetch Attendance Leaderboard
                const leaderboardRes = await axios.get(`${backendurl}/api/insights/attendance-leaderboard`, { withCredentials: true });
                const leaderboardData = leaderboardRes.data;
                if (leaderboardData.success) {
                    setLeaderboard(leaderboardData.leaderboard);
                }

                // Fetch Membership Distribution
                const distRes = await axios.get(`${backendurl}/api/insights/membership-distribution`, { withCredentials: true });
                const distData = distRes.data;
                if (distData.success) {
                    setMembershipData(distData.distribution);
                }

                // Fetch Peak Hours
                const peakRes = await axios.get(`${backendurl}/api/insights/peak-hours`, { withCredentials: true });
                const peakData = peakRes.data;
                if (peakData.success) {
                    setPeakHours(peakData.peakHours);
                }

                // Fetch Lead Conversion Rate
                const conversionRes = await axios.get(`${backendurl}/api/insights/lead-conversion`, { withCredentials: true });
                const conversionData = conversionRes.data;
                if (conversionData.success) {
                    setLeadConversion({
                        rate: conversionData.conversionRate,
                        improvement: conversionData.improvement,
                        convertedCount: conversionData.convertedCount
                    });
                }

                // Fetch Lead Sources
                const sourcesRes = await axios.get(`${backendurl}/api/insights/lead-sources`, { withCredentials: true });
                const sourcesData = sourcesRes.data;
                if (sourcesData.success) {
                    setLeadSources(sourcesData.leadSources);
                }

            } catch (error) {
                console.error("Failed to fetch insights data:", error);
            } finally {
                setLoadingRisk(false);
                setLoadingLeaderboard(false);
                setLoadingOperations(false);
                setLoadingSales(false);
            }
        };

        fetchData();
    }, [backendurl]);



    const generateBusinessInsightsPDF = async () => {
        const doc = new jsPDF();
        const primaryOrange = [249, 115, 22];
        const accentOrange = [234, 88, 12];

        // -- Header with Logo, Name, Address, etc. --
        let yPos = await drawGymHeader(doc, gymSettings, backendurl);

        // -- Report Title --
        doc.setFontSize(18);
        doc.setTextColor(...accentOrange);
        doc.text("BUSINESS PERFORMANCE INSIGHTS", 105, yPos, { align: "center" });

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

        // 1. Attendance Leaderboard
        doc.setFont("helvetica", "bold");
        doc.setFillColor(...primaryOrange);
        doc.setTextColor(255, 255, 255);
        doc.rect(15, yPos - 5, 180, 8, 'F');
        doc.text("Attendance Leaderboard (Top Members)", 17, yPos);
        yPos += 10;

        autoTable(doc, {
            startY: yPos,
            head: [['Rank', 'Member Name', 'Package', 'Visits']],
            body: leaderboard.map(m => [`#${m.rank}`, m.fullName, m.packageName, m.score]),
            theme: 'grid',
            headStyles: { fillColor: primaryOrange }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // 2. High Risk Members
        doc.setFont("helvetica", "bold");
        doc.setFillColor(239, 68, 68); // Red for risk
        doc.setTextColor(255, 255, 255);
        doc.rect(15, yPos - 5, 180, 8, 'F');
        doc.text("High Risk Members (Potential Churn)", 17, yPos);
        yPos += 10;

        autoTable(doc, {
            startY: yPos,
            head: [['Name', 'Package', 'Risk Score']],
            body: highRiskMembers.map(m => [m.fullName, m.packageName, `${(m.churnScore * 100).toFixed(0)}%`]),
            theme: 'grid',
            headStyles: { fillColor: [239, 68, 68] }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // 3. Conversion Summary
        doc.setFont("helvetica", "bold");
        doc.setFillColor(16, 185, 129); // Green for sales
        doc.setTextColor(255, 255, 255);
        doc.rect(15, yPos - 5, 180, 8, 'F');
        doc.text("Sales & Conversion Summary", 17, yPos);
        yPos += 10;

        autoTable(doc, {
            startY: yPos,
            head: [['Metric', 'Value']],
            body: [
                ['Lead to Member Conversion Rate', `${leadConversion.rate}%`],
                ['Converted Count', leadConversion.convertedCount],
                ['Trend Improvement', `${leadConversion.improvement}%`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] }
        });

        return doc.output('datauristring').split(',')[1];
    };

    const handleSendBusinessReportToWhatsApp = async () => {
        try {
            if (!gymSettings || !gymSettings.mobile) {
                toast.warning("Owner Mobile number should be saved or not given in the gym profile.");
                return;
            }
            setSendingWhatsapp(true);
            const pdfBase64 = await generateBusinessInsightsPDF();
            
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'];
            const reportMonth = monthNames[new Date().getMonth()];
            const reportYear = new Date().getFullYear().toString();

            const response = await fetch(`${backendurl}/whatsapp/send-report`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pdf: pdfBase64, reportMonth, reportYear }),
              credentials: 'include'
            });

            const data = await response.json();
            if (data.success) {
                toast.success(`Business report sent successfully to gym owner!`);
            } else {
                toast.error(`Failed to send report: ${data.message}`);
            }
        } catch (error) {
            console.error("Error sending business report:", error);
            toast.error("An error occurred while sending the report.");
        } finally {
            setSendingWhatsapp(false);
        }
    };

    // Styles
    const pageContainerStyle = { padding: '2rem', backgroundColor: '#f9fafb', minHeight: '100vh', color: '#1e293b' };
    const sectionTitleStyle = { fontSize: '1.25rem', fontWeight: 600, color: '#334155', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' };
    const chartContainerStyle = { height: '250px', width: '100%' };
    const smallText = { fontSize: '0.75rem', color: '#64748b' };
    const metricValue = { fontSize: '1.875rem', fontWeight: 700, color: '#0f172a' };

    return (
        <>
            <Sidebar />
            <div className="dash-main">
                <header className="dash-header">
                    <div className="dash-header-left">
                        <ToggleButton isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
                        <div className="dash-breadcrumb">
                            Dashboard / Business Insights
                        </div>
                    </div>
                    <div className="dash-header-right" style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={handleSendBusinessReportToWhatsApp}
                            disabled={sendingWhatsapp}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                background: sendingWhatsapp ? '#94a3b8' : '#2563eb',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: sendingWhatsapp ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            {sendingWhatsapp ? '⏳ Sending...' : '💬 Send Report to Owner'}
                        </button>
                    </div>
                </header>

                <div style={pageContainerStyle}>



                    {/* ROW 2: MEMBER HEALTH */}
                    <h2 style={sectionTitleStyle}>
                        <Users size={20} color="#ec4899" /> Member Health
                    </h2>

                    {/* ATTENDANCE LEADERBOARD */}
                    <div className="bi-grid-1" style={{ marginBottom: '1.5rem' }}>
                        <div className="bi-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div style={{ backgroundColor: '#fff7ed', padding: '1rem 1.5rem', borderBottom: '1px solid #ffedd5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#c2410c', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Target size={20} /> Attendance Leaderboard
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: '#ea580c', margin: '0.25rem 0 0 0' }}>Top 3 attendees of the month</p>
                                </div>
                            </div>
                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {loadingLeaderboard ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading leaderboard...</div>
                                ) : leaderboard.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No attendance data available for this month yet.</div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                                        {leaderboard.map((member, index) => {
                                            // Handle ranking colors/icons
                                            let rankBadgeBg = '#f1f5f9';
                                            let rankBadgeColor = '#64748b';
                                            let rankIcon = null;

                                            if (member.rank === 1) {
                                                rankBadgeBg = '#fef3c7'; // Yellow/Gold
                                                rankBadgeColor = '#b45309';
                                                rankIcon = '🥇';
                                            } else if (member.rank === 2) {
                                                rankBadgeBg = '#f1f5f9'; // Silver/Gray
                                                rankBadgeColor = '#475569';
                                                rankIcon = '🥈';
                                            } else if (member.rank === 3) {
                                                rankBadgeBg = '#ffedd5'; // Bronze/Orange
                                                rankBadgeColor = '#c2410c';
                                                rankIcon = '🥉';
                                            }

                                            return (
                                                <div key={`${member.memberId}-${index}`} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '1rem',
                                                    borderRadius: '0.75rem',
                                                    backgroundColor: 'white',
                                                    border: '1px solid #e2e8f0',
                                                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                                                    transition: 'transform 0.2s',
                                                    cursor: 'pointer'
                                                }} className="hover:scale-[1.02]">
                                                    {/* Rank Badge */}
                                                    <div style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '50%',
                                                        backgroundColor: rankBadgeBg,
                                                        color: rankBadgeColor,
                                                        fontWeight: 'bold',
                                                        fontSize: '1rem',
                                                        marginRight: '1rem',
                                                        flexShrink: 0
                                                    }}>
                                                        {rankIcon ? <span style={{ fontSize: '1.25rem' }}>{rankIcon}</span> : `#${member.rank}`}
                                                    </div>

                                                    {/* Profile Info */}
                                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                            {member.fullName}
                                                        </h4>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                            {member.packageName}
                                                        </p>
                                                    </div>

                                                    {/* Score */}
                                                    <div style={{ marginLeft: '1rem', textAlign: 'right' }}>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f97316' }}>{member.score}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Days</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="bi-grid-1">
                        <div className="bi-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div style={{ backgroundColor: '#fef2f2', padding: '1rem 1.5rem', borderBottom: '1px solid #fee2e2' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#991b1b', margin: 0 }}>people who have higher chance to leave</h3>
                            </div>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '0.5rem' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        {loadingRisk ? (
                                            <tr>
                                                <td colSpan="2" style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Loading...</td>
                                            </tr>
                                        ) : highRiskMembers.length === 0 ? (
                                            <tr>
                                                <td colSpan="2" style={{ padding: '1rem', textAlign: 'center', color: '#10b981' }}>Great! No high risk members found.</td>
                                            </tr>
                                        ) : (
                                            highRiskMembers.map((m) => (
                                                <tr
                                                    key={m.memberId}
                                                    style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                                                    onClick={() => openModal('member', m)}
                                                    className="hover:bg-slate-50 transition-colors"
                                                >
                                                    <td style={{ padding: '1rem' }}>
                                                        <p style={{ fontSize: '1rem', fontWeight: 500, color: '#1e293b', margin: 0 }}>{m.fullName}</p>
                                                        <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>{m.packageName}</p>
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '0.25rem 0.75rem',
                                                            borderRadius: '0.5rem',
                                                            fontSize: '0.875rem',
                                                            fontWeight: 600,
                                                            backgroundColor: '#fee2e2',
                                                            color: '#991b1b'
                                                        }}>
                                                            {m.churnScore ? (m.churnScore * 100).toFixed(0) : 0}% Risk
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* ROW 3: OPERATIONAL INSIGHTS */}
                    <h2 style={sectionTitleStyle}>
                        <Activity size={20} color="#f97316" /> Operational Insights
                    </h2>
                    <div className="bi-grid-1">
                        <div className="bi-card">
                            <div className="bi-header-row">
                                <div>
                                    <h3 style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>Peak hours in your gym</h3>
                                    <p style={smallText}>Based on last 7 days check-in data</p>
                                </div>
                            </div>
                            <div style={{ height: '400px', width: '100%' }}>
                                <ResponsiveContainer>
                                    <BarChart data={loadingOperations ? [] : peakHours}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* ROW 4: SALES & FUNNEL */}
                    <h2 style={sectionTitleStyle}>
                        <Target size={20} color="#10b981" /> Sales & Funnel
                    </h2>
                    <div className="bi-grid-2">
                        <div className="bi-card" style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: '2rem' }}>
                            <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: '#ecfdf5', marginRight: '1.5rem' }}>
                                <TrendingUp size={32} color="#059669" />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                    <h3 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                                        {loadingSales ? '...' : `${leadConversion.rate}%`}
                                    </h3>
                                    {!loadingSales && (
                                        <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b' }}>
                                            ({leadConversion.convertedCount} Members)
                                        </span>
                                    )}
                                </div>
                                <p style={{ color: '#64748b', fontWeight: 500, margin: 0 }}>Lead to Member Conversion</p>
                                <p style={{
                                    fontSize: '0.75rem',
                                    color: leadConversion.improvement >= 0 ? '#059669' : '#ef4444',
                                    marginTop: '0.25rem',
                                    fontWeight: 600
                                }}>
                                    {loadingSales ? '' : `${leadConversion.improvement >= 0 ? '+' : ''}${leadConversion.improvement}% vs last 30 days`}
                                </p>
                            </div>
                        </div>

                        <div className="bi-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ width: '50%', height: '160px' }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie data={loadingSales ? [] : leadSources} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                                            {leadSources.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ width: '50%' }}>
                                <h4 style={{ fontWeight: 600, color: '#1e293b', marginBottom: '0.75rem' }}>Lead Sources</h4>
                                <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {loadingSales ? (
                                        <li style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Loading...</li>
                                    ) : leadSources.length === 0 ? (
                                        <li style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No lead data</li>
                                    ) : (
                                        leadSources.map((s, i) => (
                                            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', color: '#64748b' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', marginRight: '8px', backgroundColor: COLORS[i % COLORS.length] }}></span>
                                                    {s.name}
                                                </span>
                                                <span style={{ fontWeight: 700, color: '#334155' }}>{s.value}%</span>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* ROW 5: MEMBERSHIP DISTRIBUTION */}
                    <h2 style={sectionTitleStyle}>
                        <Activity size={20} color="#8b5cf6" /> Membership Analysis
                    </h2>
                    <div className="bi-grid-1">
                        <div className="bi-card">
                            <div className="bi-header-row">
                                <div style={{ padding: '0.5rem 0' }}>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.5rem 0' }}>How many members in Membership</h3>
                                    <p style={{ ...smallText, fontSize: '0.875rem' }}>Active members count by each membership package</p>
                                </div>
                            </div>
                            <div style={chartContainerStyle}>
                                <ResponsiveContainer>
                                    <BarChart data={membershipData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 12, fill: '#64748b' }}
                                            allowDecimals={false}
                                            domain={[0, 'auto']}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar
                                            dataKey="value"
                                            fill="#f97316"
                                            radius={[4, 4, 0, 0]}
                                            maxBarSize={60}
                                            minPointSize={4}
                                        >
                                            {membershipData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={COLORS[index % COLORS.length]}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* DETAILS MODAL */}
                    {isModalOpen && selectedItem && (
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
                            zIndex: 1000,
                            backdropFilter: 'blur(4px)'
                        }} onClick={closeModal}>
                            <div style={{
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                width: '90%',
                                maxWidth: '500px',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                position: 'relative',
                                animation: 'fadeIn 0.2s ease-out'
                            }} onClick={(e) => e.stopPropagation()}>

                                {/* Modal Header */}
                                <div style={{
                                    padding: '1.5rem',
                                    borderBottom: '1px solid #f1f5f9',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start'
                                }}>
                                    <div>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            color: selectedItem.type === 'member'
                                                ? (selectedItem.data.churnRisk === 'High Risk' ? '#ec4899' : '#f97316')
                                                : '#2563eb',
                                            backgroundColor: selectedItem.type === 'member'
                                                ? (selectedItem.data.churnRisk === 'High Risk' ? '#fdf2f8' : '#fff7ed')
                                                : '#eff6ff',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '9999px',
                                            marginBottom: '0.5rem',
                                            display: 'inline-block'
                                        }}>
                                            {selectedItem.type === 'member'
                                                ? (selectedItem.data.churnRisk === 'High Risk' ? 'Higher chance to leave' : 'Expiring Member')
                                                : 'Lead Details'}
                                        </span>
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                                            {selectedItem.type === 'member' ? selectedItem.data.fullName : selectedItem.data.name}
                                        </h3>
                                    </div>
                                    <button onClick={closeModal} style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#94a3b8',
                                        padding: '4px'
                                    }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                </div>

                                {/* Modal Content */}
                                <div style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '1.5rem', alignItems: 'start' }}>
                                        {/* Profile Image (Placeholder or Actual) */}
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            backgroundColor: '#f1f5f9',
                                            backgroundImage: selectedItem.data.profilePhoto
                                                ? `url(${selectedItem.data.profilePhoto.startsWith('/') ? '' : '/'}${selectedItem.data.profilePhoto.replace(/\\/g, '/')})`
                                                : 'none',
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '2rem',
                                            color: '#cbd5e1',
                                            border: '1px solid #e2e8f0'
                                        }}>
                                            {!selectedItem.data.profilePhoto && (selectedItem.type === 'member' ? selectedItem.data.fullName?.[0] : selectedItem.data.name?.[0])}
                                        </div>

                                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                                            {/* Email */}
                                            <div>
                                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Email</p>
                                                <p style={{ fontSize: '0.9rem', color: '#334155', wordBreak: 'break-all' }}>{selectedItem.data.email || 'N/A'}</p>
                                            </div>
                                            {/* Phone */}
                                            <div>
                                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Phone</p>
                                                <p style={{ fontSize: '0.9rem', color: '#334155' }}>{selectedItem.data.phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        {/* Location */}
                                        <div>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Location</p>
                                            <p style={{ fontSize: '0.9rem', color: '#334155' }}>
                                                {selectedItem.data.area || selectedItem.data.location || 'N/A'}
                                                {selectedItem.data.city ? `, ${selectedItem.data.city}` : ''}
                                            </p>
                                        </div>

                                        {/* Status / Risk */}
                                        <div>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                {selectedItem.type === 'member' ? 'Risk Status' : 'Status'}
                                            </p>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '6px',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                backgroundColor: selectedItem.type === 'member'
                                                    ? (selectedItem.data.churnRisk === 'High Risk' ? '#fee2e2' : '#fff7ed')
                                                    : '#eff6ff',
                                                color: selectedItem.type === 'member'
                                                    ? (selectedItem.data.churnRisk === 'High Risk' ? '#991b1b' : '#9a3412')
                                                    : '#2563eb'
                                            }}>
                                                {selectedItem.type === 'member'
                                                    ? (selectedItem.data.churnRisk
                                                        ? `${selectedItem.data.churnRisk} (${(selectedItem.data.churnScore * 100).toFixed(0)}%)`
                                                        : selectedItem.data.status || 'Active')
                                                    : selectedItem.data.status}
                                            </span>
                                        </div>

                                        {/* Plan / Source */}
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>
                                                {selectedItem.type === 'member' ? 'Membership Plan' : 'Lead Source'}
                                            </p>
                                            <p style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                                                {selectedItem.type === 'member' ? selectedItem.data.packageName : selectedItem.data.source}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button onClick={closeModal} style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: 'white',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        color: '#475569',
                                        cursor: 'pointer'
                                    }}>
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
