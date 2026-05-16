import React from 'react';
import '../styles/dashboard.css'; // Shared styles

const PlanDetailsModal = ({ isOpen, onClose, plan, backendurl }) => {
    if (!isOpen || !plan) return null;

    // Helper to get proper image URL (logic adapted from Planslisting.jsx)
    const getImageUrl = (image) => {
        if (!image) return '/api/placeholder/300/200';
        if (image.includes('/api/placeholder/') || image.startsWith('http')) return image;

        // Handle relative paths
        if (image.startsWith('/uploads/')) {
            return `${backendurl.replace(/\/gym$/, '')}${image}`;
        }
        if (image.startsWith('/')) {
            return `${backendurl}${image}`;
        }
        return `${backendurl}/${image}`;
    };

    const formatOfferDate = (val) => {
        if (!val) return 'No offer';
        const parsed = new Date(val);
        if (!isNaN(parsed.getTime()) && /T|\d{4}-\d{2}-\d{2}/.test(val)) {
            return parsed.toLocaleDateString();
        }
        return val;
    };

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
                {/* Header with Orange Gradient */}
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
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{plan.name}</h2>
                        <div style={{ opacity: 0.9, fontSize: '0.9rem', marginTop: '4px' }}>Code: {plan.planCode}</div>
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

                        {/* Top Section: Image and Key Info */}
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <div style={{ flexShrink: 0, width: '200px', height: '140px' }}>
                                <img
                                    src={getImageUrl(plan.image)}
                                    alt={plan.name}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: '12px',
                                        objectFit: 'cover',
                                        border: '1px solid #e5e7eb',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}
                                    onError={(e) => {
                                        e.target.src = '/api/placeholder/300/200';
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                                    <div className={`status-badge ${plan.status?.toLowerCase() || 'inactive'}`} style={{ marginTop: '4px' }}>
                                        {plan.status || 'Inactive'}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</label>
                                    <div style={{ fontWeight: '700', color: '#111827', fontSize: '1.25rem' }}>₹{plan.price}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</label>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{plan.durationDays} Days</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</label>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{plan.type}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Members</label>
                                    <div style={{ fontWeight: '500', color: '#111827' }}>{plan.maxMembers > 0 ? plan.maxMembers : 'Unlimited'}</div>
                                </div>
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />

                        {/* Description & Details */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>Description</h3>
                                <p style={{ color: '#4b5563', lineHeight: '1.5', margin: 0 }}>
                                    {plan.description || "No description provided."}
                                </p>
                            </div>

                            {plan.offerValid && (
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>Valid Offer</h3>
                                    <div style={{ color: '#ea580c', fontWeight: '500' }}>
                                        {formatOfferDate(plan.offerValid)}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Features */}
                        {plan.features && plan.features.length > 0 && (
                            <>
                                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>Features</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {plan.features.map((feature, idx) => (
                                            <span key={idx} style={{
                                                backgroundColor: '#eff6ff',
                                                color: '#1d4ed8',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.875rem',
                                                border: '1px solid #bfdbfe'
                                            }}>
                                                ✓ {feature}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlanDetailsModal;
