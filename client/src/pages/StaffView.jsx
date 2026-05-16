// StaffView.jsx
import React, { useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppContent } from "../context/context.jsx";
import "../styles/dashboard.css";
import ToggleButton from "../components/ToggleButton.jsx";
import Sidebar from "../components/Sidebar.jsx";
import "../styles/sidebar.css";
import "../styles/toggle-button.css";

export default function StaffView() {
  console.log('StaffView component initialized');
  const { isauthenticated, getuserdata, userdata, backendurl } = useContext(AppContent);
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  
  // Get staff data from location state
  // Get staff data from location state (support both `staff` and `staffMember` keys)
  const staffMember = location.state?.staffMember ?? location.state?.staff;

  // Derive a fullName for compatibility with different payload shapes
  const fullName = (staffMember && (staffMember.fullName || `${staffMember.firstName || ''} ${staffMember.lastName || ''}`)) || '';
  
  // Debug: Log the location state and staff data
  console.log('StaffView location state:', location.state);
  console.log('StaffView staffMember:', staffMember);
  console.log('StaffView staffMember keys:', Object.keys(staffMember || {}));
  console.log('StaffView backendurl:', backendurl);
  console.log('StaffView workDays:', staffMember?.workDays);
  console.log('StaffView workDays type:', typeof staffMember?.workDays);
  console.log('StaffView workDays isArray:', Array.isArray(staffMember?.workDays));
  
  // If no staff data, redirect back to staff listing
  if (!staffMember) {
    console.log('No staff data found, redirecting to stafflisting');
    navigate('/stafflisting');
    return null;
  }

  // Ensure we have the minimum required data
  if (!staffMember.fullName) {
    console.log('Staff data missing fullName, redirecting to stafflisting');
    console.log('Available staffMember properties:', Object.keys(staffMember));
    navigate('/stafflisting');
    return null;
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      // Handle different date formats
      let date;
      if (typeof dateString === 'string') {
        // Handle ISO date strings
        if (dateString.includes('T') || dateString.includes('Z')) {
          date = new Date(dateString);
        } else {
          // Handle YYYY-MM-DD format
          const parts = dateString.split('-');
          if (parts.length === 3) {
            date = new Date(parts[0], parts[1] - 1, parts[2]);
          } else {
            date = new Date(dateString);
          }
        }
      } else if (dateString instanceof Date) {
        date = dateString;
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return '-';
      }
      
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return '-';
    }
  };

  const formatWorkDays = (workDays) => {
    if (!workDays) return 'Not Set';

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    // Try multi-pass JSON parsing (handles double-encoded strings)
    let parsed = workDays;
    for (let i = 0; i < 5; i++) {
      if (typeof parsed === 'string') {
        const t = parsed.trim();
        if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('"') && t.endsWith('"'))) {
          try {
            parsed = JSON.parse(parsed);
            continue;
          } catch (e) {
            break;
          }
        }
      }
      break;
    }

    // If parsed is array, normalize to day names
    if (Array.isArray(parsed)) {
      const normalized = parsed.map((d) => String(d).trim()).filter(Boolean).map((s) => {
        const found = DAYS.find((x) => x.toLowerCase() === s.toLowerCase());
        return found || (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
      }).filter(Boolean);
      return normalized.length ? normalized.join(', ') : 'Not Set';
    }

    // If parsed is single string with commas
    if (typeof parsed === 'string') {
      const arr = parsed.split(',').map(s => s.trim()).filter(Boolean);
      return arr.length ? arr.join(', ') : 'Not Set';
    }

    return 'Not Set';
  };

  const handleEdit = () => {
    navigate('/addstaff', { state: { staffMember: staffMember, isEditing: true } });
  };

  const handleBack = () => {
    navigate('/stafflisting');
  };

  console.log('StaffView component rendering with staffMember:', staffMember);
  console.log('StaffView component rendering - backendurl:', backendurl);
  console.log('StaffView component rendering - location:', location);
  console.log('StaffView component rendering - isauthenticated:', isauthenticated);
  return (
    <div className="app-container">
      <Sidebar isOpen={false} />
      <main className={`main-content`}>
        <div className="dash-main">
          <header className="staff-view-header">
            <div className="header-content">
              <div className="header-left">
                <h1>Staff Details</h1>
                <p>Complete information about {staffMember.fullName}</p>
              </div>
              <div className="header-actions">
                <button className="btn-secondary" onClick={handleBack}>
                  ← Back to Staff List
                </button>
                <button className="btn-primary" onClick={handleEdit}>
                  Edit Staff
                </button>
              </div>
            </div>
          </header>

          <div className="dash-content">
            <div className="nm-card" style={{maxWidth:980, margin:'20px auto'}}>
              <div style={{display:'flex', gap:24}}>
                <div style={{flex:'0 0 320px'}}>
                  {/* Profile Image */}
                  {staffMember.profilePhoto ? (
                    <img 
                      src={`${backendurl.replace('/gym', '')}${staffMember.profilePhoto.startsWith('/') ? '' : '/'}${staffMember.profilePhoto}`}
                      alt={staffMember.fullName}
                      style={{
                          width: '120px',
                          height: '120px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          objectPosition: 'top center',
                          border: '4px solid white',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                      onError={(e) => {
                        console.log('Image load error for:', staffMember.profilePhoto);
                        e.target.style.display = 'none';
                        const fallback = document.createElement('div');
                        fallback.className = 'profile-image-fallback';
                        fallback.textContent = staffMember.fullName.charAt(0).toUpperCase();
                        e.target.parentNode.appendChild(fallback);
                      }}
                      onLoad={(e) => {
                        console.log('Image loaded successfully:', staffMember.profilePhoto);
                        e.target.style.display = 'block';
                      }}
                    />
                  ) : (
                    <div style={{width:'100%', height: '220px', borderRadius:8, border:'1px solid #e5e7eb', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'48px', fontWeight:'700', color:'#6b7280'}}>
                      {staffMember.fullName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  {/* Profile Info */}
                  <div style={{marginTop:16, padding:12, background:'#f9fafb', borderRadius:8}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                      <div>
                        <div style={{fontSize:18, fontWeight:700, marginBottom:4}}>{staffMember.fullName}</div>
                        <div style={{color:'#6b7280', fontSize:13}}>Staff ID: {staffMember.staffId}</div>
                        <div style={{color:'#6b7280', fontSize:'13px'}}>Staff ID: {staffMember.staffId || '-'}</div>
                        <div style={{color:'#6b7280', fontSize:'13px'}}>Attendance ID: {staffMember.attendanceId || '-'}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{padding:'6px 10px', background: staffMember.status === 'Active' ? '#dcfce7' : staffMember.status === 'On Leave' ? '#fff7ed' : '#f3f4f6', borderRadius:6, color: staffMember.status === 'Active' ? '#166534' : staffMember.status === 'On Leave' ? '#9a3412' : '#374151', fontWeight:600, fontSize:'12px'}}>
                          {staffMember.status || 'Inactive'}
                        </div>
                      </div>
                    </div>
                    <div style={{color:'#6b7280', fontSize:'12px', borderTop:'1px solid #e5e7eb', paddingTop:8}}>
                      <div style={{marginBottom:4}}>{staffMember.role}</div>
                      <div>{staffMember.department}</div>
                    </div>
                  </div>
                </div>

                <div style={{flex:1}}>
                  {/* Contact & Basic Info Section */}
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14, color:'#111827', fontWeight:600, marginBottom:4}}>{staffMember.role}</div>
                      <div style={{color:'#374151', marginBottom:12}}>{staffMember.department}</div>
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
                        <div style={{color:'#6b7280', fontSize:'14px'}}>
                          <div style={{marginBottom:4}}><strong>Email:</strong> {staffMember.email || '-'}</div>
                          <div><strong>Phone:</strong> {staffMember.phone}</div>
                        </div>
                        <div style={{color:'#6b7280', fontSize:'14px'}}>
                          <div style={{marginBottom:4}}><strong>Staff ID:</strong> {staffMember.staffId}</div>
                          <div><strong>Joining Date:</strong> {formatDate(staffMember.joinDate)}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{textAlign:'right', flex:'0 0 200px', borderLeft:'1px solid #e5e7eb', paddingLeft:16}}>
                      <div style={{fontSize:20, fontWeight:700, marginBottom:4}}>₹{staffMember.salary || '0'}</div>
                      <div style={{fontSize:13, color:'#6b7280', marginBottom:8}}>Monthly Salary</div>
                      <div style={{color:'#6b7280', fontSize:'13px', marginBottom:4}}>Experience: {staffMember.experience || '0'} years</div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>PT Sessions: {staffMember.ptSessions || '0'}</div>
                    </div>
                  </div>

                  {/* Personal Information Section */}
                  <div style={{marginBottom:16, padding:12, background:'#f9fafb', borderRadius:8}}>
                    <h4 style={{margin:'6px 0 12px 0', fontSize:'14px', fontWeight:600, color:'#374151'}}>Personal Information</h4>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Date of Birth:</strong> {formatDate(staffMember.dob)}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Gender:</strong> {staffMember.gender || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px', gridColumn:'1 / -1'}}>
                        <strong>Address:</strong> {staffMember.address || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>City:</strong> {staffMember.city || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>State:</strong> {staffMember.state || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Pincode:</strong> {staffMember.pincode || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Emergency Contact:</strong> {staffMember.emergencyContact || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Emergency Phone:</strong> {staffMember.emergencyPhone || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>PAN Number:</strong> {staffMember.panNumber || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Aadhaar Number:</strong> {staffMember.aadhaarNumber || '-'}
                      </div>
                    </div>
                  </div>

                  {/* Work Schedule Section */}
                  <div style={{marginBottom:16, padding:12, background:'#f9fafb', borderRadius:8}}>
                    <h4 style={{margin:'6px 0 12px 0', fontSize:'14px', fontWeight:600, color:'#374151'}}>Work Schedule</h4>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Work Days:</strong> {formatWorkDays(staffMember.workDays)}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Start Time:</strong> {staffMember.workHoursStart || staffMember.startTime || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>End Time:</strong> {staffMember.workHoursEnd || staffMember.endTime || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Break Duration:</strong> {staffMember.breakDuration ? `${staffMember.breakDuration} minutes` : staffMember.breakTime || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Shift Type:</strong> {staffMember.shiftType || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Assigned Batches:</strong> {staffMember.assignedBatches && staffMember.assignedBatches.length > 0 ? staffMember.assignedBatches.join(', ') : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Additional Information Section */}
                  <div style={{marginBottom:16, padding:12, background:'#f9fafb', borderRadius:8}}>
                    <h4 style={{margin:'6px 0 12px 0', fontSize:'14px', fontWeight:600, color:'#374151'}}>Additional Information</h4>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Qualification:</strong> {staffMember.qualifications || staffMember.qualification || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Certifications:</strong> {staffMember.certifications || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Specializations:</strong> {staffMember.specializations || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Employment Type:</strong> {staffMember.employmentType || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Salary Payment Mode:</strong> {staffMember.salaryPaymentMode || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Bank Account:</strong> {staffMember.bankAccount || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>IFSC Code:</strong> {staffMember.ifsc || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Assigned Branch:</strong> {staffMember.assignedBranch || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Referral Code:</strong> {staffMember.referralCode || '-'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Referral Discount:</strong> {staffMember.referralDiscountPercentage || '0'}%
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Probation Period:</strong> {staffMember.probationPeriod ? 'Yes' : 'No'}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px'}}>
                        <strong>Probation End Date:</strong> {formatDate(staffMember.probationEndDate)}
                      </div>
                      <div style={{color:'#6b7280', fontSize:'13px', gridColumn:'1 / -1'}}>
                        <strong>Notes:</strong> {staffMember.notes || '-'}
                      </div>
                    </div>
                  </div>

                  {/* Assigned Members Section */}
                  {staffMember.assignedMembers && staffMember.assignedMembers.length > 0 && (
                    <div style={{marginBottom:16, padding:12, background:'#f9fafb', borderRadius:8}}>
                      <h4 style={{margin:'6px 0 12px 0', fontSize:'14px', fontWeight:600, color:'#374151'}}>Assigned Members ({staffMember.assignedMembers.length})</h4>
                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:12}}>
                        {staffMember.assignedMembers.map((member, index) => (
                          <div key={index} style={{border:'1px solid #e5e7eb', borderRadius:8, padding:12, background:'#ffffff'}}>
                            <div style={{fontWeight:600, fontSize:'14px', marginBottom:4}}>{member.name}</div>
                            <div style={{fontSize:'12px', color:'#6b7280', marginBottom:6}}>{member.memberId}</div>
                            <div style={{fontSize:'13px', color:'#374151'}}>{member.phone}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
          
}