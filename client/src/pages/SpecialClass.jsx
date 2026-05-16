import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Search, RefreshCw, Dumbbell, Wind, ChevronLeft, ChevronRight } from 'lucide-react';
import '../styles/dashboard.css';

export default function SpecialClass() {
    const { backendurl, sidebarOpen, setSidebarOpen, isauthenticated } = useContext(AppContent);
    const navigate = useNavigate();

    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all'); // 'all' | 'pt' | 'sauna'
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const LIMIT = 50;

    // Stats
    const [stats, setStats] = useState({ totalPt: 0, totalSauna: 0, activeMembers: 0 });

    useEffect(() => {
        if (!isauthenticated) navigate('/');
    }, [isauthenticated]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const params = new URLSearchParams({
                page: currentPage,
                limit: LIMIT,
                search: search || '',
                type: filterType
            });

            const res = await axios.get(`${backendurl}/special-classes?${params}`, { headers, withCredentials: true });

            if (res.data.success) {
                setMembers(res.data.members || []);
                setTotalPages(res.data.pagination?.pages || 1);
                setTotalCount(res.data.pagination?.total || 0);
                if (res.data.stats) setStats(res.data.stats);
            } else {
                throw new Error(res.data.message || 'Failed to load');
            }
        } catch (err) {
            console.error('SpecialClass fetch error:', err);
            setError(err.message);
            setMembers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (backendurl) fetchMembers();
    }, [backendurl, currentPage, search, filterType]);

    const logSession = async (subscriptionId, sessionType) => {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await axios.post(
                `${backendurl}/special-classes/log`,
                { subscriptionId, sessionType },
                { headers, withCredentials: true }
            );

            if (res.data.success) {
                toast.success(`${sessionType === 'pt' ? '🏋️ PT' : '🧖 Sauna'} session logged!`);
                // Update local state
                setMembers(prev => prev.map(m => {
                    if (m._subId !== subscriptionId) return m;
                    if (sessionType === 'pt') {
                        return { ...m, ptSessionsUsed: Math.min(m.ptSessionsUsed + 1, m.ptSessionsTotal) };
                    } else {
                        return { ...m, steamSessionsUsed: Math.min(m.steamSessionsUsed + 1, m.steamSessionsTotal) };
                    }
                }));
            } else {
                toast.error(res.data.message || 'Failed to log session');
            }
        } catch (err) {
            toast.error('Error logging session');
        }
    };

    const getPhotoUrl = (photo, name) => {
        if (!photo) return `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'x'}`;
        if (photo.startsWith('http') || photo.startsWith('data:')) return photo;
        const base = backendurl ? backendurl.replace('/gym', '').replace(/\/+$/, '') : '';
        return `${base}${photo.startsWith('/') ? '' : '/'}${photo}`;
    };

    const SessionDots = ({ used, total, color }) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '200px' }}>
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        width: '14px', height: '14px', borderRadius: '3px',
                        background: i < used ? color : '#e5e7eb',
                        transition: 'background 0.2s'
                    }}
                />
            ))}
        </div>
    );

    return (
        <div className="dash-main">
            <header className="dash-header">
                <div className="dash-breadcrumb">Dashboard / Special Classes</div>
                <div className="header-actions">
                    <button
                        className="btn-secondary"
                        onClick={() => fetchMembers()}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </header>

            <main>
                <div className="dash-content">
                    <div className="subscriptions-listing">

                        {/* Stats */}
                        <div className="overview-stats">
                            <div className="stat-card total">
                                <h3>{totalCount}</h3>
                                <p>Members with Special Plans</p>
                                <span className="stat-change positive">All Active</span>
                            </div>
                            <div className="stat-card active">
                                <h3>{stats.totalPt}</h3>
                                <p>PT Sessions Remaining</p>
                                <span className="stat-change positive">🏋️ Personal Training</span>
                            </div>
                            <div className="stat-card pending">
                                <h3>{stats.totalSauna}</h3>
                                <p>Sauna Sessions Remaining</p>
                                <span className="stat-change warning">🧖 Sauna / Steam</span>
                            </div>
                            <div className="stat-card expired">
                                <h3>{stats.activeMembers}</h3>
                                <p>Active Members</p>
                                <span className="stat-change warning">Ongoing</span>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="listing-filters">
                            <div className="search-controls" style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    className="dash-search"
                                    placeholder="Search members..."
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                                    style={{ paddingLeft: '36px' }}
                                />
                            </div>
                            <select
                                className="status-filter"
                                value={filterType}
                                onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="all">All Types</option>
                                <option value="pt">PT Sessions Only</option>
                                <option value="sauna">Sauna Only</option>
                            </select>
                        </div>

                        {/* Table */}
                        {loading ? (
                            <div className="loading-state">
                                <div className="loading-spinner"></div>
                                <p>Loading special classes...</p>
                            </div>
                        ) : error ? (
                            <div className="error-state">
                                <div className="error-icon">⚠️</div>
                                <h3>Error Loading Data</h3>
                                <p>{error}</p>
                                <button className="btn-primary" onClick={fetchMembers}>Try Again</button>
                            </div>
                        ) : members.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">🏋️</div>
                                <h3>No members with PT or Sauna sessions</h3>
                                <p>Go to Subscriptions and enable PT Session or Sauna for a member.</p>
                                <button className="btn-primary" onClick={() => navigate('/subscriptions')}>
                                    Go to Subscriptions
                                </button>
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
                                            <th>🏋️ PT Sessions</th>
                                            <th>🧖 Sauna Sessions</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {members.map((member) => (
                                            <tr key={`${member._id}-${member._subId}`} className="clickable-row">
                                                {/* Photo */}
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                    <div className="member-photo-cell" style={{ margin: '0 auto' }}>
                                                        <img
                                                            src={getPhotoUrl(member.profilePhoto, member.memberName)}
                                                            alt="Profile"
                                                            className="member-table-photo"
                                                            width={40} height={40} loading="lazy"
                                                            onError={e => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.memberName}`; }}
                                                        />
                                                    </div>
                                                </td>

                                                {/* Member ID */}
                                                <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                    <span className="attendance-id-badge" style={{ background: '#e0f2fe', color: '#0369a1', margin: 0 }}>
                                                        {member.memberId || 'N/A'}
                                                    </span>
                                                </td>

                                                {/* Name */}
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    <div className="member-name">{member.memberName}</div>
                                                    {member.trainerName && (
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Trainer: {member.trainerName}</div>
                                                    )}
                                                </td>

                                                {/* Phone */}
                                                <td style={{ verticalAlign: 'middle' }}>{member.phone}</td>

                                                {/* Plan */}
                                                <td>
                                                    <span className="plan-badge">{member.plan || 'N/A'}</span>
                                                </td>

                                                {/* PT Sessions */}
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    {member.ptSessionsTotal > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            <SessionDots used={member.ptSessionsUsed} total={member.ptSessionsTotal} color="#10b981" />
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065f46' }}>
                                                                    {member.ptSessionsUsed} / {member.ptSessionsTotal}
                                                                </span>
                                                                {member.ptSessionsUsed < member.ptSessionsTotal && (
                                                                    <button
                                                                        onClick={() => logSession(member._subId, 'pt')}
                                                                        style={{
                                                                            padding: '2px 10px', borderRadius: '6px', border: 'none',
                                                                            background: '#10b981', color: 'white', fontSize: '0.75rem',
                                                                            fontWeight: 700, cursor: 'pointer'
                                                                        }}
                                                                        title="Mark 1 PT session done"
                                                                    >
                                                                        + Done
                                                                    </button>
                                                                )}
                                                                {member.ptSessionsUsed >= member.ptSessionsTotal && (
                                                                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontStyle: 'italic' }}>Completed</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>—</span>
                                                    )}
                                                </td>

                                                {/* Sauna Sessions */}
                                                <td style={{ verticalAlign: 'middle' }}>
                                                    {member.steamSessionsTotal > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            <SessionDots used={member.steamSessionsUsed} total={member.steamSessionsTotal} color="#3b82f6" />
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e3a8a' }}>
                                                                    {member.steamSessionsUsed} / {member.steamSessionsTotal}
                                                                </span>
                                                                {member.steamSessionsUsed < member.steamSessionsTotal && (
                                                                    <button
                                                                        onClick={() => logSession(member._subId, 'sauna')}
                                                                        style={{
                                                                            padding: '2px 10px', borderRadius: '6px', border: 'none',
                                                                            background: '#3b82f6', color: 'white', fontSize: '0.75rem',
                                                                            fontWeight: 700, cursor: 'pointer'
                                                                        }}
                                                                        title="Mark 1 Sauna session done"
                                                                    >
                                                                        + Done
                                                                    </button>
                                                                )}
                                                                {member.steamSessionsUsed >= member.steamSessionsTotal && (
                                                                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontStyle: 'italic' }}>Completed</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>—</span>
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td>
                                                    <span className={`status-badge ${member.status?.toLowerCase()}`}>
                                                        {member.status?.charAt(0).toUpperCase() + member.status?.slice(1)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pagination-controls" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft size={16} /> Previous
                                </button>
                                <span className="page-info">Page {currentPage} of {totalPages} • Total: {totalCount}</span>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next <ChevronRight size={16} />
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}
