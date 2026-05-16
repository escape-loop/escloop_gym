import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/dashboard.css'; // Assuming we might want to share some styles or add new ones

const MemberDetailsModal = ({ isOpen, onClose, member, backendurl }) => {
    const [joinDate, setJoinDate] = useState(null);

    // Calculate Age helper
    const calculateAge = (dob) => {
        if (!dob) return null;
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    // Fetch subscriptions to find Join Date
    useEffect(() => {
        const fetchJoinDate = async () => {
            if (isOpen && member && member._id) {
                try {
                    const res = await axios.get(`${backendurl}/subscriptions/member/${member._id}`, { withCredentials: true });
                    if (res.data.success && res.data.subscriptions && res.data.subscriptions.length > 0) {
                        // Find earliest start date
                        const earliest = res.data.subscriptions.reduce((min, sub) => {
                            const date = new Date(sub.startDate);
                            return date < min ? date : min;
                        }, new Date()); // Default to now if something fails, but logically should be first sub

                        // Or more accurately:
                        const dates = res.data.subscriptions.map(s => new Date(s.startDate));
                        const minDate = new Date(Math.min.apply(null, dates));
                        setJoinDate(minDate);
                    } else {
                        // Fallback to member creation date if no subs
                        setJoinDate(member.createdAt ? new Date(member.createdAt) : null);
                    }
                } catch (err) {
                    console.error("Error fetching subscriptions for join date:", err);
                    setJoinDate(member.createdAt ? new Date(member.createdAt) : null);
                }
            }
        };
        fetchJoinDate();
    }, [isOpen, member, backendurl]);

    if (!isOpen || !member) return null;

    // Helper to construct full URL for images/files
    const getFullUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http') || path.startsWith('blob:')) return path;

        const baseUrl = backendurl.replace(/\/gym$/, '');
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${cleanPath}`;
    };

    const isImage = (path) => {
        if (!path) return false;
        const lower = path.toLowerCase();
        return lower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/) || lower.startsWith('data:image');
    };

    const age = calculateAge(member.dob);

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
        }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                width: '90%',
                maxWidth: '800px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                position: 'relative',
                padding: '0'
            }}>
                {/* Header with gradient background */}
                <div className="modal-header" style={{
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: 'white',
                    padding: '24px',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{member.fullName}</h2>
                        <div style={{ opacity: 0.8, fontSize: '0.9rem', marginTop: '4px' }}>Member ID: #{member.memberId}</div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: 'white',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseOut={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
                    >
                        ✕
                    </button>
                </div>

                <div className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Top Section: Photo and Key Info */}
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ flexShrink: 0 }}>
                                <img
                                    src={getFullUrl(member.profilePhoto) || `https://api.dicebear.com/7.x/initials/svg?seed=${member.fullName}&backgroundColor=f97316`}
                                    alt={member.fullName}
                                    style={{
                                        width: '120px',
                                        height: '120px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '4px solid #f3f4f6',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}
                                    onError={(e) => {
                                        if (!e.target.src.includes('dicebear')) {
                                            e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${member.fullName}&backgroundColor=f97316`;
                                        }
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                                    <div className={`status-badge ${member.status?.toLowerCase() || 'unknown'}`} style={{ marginTop: '4px' }}>
                                        {member.status || 'Unknown'}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</label>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{member.phone}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan</label>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{member.membershipType} - {member.packageName}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expires</label>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{new Date(member.endDate).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</label>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{joinDate ? joinDate.toLocaleDateString() : '...'}</div>
                                </div>
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />

                        {/* Detailed Info Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Personal Information</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Email:</span>
                                        <div style={{ color: '#111827' }}>{member.email || '-'}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '24px' }}>
                                        <div>
                                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>DOB:</span>
                                            <div style={{ color: '#111827' }}>{member.dob ? new Date(member.dob).toLocaleDateString() : '-'}</div>
                                        </div>
                                        <div>
                                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Age:</span>
                                            <div style={{ color: '#111827' }}>{age !== null ? `${age} yrs` : '-'}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Gender:</span>
                                        <div style={{ color: '#111827' }}>{member.gender || '-'}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Address:</span>
                                        <div style={{ color: '#111827' }}>{member.address || '-'}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Area:</span>
                                        <div style={{ color: '#111827' }}>{member.area || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Emergency Contact</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Name:</span>
                                        <div style={{ color: '#111827' }}>{member.emergencyName || '-'}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Phone:</span>
                                        <div style={{ color: '#111827' }}>{member.emergencyPhone || '-'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />

                        {/* Medical Records Section */}
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Medical Records</h3>

                            {(!member.medicalReports || (Array.isArray(member.medicalReports) && member.medicalReports.length === 0)) && !member.medicalConditions && !member.injuryHistory && !member.doctorRestrictions ? (
                                <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No medical records available.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {(member.medicalConditions || member.injuryHistory || member.doctorRestrictions) && (
                                        <div style={{ background: '#fff7ed', padding: '12px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                                            {member.medicalConditions && <div style={{ marginBottom: '8px' }}><strong>Conditions:</strong> {member.medicalConditions}</div>}
                                            {member.injuryHistory && <div style={{ marginBottom: '8px' }}><strong>History:</strong> {member.injuryHistory}</div>}
                                            {member.doctorRestrictions && <div><strong>Doctor Restrictions:</strong> {member.doctorRestrictions}</div>}
                                        </div>
                                    )}

                                    {(() => {
                                        const reports = Array.isArray(member.medicalReports)
                                            ? member.medicalReports
                                            : (member.medicalReports ? [member.medicalReports] : []);

                                        const validReports = reports.filter(r => r && typeof r === 'string' && r.trim() !== '');

                                        if (validReports.length > 0) {
                                            return (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                                    {validReports.map((report, idx) => {
                                                        const url = getFullUrl(report);
                                                        const isImg = isImage(report);

                                                        return (
                                                            <a
                                                                key={idx}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    textDecoration: 'none',
                                                                    display: 'block'
                                                                }}
                                                            >
                                                                <div style={{
                                                                    border: '1px solid #e5e7eb',
                                                                    borderRadius: '8px',
                                                                    overflow: 'hidden',
                                                                    width: '100px',
                                                                    height: '100px',
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    background: '#f9fafb',
                                                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                                                }}
                                                                    onMouseOver={e => {
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                                                                    }}
                                                                    onMouseOut={e => {
                                                                        e.currentTarget.style.transform = 'none';
                                                                        e.currentTarget.style.boxShadow = 'none';
                                                                    }}
                                                                >
                                                                    {isImg ? (
                                                                        <img src={url} alt="Medical Report" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    ) : (
                                                                        <>
                                                                            <span style={{ fontSize: '24px' }}>📄</span>
                                                                            <span style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>Document</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default MemberDetailsModal;
