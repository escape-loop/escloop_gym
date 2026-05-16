import React, { useState, useEffect, useContext } from 'react';
import { AppContent } from '../context/context.jsx';
import axios from 'axios';
import {
    Save,
    Activity,
    CheckCircle2,
    Zap,
    MessageSquare,
    UserPlus,
    CreditCard,
    Calendar,
    Cake,
    FileText,
    Settings2,
    Loader2
} from 'lucide-react';
import { toast } from 'react-toastify';
import '../styles/dashboard.css';

/**
 * ========================================
 * AUTOMATION ENGINE COMPONENT (Native)
 * ========================================
 */
export default function AutomationEngine() {
    const { backendurl } = useContext(AppContent);
    const [toggles, setToggles] = useState({
        subscriptionRenewal: true,
        newRegistration: true,
        paymentReceipt: true,
        attendanceAlert: true,
        birthdayWish: true,
        enquiryFollowup: true,
        personalizedPlan: true,
        salaryPayslip: true,
        revenueReportToOwner: true
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Automation categories for better UI
    const automationCategories = [
        {
            id: 'subscriptionRenewal',
            name: 'Subscription Renewal',
            description: 'Send automated reminders to members before their membership expires.',
            icon: <Calendar size={20} color="#f97316" />,
            color: '#fff7ed'
        },
        {
            id: 'newRegistration',
            name: 'New Registration',
            description: 'Send a warm welcome message to new members immediately after they join.',
            icon: <UserPlus size={20} color="#0ea5e9" />,
            color: '#f0f9ff'
        },
        {
            id: 'paymentReceipt',
            name: 'Payment Receipt',
            description: 'Automatically send a professional PDF receipt via WhatsApp after any payment.',
            icon: <CreditCard size={20} color="#10b981" />,
            color: '#ecfdf5'
        },
        {
            id: 'attendanceAlert',
            name: 'Attendance Alert',
            description: 'Notify members or staff regarding attendance status and milestones.',
            icon: <Activity size={20} color="#ef4444" />,
            color: '#fef2f2'
        },
        {
            id: 'birthdayWish',
            name: 'Birthday Wishes',
            description: 'Automated personalized birthday greetings to make members feel special.',
            icon: <Cake size={20} color="#d946ef" />,
            color: '#fdf4ff'
        },
        {
            id: 'enquiryFollowup',
            name: 'Enquiry Follow-up',
            description: 'Automatically follow up with potential leads to improve conversion rates.',
            icon: <MessageSquare size={20} color="#6366f1" />,
            color: '#eef2ff'
        },
        {
            id: 'personalizedPlan',
            name: 'Personalized Plans',
            description: 'Send diet and workout plans directly to members via WhatsApp.',
            icon: <FileText size={20} color="#8b5cf6" />,
            color: '#f5f3ff'
        },
        {
            id: 'salaryPayslip',
            name: 'Salary Payslips',
            description: 'Automatically send a PDF payslip to staff when their salary is marked as paid.',
            icon: <FileText size={20} color="#14b8a6" />,
            color: '#f0fdfa'
        },
        {
            id: 'revenueReportToOwner',
            name: 'Revenue Reports',
            description: 'Allow sending end-of-day/monthly revenue reports manually to the gym owner via WhatsApp.',
            icon: <Activity size={20} color="#f43f5e" />,
            color: '#fff1f2'
        }
    ];

    useEffect(() => {
        fetchToggles();
    }, []);

    const fetchToggles = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get(`${backendurl}/automation-toggles`, { withCredentials: true });
            if (response.data.success && response.data.toggles) {
                setToggles(response.data.toggles);
            }
        } catch (error) {
            console.error('Error fetching toggles:', error);
            toast.error('Failed to load automation settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = (id) => {
        setToggles(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const response = await axios.put(`${backendurl}/automation-toggles`, { toggles }, { withCredentials: true });
            if (response.data.success) {
                toast.success('Automation settings saved successfully');
            }
        } catch (error) {
            console.error('Error saving toggles:', error);
            toast.error('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <Loader2 size={48} className="animate-spin" color="#f97316" />
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: '40px' }}>
            {/* Page Title */}
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: 800,
                        color: '#1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '8px'
                    }}>
                        <Zap size={32} color="#f97316" fill="#f97316" />
                        Automation Hub
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1rem' }}>
                        Control all WhatsApp automations from one place. Turn toggles on/off to manage your gym's automated communications.
                    </p>
                </div>
                
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{
                        padding: '12px 24px',
                        background: '#f97316',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 6px -1px rgba(249, 115, 22, 0.2)'
                    }}
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Changes
                </button>
            </div>

            {/* Automation Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '24px'
            }}>
                {automationCategories.map((item) => (
                    <div
                        key={item.id}
                        style={{
                            background: 'white',
                            borderRadius: '20px',
                            padding: '24px',
                            border: '1px solid #e2e8f0',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Status Indicator Bar */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '4px',
                            height: '100%',
                            background: toggles[item.id] ? '#10b981' : '#cbd5e1'
                        }} />

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '12px',
                                    background: item.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {item.icon}
                                </div>
                                
                                {/* Custom Toggle Switch */}
                                <button
                                    onClick={() => handleToggle(item.id)}
                                    style={{
                                        width: '56px',
                                        height: '30px',
                                        borderRadius: '15px',
                                        background: toggles[item.id] ? '#10b981' : '#e2e8f0',
                                        border: 'none',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '3px',
                                        left: toggles[item.id] ? '29px' : '3px',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }} />
                                </button>
                            </div>

                            <h3 style={{
                                fontSize: '1.2rem',
                                fontWeight: 700,
                                color: '#1e293b',
                                marginBottom: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                {item.name}
                                {toggles[item.id] && <CheckCircle2 size={16} color="#10b981" />}
                            </h3>
                            
                            <p style={{
                                fontSize: '0.9rem',
                                color: '#64748b',
                                lineHeight: '1.5',
                                marginBottom: '16px'
                            }}>
                                {item.description}
                            </p>
                        </div>

                        <div style={{
                            paddingTop: '16px',
                            borderTop: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <span style={{
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: toggles[item.id] ? '#059669' : '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                {toggles[item.id] ? 'System Active' : 'System Paused'}
                            </span>
                            
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: toggles[item.id] ? '#10b981' : '#cbd5e1',
                                        opacity: 1 - (i * 0.2)
                                    }} />
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Notice */}
            <div style={{
                marginTop: '40px',
                padding: '24px',
                background: '#f8fafc',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Settings2 size={20} color="#475569" />
                </div>
                <p style={{ fontSize: '0.9rem', color: '#475569', margin: 0 }}>
                    <strong>Note:</strong> These toggles control the backend automation engine. If a toggle is off, the corresponding WhatsApp message will not be sent, even if manually triggered from other pages. Ensure your WhatsApp instance is connected in <strong>WhatsApp Connection</strong> page.
                </p>
            </div>
        </div>
    );
}
