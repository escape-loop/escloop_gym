import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/dashboard.css';

const StaffDetailsModal = ({ isOpen, onClose, staff: initialStaff, backendurl }) => {
    const [staff, setStaff] = useState(initialStaff);
    const [assignedMembersList, setAssignedMembersList] = useState([]);
    const [loadingAssigned, setLoadingAssigned] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Sync initialStaff to state when modal opens
    useEffect(() => {
        setStaff(initialStaff);
        setAssignedMembersList([]);
    }, [initialStaff, isOpen]);

    // Fetch full staff details (for sensitive fields) and assigned members
    useEffect(() => {
        const fetchDetails = async () => {
            if (isOpen && initialStaff && initialStaff._id) {
                setLoadingDetails(true);
                try {
                    // Fetch full staff details to get sensitive fields (PAN, Bank, etc.)
                    // expected endpoint: /api/staff/:id
                    const detailRes = await axios.get(`${backendurl}/staff/${initialStaff._id}`, { withCredentials: true });
                    if (detailRes.data.success) {
                        setStaff(prev => ({ ...prev, ...detailRes.data.staff }));
                    }
                } catch (err) {
                    console.error("Error fetching staff details:", err);
                } finally {
                    setLoadingDetails(false);
                }

                // Fetch assigned members if Trainer
                if (initialStaff.role === 'Trainer') {
                    setLoadingAssigned(true);
                    try {
                        const res = await axios.get(`${backendurl}/staff/${initialStaff._id}/assigned-members`, { withCredentials: true });
                        if (res.data.success) {
                            setAssignedMembersList(res.data.members || []);
                        }
                    } catch (err) {
                        console.error("Error fetching assigned members:", err);
                    } finally {
                        setLoadingAssigned(false);
                    }
                }
            }
        };

        fetchDetails();
    }, [isOpen, initialStaff, backendurl]);


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

    if (!isOpen || !staff) return null;

    // Fix: use joinDate (from backend model) instead of dateOfJoining
    const joinDate = staff.joinDate ? new Date(staff.joinDate) : (staff.dateOfJoining ? new Date(staff.dateOfJoining) : null);
    const dob = staff.dob ? new Date(staff.dob) : null;

    // Helper to calculate age from DOB
    const calculateAge = (dobDate) => {
        if (!dobDate) return null;
        const diffValid = Date.now() - dobDate.getTime();
        const ageDate = new Date(diffValid);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    const age = calculateAge(dob);

    const getAssignedBatchesDisplay = () => {
        if (!staff.assignedBatches) return '-';
        if (Array.isArray(staff.assignedBatches)) {
            // Flatten and clean up logic
            return staff.assignedBatches.map(b => b.replace ? b.replace(/[\[\]"]/g, '') : b).join(', ');
        }
        return staff.assignedBatches;
    };

    const getWorkDaysDisplay = () => {
        if (!staff.workDays) return '-';
        if (Array.isArray(staff.workDays)) {
            return staff.workDays.join(', ');
        }
        return staff.workDays;
    }

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
                overflowX: 'hidden',
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
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{staff.firstName} {staff.lastName}</h2>
                        <div style={{ opacity: 0.8, fontSize: '0.9rem', marginTop: '4px' }}>Staff ID: #{staff.staffId || staff._id?.slice(-6).toUpperCase()}</div>
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
                                    src={getFullUrl(staff.profilePhoto) || `https://via.placeholder.com/150x150/e5e7eb/9ca3af?text=${staff.firstName?.charAt(0) || 'U'}`}
                                    alt={staff.firstName}
                                    style={{
                                        width: '120px',
                                        height: '120px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '5px solid #fff7ed',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}
                                    onError={(e) => {
                                        e.target.src = `https://via.placeholder.com/150x150/e5e7eb/9ca3af?text=${staff.firstName?.charAt(0) || 'U'}`;
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                                    <div className={`status-badge ${staff.status?.toLowerCase() || 'active'}`} style={{ marginTop: '4px' }}>
                                        {staff.status || 'Active'}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</label>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{staff.phone}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</label>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{staff.role}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</label>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{staff.department || '-'}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</label>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{joinDate ? joinDate.toLocaleDateString() : '-'}</div>
                                </div>
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />

                        {/* Detailed Info Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Identity & Financial</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', gap: '24px' }}>
                                        <div>
                                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>DOB:</span>
                                            <div style={{ color: '#111827' }}>{dob ? dob.toLocaleDateString() : '-'}</div>
                                        </div>
                                        <div>
                                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Age:</span>
                                            <div style={{ color: '#111827' }}>{age !== null ? `${age} yrs` : '-'}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Email:</span>
                                        <div style={{ color: '#111827' }}>{staff.email || '-'}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Gender:</span>
                                        <div style={{ color: '#111827' }}>{staff.gender || '-'}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Address:</span>
                                        <div style={{ color: '#111827' }}>{staff.address || '-'}</div>
                                    </div>

                                    <hr style={{ border: 'none', borderTop: '1px dashed #e5e7eb', margin: '8px 0' }} />

                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Salary:</span>
                                        <div style={{ color: '#111827', fontWeight: '600' }}>₹{staff.salary ? staff.salary.toLocaleString() : '-'}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Account No:</span>
                                        {/* Show simple loading indicator if detailed data is text fetching */}
                                        <div style={{ color: '#111827' }}>{loadingDetails && !staff.bankAccount ? 'Loading...' : (staff.bankAccount || '-')}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>IFSC Code:</span>
                                        <div style={{ color: '#111827' }}>{staff.ifsc || '-'}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '24px' }}>
                                        <div>
                                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>PAN:</span>
                                            <div style={{ color: '#111827' }}>{loadingDetails && !staff.panNumber ? 'Loading...' : (staff.panNumber || '-')}</div>
                                        </div>
                                        <div>
                                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Aadhaar:</span>
                                            <div style={{ color: '#111827' }}>{loadingDetails && !staff.aadhaarNumber ? 'Loading...' : (staff.aadhaarNumber || '-')}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Work & Qualifications</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Shift Type:</span>
                                        <div style={{ color: '#111827' }}>{staff.shiftType || '-'}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Work Days:</span>
                                        <div style={{ color: '#111827', wordBreak: 'break-word', whiteSpace: 'normal' }}>{getWorkDaysDisplay()}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Work Hours:</span>
                                        <div style={{ color: '#111827' }}>{staff.workHoursStart || '?'} to {staff.workHoursEnd || '?'}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Probation:</span>
                                        <div style={{ color: '#111827' }}>
                                            {staff.probationPeriod ? `Ends: ${new Date(staff.probationEndDate).toLocaleDateString()}` : 'No'}
                                        </div>
                                    </div>

                                    <hr style={{ border: 'none', borderTop: '1px dashed #e5e7eb', margin: '8px 0' }} />

                                    {/* Certifications & Skills */}
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Qualifications:</span>
                                        <div style={{ color: '#111827' }}>{staff.qualifications || '-'}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Specializations:</span>
                                        <div style={{ color: '#111827' }}>{staff.specializations || '-'}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Certifications:</span>
                                        <div style={{ color: '#111827' }}>{staff.certifications || '-'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Trainer Specific Section: Assignments */}
                        {staff.role === 'Trainer' && (
                            <>
                                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Gym Assignment</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                                        <div>
                                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Assigned Batches:</span>
                                            <div style={{ color: '#111827', marginTop: '4px' }}>{getAssignedBatchesDisplay()}</div>
                                        </div>
                                        <div>
                                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Assigned Members ({assignedMembersList.length}):</span>
                                            <div style={{ marginTop: '8px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px' }}>
                                                {loadingAssigned ? (
                                                    <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading...</div>
                                                ) : assignedMembersList.length === 0 ? (
                                                    <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No members assigned.</div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {assignedMembersList.map(m => (
                                                            <div key={m._id || m.memberId} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
                                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f3f4f6', overflow: 'hidden' }}>
                                                                    <img
                                                                        src={getFullUrl(m.profilePhoto)}
                                                                        alt={m.firstName}
                                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                        onError={(e) => e.target.style.display = 'none'}
                                                                    />
                                                                </div>
                                                                <span>{m.firstName} {m.lastName}</span>
                                                                <span className={`status-badge small ${m.status?.toLowerCase()}`} style={{ fontSize: '10px', padding: '1px 4px' }}>{m.status}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />

                        {/* Documents Section (Gallery) */}
                        {(Array.isArray(staff.certificates) && staff.certificates.length > 0) && (
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Uploaded Documents</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                                    {staff.certificates.map((cert, idx) => {
                                        const url = getFullUrl(cert);
                                        const isImg = isImage(cert);

                                        return (
                                            <a
                                                key={idx}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ textDecoration: 'none' }}
                                            >
                                                <div style={{
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '8px',
                                                    overflow: 'hidden',
                                                    width: '100px',
                                                    height: '100px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: '#f9fafb',
                                                    flexDirection: 'column',
                                                    transition: 'transform 0.2s',
                                                    cursor: 'pointer'
                                                }}
                                                    onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                    onMouseOut={e => e.currentTarget.style.transform = 'none'}
                                                >
                                                    {isImg ? (
                                                        <img src={url} alt={`Certificate ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <>
                                                            <span style={{ fontSize: '24px' }}>📄</span>
                                                            <span style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>Doc</span>
                                                        </>
                                                    )}
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffDetailsModal;
