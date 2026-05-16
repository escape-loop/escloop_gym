import React, { useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppContent } from "../context/context";
import ToggleButton from "../components/ToggleButton.jsx";
import "../styles/dashboard.css";
import "../styles/toggle-button.css";

export default function AttendanceHome() {
  const navigate = useNavigate();
  const { backendurl, sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState((() => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })());
  const [currentDate, setCurrentDate] = useState(new Date());
  // Initialize with state from navigation if available, otherwise default to 'member'
  const [attendanceType, setAttendanceType] = useState(location.state?.type || 'member');

  const handleDateClick = (date) => {
    setSelectedDate(date);
    navigate(`/attendance-details/${attendanceType}/${date}`);
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateYear = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(currentDate.getFullYear() + direction);
    setCurrentDate(newDate);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const goToToday = () => {
    const d = new Date();
    const today = d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0');
    setCurrentDate(new Date());
    setSelectedDate(today);
    // Navigate to the daily view for today
    navigate(`/attendance-details/${attendanceType}/${today}`, { state: { type: attendanceType } });
  };

  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Create a new Date object for the first day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Get the day of the week for the first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = firstDay.getDay();

    // Create calendar array
    const days = [];

    // FIX 1: Correct padding for Sunday-start calendar
    // Since your headers are ["Sun", "Mon"...], we just use the day index directly.
    const paddingDays = firstDayOfWeek;

    for (let i = 0; i < paddingDays; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      // FIX 2: Create Local Date String manually to avoid Timezone shifts
      // This ensures "2026-02-01" stays "2026-02-01" regardless of your timezone
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push(dateStr);
    }

    return days;
  };

  const calendarDays = generateCalendar();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Test function to verify JavaScript date calculations
  const testDateCalculations = () => {
    console.log('=== DATE CALCULATION TEST ===');

    // Test specific dates
    const testDates = [
      { date: new Date(2026, 0, 1), name: 'January 1, 2026' }, // Should be Thursday
      { date: new Date(2026, 0, 31), name: 'January 31, 2026' }, // Should be Saturday
      { date: new Date(2026, 1, 1), name: 'February 1, 2026' }, // Should be Sunday
      { date: new Date(2026, 1, 28), name: 'February 28, 2026' }, // Should be Saturday
    ];

    testDates.forEach(({ date, name }) => {
      const dayOfWeek = date.getDay();
      const dayName = dayNames[dayOfWeek];
      console.log(`${name}: ${date.toDateString()} - Day ${dayOfWeek} (${dayName})`);
    });

    // Test February days
    const feb2026 = new Date(2026, 2, 0);
    console.log(`February 2026 has ${feb2026.getDate()} days`);

    console.log('=== END TEST ===');
  };

  // Run the test once when component mounts
  React.useEffect(() => {
    testDateCalculations();

    // Also test the calendar generation
    const testCalendar = generateCalendar();
    console.log('Calendar generated successfully');
  }, []);

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-header-left">
          <ToggleButton isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
          <div className="dash-breadcrumb">Dashboard / Attendance Calendar</div>
        </div>
        <div className="dash-header-right">
          <button
            className="btn-secondary"
            onClick={() => navigate('/attendance')}
          >
            Back to Check-in
          </button>
        </div>
      </header>
      <div className="dash-content">
        <div className="attendance-calendar">
          <div className="calendar-header">
            <div>
              <h2>Select Date</h2>
              <div className="attendance-type-selector">
                <label>Attendance Type:</label>
                <select
                  value={attendanceType}
                  onChange={(e) => setAttendanceType(e.target.value)}
                  className="attendance-type-select"
                >
                  <option value="member">Member</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>
            <button className="btn-primary today-btn" onClick={goToToday}>Today</button>
          </div>

          <div className="month-year">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="nav-btn" onClick={() => navigateYear(-1)}>◀◀</button>
              <button className="nav-btn" onClick={() => navigateMonth(-1)}>◀</button>
              <div className="month-title">{monthNames[month]} {year}</div>
              <button className="nav-btn" onClick={() => navigateMonth(1)}>▶</button>
              <button className="nav-btn" onClick={() => navigateYear(1)}>▶▶</button>
            </div>
          </div>

          <div className="calendar-grid">
            {dayNames.map((dayName, index) => (
              <div key={index} className="calendar-header-label">
                {dayName}
              </div>
            ))}

            {calendarDays.map((day, idx) => {
              return (
                <div
                  key={idx}
                  className={`calendar-day ${day === selectedDate ? 'selected' : ''} ${!day ? 'empty' : ''} ${(() => { const d = new Date(); const todayStr = d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); return day === todayStr; })() ? 'today' : ''}`}
                  onClick={() => day && handleDateClick(day)}
                >
                  {day ? new Date(day).getDate() : ''}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}