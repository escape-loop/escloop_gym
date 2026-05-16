import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppContent } from "../context/context.jsx";
import "../styles/dashboard.css";
import ToggleButton from "../components/ToggleButton.jsx";
import "../styles/toggle-button.css";
import MemberDetailsModal from "../components/MemberDetailsModal.jsx"; // Import Modal
import axios from "axios";
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { Send, X } from 'lucide-react';

export default function MembersListing() {
  const { isauthenticated, getuserdata, userdata, backendurl, sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const navigate = useNavigate();
  const location = useLocation();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "table"
  const [searchName, setSearchName] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Initialize filter from navigation state if available
  const [statusFilter, setStatusFilter] = useState(location.state?.filter || "all");

  // Update filter if location state changes (handling navigation within the same component if that ever happens)
  useEffect(() => {
    if (location.state?.filter) {
      setStatusFilter(location.state.filter);
    }
  }, [location.state]);

  // State for details modal
  const [selectedMemberForView, setSelectedMemberForView] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [limit] = useState(50); // Members per page
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, pending: 0 });

  // Bulk messaging state
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [selectedMemberDataMap, setSelectedMemberDataMap] = useState(new Map());
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);



  const [gymName, setGymName] = useState('Gym'); // Default fallback

  useEffect(() => {
    if (!isauthenticated) {
      navigate("/");
      return;
    }
    getuserdata();
    fetchMembers();
    fetchGymSettings();
    window.scrollTo(0, 0);
    document.querySelector('.dash-content')?.scrollTo(0, 0);
    document.querySelector('.app-container')?.scrollTo(0, 0);
  }, [isauthenticated, navigate, currentPage, debouncedSearch, statusFilter]);

  // Fetch Gym Settings
  const fetchGymSettings = async () => {
    try {
      const response = await axios.get(`${backendurl}/settings`, { withCredentials: true });
      if (response.data.success && response.data.settings?.gymName) {
        setGymName(response.data.settings.gymName);
      }
    } catch (error) {
      console.error("Error fetching gym settings:", error);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchName);
      setCurrentPage(1); // Reset to first page on new search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchName]);

  // Fetch members from backend API
  const fetchMembers = async () => {
    if (!searchName) setLoading(true);

    try {
      const response = await axios.get(`${backendurl}/members`, {
        params: {
          page: currentPage,
          limit: limit,
          search: debouncedSearch,
          status: statusFilter === 'all' ? '' : statusFilter
        },
        withCredentials: true
      });

      if (response.data.success) {
        setMembers(response.data.members);
        setTotalPages(response.data.pagination.pages);
        setTotalMembers(response.data.pagination.total);
        if (response.data.stats) {
          setStats(response.data.stats);
        }
      } else {
        console.error('Failed to fetch members:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      if (!searchName) setLoading(false);
    }
  };

  const handleEdit = (member) => {
    navigate('/addmember', { state: { member, isEditing: true } });
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete this member?',
      text: 'ALL THE MEMBERS DETAIL AND SUBSCRIPTION DETAIL WILL GET DELETED WHICH CANT BE RETRIEVED IN THE FUTURE',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete'
    });
    if (result.isConfirmed) {
      try {
        const response = await axios.delete(`${backendurl}/members/${id}`, {
          withCredentials: true
        });

        if (response.data.success) {
          Swal.fire({
            title: 'Success',
            text: 'MEMBER DELETED SUCCESSFULLY',
            icon: 'success',
            confirmButtonColor: '#f97316'
          }).then(() => {
            fetchMembers();
            navigate('/members', { replace: true });
          });
        } else {
          toast.error(response.data.message || 'Failed to delete member');
        }
      } catch (error) {
        console.error('Error deleting member:', error);
        toast.error('Error deleting member. Please try again.');
      }
    }
  };

  const handleRenewal = (member) => {
    navigate('/newsub', {
      state: {
        selectedMember: member
      }
    });
  };

  const handlePaymentNavigation = (member) => {
    navigate('/billing', {
      state: {
        memberId: member.memberId,
        memberData: member
      }
    });
  };



  const getStatusDisplay = (status) => {
    if (!status) return 'Unknown';
    if (status === 'Hold') return 'Hold';
    return status;
  };

  const handleViewDetails = (member) => {
    setSelectedMemberForView(member);
    setShowDetailsModal(true);
  };

  // Standardize profile photo URL construction
  const getProfilePhotoUrl = (member) => {
    if (!member || !member.profilePhoto) return null;
    const photo = member.profilePhoto;
    if (photo.startsWith('http')) return photo;
    if (photo.startsWith('data:')) return photo;

    // Construct the full URL relative to backendurl
    const baseUrl = backendurl.replace('/gym', '').replace(/\/+$/, '');
    const cleanPath = photo.startsWith('/') ? photo : `/${photo}`;
    return `${baseUrl}${cleanPath}`;
  };

  // Helper to get initials or fallback avatar (Local SVG)
  const getFallbackImage = (member) => {
    const name = member?.fullName || 'User';
    const initials = name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    // Simple SVG data URI with the initials
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" style="background-color: #f97316;">
        <text x="50%" y="50%" dy=".1em" font-size="50" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif">
          ${initials}
        </text>
      </svg>
    `.trim();

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  // Checkbox selection handlers
  const handleSelectMember = (member) => {
    const memberId = member._id;
    const newSelectedId = new Set(selectedMembers);
    const newSelectedData = new Map(selectedMemberDataMap);

    if (newSelectedId.has(memberId)) {
      newSelectedId.delete(memberId);
      newSelectedData.delete(memberId);
    } else {
      newSelectedId.add(memberId);
      newSelectedData.set(memberId, { name: member.fullName, phone: member.phone });
    }
    setSelectedMembers(newSelectedId);
    setSelectedMemberDataMap(newSelectedData);
  };

  const handleSelectAll = async () => {
    // If all are already selected, deselect all
    if (selectedMembers.size > 0 && selectedMembers.size === totalMembers) {
      setSelectedMembers(new Set());
      setSelectedMemberDataMap(new Map());
      return;
    }

    // Select ALL members (Global)
    try {
      setLoading(true);
      const response = await axios.get(`${backendurl}/members`, {
        params: {
          page: 1,
          limit: 1000000, // Fetch all for selection
          search: debouncedSearch,
          status: statusFilter === 'all' ? '' : statusFilter
        },
        withCredentials: true
      });

      if (response.data.success) {
        const allMembers = response.data.members;
        const newIds = new Set(allMembers.map(m => m._id));
        const newMap = new Map();

        allMembers.forEach(m => {
          newMap.set(m._id, { name: m.fullName, phone: m.phone });
        });

        setSelectedMembers(newIds);
        setSelectedMemberDataMap(newMap);
        toast.success(`Selected all ${allMembers.length} members`);
      } else {
        toast.error("Failed to select members");
      }
    } catch (error) {
      console.error("Error selecting all:", error);
      toast.error("Error selecting members");
    } finally {
      setLoading(false);
    }
  };

  // Send customized message webhook
  const handleSendCustomMessage = async () => {
    if (!customMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    const selectedMemberData = Array.from(selectedMemberDataMap.values());

    if (selectedMemberData.length === 0) {
      toast.error('No members selected');
      return;
    }

    setSendingMessage(true);
    try {
      const response = await fetch(`${backendurl}/whatsapp/send-custom-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: customMessage,
          members: selectedMemberData,
          gymName: gymName
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
         throw new Error(data.message || 'Failed to send message');
      }

      toast.success(data.message || `Message sent to ${selectedMemberData.length} member(s)`);
      setShowMessageModal(false);
      setCustomMessage('');
      setSelectedMembers(new Set());
      setSelectedMemberDataMap(new Map());
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(error.message || 'Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading && members.length === 0 && !searchName) {
    return (
      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-header-left">
            <ToggleButton isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
            <div className="dash-breadcrumb">Dashboard / Members</div>
          </div>
        </header>
        <div className="dash-content">
          <div style={{ padding: '20px', textAlign: 'center' }}>Loading members...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-header-left">
          <ToggleButton isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
          <div className="dash-breadcrumb">Dashboard / Members {statusFilter !== 'all' && `(${statusFilter})`}</div>
        </div>
        <div className="dash-header-right">
          <div className="search-container">
            <input
              className="dash-search"
              placeholder="Search "
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              autoFocus={!!searchName}
            />
          </div>
          <select className="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Expired">Expired</option>
          </select>
          <button className="btn-primary" onClick={() => {
            setSearchName("");
            setDebouncedSearch("");
            navigate('/addmember');
          }}>
            + Add New Member
          </button>
        </div>
      </header>

      <div className="dash-content">
        <div className="members-controls">
          <div className="stats">
            <span>Total: {stats.total}</span>
            <span>Active: {stats.active}</span>
            <span>Expired: {stats.expired}</span>
            <span>Due: {stats.pending}</span>
          </div>
          <div className="view-toggle">
            <button className={`view-btn ${viewMode === "cards" ? "active" : ""}`} onClick={() => setViewMode("cards")}>Cards</button>
            <button className={`view-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")}>Table</button>
          </div>
        </div>

        {viewMode === "cards" ? (
          <div className="members-grid">
            {members.map((member) => (
              <div
                key={member._id}
                className="member-card"
                onClick={() => handleViewDetails(member)}
                style={{ cursor: 'pointer', transition: 'transform 0.2s', position: 'relative' }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'none'}
              >
                <div className={`status-badge ${getStatusDisplay(member.status).toLowerCase()}`} style={{
                  position: 'absolute', top: '12px', right: '12px', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {getStatusDisplay(member.status)}
                </div>

                <div className="member-image" style={{
                  padding: '20px 0 0 0', display: 'flex', justifyContent: 'center', background: 'linear-gradient(to bottom, #f9fafb 50%, white 50%)'
                }}>
                  <img
                    src={getProfilePhotoUrl(member) || getFallbackImage(member)}
                    alt={member.fullName}
                    onError={(e) => { if (!e.target.src.includes('dicebear')) e.target.src = getFallbackImage(member); }}
                    style={{
                      width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center',
                      border: '4px solid white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
                <div className="member-content">
                  <div className="member-header">
                    <h3 className="member-name">{member.fullName}</h3>
                    <span className="member-id">#{member.memberId}</span>
                  </div>
                  <div className="member-info">
                    <div className="member-meta">
                      <span>{member.phone}</span>
                    </div>
                    <div className="member-plan">
                      {member.packageName && member.membershipType
                        ? `${member.membershipType} - ${member.packageName}`
                        : (member.packageName || member.membershipType || "No Active Plans")}
                    </div>
                  </div>
                  <div className="member-finance">
                    <div className="finance-header">
                      <div className="finance-total">₹{member.amount}</div>
                      {member.status === "Expired" && (
                        <button className="btn-primary" onClick={(e) => { e.stopPropagation(); handleRenewal(member); }} style={{ zIndex: 0, position: 'relative' }}>
                          Renewal
                        </button>
                      )}
                    </div>
                    {member.balanceAmount > 0 && (
                      <div className="finance-installment" style={{ color: '#ef4444' }}>
                        Due Amount: ₹{member.balanceAmount}
                      </div>
                    )}
                    <div className="finance-dates">
                      <div className="expires-center">Expires: {member.endDate ? new Date(member.endDate).toLocaleDateString() : 'N/A'}</div>
                    </div>
                  </div>
                  <div className="member-actions">
                    <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); handleEdit(member); }}>Edit</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="members-table-container">
            {/* Send Message Button - shows when members are selected */}
            {selectedMembers.size > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#fff7ed',
                borderRadius: '8px',
                border: '1px solid #fed7aa'
              }}>
                <span style={{ fontWeight: 600, color: '#9a3412' }}>
                  {selectedMembers.size} member(s) selected
                </span>
                <button
                  className="btn-primary"
                  onClick={() => setShowMessageModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Send size={16} /> Send Customized Message
                </button>
              </div>
            )}
            <table className="members-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={totalMembers > 0 && selectedMembers.size === totalMembers}
                      onChange={handleSelectAll}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                  </th>
                  <th>Image</th>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Phone No</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member._id} onClick={() => handleViewDetails(member)} style={{ cursor: 'pointer' }}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(member._id)}
                        onChange={() => handleSelectMember(member)}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                    </td>
                    <td>
                      <img
                        src={getProfilePhotoUrl(member) || getFallbackImage(member)}
                        alt={member.fullName}
                        className="table-member-img member-profile-image"
                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '50%' }}
                        onError={(e) => { if (!e.target.src.includes('dicebear')) e.target.src = getFallbackImage(member); }}
                      />
                    </td>
                    <td>{member.fullName}</td>
                    <td>#{member.memberId}</td>
                    <td>{member.phone}</td>
                    <td>
                      <div>
                        <div className="plan-name" style={{ fontWeight: 600 }}>
                          {member.packageName && member.membershipType
                            ? `${member.membershipType} - ${member.packageName}`
                            : (member.packageName || member.membershipType || "No Plan")}
                        </div>
                      </div>
                    </td>
                    <td>₹{member.amount}</td>
                    <td>{member.endDate ? new Date(member.endDate).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <span className={`status-badge ${getStatusDisplay(member.status).toLowerCase()}`}>{getStatusDisplay(member.status)}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn-secondary small" onClick={(e) => { e.stopPropagation(); handleEdit(member); }}>Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {members.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No members found</h3>
            <button className="btn-primary" onClick={() => {
              setSearchName("");
              setDebouncedSearch("");
              navigate('/addmember');
            }}>
              + Add New Member
            </button>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination-controls">
            <button className="btn-secondary" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>Previous</button>
            <span className="page-info">Page {currentPage} of {totalPages} • Total: {totalMembers}</span>
            <button className="btn-secondary" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Next</button>
          </div>
        )}
      </div>

      <MemberDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        member={selectedMemberForView}
        backendurl={backendurl}
      />

      {/* Customized Message Modal */}
      {showMessageModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowMessageModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Send Customized Message</h3>
              <button
                onClick={() => setShowMessageModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                <X size={20} color="#6b7280" />
              </button>
            </div>
            <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Sending to {selectedMembers.size} member(s)
            </p>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Type your message here..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
                resize: 'vertical',
                marginBottom: '0.5rem'
              }}
            />
            <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '1rem', fontStyle: 'italic' }}>
              Note: You don't want to put hi (name), [just give your message]
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => setShowMessageModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSendCustomMessage}
                disabled={sendingMessage}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {sendingMessage ? 'Sending...' : <><Send size={16} /> Send Message</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}