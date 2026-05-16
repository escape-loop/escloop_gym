// Dashboard.jsx
import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../context/context.jsx";
import {
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  RefreshCcw,
  UserPlus,
  Wrench,
  Bell,
  ChevronRight
} from "lucide-react";
import axios from "axios";
import "../styles/dashboard.css";
import ToggleButton from "../components/ToggleButton.jsx";

export default function Dashboard() {
  const { isauthenticated, getuserdata, userdata, backendurl } = useContext(AppContent);
  const navigate = useNavigate();

  // Stats and Alerts State
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    expiredMembers: 0,
    pendingPayments: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isauthenticated) {
      navigate("/");
    } else {
      getuserdata();
      fetchDashboardData();
    }
  }, [isauthenticated]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, alertsRes] = await Promise.all([
        axios.get(`${backendurl}/dashboard/stats`, { withCredentials: true }),
        axios.get(`${backendurl}/dashboard/recent-alerts`, { withCredentials: true })
      ]);

      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
      if (alertsRes.data.success) {
        setAlerts(alertsRes.data.alerts);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const IconMap = {
    DollarSign: <DollarSign size={18} />,
    RefreshCcw: <RefreshCcw size={18} />,
    UserPlus: <UserPlus size={18} />,
    Wrench: <Wrench size={18} />,
    Clock: <Clock size={18} />,
    Bell: <Bell size={18} />
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'payment': return '#f97316'; // Orange
      case 'renewal': return '#ef4444'; // Red
      case 'lead': return '#3b82f6'; // Blue
      case 'maintenance': return '#8b5cf6'; // Purple
      default: return '#64748b';
    }
  };

  return (
    <div className="dash-root">
      <main className="dash-main">
        <header className="dash-header">
          <div className="dash-header-left">
            <ToggleButton isOpen={false} onClick={() => { }} />
            <div className="dash-breadcrumb" style={{ marginLeft: "40px" }}>
              Dashboard / Home
            </div>
          </div>
          <div className="dash-header-right">
          </div>
        </header>

        <div className="dash-content">
          {/* Top Metrics Grid */}
          <div className="dash-grid-top" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div className="dash-card metric" onClick={() => navigate('/members')} style={{ cursor: 'pointer' }}>
              <div className="dash-card-icon-wrapper" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                <Users size={20} />
              </div>
              <div>
                <div className="dash-card-title">Total Members</div>
                <div className="dash-metric-value">{stats.totalMembers}</div>
              </div>
            </div>

            <div className="dash-card metric" onClick={() => navigate('/members', { state: { filter: 'Active' } })} style={{ cursor: 'pointer' }}>
              <div className="dash-card-icon-wrapper" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
                <CheckCircle size={20} />
              </div>
              <div>
                <div className="dash-card-title">Active Members</div>
                <div className="dash-metric-value" style={{ color: '#059669' }}>{stats.activeMembers}</div>
              </div>
            </div>

            <div className="dash-card metric" onClick={() => navigate('/members', { state: { filter: 'Expired' } })} style={{ cursor: 'pointer' }}>
              <div className="dash-card-icon-wrapper" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                <AlertCircle size={20} />
              </div>
              <div>
                <div className="dash-card-title">Expired Members</div>
                <div className="dash-metric-value" style={{ color: '#dc2626' }}>{stats.expiredMembers}</div>
              </div>
            </div>

            <div className="dash-card metric" onClick={() => navigate('/notifications')} style={{ cursor: 'pointer' }}>
              <div className="dash-card-icon-wrapper" style={{ backgroundColor: '#fff7ed', color: '#f97316' }}>
                <Clock size={20} />
              </div>
              <div>
                <div className="dash-card-title">Pending Payments</div>
                <div className="dash-metric-value" style={{ color: '#f97316' }}>{stats.pendingPayments}</div>
              </div>
            </div>
          </div>

          {/* Recent Alerts Section */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Recently Added Notifications</h2>
              <button
                onClick={() => navigate('/notifications')}
                className="btn-text"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f97316', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer' }}
              >
                View All <ChevronRight size={16} />
              </button>
            </div>

            <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading alerts...</div>
              ) : alerts.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No recent notifications found.</div>
              ) : (
                <div className="dash-alerts-list">
                  {alerts.map((alert, index) => (
                    <div
                      key={alert.id + index}
                      className="dash-alert-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '16px 24px',
                        borderBottom: index === alerts.length - 1 ? 'none' : '1px solid #f1f5f9',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={() => navigate('/notifications')}
                    >
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          backgroundColor: `${getAlertColor(alert.type)}15`,
                          color: getAlertColor(alert.type),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: '16px'
                        }}
                      >
                        {IconMap[alert.icon] || <Bell size={18} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{alert.title}</div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{alert.subtitle}</div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {new Date(alert.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
