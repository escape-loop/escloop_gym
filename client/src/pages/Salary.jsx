// pages/SalaryReport.jsx
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import ToggleButton from '../components/ToggleButton.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { Search, RotateCcw, Filter, MapPin, Phone, CreditCard, Calendar, User, Briefcase, IndianRupee, Download, CheckCircle, Clock } from 'lucide-react';
import '../styles/dashboard.css';
import '../styles/toggle-button.css';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

export default function SalaryReport() {
  const { isauthenticated, getuserdata, sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    month: (() => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0'); })(), // YYYY-MM
    role: 'all',
    status: 'all',
    search: ''
  });

  const [staffData, setStaffData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchSalaryData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/gym/attendance/staff/salary-details?month=${filters.month}`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setStaffData(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch salary data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isauthenticated) {
      navigate("/");
      return;
    }
    getuserdata();
  }, [isauthenticated, navigate]);

  useEffect(() => {
    if (isauthenticated) {
      fetchSalaryData();
    }
  }, [filters.month, isauthenticated]);

  const handleMarkPaid = async (staff) => {
    const result = await Swal.fire({
      title: 'Mark Salary as Paid?',
      text: `Confirm payment for ${staff.fullName}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#f97316',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, mark paid'
    });
    if (!result.isConfirmed) return;

    setProcessingId(staff.staffId);
    try {
      const response = await fetch('/gym/attendance/staff/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          staffId: staff.staffId,
          month: filters.month,
          baseSalary: staff.salary,
          finalAmount: staff.salary, // You can add dynamic adjustment logic here if needed
          presentDays: staff.presentDays,
          absentDays: staff.absentDays,
          totalWorkingDays: staff.totalWorkingDays,
          paymentMode: 'Cash'
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Payment marked successfully!');
        fetchSalaryData();
      }
    } catch (error) {
      console.error("Failed to mark paid:", error);
      toast.error('Failed to mark payment. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownloadPayslip = async (paymentRecordId) => {
    if (!paymentRecordId) {
      toast.warning('Please mark as paid first to generate a payslip.');
      return;
    }
    window.open(`/gym/attendance/staff/payslip/${paymentRecordId}`, '_blank');
  };

  const filteredStaff = staffData.filter(staff => {
    const matchesRole = filters.role === 'all' ||
      (staff.role && staff.role.toLowerCase() === filters.role.toLowerCase());
    const matchesSearch = !filters.search ||
      staff.fullName.toLowerCase().includes(filters.search.toLowerCase()) ||
      staff.staffId.toLowerCase().includes(filters.search.toLowerCase()) ||
      staff.phone.includes(filters.search);

    return matchesRole && matchesSearch;
  });

  const handleCardClick = (staff) => {
    setSelectedStaff(staff);
    setShowModal(true);
  };

  return (
    <>
      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-header-left">
            <div className="dash-breadcrumb">
              Dashboard / Salary Report
            </div>
          </div>
          <div className="dash-header-right">
          </div>
        </header>

        <div className="dash-content">
          <div className="salary-report">

            {/* Filters */}
            <div className="listing-filters" style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '24px',
              flexWrap: 'wrap',
              alignItems: 'center',
              padding: '20px',
              backgroundColor: 'white',
              borderRadius: '12px',
              margin: '0 20px 20px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>By Month</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="month"
                    value={filters.month}
                    onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                    style={{
                      padding: '8px 12px 8px 34px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#374151',
                      outline: 'none',
                      height: '40px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>By Role</label>
                <div style={{ position: 'relative' }}>
                  <Briefcase size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <select
                    value={filters.role}
                    onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                    style={{
                      padding: '8px 12px 8px 34px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#374151',
                      outline: 'none',
                      minWidth: '180px',
                      height: '40px',
                      appearance: 'none'
                    }}
                  >
                    <option value="all">All Roles</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Trainer">Trainer</option>
                    <option value="Manager">Manager</option>
                    <option value="Cleaner">Cleaner</option>
                    <option value="Admin">Admin</option>
                    <option value="Security">Security</option>
                    <option value="Nutritionist">Nutritionist</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '200px' }}>
                <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Search Employment</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="text"
                    placeholder="Search by name, ID or phone..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    style={{
                      padding: '8px 12px 8px 34px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#374151',
                      outline: 'none',
                      width: '100%',
                      height: '40px'
                    }}
                  />
                </div>
              </div>


            </div>

            {/* Card View Section */}
            <div style={{ padding: '0 20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                  Staff Salary Report ({filteredStaff.length})
                </h3>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '100px', color: '#6b7280' }}>
                  <div className="spinner" style={{ marginBottom: '10px' }}></div>
                  Loading staff details...
                </div>
              ) : filteredStaff.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '100px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                  <User size={48} style={{ color: '#d1d5db', marginBottom: '16px' }} />
                  <p style={{ color: '#6b7280', fontSize: '16px' }}>No staff found matching your criteria</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                  gap: '24px',
                  paddingBottom: '40px'
                }}>
                  {filteredStaff.map((staff) => (
                    <div key={staff.staffId} style={{
                      backgroundColor: 'white',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                      position: 'relative',
                      border: '1px solid #f3f4f6',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      cursor: 'pointer'
                    }}
                      onClick={() => handleCardClick(staff)}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
                      }}
                    >
                      {/* Status Badge */}
                      <div style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: staff.paymentStatus === 'Paid' ? '#ecfdf5' : (staff.paymentStatus === 'Processing' ? '#f3f4f6' : '#fff7ed'),
                        color: staff.paymentStatus === 'Paid' ? '#059669' : (staff.paymentStatus === 'Processing' ? '#6b7280' : '#d97706'),
                        border: `1px solid ${staff.paymentStatus === 'Paid' ? '#10b981' : (staff.paymentStatus === 'Processing' ? '#d1d5db' : '#fbbf24')}20`
                      }}>
                        {staff.paymentStatus === 'Paid' ? <CheckCircle size={14} /> : <Clock size={14} />}
                        {staff.paymentStatus}
                      </div>

                      {/* Header: Photo & Name */}
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                        <img
                          src={staff.profilePhoto ? `${staff.profilePhoto.startsWith('/') ? '' : '/'}${staff.profilePhoto}` : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                          alt={staff.fullName}
                          style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #f3f4f6' }}
                          onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>{staff.fullName}</h4>
                          <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>ID: {staff.staffId}</span>
                        </div>
                      </div>

                      {/* Role & Dept Info */}
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: '600' }}>
                          {staff.role}
                        </span>
                        <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', backgroundColor: '#f3f4f6', color: '#4b5563', fontWeight: '600' }}>
                          {staff.department}
                        </span>
                      </div>

                      {/* Details Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                        padding: '16px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '12px',
                        marginBottom: '20px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700' }}>Phone No</span>
                          <span style={{ fontSize: '13px', color: '#374151', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} color="#9ca3af" /> {staff.phone}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700' }}>Salary</span>
                          <span style={{ fontSize: '15px', color: '#111827', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <IndianRupee size={14} /> {staff.salary?.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700' }}>Present / Total</span>
                          <span style={{ fontSize: '13px', color: '#374151', fontWeight: '600' }}>
                            <span style={{ color: '#059669' }}>{staff.presentDays}</span> / <span style={{ color: '#4b5563' }}>{staff.totalWorkingDays}</span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700' }}>Absent</span>
                          <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: '700' }}>{staff.absentDays} Days</span>
                        </div>
                      </div>

                      {/* Actions */}
                      {staff.isActionable ? (
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMarkPaid(staff); }}
                            disabled={staff.paymentStatus === 'Paid' || processingId === staff.staffId}
                            style={{
                              flex: 1,
                              padding: '10px',
                              borderRadius: '10px',
                              backgroundColor: staff.paymentStatus === 'Paid' ? '#f3f4f6' : '#f97316',
                              color: staff.paymentStatus === 'Paid' ? '#9ca3af' : 'white',
                              border: 'none',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: staff.paymentStatus === 'Paid' ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              transition: 'background 0.2s'
                            }}
                            onMouseOver={(e) => { if (staff.paymentStatus !== 'Paid') e.target.style.background = '#ea580c' }}
                            onMouseOut={(e) => { if (staff.paymentStatus !== 'Paid') e.target.style.background = '#f97316' }}
                          >
                            <CreditCard size={18} />
                            {staff.paymentStatus === 'Paid' ? 'Paid' : 'Mark as Paid'}
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownloadPayslip(staff.paymentRecordId); }}
                            disabled={staff.paymentStatus !== 'Paid'}
                            style={{
                              padding: '10px',
                              borderRadius: '10px',
                              backgroundColor: staff.paymentStatus === 'Paid' ? 'white' : '#f9fafb',
                              color: staff.paymentStatus === 'Paid' ? '#4b5563' : '#9ca3af',
                              border: '1px solid #e5e7eb',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: staff.paymentStatus === 'Paid' ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              minWidth: '120px'
                            }}
                            onMouseOver={(e) => { if (staff.paymentStatus === 'Paid') e.target.style.background = '#f9fafb' }}
                            onMouseOut={(e) => { if (staff.paymentStatus === 'Paid') e.target.style.background = 'white' }}
                          >
                            <Download size={18} />
                            Payslip
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          padding: '12px',
                          borderRadius: '10px',
                          backgroundColor: '#f8fafc',
                          border: '1px dashed #e2e8f0',
                          textAlign: 'center',
                          color: '#64748b',
                          fontSize: '13px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}>
                          <Clock size={16} />
                          Salary processing (Month active)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showModal && selectedStaff && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '90vh',
            overflowY: 'auto', padding: '0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', position: 'relative'
          }} onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <img
                src={selectedStaff.profilePhoto ? `${selectedStaff.profilePhoto.startsWith('/') ? '' : '/'}${selectedStaff.profilePhoto}` : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                alt={selectedStaff.fullName}
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f3f4f6' }}
                onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; }}
              />
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: '700', color: '#111827' }}>{selectedStaff.fullName}</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>ID: {selectedStaff.staffId}</span>
                  <span style={{ height: '4px', width: '4px', borderRadius: '50%', backgroundColor: '#d1d5db' }}></span>
                  <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: '600' }}>{selectedStaff.role}</span>
                  <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f3f4f6', color: '#4b5563', fontWeight: '600' }}>{selectedStaff.department}</span>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <RotateCcw size={20} style={{ transform: 'rotate(45deg)' }} /> {/* Close icon using rotated Refresh */}
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              {/* Stats Grid */}
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>Monthly Overview</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Total Working Days</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>{selectedStaff.totalWorkingDays}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>In selected month</div>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Working Days/Week</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>{selectedStaff.workDaysInWeek}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>Scheduled</div>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '12px', border: '1px solid #d1fae5' }}>
                  <div style={{ fontSize: '12px', color: '#065f46', marginBottom: '8px' }}>Present</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669' }}>{selectedStaff.presentDays}</div>
                  <div style={{ fontSize: '11px', color: '#10b981' }}>Days</div>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                  <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '8px' }}>Absent</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#dc2626' }}>{selectedStaff.absentDays}</div>
                  <div style={{ fontSize: '11px', color: '#f87171' }}>Days</div>
                </div>
              </div>

              {/* Absent Details */}
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>Absent Days Details</h3>
              {selectedStaff.absentDates && selectedStaff.absentDates.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedStaff.absentDates.map((date, idx) => {
                    const d = new Date(date);
                    const formatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); // 12 Oct
                    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }); // Mon
                    return (
                      <div key={idx} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '10px 16px', backgroundColor: '#fff1f2', borderRadius: '10px',
                        border: '1px solid #fecdd3', minWidth: '80px'
                      }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#e11d48' }}>{formatted}</span>
                        <span style={{ fontSize: '11px', color: '#fb7185', fontWeight: '600' }}>{dayName}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '12px', color: '#6b7280', fontSize: '14px' }}>
                  No absences recorded for this period. Great attendance!
                </div>
              )}

              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Base Salary</span>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>₹ {selectedStaff.salary?.toLocaleString()}</span>
                </div>
                <button onClick={() => setShowModal(false)} style={{
                  padding: '10px 24px', backgroundColor: '#111827', color: 'white', border: 'none',
                  borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
                }}>Close</button>
              </div>

            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #f97316;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `
      }} />
    </>
  );
}
