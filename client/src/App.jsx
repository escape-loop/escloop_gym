import React, { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Landing from './pages/Landing.jsx';
import ForgotPassword from './pages/Forgotpassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Addmember from './pages/Addmember.jsx';
import Sidebar from './components/Sidebar.jsx';
import ToggleButton from './components/ToggleButton.jsx';
import Membership from './pages/Membership.jsx';
import Planslisting from './pages/Planslisting.jsx';
import PlanView from './pages/PlanView.jsx';
import './styles/sidebar.css';
import './styles/toggle-button.css';
import AddStaff from './pages/Addstaff.jsx';
import StaffListing from './pages/Stafflisting.jsx';
import StaffView from './pages/StaffView.jsx';
import MembersListing from './pages/Memberslisting.jsx';
import Billing from './pages/billing.jsx';
import BillListing from './pages/Billlisting.jsx';
import Payment from './pages/Payment.jsx';
import Subscriptions from './pages/Subscriptions.jsx';
import Newsub from './pages/Newsub.jsx';
import FitnessPlansAdd from './pages/addfitness.jsx';
import Fitnesslisting from './pages/Fitnesslisting.jsx';
import EquipmentAdd from './pages/Addequip.jsx';
import EquipmentListing from './pages/Equiplist.jsx';
import AddExpense from './pages/Addexpense.jsx';
import ExpenseListing from './pages/Expenselist.jsx';
import Attendance from './pages/Attendance.jsx';
import AttendanceCalendar from './pages/Attendancecalendar.jsx';
import AttendanceDayView from './pages/AttendanceDayView.jsx';
import LeadsListing from './pages/Leadslisting.jsx';
import AddLead from './pages/Addlead.jsx';
import SalaryReport from './pages/Salary.jsx';
import Revenue from './pages/Revenue.jsx';
import BusinessInsights from './pages/BusinessInsights.jsx';
import PersonalizedPlan from './pages/PersonalizedPlan.jsx';
import NotificationsReminders from './pages/NotificationsReminders.jsx';
import WhatsAppConnection from './pages/WhatsAppConnection.jsx';
import AccountSettings from './pages/AccountSettings.jsx';
import AutomationEngine from './pages/AutomationEngine.jsx';
import QrAttendance from './pages/QrAttendance.jsx';
import SpecialClass from './pages/SpecialClass.jsx';
import BranchRevenueOverview from './pages/BranchRevenueOverview.jsx';
import { useContext } from 'react';
import { AppContent } from './context/context.jsx';
import GlobalAttendanceListener from './components/GlobalAttendanceListener.jsx';
import PlanGate from './components/PlanGate.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

const App = () => {
  const { sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const location = useLocation();

  // Only show sidebar on these pages
  const showSidebar = location.pathname === '/dashboard' || location.pathname === '/addmember' || location.pathname === '/membership' || location.pathname === '/planslisting' || location.pathname === '/plans' || location.pathname === '/members' || location.pathname === '/stafflisting' || location.pathname === '/addstaff' || location.pathname === '/staffview' || location.pathname === '/billing' || location.pathname === '/billlisting' || location.pathname === '/payment' || location.pathname === '/subscriptions' || location.pathname === '/newsub' || location.pathname === '/fitnesslisting' || location.pathname === '/addfitness' || location.pathname === '/equiplist' || location.pathname === '/addequip' || location.pathname === '/expenses' || location.pathname === '/addexpense' || location.pathname === '/attendance' || location.pathname === '/attendance/calendar' || location.pathname.startsWith('/attendance/') || location.pathname.startsWith('/attendance-details/') || location.pathname === '/calendar' || location.pathname === '/auto' || location.pathname === '/manual' || location.pathname === '/personalizedplan' || location.pathname === '/leads' || location.pathname === '/addlead' || location.pathname === '/insights' || location.pathname === '/notifications' || location.pathname === '/settings' || location.pathname === '/whatsapp-settings' || location.pathname === '/salary' || location.pathname === '/revenue' || location.pathname === '/expenselist' || location.pathname === '/automation-engine' || location.pathname === '/special-classes' || location.pathname === '/branch-revenue';

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="app-container">
      <GlobalAttendanceListener />

      {/* Toggle Button - only on Dashboard and Addmember pages */}
      {showSidebar && (
        <ToggleButton isOpen={sidebarOpen} onClick={toggleSidebar} />
      )}

      {/* Sidebar - only on Dashboard and Addmember pages */}
      {showSidebar && (
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      )}

      {/* Main Content */}
      <div className={`main-content ${sidebarOpen && showSidebar ? 'sidebar-open' : ''}`} style={{ marginLeft: sidebarOpen && showSidebar ? '260px' : '0' }}>
        <Routes>
          {/* Public routes - no auth required */}
          <Route path='/' element={<Landing />} />
          <Route path='/forgotpassword' element={<ForgotPassword />} />
          <Route path='/qr-attendance' element={<QrAttendance />} />

          {/* Protected routes - require authentication */}
          <Route path='/dashboard' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path='/addmember' element={<ProtectedRoute><Addmember /></ProtectedRoute>} />
          <Route path='/members' element={<ProtectedRoute><MembersListing /></ProtectedRoute>} />
          <Route path='/membership' element={<ProtectedRoute><Membership /></ProtectedRoute>} />
          <Route path='/planview' element={<ProtectedRoute><PlanView /></ProtectedRoute>} />
          <Route path='/planslisting' element={<ProtectedRoute><Planslisting /></ProtectedRoute>} />
          <Route path='/addstaff' element={<ProtectedRoute><AddStaff /></ProtectedRoute>} />
          <Route path='/stafflisting' element={<ProtectedRoute><StaffListing /></ProtectedRoute>} />
          <Route path='/staffview' element={<ProtectedRoute><StaffView /></ProtectedRoute>} />
          <Route path='/billing' element={<ProtectedRoute><Billing /></ProtectedRoute>} />
          <Route path='/billlisting' element={<ProtectedRoute><BillListing /></ProtectedRoute>} />
          <Route path='/payment/:id' element={<ProtectedRoute><Payment /></ProtectedRoute>} />
          <Route path='/subscriptions' element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
          <Route path='/subscriptions/:id' element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
          <Route path='/newsub' element={<ProtectedRoute><Newsub /></ProtectedRoute>} />
          <Route path='/addfitness' element={<ProtectedRoute><PlanGate feature="aiFitnessPlan" requiredPlan="PRO"><FitnessPlansAdd /></PlanGate></ProtectedRoute>} />
          <Route path='/fitnesslisting' element={<ProtectedRoute><PlanGate feature="aiFitnessPlan" requiredPlan="PRO"><Fitnesslisting /></PlanGate></ProtectedRoute>} />
          <Route path='/addequip' element={<ProtectedRoute><EquipmentAdd /></ProtectedRoute>} />
          <Route path='/equiplist' element={<ProtectedRoute><EquipmentListing /></ProtectedRoute>} />
          <Route path='/addexpense' element={<ProtectedRoute><AddExpense /></ProtectedRoute>} />
          <Route path='/expenselist' element={<ProtectedRoute><ExpenseListing /></ProtectedRoute>} />
          <Route path='/attendance' element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
          <Route path='/attendance/calendar' element={<ProtectedRoute><AttendanceCalendar /></ProtectedRoute>} />
          <Route path='/attendance-details/:type/:date' element={<ProtectedRoute><AttendanceDayView /></ProtectedRoute>} />
          <Route path='/leads' element={<ProtectedRoute><LeadsListing /></ProtectedRoute>} />
          <Route path='/addlead' element={<ProtectedRoute><AddLead /></ProtectedRoute>} />
          <Route path='/salary' element={<ProtectedRoute><SalaryReport /></ProtectedRoute>} />
          <Route path='/revenue' element={<ProtectedRoute><Revenue /></ProtectedRoute>} />
          <Route path='/insights' element={<ProtectedRoute><PlanGate feature="aiBusinessInsights" requiredPlan="ELITE"><BusinessInsights /></PlanGate></ProtectedRoute>} />
          <Route path='/personalizedplan' element={<ProtectedRoute><PlanGate feature="aiFitnessPlan" requiredPlan="PRO"><PersonalizedPlan /></PlanGate></ProtectedRoute>} />
          <Route path='/notifications' element={<ProtectedRoute><NotificationsReminders /></ProtectedRoute>} />
          <Route path='/whatsapp-settings' element={<ProtectedRoute><WhatsAppConnection /></ProtectedRoute>} />
          <Route path='/settings' element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
          <Route path='/automation-engine' element={<ProtectedRoute><AutomationEngine /></ProtectedRoute>} />
          <Route path='/special-classes' element={<ProtectedRoute><SpecialClass /></ProtectedRoute>} />
          <Route path='/branch-revenue' element={<ProtectedRoute><BranchRevenueOverview /></ProtectedRoute>} />
        </Routes>
      </div>
    </div>
  )



}

export default App