import React from 'react';
import '../styles/dashboard.css';

const EquipmentDetailsModal = ({ isOpen, onClose, equipment, backendurl }) => {
    if (!isOpen || !equipment) return null;

    const getStatusColor = (status) => {
        const colors = {
            available: '#10b981',
            'in-use': '#3b82f6',
            maintenance: '#f59e0b',
            repair: '#ef4444',
            retired: '#6b7280'
        };
        return colors[status] || '#6b7280';
    };

    const getCategoryColor = (category) => {
        const colors = {
            cardio: '#3b82f6',
            strength: '#ef4444',
            'free-weights': '#10b981',
            machines: '#f59e0b',
            accessories: '#8b5cf6',
            functional: '#ec4899'
        };
        return colors[category] || '#6b7280';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString();
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
            zIndex: 10000,
            backdropFilter: 'blur(5px)'
        }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                width: '90%',
                maxWidth: '700px',
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
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{equipment.name}</h2>
                        <div style={{ opacity: 0.8, fontSize: '0.9rem', marginTop: '4px' }}>{equipment.brand} {equipment.model}</div>
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
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
                                <div style={{
                                    marginTop: '4px',
                                    display: 'inline-block',
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    background: `${getCategoryColor(equipment.category)}15`,
                                    color: getCategoryColor(equipment.category),
                                    fontWeight: '600',
                                    fontSize: '0.875rem'
                                }}>
                                    {equipment.category.charAt(0).toUpperCase() + equipment.category.slice(1).replace('-', ' ')}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                                <div style={{
                                    marginTop: '4px',
                                    display: 'inline-block',
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    background: `${getStatusColor(equipment.status || equipment.statuses?.[0])}15`,
                                    color: getStatusColor(equipment.status || equipment.statuses?.[0]),
                                    fontWeight: '600',
                                    fontSize: '0.875rem'
                                }}>
                                    {(equipment.status || equipment.statuses?.[0] || 'available').toUpperCase()}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quantity</label>
                                <div style={{ fontWeight: '600', fontSize: '1.125rem', color: '#111827' }}>{equipment.quantity || equipment.serialNumbers?.length || 1}</div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Purchase Price</label>
                                <div style={{ fontWeight: '600', fontSize: '1.125rem', color: '#10b981' }}>₹{equipment.purchasePrice.toLocaleString()}</div>
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />

                        {/* Equipment Details */}
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Equipment Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Brand:</span>
                                    <div style={{ color: '#111827', fontWeight: '500' }}>{equipment.brand}</div>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Model:</span>
                                    <div style={{ color: '#111827', fontWeight: '500' }}>{equipment.model}</div>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Purchase Date:</span>
                                    <div style={{ color: '#111827', fontWeight: '500' }}>{formatDate(equipment.purchaseDate)}</div>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Total Value:</span>
                                    <div style={{ color: '#111827', fontWeight: '600' }}>₹{(equipment.purchasePrice * (equipment.quantity || 1)).toLocaleString()}</div>
                                </div>
                            </div>
                        </div>

                        {equipment.serialNumbers && equipment.serialNumbers.length > 0 && (
                            <>
                                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>Serial Numbers ({equipment.serialNumbers.length})</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {equipment.serialNumbers.map((serial, index) => (
                                            <div key={index} style={{
                                                padding: '8px 12px',
                                                background: '#f3f4f6',
                                                borderRadius: '6px',
                                                fontSize: '0.875rem',
                                                fontFamily: 'monospace',
                                                color: '#374151',
                                                fontWeight: '500',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}>
                                                <span style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '50%',
                                                    background: `${getStatusColor(equipment.statuses?.[index] || 'available')}20`,
                                                    color: getStatusColor(equipment.statuses?.[index] || 'available'),
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '10px'
                                                }}>
                                                    {index + 1}
                                                </span>
                                                {serial}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0' }} />

                        {/* Maintenance Information */}
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Maintenance Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Last Serviced:</span>
                                    <div style={{ color: '#111827', fontWeight: '500' }}>{formatDate(equipment.lastServiced)}</div>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Next Maintenance:</span>
                                    <div style={{ color: '#111827', fontWeight: '500' }}>{formatDate(equipment.maintenanceNext)}</div>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Maintenance Interval:</span>
                                    <div style={{ color: '#111827', fontWeight: '500' }}>{equipment.maintenanceDays} days</div>
                                </div>
                                <div>
                                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Warranty Expiry:</span>
                                    <div style={{ color: '#111827', fontWeight: '500' }}>{formatDate(equipment.warrantyExpiry)}</div>
                                </div>
                                {equipment.serviceContactNumber && (
                                    <div>
                                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Service Contact:</span>
                                        <div style={{ color: '#fb923c', fontWeight: '600' }}>{equipment.serviceContactNumber}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {equipment.notes && (
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
                                        {equipment.notes}
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

export default EquipmentDetailsModal;
