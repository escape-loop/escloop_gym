// StaffListing.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AppContent } from "../context/context.jsx";
import "../styles/dashboard.css";
import ToggleButton from "../components/ToggleButton.jsx";
import StaffDetailsModal from "../components/StaffDetailsModal.jsx";
import "../styles/toggle-button.css";
import { toast } from 'react-toastify';

export default function StaffListing() {
  const { isauthenticated, getuserdata, userdata, backendurl, sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "table"
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedStaffForView, setSelectedStaffForView] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStaff, setTotalStaff] = useState(0);
  const [limit] = useState(50);

  const handleViewDetails = (staffMember) => {
    setSelectedStaffForView(staffMember);
    setShowDetailsModal(true);
  };

  // Fetch staff from backend API
  const fetchStaff = async () => {
    setLoading(true);
    try {
      console.log('Fetching staff from backend:', `${backendurl}/staff`);
      const response = await axios.get(`${backendurl}/staff`, {
        params: {
          status: statusFilter, // pass current status filter
          search: search || undefined,
          page: currentPage,
          limit: limit,
        },
        withCredentials: true,
      });

      console.log('Staff API response:', response.data);

      if (response.data.success) {
        const staffData = response.data.staff || response.data.data || [];
        setStaff(staffData);
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.pages);
          setTotalStaff(response.data.pagination.total);
        }
      } else {
        console.error('Failed to fetch staff:', response.data.message);
        setStaff([]);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  // Debug function to test member API
  const testMemberAPI = async () => {
    try {
      // console.log('Testing member API...');
      const response = await fetch(`${backendurl}/members`, {
        method: 'GET',
        credentials: 'include',
      });
      // console.log('Member API response status:', response.status);
    } catch (error) {
      console.error('Member API test failed:', error);
    }
  };

  useEffect(() => {
    if (!isauthenticated) {
      navigate("/");
      return;
    }
    getuserdata();
    fetchStaff();
    window.scrollTo(0, 0);
  }, [isauthenticated, navigate, backendurl, statusFilter, search, currentPage]); // Added currentPage dependency

  const filteredStaff = staff.filter((staffMember) => {
    // Client-side filtering is reduced since we do it on backend now, 
    // but keeping search/status for immediate feedback if needed, 
    // though ideally backend filtering handles it.
    // For now, let's trust the backend data but keep the role filter logic if backend doesn't handle it yet?
    // Backend handles status, search. Does it handle 'role'? 
    // Backend doesn't seem to be filtering by role 'Trainer' explicitly unless passed.
    // Current frontend logic: "Status filter" is passed to backend.
    // "Search" is passed to backend.
    // "filteredStaff" previously did additional filtering. 
    // We should probably rely mostly on backend data now.

    // However, existing code had logic: "Filter out inactive trainers but include Active and On Leave"
    // AND performed search.
    // If backend returns filtered data, we might not need this.
    // But let's keep it safe.

    // Actually, if we paginate, client-side filtering breaks pagination logic (showing fewer items than page size).
    // So we should try to move all filtering to backend or rely on backend return.
    // The backend `getStaff` handles status, search.
    // The "Trainer" inactive logic seems to be a specific frontend rule.
    // Let's assume backend returns what we want based on `statusFilter`.
    return true;
  });

  // State to store assigned member counts for each staff member
  const [assignedMemberCounts, setAssignedMemberCounts] = useState({});
  const [loadingAssignedCounts, setLoadingAssignedCounts] = useState(false);

  // Ref to track if we've already fetched for current staff data to prevent infinite loops
  const hasFetchedRef = useRef(false);
  const lastStaffDataRef = useRef(null);

  // Fetch assigned member counts for all trainers using the same logic as Add Staff edit mode
  const fetchAssignedMemberCounts = async () => {
    setLoadingAssignedCounts(true);
    try {
      // Get all trainers from staff
      const trainers = staff.filter(staffMember => staffMember.role === 'Trainer');

      if (trainers.length === 0) {
        setLoadingAssignedCounts(false);
        return;
      }

      // ... existing assigned member logic ...
      // For brevity, assuming this logic works. 
      // Optimally we should maybe fetch this individually per row or optimize backend to return it.
      // But keeping existing logic.

      console.log('Fetching members for assigned member counts...');

      // Fetch all members and filter on client side (same logic as Add Staff edit mode)
      const response = await fetch(`${backendurl}/members`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.members) {
        // Initialize counts for all trainers
        const trainerMemberCounts = {};
        trainers.forEach(trainer => {
          trainerMemberCounts[trainer._id] = 0;
        });

        // Iterate trainers and count their assigned active members
        trainers.forEach(trainer => {
          let count = 0;
          result.members.forEach(member => {
            const status = member.status ? member.status.toLowerCase() : '';
            const isActive = ['active', 'approved', 'running', 'valid', 'pending'].includes(status);
            if (!isActive) return;

            // Check assignment via ID or Name
            let isAssigned = false;
            if (member.trainerId && String(member.trainerId) === String(trainer._id)) {
              isAssigned = true;
            }
            else if (member.trainerName && member.trainerName === trainer.fullName) {
              isAssigned = true;
            }

            if (isAssigned) count++;
          });

          trainerMemberCounts[trainer._id] = count;
        });

        setAssignedMemberCounts(trainerMemberCounts);
      }
    } catch (error) {
      console.error('Error fetching assigned member counts:', error);
    } finally {
      setLoadingAssignedCounts(false);
    }
  };

  // Fetch assigned member counts when staff data changes
  useEffect(() => {
    // Check if staff data has actually changed
    const currentStaffData = JSON.stringify(staff.map(s => s._id));
    if (currentStaffData !== lastStaffDataRef.current) {
      lastStaffDataRef.current = currentStaffData;
      hasFetchedRef.current = false;
    }

    const trainers = staff.filter(staffMember => staffMember.role === 'Trainer');
    if (trainers.length > 0 && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchAssignedMemberCounts();
    }
  }, [staff]);

  const handleEdit = async (staffMember) => {
    try {
      console.log('Fetching staff data for editing:', staffMember._id);
      const response = await axios.get(`${backendurl}/staff/${staffMember._id}`, {
        withCredentials: true,
      });

      if (response.data.success) {
        navigate('/addstaff', { state: { staffMember: response.data.staff, isEditing: true } });
      } else {
        toast.error('Failed to load staff data for editing: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error fetching staff data:', error);
      toast.error('Error loading staff data for editing.');
    }
  };

  const toggleStatus = async (id) => {
    try {
      const response = await axios.patch(`${backendurl}/staff/${id}/toggle`, {}, {
        withCredentials: true,
      });

      if (response.data.success) {
        const newStatus = response.data.status || response.data.staff?.status;
        setStaff((prev) =>
          prev.map((staffMember) =>
            staffMember._id === id
              ? {
                ...staffMember,
                status: newStatus,
              }
              : staffMember
          )
        );
        toast.success('Staff status updated successfully');
      } else {
        toast.error(response.data.message || 'Failed to update staff status');
      }
    } catch (error) {
      console.error('Error toggling staff status:', error);
      toast.error('Error updating staff status');
    }
  };

  const handleView = (staffMember) => {
    navigate('/staffview', { state: { staff: staffMember } });
  };

  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`${backendurl}/staff/${id}`, {
        withCredentials: true,
      });

      if (response.data.success) {
        setStaff((prev) => prev.filter((staffMember) => staffMember._id !== id));
        fetchStaff(); // Refresh to update pagination counts? Or just local update is fine.
        toast.success('Staff deleted successfully');
      } else {
        toast.error(response.data.message || 'Failed to delete staff');
      }
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast.error('Error deleting staff');
    }
  };

  if (loading) {
    return (
      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-header-left">
            <ToggleButton isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
            <div className="dash-breadcrumb">Dashboard / Staff Management {statusFilter !== 'all' && `(${statusFilter})`}</div>
          </div>
          <div className="dash-header-right">
            <div className="search-container">
              <input
                className="dash-search"
                placeholder="Search staff..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="On Leave">On Leave</option>
            </select>
            <button
              className="btn-primary"
              onClick={() => navigate("/addstaff")}
            >
              + Add New Staff
            </button>
          </div>
        </header>
        <div className="dash-content">
          <div className="loading" style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px',
            color: '#6b7280',
            fontSize: '14px'
          }}>
            Loading staff...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-header-left">
          <ToggleButton isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
          <div className="dash-breadcrumb">Dashboard / Staff Management {statusFilter !== 'all' && `(${statusFilter})`}</div>
        </div>
        <div className="dash-header-right">
          <div className="search-container">
            <input
              className="dash-search"
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
          </select>
          <button
            className="btn-primary"
            onClick={() => navigate("/addstaff")}
          >
            + Add New Staff
          </button>
        </div>
      </header>

      <div className="dash-content">
        <div className="staff-controls">
          <div className="stats">
            <span>Total: {totalStaff}</span>
          </div>
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === "cards" ? "active" : ""}`}
              onClick={() => setViewMode("cards")}
            >
              Cards
            </button>
            <button
              className={`view-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
            >
              Table
            </button>
          </div>
        </div>
        {viewMode === "cards" ? (
          <div className="members-grid">
            {staff.map((staffMember) => (
              <div key={staffMember._id} className="member-card" onClick={() => handleViewDetails(staffMember)} style={{ cursor: 'pointer' }}>
                <div className="member-image" style={{
                  padding: '20px 0 0 0',
                  display: 'flex',
                  justifyContent: 'center',
                  background: 'linear-gradient(to bottom, #f9fafb 50%, white 50%)'
                }}>
                  <img
                    src={staffMember.profilePhoto ? (
                      staffMember.profilePhoto.startsWith('http')
                        ? staffMember.profilePhoto
                        : `${backendurl.replace('/gym', '')}${staffMember.profilePhoto.startsWith('/') ? '' : '/'}${staffMember.profilePhoto}`
                    ) : `https://placehold.co/120x120/e5e7eb/9ca3af?text=${staffMember.firstName?.charAt(0) || 'U'}`}
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
                      e.target.style.display = 'none';
                      if (e.target.parentNode) {
                        const fallback = document.createElement('div');
                        fallback.className = 'image-fallback round';
                        fallback.style.width = '120px';
                        fallback.style.height = '120px';
                        fallback.textContent = 'No Image';
                        e.target.parentNode.appendChild(fallback);
                      }
                    }}
                    onLoad={(e) => {
                      e.target.style.display = 'block';
                    }}
                  />
                </div>
                <div className="member-content">
                  <div className="member-header">
                    <h3 className="member-name">{staffMember.fullName}</h3>
                    <span className="member-id">#{staffMember.attendanceId || staffMember.staffId}</span>
                    <div
                      className={`member-status ${staffMember.status?.toLowerCase().replace(/\s+/g, '-') || 'inactive'}`}
                      style={{ color: staffMember.status?.toLowerCase() === 'inactive' ? '#dc2626' : undefined }}
                    >
                      {staffMember.status || 'Inactive'}
                    </div>
                  </div>
                  <div className="member-info">
                    <div className="member-meta">
                      <span>{staffMember.phone}</span>
                    </div>
                    <div className="sector">
                      <div className="member-plan">
                        <span>{staffMember.role} - {staffMember.department}</span>
                      </div>

                    </div>
                  </div>
                  <div className="member-finance">
                    <div className="finance-header">
                      <div className="finance-total">₹{staffMember.salary.toLocaleString()}</div>
                      {staffMember.role === 'Trainer' && (
                        <div className="finance-balance" style={{ marginLeft: '16px', fontSize: '12px', color: '#6b7280' }}>
                          Assigned Members: {loadingAssignedCounts ? 'Loading...' : (assignedMemberCounts[staffMember._id] || 0)}
                        </div>
                      )}
                    </div>
                    <div className="finance-dates">
                      <div>Shift: {staffMember.shiftType || ''}</div>
                      <div>Timing: {staffMember.workHoursStart || ''} - {staffMember.workHoursEnd || ''}</div>
                    </div>
                  </div>
                  <div className="member-actions">
                    <button
                      className="btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(staffMember);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStatus(staffMember._id);
                      }}
                    >
                      {staffMember.status === "Active" ? "Deactivate" : "Activate"}
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="members-table-container">
            <table className="members-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Salary</th>
                  <th>Assigned Members</th>
                  <th>Shift</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((staffMember) => (
                  <tr key={staffMember._id}>
                    <td>
                      <img
                        src={staffMember.profilePhoto ? (
                          staffMember.profilePhoto.startsWith('http')
                            ? staffMember.profilePhoto
                            : `${backendurl.replace('/gym', '')}${staffMember.profilePhoto.startsWith('/') ? '' : '/'}${staffMember.profilePhoto}`
                        ) : `https://placehold.co/40x40/e5e7eb/9ca3af?text=${staffMember.firstName?.charAt(0) || 'U'}`}
                        alt={staffMember.fullName}
                        className="table-member-img member-profile-image"
                        style={{
                          width: '40px',
                          height: '40px',
                          objectFit: 'cover',
                          objectPosition: 'top center',
                          borderRadius: '50%',
                          display: 'block',
                          border: '2px solid white',
                          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.parentNode) {
                            const fallback = document.createElement('div');
                            fallback.className = 'image-fallback round';
                            fallback.style.width = '40px';
                            fallback.style.height = '40px';
                            fallback.textContent = 'No Image';
                            e.target.parentNode.appendChild(fallback);
                          }
                        }}
                        onLoad={(e) => {
                          e.target.style.display = 'block';
                        }}
                      />
                    </td>
                    <td>{staffMember.fullName}</td>
                    <td>#{staffMember.attendanceId || staffMember.staffId}</td>
                    <td>{staffMember.phone}</td>
                    <td>
                      <div>
                        <div className="plan-type">
                          {staffMember.role}
                        </div>
                        <div className="plan-name" style={{ fontSize: '12px', color: '#6b7280' }}>
                          {staffMember.department}
                        </div>
                      </div>
                    </td>
                    <td>₹{staffMember.salary.toLocaleString()}</td>
                    <td>
                      {staffMember.role === 'Trainer' ? (
                        <span style={{
                          background: '#f3f4f6',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          {loadingAssignedCounts ? '...' : (assignedMemberCounts[staffMember._id] || 0)}
                        </span>
                      ) : '-'}
                    </td>
                    <td>{staffMember.shiftType || 'Not Set'}</td>
                    <td>
                      <span
                        className={`status-badge ${staffMember.status?.toLowerCase().replace(/\s+/g, '-') || 'inactive'}`}
                        style={{ color: staffMember.status?.toLowerCase() === 'inactive' ? '#dc2626' : undefined }}
                      >
                        {staffMember.status || 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn-secondary small"
                          onClick={() => handleEdit(staffMember)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-secondary small"
                          onClick={() => toggleStatus(staffMember._id)}
                        >
                          {staffMember.status === "Active" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {staff.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">👨‍💼</div>
            <h3>No staff found</h3>
            <p>
              {search || statusFilter !== "all"
                ? "No staff match your current filters. Try adjusting them."
                : "No staff have been added yet. Add your first staff member to get started."}
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate("/addstaff")}
            >
              + Add New Staff
            </button>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="pagination-controls" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
            <button
              className="btn-secondary"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="page-info">
              Page {currentPage} of {totalPages} • Total: {totalStaff}
            </span>
            <button
              className="btn-secondary"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {selectedStaffForView && (
        <StaffDetailsModal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          staff={selectedStaffForView}
          backendurl={backendurl}
        />
      )}
    </div>
  );
}