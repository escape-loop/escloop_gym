// Sidebar.jsx
import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../context/context.jsx";
import { PlanContext } from "../context/PlanContext.jsx";
import "../styles/sidebar.css";

import logo from "../assets/logo.png";
import axios from "axios";
import { toast } from "react-toastify";

import {
  Home,
  Users,
  Layers,
  RefreshCw,
  Dumbbell,
  UserCheck,
  Wrench,
  Calendar,
  Target,
  Receipt,
  FileSpreadsheet,
  LineChart,
  CreditCard,
  BarChart,
  Bell,
  Settings,
  Lock,
  LogOut,
  CalendarCheck
} from "lucide-react";

const menuItems = [
  { id: "overview", label: "Home", path: "/dashboard", icon: Home, planFeature: null },
  { id: "members", label: "Members Management", path: "/members", icon: Users, planFeature: null },
  { id: "memberships", label: "Membership Management", path: "/planslisting", icon: Layers, planFeature: null },
  { id: "subscriptions", label: "Subscriptions", path: "/subscriptions", icon: RefreshCw, planFeature: null },
  { id: "personalized-plan", label: "Personalized Fitness Plan", path: "/fitnesslisting", icon: Dumbbell, planFeature: "aiFitnessPlan" },
  { id: "staff", label: "Staff Management", path: "/stafflisting", icon: UserCheck, planFeature: null },
  { id: "equipment", label: "Equipments Management", path: "/equiplist", icon: Wrench, planFeature: null },

  { id: "attendance", label: "Attendance", path: "/attendance/calendar", icon: Calendar, planFeature: null },
  { id: "special-classes", label: "Special Classes", path: "/special-classes", icon: CalendarCheck, planFeature: null },
  { id: "leads", label: "Leads Management", path: "/leads", icon: Target, planFeature: null },
  { id: "billing", label: "Paying & Billing System", path: "/billlisting", icon: Receipt, planFeature: null },
  { id: "salary", label: "Salary Report", path: "/salary", icon: FileSpreadsheet, planFeature: null },
  { id: "revenue", label: "Revenue Report", path: "/revenue", icon: LineChart, planFeature: null },
  { id: "expenditure", label: "Expenditure", path: "/expenselist", icon: CreditCard, planFeature: null },
  { id: "insights", label: "Business Insights", path: "/insights", icon: BarChart, planFeature: "aiBusinessInsights" },
  { id: "branch-revenue", label: "Branch Revenue", path: "/branch-revenue", icon: BarChart, planFeature: "multiBranch" },
];

export default function Sidebar({ isOpen, onClose }) {
  const { userdata, setisloggedin, backendurl } = useContext(AppContent);
  const { hasFeature } = useContext(PlanContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backendurl}/logout`);
      if (response.data.success) {
        toast.success("Logged out successfully");

        // Force-clear all browser client-side caching
        localStorage.clear();
        sessionStorage.clear();

        if (setisloggedin) setisloggedin(false);
        setTimeout(() => {
          navigate("/");
          window.location.reload();
        }, 500);
      } else {
        toast.error("Logout failed: " + response.data.message);
      }
    } catch (error) {
      console.error("Logout Error:", error);
      toast.error("An error occurred during logout");
    }
  };

  const handleNavigation = (path, label) => {
    if (label === "Membership Management") {
      navigate("/planslisting");
    } else if (label === "Subscriptions") {
      navigate("/subscriptions");
    } else if (label === "Expenditure") {
      navigate("/expenselist");
    } else if (label === "Attendance") {
      navigate("/attendance");
    } else if (label === "Leads Management") {
      navigate("/leads");
    } else {
      navigate(path);
    }

    // Check current window width and close sidebar only on mobile
    const currentWidth = window.innerWidth;
    if (currentWidth <= 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay for mobile only */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={(e) => {
            // Only close on mobile when clicking overlay (not sidebar)
            const currentWidth = window.innerWidth;
            if (currentWidth <= 1024) {
              onClose();
            }
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} role="navigation" aria-label="Main navigation">
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="app-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '40px' }}>
            <img src={logo} alt="Logo" style={{ width: "30px", height: "30px" }} />
            ESCLOOP GYM SOFTWARE
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">MAIN</div>
          {menuItems.map((item) => {
            const isLocked = item.planFeature && !hasFeature(item.planFeature);
            const isBranchManager = userdata?.role === 'branch_manager';
            
            // Hide Branch Revenue from Branch Managers
            if (item.id === 'branch-revenue' && isBranchManager) return null;

            return (
              <button
                key={item.id}
                className={`nav-item ${isLocked ? 'locked' : ''}`}
                onClick={() => handleNavigation(item.path, item.label)}
                aria-label={item.label}
              >
                <item.icon className="nav-icon" size={18} style={{ color: '#6b7280' }} />
                <span className="nav-label" style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                {isLocked && <Lock size={14} style={{ color: '#9ca3af', marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="sidebar-footer">
          <div className="nav-section-label" style={{ marginTop: '0', borderBottom: '1px solid currentColor', paddingBottom: '10px' }}>SYSTEM</div>

          <button className="nav-item" onClick={() => handleNavigation('/notifications', 'Notifications & Reminders')}>
            <Bell className="nav-icon" size={18} style={{ color: '#6b7280' }} />
            <span className="nav-label">Notifications & Reminders</span>
          </button>

          <button className="nav-item" onClick={() => handleNavigation('/settings', 'Account Settings')} style={{ marginBottom: '15px' }}>
            <Settings className="nav-icon" size={18} style={{ color: '#6b7280' }} />
            <span className="nav-label">Account Settings</span>
          </button>

          <div className="user-card" style={{ marginBottom: '10px' }}>
            <div className="avatar-mini">
              {userdata?.Name?.[0] || "U"}
            </div>
            <div className="user-info">
              <div className="user-name">{userdata?.Name || "Owner"}</div>
              <div className="user-email">{userdata?.email}</div>
            </div>
          </div>

          <button
            className="nav-item"
            onClick={handleLogout}
            style={{ color: '#ef4444', marginTop: 'auto' }}
          >
            <LogOut className="nav-icon" size={18} style={{ color: '#ef4444' }} />
            <span className="nav-label" style={{ fontWeight: '500' }}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}