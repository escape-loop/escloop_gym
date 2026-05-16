import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AppContent } from '../context/context.jsx';
import { Loader2, CheckCircle, XCircle, Phone } from 'lucide-react';

export default function PublicAttendance() {
    const { backendurl } = useContext(AppContent);
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '', gymName: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!phone || phone.length < 10) {
            setStatus({ type: 'error', message: 'Please enter a valid 10-digit mobile number' });
            return;
        }

        setLoading(true);
        setStatus({ type: '', message: '' });

        // Helper to get location
        const getLocation = () => {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation not supported'));
                } else {
                    navigator.geolocation.getCurrentPosition(resolve, reject);
                }
            });
        };

        try {
            let locationData = { lat: null, lon: null };
            try {
                const pos = await getLocation();
                locationData = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            } catch (locErr) {
                console.warn("Location access failed:", locErr);
                // We'll proceed, but backend might reject if geofencing is enabled
            }

            // Get gymId from URL
            const urlParams = new URLSearchParams(window.location.search);
            const gymId = urlParams.get('gym') || urlParams.get('gymId');

            const response = await axios.post(`${backendurl}/public-check`, {
                attendanceId: phone, // changed from phoneNo to match backend expectations
                type: 'member', // Default to member for public scans
                lat: locationData.lat,
                lon: locationData.lon,
                gymId: gymId
            });

            if (response.data.success) {
                setStatus({ 
                    type: 'success', 
                    message: `Attendance marked successfully for ${response.data.person.fullName || 'Member'}`,
                    gymName: response.data.gymName 
                });
                setPhone('');
            } else if (response.data.existing) {
                setStatus({ type: 'info', message: 'Attendance already marked for today' });
            } else {
                setStatus({ type: 'error', message: response.data.message || 'Failed to mark attendance' });
            }
        } catch (error) {
            console.error("Attendance Error:", error);
            setStatus({
                type: 'error',
                message: error.response?.data?.message || 'Member not found or membership expired'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
            padding: '20px',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                padding: '32px',
                textAlign: 'center'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    background: '#f9731615',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px'
                }}>
                    <CheckCircle size={32} color="#f97316" />
                </div>

                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                    Gym Attendance
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '32px' }}>
                    Scan & Mark your attendance instantly
                </p>

                {status.message && (
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '24px',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        textAlign: 'left',
                        backgroundColor: status.type === 'success' ? '#ecfdf5' : status.type === 'info' ? '#eff6ff' : '#fef2f2',
                        color: status.type === 'success' ? '#059669' : status.type === 'info' ? '#2563eb' : '#dc2626',
                        border: `1px solid ${status.type === 'success' ? '#10b98130' : status.type === 'info' ? '#3b82f630' : '#ef444430'}`
                    }}>
                        {status.type === 'success' ? <CheckCircle size={18} /> : status.type === 'error' ? <XCircle size={18} /> : null}
                        {status.message}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                            Mobile Number
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                <Phone size={18} />
                            </div>
                            <input
                                type="tel"
                                placeholder="Enter 10 digit number"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 40px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#fb923c'}
                                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: '#f97316',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'background 0.2s'
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Mark Attendance'}
                    </button>
                </form>

                <div style={{ marginTop: '40px', fontSize: '0.75rem', color: '#94a3b8' }}>
                    © {new Date().getFullYear()} {status.gymName || "Gym Name"}
                </div>
            </div>
        </div>
    );
}
