import React from 'react';
import '../styles/dashboard.css';

const LeadDetailsModal = ({ isOpen, onClose, lead, backendurl }) => {
    if (!isOpen || !lead) return null;

    const getStatusColor = (status) => {
        const colors = {
            new: '#3b82f6',
            contacted: '#10b981',
            follow_up: '#f59e0b',
            converted: '#22c55e',
            lost: '#ef4444'
        };
        return colors[status] || '#6b7280';
    };

    const getSourceColor = (source) => {
        const colors = {
            website: '#3b82f6',
            referral: '#10b981',
            social_media: '#f59e0b',
            walk_in: '#8b5cf6',
            event: '#ec4899'
        };
        return colors[source] || '#6b7280';
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
                {/* Header with gradient background */}
                <div className="modal-header" style={{
                    background: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
                    color: 'white',
                    padding: '24px',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{lead.name}</h2>
                        <div style={{ opacity: 0.8, fontSize: '0.9rem', marginTop: '4px' }}>Lead ID: #{lead.leadId}</div>
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

                        {/* Top Section: Key Info */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                                <div style={{
                                    marginTop: '4px',
                                    display: 'inline-block',
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    background: `${getStatusColor(lead.status)}15`,
                                    color: getStatusColor(lead.status),
                                    fontWeight: '600',
                                    fontSize: '0.875rem'
                                }}>
                                    {lead.status.toUpperCase()}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</label>
                                <div style={{ fontWeight: '500', color: '#111827' }}>{lead.phone}</div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</label>
                                <div style={{
                                    marginTop: '4px',
                                    display: 'inline-block',
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    background: `${getSourceColor(lead.source)}15`,
                                    color: getSourceColor(lead.source),
                                    fontWeight: '600',
                                    fontSize: '0.875rem'
                                }}>
                                    {lead.source.toUpperCase().replace('_', ' ')}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interest Level</label>
                                <div style={{
                                    marginTop: '4px',
                                    fontWeight: '600',
                                    color: lead.interestLevel === 'high' ? '#22c55e' : lead.interestLevel === 'medium' ? '#f59e0b' : '#ef4444'
                                }}>
                                    {lead.interestLevel.toUpperCase()}
                                </div>
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />

                        {/* Contact Information */}
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Contact Information</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Email:</span>
                                    <div style={{ color: '#111827' }}>{lead.email || '-'}</div>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Location:</span>
                                    <div style={{ color: '#111827' }}>{lead.location || '-'}</div>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Interested Service:</span>
                                    <div style={{ color: '#111827' }}>{lead.interestedService || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />

                        {/* Follow-up Information */}
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Follow-up Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Last Contacted:</span>
                                    <div style={{ color: '#111827' }}>
                                        {lead.lastContactedDate ? new Date(lead.lastContactedDate).toLocaleDateString() : '-'}
                                    </div>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Next Follow-up:</span>
                                    <div style={{ color: '#111827' }}>
                                        {lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toLocaleDateString() : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {lead.additionalInformation && (
                            <>
                                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>Additional Information</h3>
                                    <div style={{
                                        background: '#fff7ed',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        borderLeft: '3px solid #fb923c',
                                        color: '#374151',
                                        fontSize: '0.875rem',
                                        lineHeight: '1.5'
                                    }}>
                                        {lead.additionalInformation}
                                    </div>
                                </div>
                            </>
                        )}

                        {lead.notes && (
                            <>
                                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>Notes</h3>
                                    <div style={{
                                        background: '#f9fafb',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        borderLeft: '3px solid #fb923c',
                                        color: '#374151',
                                        fontSize: '0.875rem',
                                        lineHeight: '1.5'
                                    }}>
                                        {lead.notes}
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

export default LeadDetailsModal;
