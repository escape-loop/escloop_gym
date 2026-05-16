import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import '../styles/dashboard.css';
import ToggleButton from '../components/ToggleButton.jsx';
import Sidebar from '../components/Sidebar.jsx';
import '../styles/sidebar.css';
import '../styles/toggle-button.css';
import axios from 'axios';

export default function Subscriptions() {
  const { isauthenticated, getuserdata, userdata, backendurl, sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const navigate = useNavigate();
  const location = useLocation();
  /* Pagination State */
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [limit] = useState(50);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchName, setSearchName] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");

  // Stats state
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, pending: 0 });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);

      const tokenFromStorage = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (tokenFromStorage) headers['Authorization'] = `Bearer ${tokenFromStorage}`;

      // Build query string
      const params = new URLSearchParams({
        flatten: 'true',
        page: currentPage,
        limit: limit,
        search: searchName || '',
        status: filterStatus !== 'all' ? filterStatus : ''
      });

      const apiUrl = `${backendurl}/members?${params.toString()}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch members: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Transform the data
        const transformedMembers = (result.members || []).map(item => {
          return {
            _id: item._id,
            memberName: item.fullName || `${item.firstName} ${item.lastName}`,
            email: item.email,
            phone: item.phone,
            attendanceId: item.attendanceId || `MEM-${item._id?.slice(-4) || '0000'}`,
            plan: `${item.membershipType || 'Monthly'} - ${item.packageName}`,
            startDate: item.startDate ? formatDate(item.startDate) : '',
            endDate: item.endDate ? formatDate(item.endDate) : '',
            status: (() => {
              if (item.endDate) {
                const end = new Date(item.endDate);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                if (end < now) return 'expired';
              }
              return (item.status || 'active').toLowerCase();
            })(),
            memberSince: item.createdAt ? formatDate(item.createdAt) : 'N/A',
            nextPayment: item.endDate ? formatDate(item.endDate) : 'N/A',
            totalPayments: item.amount || 0,
            pendingPayments: item.balanceAmount || 0,
            netPayable: item.netPayable,
            memberId: item.memberId,
            profilePhoto: item.profilePhoto
              ? (item.profilePhoto.startsWith('http') || item.profilePhoto.startsWith('data:')
                ? item.profilePhoto
                : `${backendurl.replace('/gym', '').replace(/\/+$/, '')}${item.profilePhoto.startsWith('/') ? '' : '/'}${item.profilePhoto}`)
              : null,
            _subId: item._subId
          };
        });

        setMembers(transformedMembers);

        if (result.pagination) {
          setTotalPages(result.pagination.pages);
          setTotalMembers(result.pagination.total);
        }

        if (result.stats) {
          setStats(result.stats);
        }
      } else {
        throw new Error(result.message || 'Failed to fetch members');
      }
    } catch (err) {
      console.error('Error fetching members:', err);
      setError(err.message);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (location.state?.filter) {
      setFilterStatus(location.state.filter);
    }
  }, [location.state]);

  useEffect(() => {
    if (!isauthenticated) {
      navigate("/");
      return;
    }
    getuserdata();
    fetchMembers();
    window.scrollTo(0, 0);
  }, [isauthenticated, navigate, currentPage, searchName, filterStatus]); // Trigger fetch on these changes

  // Client-side filtering for Plan ONLY (as server handles search & status)
  const filteredMembers = members.filter((member) => {
    const matchesPlan = filterPlan === "all" || (member.plan && member.plan.toLowerCase().includes(filterPlan.toLowerCase()));
    return matchesPlan;
  });

  // CLEANUP: Hide expired subscriptions if the member has an active/pending one
  // Note: With pagination, this check assumes the active/pending sub IS IN THE CURRENT PAGE. 
  // If it's on another page, we might show expired erroneously in this list. 
  // But given flatten=true aggregates data per member (sort of), wait.
  // flatten=true aggregation returns ONE doc per member-subscription pair.
  // So a member with 3 subs appears 3 times? 
  // Code in member.js: { $unwind: "$subs" } -> Yes.
  // This logic works best if we fetch ALL rows for a member. Server-side pagination splits them.
  // We might need to live with this limitation or solve it server-side.
  // For now, I'll keep the client-side cleanup for what's visible.

  const finalVisibleMembers = filteredMembers.filter((sub) => {
    // Only check against CURRENT page loaded members
    const hasCurrentSub = members.some(m =>
      m.memberId === sub.memberId &&
      (m.status === 'active' || m.status === 'pending')
    );
    if (hasCurrentSub && sub.status === 'expired') {
      return false;
    }
    return true;
  });

  const handleAddSubscription = () => {
    navigate('/addmember');
  };

  const handleRefresh = () => {
    fetchMembers();
  };

  const handleViewMemberDetails = (member) => {
    navigate('/newsub', { state: { selectedMember: member } });
  };

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-breadcrumb">Dashboard / Subscriptions</div>
        <div className="header-actions"></div>
      </header>
      <main>
        <div className="dash-content">
          <div className="subscriptions-listing">
            {/* Stats Cards - Note: These counts should ideally come from backend stats API to be accurate across all pages */}
            <div className="overview-stats">
              <div className="stat-card total">
                <h3>{stats.total}</h3>
                <p>Total Subscriptions</p>
                <span className="stat-change positive">All Time</span>
              </div>
              <div className="stat-card active">
                <h3>{stats.active}</h3>
                <p>Active Subscriptions</p>
                <span className="stat-change positive">View Active</span>
              </div>
              <div className="stat-card pending">
                <h3>{stats.pending}</h3>
                <p>Pending Payments</p>
                <span className="stat-change warning">View Pending</span>
              </div>
              <div className="stat-card expired">
                <h3>{stats.expired}</h3>
                <p>Expired Subscriptions</p>
                <span className="stat-change warning">View Expired</span>
              </div>
            </div>

            {/* Filters */}
            <div className="listing-filters">
              <div className="search-controls">
                <input
                  className="dash-search"
                  placeholder="Search subscriptions..."
                  value={searchName}
                  onChange={(e) => {
                    setSearchName(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <select
                className="status-filter"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                {/* Payment Due status support needs backend alignment or frontend post-filtering. Backend supports status field. */}
              </select>
              <select
                className="status-filter"
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
              >
                <option value="all">All Plans</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Half-Yearly">Half-Yearly</option>
                <option value="Yearly">Yearly</option>
                <option value="Personal Training">Personal Training</option>
              </select>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading subscriptions...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <h3>Error Loading Subscriptions</h3>
                <p>{error}</p>
                <button className="btn-primary" onClick={handleRefresh}>Try Again</button>
              </div>
            ) : finalVisibleMembers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No subscriptions found</h3>
                <p>Try adjusting your search or filters.</p>
                <button className="btn-primary" onClick={handleAddSubscription}>+ Add Subscription</button>
              </div>
            ) : (
              <div className="subscriptions-table-container">
                <table className="subscriptions-table">
                  <thead>
                    <tr>
                      <th>Photo</th>
                      <th>Member ID</th>
                      <th>Member Name</th>
                      <th>Phone</th>
                      <th>Plan</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalVisibleMembers.map((member, index) => {
                      const isFirstForMember = index === 0 || finalVisibleMembers[index - 1].memberId !== member.memberId;
                      let rowSpan = 1;
                      if (isFirstForMember) {
                        for (let i = index + 1; i < finalVisibleMembers.length; i++) {
                          if (finalVisibleMembers[i].memberId === member.memberId) {
                            rowSpan++;
                          } else {
                            break;
                          }
                        }
                      }

                      return (
                        <tr
                          key={`${member._id}-${member._subId || index}`}
                          onClick={() => handleViewMemberDetails(member)}
                          style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                          className="clickable-row"
                        >
                          {isFirstForMember && (
                            <>
                              <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                <div className="member-photo-cell" style={{ margin: '0 auto' }}>
                                  <img
                                    src={member.profilePhoto || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Default'}
                                    alt="Profile"
                                    className="member-table-photo"
                                    width={40}
                                    height={40}
                                    loading="lazy"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Default';
                                    }}
                                  />
                                </div>
                              </td>
                              <td rowSpan={rowSpan} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                <span className="attendance-id-badge" style={{ background: '#e0f2fe', color: '#0369a1', margin: 0 }}>
                                  {member.memberId || 'N/A'}
                                </span>
                              </td>
                              <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                <div className="table-cell-name">
                                  <button
                                    className="member-name-link"
                                    onClick={(e) => { e.stopPropagation(); handleViewMemberDetails(member); }}
                                    title="View Member Details"
                                  >
                                    <div className="member-name">{member.memberName}</div>
                                  </button>
                                </div>
                              </td>
                              <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                {member.phone}
                              </td>
                            </>
                          )}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              <span className="plan-badge" style={{ whiteSpace: 'nowrap' }}>
                                {member.plan}
                              </span>
                            </div>
                          </td>
                          <td>{member.startDate}</td>
                          <td>{member.endDate}</td>
                          <td>
                            <span className={`status-badge ${member.status?.toLowerCase()}`}>
                              {member.status?.charAt(0).toUpperCase() + member.status?.slice(1)}
                            </span>
                          </td>
                          <td>
                            {member.pendingPayments > 0 && (
                              <span style={{ fontWeight: '600', color: '#ef4444' }}>
                                ₹{member.pendingPayments.toLocaleString()}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                  Page {currentPage} of {totalPages} • Total: {totalMembers}
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
        </div>
      </main>
    </div>
  );
}