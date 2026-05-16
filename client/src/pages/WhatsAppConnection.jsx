import React, { useState, useEffect } from 'react';
import {
    Wifi,
    WifiOff,
    QrCode,
    Send,
    RefreshCcw,
    Trash2,
    Power,
    CheckCircle2,
    AlertTriangle,
    Phone,
    MessageSquare,
    User,
    Loader2
} from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

import { AppContent } from '../context/context.jsx';
import axios from 'axios';

/**
 * ========================================
 * BACKEND API CONFIGURATION
 * ========================================
 */

/**
 * Helper function to extract phone number from ownerJid
 * ownerJid format: "917358546188@s.whatsapp.net" -> "+91 73585 46188"
 */
const extractPhoneNumber = (ownerJid) => {
    if (!ownerJid) return null;
    const number = ownerJid.split('@')[0];
    if (number.length >= 10) {
        // Format as +XX XXXXX XXXXX (assuming country code + 10 digit number)
        const countryCode = number.slice(0, number.length - 10);
        const part1 = number.slice(-10, -5);
        const part2 = number.slice(-5);
        return `+${countryCode} ${part1} ${part2}`;
    }
    return `+${number}`;
};

/**
 * ========================================
 * MAIN COMPONENT
 * ========================================
 */
export default function WhatsAppConnection() {
    const { backendurl } = React.useContext(AppContent);
    // backendurl contains '/gym' prefix (e.g., http://localhost:5000/gym)
    // WhatsApp routes are mounted at /gym/whatsapp, so we use backendurl directly
    const serverUrl = backendurl;

    // Instance and connection state
    const [instanceName, setInstanceName] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('close'); // 'open' | 'close' | 'connecting'
    const [profileName, setProfileName] = useState(null);
    const [profilePicUrl, setProfilePicUrl] = useState(null);
    const [phoneNumber, setPhoneNumber] = useState(null);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [qrTimer, setQrTimer] = useState(60);
    const [isGeneratingQR, setIsGeneratingQR] = useState(false);
    const [testPhoneNumber, setTestPhoneNumber] = useState('');
    const [testMessage, setTestMessage] = useState('Hello! This is a test message from FitZone Gym Management System.');
    const [isSendingTest, setIsSendingTest] = useState(false);

    // Derived state
    const isConnected = connectionStatus === 'open';
    const isConnecting = connectionStatus === 'connecting';

    /**
     * Fetch dedicated instance for the tenant
     * GET /gym/whatsapp/instance
     */
    const fetchInstances = async () => {
        try {
            const response = await axios.get(`${serverUrl}/whatsapp/instance`, {
                withCredentials: true
            });

            if (response.data.success && response.data.instance) {
                const tenantInstance = response.data.instance;

                // Store instance name for subsequent API calls
                setInstanceName(tenantInstance.name || tenantInstance.instanceName);

                // Extract and set profile data
                setProfileName(tenantInstance.profileName || tenantInstance.name || tenantInstance.instanceName);
                setProfilePicUrl(tenantInstance.profilePicUrl);
                setPhoneNumber(extractPhoneNumber(tenantInstance.ownerJid));

                // Set initial connection status from instance data
                setConnectionStatus(tenantInstance.connectionStatus || 'close');

                return tenantInstance.name || tenantInstance.instanceName;
            } else {
                setError('Failed to fetch WhatsApp instance.');
                return null;
            }
        } catch (err) {
            console.error('Error fetching instance:', err);
            setError(`Failed to fetch instance: ${err.message}`);
            return null;
        }
    };

    /**
     * Check connection status for a specific instance
     * GET /gym/whatsapp/connectionState
     */
    const checkConnectionStatus = async (instName) => {
        if (!instName) return;

        try {
            const response = await axios.get(`${serverUrl}/whatsapp/connectionState`, {
                withCredentials: true
            });

            const data = response.data;

            // Response format: { instance: { state: "open" } }
            if (data && data.instance && data.instance.state) {
                const state = data.instance.state;
                setConnectionStatus(state);

                // Clear error on successful check
                setError(null);
            }
        } catch (err) {
            console.error('Error checking connection status:', err);
            const msg = err.response?.data?.message || err.message;
            if (msg && typeof msg === 'string' && !msg.includes('Not Found')) {
                 setError(`Connection Error: ${msg}`);
            }
        }
    };

    /**
     * Initial data fetch on component mount
     */
    useEffect(() => {
        const initializeData = async () => {
            setIsLoading(true);
            const instName = await fetchInstances();
            if (instName) {
                await checkConnectionStatus(instName);
            }
            setIsLoading(false);
        };

        initializeData();
    }, []);

    /**
     * Poll connection status every 10 seconds
     */
    useEffect(() => {
        if (!instanceName) return;

        const interval = setInterval(() => {
            checkConnectionStatus(instanceName);
        }, 10000);

        return () => clearInterval(interval);
    }, [instanceName]);

    // QR Code Timer countdown
    useEffect(() => {
        if (!isConnected && qrTimer > 0) {
            const timer = setTimeout(() => setQrTimer(qrTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [qrTimer, isConnected]);

    // State for QR Code base64 image
    const [qrCodeBase64, setQrCodeBase64] = useState(null);

    /**
     * Generate QR Code for WhatsApp connection
     * GET /gym/whatsapp/connect
     */
    const handleGenerateQR = async () => {
        if (!instanceName) {
            toast.error('No instance found. Please refresh the page.');
            return;
        }

        setIsGeneratingQR(true);
        setQrTimer(60);
        setQrCodeBase64(null);

        try {
            const response = await axios.get(`${serverUrl}/whatsapp/connect`, {
                withCredentials: true
            });

            const data = response.data;

            // Response format: { base64: "[base64 image data]", code: "...", pairingCode: null, count: 4 }
            if (data && data.base64) {
                setQrCodeBase64(data.base64);
            } else {
                throw new Error('No QR code received from API');
            }
        } catch (err) {
            console.error('Error generating QR code:', err);
            toast.error(`Failed to generate QR code: ${err.message}`);
        } finally {
            setIsGeneratingQR(false);
        }
    };

    // Handle Refresh QR Code (same as generate)
    const handleRefreshQR = () => {
        handleGenerateQR();
    };

    /**
     * Send Test Message
     * POST /gym/whatsapp/sendText
     */
    const handleSendTest = async () => {
        if (!testPhoneNumber) {
            toast.warning('Please enter a phone number');
            return;
        }

        if (!instanceName) {
            toast.error('No instance found. Please refresh the page.');
            return;
        }

        // Clean phone number - remove spaces, dashes, and + symbol
        const cleanNumber = testPhoneNumber.replace(/[\s\-\+]/g, '');

        setIsSendingTest(true);

        try {
            await axios.post(`${serverUrl}/whatsapp/sendText`, {
                number: cleanNumber,
                text: testMessage
            }, {
                withCredentials: true
            });

            toast.success('Test message sent successfully!');
        } catch (err) {
            console.error('Error sending test message:', err);
            toast.error(`Failed to send message: ${err.message}`);
        } finally {
            setIsSendingTest(false);
        }
    };

    /**
     * Restart Instance
     * POST /gym/whatsapp/restart
     */
    const handleRestart = async () => {
        const result = await Swal.fire({
            title: 'Restart WhatsApp?',
            text: 'This will temporarily disconnect the service.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, restart'
        });
        if (!result.isConfirmed) return;

        if (!instanceName) {
            toast.error('No instance found. Please refresh the page.');
            return;
        }

        try {
            await axios.post(`${serverUrl}/whatsapp/restart`, {}, {
                withCredentials: true
            });

            toast.success('Instance restart initiated. Please wait a moment...');

            // Refresh connection status after a short delay
            setTimeout(() => {
                checkConnectionStatus(instanceName);
                fetchInstances();
            }, 3000);
        } catch (err) {
            console.error('Error restarting instance:', err);
            toast.error(`Failed to restart instance: ${err.message}`);
        }
    };

    /**
     * Logout/Delete Instance
     * DELETE /gym/whatsapp/logout
     */
    const handleLogout = async () => {
        const result = await Swal.fire({
            title: 'Disconnect WhatsApp?',
            text: 'This will disconnect WhatsApp and delete the instance. You will need to scan the QR code again.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, disconnect'
        });
        if (!result.isConfirmed) return;

        if (!instanceName) {
            toast.error('No instance found. Please refresh the page.');
            return;
        }

        try {
            await axios.delete(`${serverUrl}/whatsapp/logout`, {
                withCredentials: true
            });

            // Update local state
            setConnectionStatus('close');
            setQrCodeBase64(null);
            setProfilePicUrl(null);
            setPhoneNumber(null);

            toast.success('WhatsApp disconnected successfully');

            // Refresh data after logout
            setTimeout(() => {
                fetchInstances();
            }, 2000);
        } catch (err) {
            console.error('Error logging out:', err);
            toast.error(`Failed to logout: ${err.message}`);
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
        marginBottom: '2rem'
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

    const gridContainerStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
        gap: '2rem',
        marginTop: '2rem'
    };

    const cardStyle = {
        backgroundColor: '#ffffff',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
    };

    const cardHeaderStyle = {
        padding: '1.5rem',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
    };

    const cardBodyStyle = {
        padding: '2rem'
    };

    const sectionTitleStyle = {
        fontSize: '1.125rem',
        fontWeight: 600,
        color: '#334155',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    };

    const buttonStyle = (color = '#4f46e5', bgColor = '#eff6ff', hoverBg = '#dbeafe') => ({
        padding: '0.75rem 1.5rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        color: color,
        backgroundColor: bgColor,
        border: `2px solid ${color}`,
        borderRadius: '0.5rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        width: '100%',
        justifyContent: 'center'
    });

    const inputStyle = {
        width: '100%',
        padding: '0.75rem',
        fontSize: '0.875rem',
        border: '2px solid #e2e8f0',
        borderRadius: '0.5rem',
        outline: 'none',
        transition: 'border-color 0.2s ease',
        fontFamily: 'inherit'
    };

    return (
        <div>
            {/* Header */}
            <header style={headerStyle}>
                <h1 style={titleStyle}>
                    <MessageSquare size={28} color="#25D366" />
                    WhatsApp Connection
                </h1>
                <p style={subtitleStyle}>
                    Connect your WhatsApp number to send automated messages, reminders, and notifications
                </p>
            </header>

            {/* Loading State */}
            {isLoading && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4rem',
                    flexDirection: 'column',
                    gap: '1rem'
                }}>
                    <Loader2 size={48} color="#4f46e5" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#64748b', margin: 0 }}>Loading WhatsApp connection...</p>
                </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
                <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <AlertTriangle size={24} color="#dc2626" />
                    <div>
                        <p style={{ margin: 0, fontWeight: 600, color: '#991b1b' }}>Connection Error</p>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#dc2626', fontSize: '0.875rem' }}>{error}</p>
                    </div>
                </div>
            )}

            {/* Two-Column Grid Layout */}
            {!isLoading && !error && (
                <div style={gridContainerStyle}>
                    {/* ==================== LEFT COLUMN: Connection State ==================== */}
                    <div style={cardStyle}>
                        <div style={{
                            ...cardHeaderStyle,
                            backgroundColor: isConnected ? '#ecfdf5' : '#fef2f2',
                            borderBottom: isConnected ? '1px solid #a7f3d0' : '1px solid #fecaca'
                        }}>
                            <h2 style={sectionTitleStyle}>
                                {isConnected ? (
                                    <>
                                        <Wifi size={20} color="#10b981" />
                                        Connected
                                    </>
                                ) : (
                                    <>
                                        <WifiOff size={20} color="#ef4444" />
                                        Disconnected
                                    </>
                                )}
                            </h2>
                            {isConnected && (
                                <span style={{
                                    padding: '0.25rem 0.75rem',
                                    backgroundColor: '#10b981',
                                    color: '#ffffff',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                }}>
                                    <span style={{
                                        width: '8px',
                                        height: '8px',
                                        backgroundColor: '#ffffff',
                                        borderRadius: '50%',
                                        display: 'inline-block'
                                    }}></span>
                                    Online
                                </span>
                            )}
                        </div>

                        <div style={cardBodyStyle}>
                            {/* SCENARIO A: Disconnected - Show QR Code */}
                            {!isConnected && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                        backgroundColor: '#f1f5f9',
                                        padding: '2rem',
                                        borderRadius: '0.75rem',
                                        marginBottom: '1.5rem'
                                    }}>
                                        {isGeneratingQR ? (
                                            // Loading spinner while generating QR
                                            <div style={{
                                                width: '250px',
                                                height: '250px',
                                                margin: '0 auto',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Loader2 size={60} color="#4f46e5" style={{ animation: 'spin 1s linear infinite' }} />
                                            </div>
                                        ) : qrCodeBase64 ? (
                                            // Display the actual QR code from API
                                            <img
                                                src={qrCodeBase64}
                                                alt="WhatsApp QR Code"
                                                style={{
                                                    width: '250px',
                                                    height: '250px',
                                                    margin: '0 auto',
                                                    display: 'block',
                                                    borderRadius: '0.5rem'
                                                }}
                                            />
                                        ) : (
                                            // Placeholder when no QR code yet
                                            <div style={{
                                                width: '250px',
                                                height: '250px',
                                                margin: '0 auto',
                                                backgroundColor: '#ffffff',
                                                borderRadius: '0.5rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '2px dashed #cbd5e1'
                                            }}>
                                                <QrCode size={80} color="#94a3b8" />
                                            </div>
                                        )}
                                    </div>

                                    {/* QR Timer */}
                                    {!isGeneratingQR && qrTimer < 60 && (
                                        <div style={{
                                            marginBottom: '1rem',
                                            padding: '0.5rem',
                                            backgroundColor: '#fef3c7',
                                            borderRadius: '0.5rem',
                                            color: '#92400e',
                                            fontSize: '0.875rem',
                                            fontWeight: 600
                                        }}>
                                            ⏱️ QR Code expires in {qrTimer}s
                                        </div>
                                    )}

                                    {/* Instructions */}
                                    <div style={{
                                        backgroundColor: '#eff6ff',
                                        padding: '1rem',
                                        borderRadius: '0.5rem',
                                        marginBottom: '1.5rem',
                                        textAlign: 'left'
                                    }}>
                                        <h3 style={{
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#1e40af',
                                            marginBottom: '0.5rem'
                                        }}>
                                            📱 How to Connect:
                                        </h3>
                                        <ol style={{
                                            fontSize: '0.875rem',
                                            color: '#475569',
                                            paddingLeft: '1.25rem',
                                            margin: 0,
                                            lineHeight: 1.6
                                        }}>
                                            <li>Open WhatsApp on your phone</li>
                                            <li>Tap Menu or Settings → Linked Devices</li>
                                            <li>Tap "Link a Device"</li>
                                            <li>Scan the QR code above</li>
                                        </ol>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button
                                            onClick={handleGenerateQR}
                                            disabled={isGeneratingQR}
                                            style={{
                                                ...buttonStyle('#25D366', '#ecfdf5', '#d1fae5'),
                                                opacity: isGeneratingQR ? 0.6 : 1,
                                                cursor: isGeneratingQR ? 'not-allowed' : 'pointer'
                                            }}
                                            onMouseEnter={(e) => !isGeneratingQR && (e.target.style.backgroundColor = '#d1fae5')}
                                            onMouseLeave={(e) => !isGeneratingQR && (e.target.style.backgroundColor = '#ecfdf5')}
                                        >
                                            <QrCode size={18} />
                                            {isGeneratingQR ? 'Generating...' : 'Generate QR Code'}
                                        </button>

                                        <button
                                            onClick={handleRefreshQR}
                                            disabled={isGeneratingQR}
                                            style={{
                                                ...buttonStyle('#6366f1', '#eef2ff', '#e0e7ff'),
                                                opacity: isGeneratingQR ? 0.6 : 1,
                                                cursor: isGeneratingQR ? 'not-allowed' : 'pointer'
                                            }}
                                            onMouseEnter={(e) => !isGeneratingQR && (e.target.style.backgroundColor = '#e0e7ff')}
                                            onMouseLeave={(e) => !isGeneratingQR && (e.target.style.backgroundColor = '#eef2ff')}
                                        >
                                            <RefreshCcw size={18} />
                                            Refresh
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* SCENARIO B: Connected - Show Profile & Device Info */}
                            {isConnected && (
                                <div style={{ textAlign: 'center' }}>
                                    {/* Profile Picture */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        {profilePicUrl ? (
                                            <img
                                                src={profilePicUrl}
                                                alt="Profile"
                                                style={{
                                                    width: '120px',
                                                    height: '120px',
                                                    borderRadius: '50%',
                                                    objectFit: 'cover',
                                                    border: '4px solid #10b981',
                                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '120px',
                                                height: '120px',
                                                borderRadius: '50%',
                                                backgroundColor: '#10b981',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto',
                                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                            }}>
                                                <User size={48} color="#ffffff" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Profile Name & Phone */}
                                    <h3 style={{
                                        fontSize: '1.5rem',
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        marginBottom: '0.25rem'
                                    }}>
                                        {profileName || 'WhatsApp Account'}
                                    </h3>
                                    <p style={{
                                        fontSize: '1rem',
                                        color: '#64748b',
                                        marginBottom: '2rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        <Phone size={16} />
                                        {phoneNumber || 'Phone number not available'}
                                    </p>

                                    {/* Connection Success Badge */}
                                    <div style={{
                                        backgroundColor: '#ecfdf5',
                                        padding: '1rem',
                                        borderRadius: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        border: '1px solid #a7f3d0'
                                    }}>
                                        <CheckCircle2 size={20} color="#10b981" />
                                        <span style={{
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#059669'
                                        }}>
                                            WhatsApp is connected and ready to send messages
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ==================== RIGHT COLUMN: Controls & Utilities ==================== */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* 1. Test Message Widget */}
                        <div style={cardStyle}>
                            <div style={{
                                ...cardHeaderStyle,
                                backgroundColor: '#fef3c7',
                                borderBottom: '1px solid #fde68a'
                            }}>
                                <h2 style={sectionTitleStyle}>
                                    <Send size={20} color="#d97706" />
                                    Send Test Message
                                </h2>
                            </div>
                            <div style={cardBodyStyle}>
                                {isConnected ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {/* Phone Number Input */}
                                        <div>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '0.875rem',
                                                fontWeight: 600,
                                                color: '#334155',
                                                marginBottom: '0.5rem'
                                            }}>
                                                Phone Number (with country code)
                                            </label>
                                            <input
                                                type="tel"
                                                placeholder="+91 98765 43210"
                                                value={testPhoneNumber}
                                                onChange={(e) => setTestPhoneNumber(e.target.value)}
                                                style={inputStyle}
                                                onFocus={(e) => e.target.style.borderColor = '#d97706'}
                                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                            />
                                        </div>

                                        {/* Message Input */}
                                        <div>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '0.875rem',
                                                fontWeight: 600,
                                                color: '#334155',
                                                marginBottom: '0.5rem'
                                            }}>
                                                Test Message
                                            </label>
                                            <textarea
                                                rows="4"
                                                value={testMessage}
                                                onChange={(e) => setTestMessage(e.target.value)}
                                                style={{
                                                    ...inputStyle,
                                                    resize: 'vertical',
                                                    fontFamily: 'inherit'
                                                }}
                                                onFocus={(e) => e.target.style.borderColor = '#d97706'}
                                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                            />
                                        </div>

                                        {/* Send Button */}
                                        <button
                                            onClick={handleSendTest}
                                            disabled={isSendingTest}
                                            style={{
                                                ...buttonStyle('#d97706', '#fef3c7', '#fde68a'),
                                                opacity: isSendingTest ? 0.6 : 1,
                                                cursor: isSendingTest ? 'not-allowed' : 'pointer'
                                            }}
                                            onMouseEnter={(e) => !isSendingTest && (e.target.style.backgroundColor = '#fde68a')}
                                            onMouseLeave={(e) => !isSendingTest && (e.target.style.backgroundColor = '#fef3c7')}
                                        >
                                            {isSendingTest ? (
                                                <>
                                                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Send size={18} />
                                                    Send Test Message
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '2rem',
                                        color: '#94a3b8'
                                    }}>
                                        <AlertTriangle size={40} color="#94a3b8" style={{ marginBottom: '1rem' }} />
                                        <p style={{ margin: 0, fontSize: '0.875rem' }}>
                                            Connect WhatsApp to send test messages
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Instance Management (Danger Zone) */}
                        <div style={cardStyle}>
                            <div style={{
                                ...cardHeaderStyle,
                                backgroundColor: '#fef2f2',
                                borderBottom: '1px solid #fecaca'
                            }}>
                                <h2 style={sectionTitleStyle}>
                                    <AlertTriangle size={20} color="#dc2626" />
                                    Instance Management
                                </h2>
                            </div>
                            <div style={cardBodyStyle}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {/* Restart Button */}
                                    <button
                                        onClick={handleRestart}
                                        disabled={!isConnected}
                                        style={{
                                            ...buttonStyle('#f59e0b', '#fffbeb', '#fef3c7'),
                                            opacity: !isConnected ? 0.5 : 1,
                                            cursor: !isConnected ? 'not-allowed' : 'pointer'
                                        }}
                                        onMouseEnter={(e) => isConnected && (e.target.style.backgroundColor = '#fef3c7')}
                                        onMouseLeave={(e) => isConnected && (e.target.style.backgroundColor = '#fffbeb')}
                                    >
                                        <Power size={18} />
                                        Restart Instance
                                    </button>

                                    {/* Logout/Delete Button */}
                                    <button
                                        onClick={handleLogout}
                                        disabled={!isConnected}
                                        style={{
                                            ...buttonStyle('#dc2626', '#fef2f2', '#fee2e2'),
                                            opacity: !isConnected ? 0.5 : 1,
                                            cursor: !isConnected ? 'not-allowed' : 'pointer'
                                        }}
                                        onMouseEnter={(e) => isConnected && (e.target.style.backgroundColor = '#fee2e2')}
                                        onMouseLeave={(e) => isConnected && (e.target.style.backgroundColor = '#fef2f2')}
                                    >
                                        <Trash2 size={18} />
                                        Logout & Delete Instance
                                    </button>

                                    {/* Warning Message */}
                                    <div style={{
                                        padding: '0.75rem',
                                        backgroundColor: '#fffbeb',
                                        border: '1px solid #fde68a',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.75rem',
                                        color: '#92400e',
                                        lineHeight: 1.5
                                    }}>
                                        ⚠️ <strong>Warning:</strong> Deleting the instance will disconnect WhatsApp and require QR code scanning to reconnect.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Inline Keyframes Animation */}
            <style>
                {`
                    @keyframes pulse {
                        0%, 100% {
                            opacity: 1;
                        }
                        50% {
                            opacity: 0.5;
                        }
                    }
                    @keyframes spin {
                        from {
                            transform: rotate(0deg);
                        }
                        to {
                            transform: rotate(360deg);
                        }
                    }
                `}
            </style>
        </div>
    );
}
