// pages/AttendanceCalendar.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import Sidebar from '../components/Sidebar.jsx';
import ToggleButton from '../components/ToggleButton.jsx';
import '../styles/dashboard.css';
import '../styles/sidebar.css';
import '../styles/toggle-button.css';

export default function Attendance() {
  const { backendurl, sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const navigate = useNavigate();

  // State for check-in/check-out functionality
  const [memberIdInput, setMemberIdInput] = useState('');
  const [memberPhoneInput, setMemberPhoneInput] = useState('');
  const [staffIdInput, setStaffIdInput] = useState('');
  const [staffPhoneInput, setStaffPhoneInput] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success', 'error', 'info'
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // State to store person details for display on the right side
  const [displayedPerson, setDisplayedPerson] = useState(null);

  // Helper function to search for person by ID or phone number
  // type: 'member' | 'staff' | null (null searches both)
  const searchPerson = async (searchData, type = null) => {
    const searchPromises = [];
    const { attendanceId, phone } = searchData;

    // If type is specified, search only that type
    if (type === 'member') {
      if (attendanceId) {
        const paddedId = attendanceId.toString().trim().padStart(4, '0');
        console.log(`Searching Member DB only (ID: ${paddedId})`);
        searchPromises.push(
          fetch(`${backendurl}/members?search=${paddedId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }).then(res => res.json().then(data => ({ ...data, source: 'members' })))
        );
      }
      if (phone) {
        searchPromises.push(
          fetch(`${backendurl}/members?search=${phone}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }).then(res => res.json().then(data => ({ ...data, source: 'members' })))
        );
      }
    } else if (type === 'staff') {
      // For Staff, we MUST include status=all because default is Only Active
      if (attendanceId) {
        const idStr = attendanceId.toString().trim();
        console.log(`Searching Staff DB only (ID: ${idStr})`);
        searchPromises.push(
          fetch(`${backendurl}/staff?search=${idStr}&status=all`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }).then(res => res.json().then(data => ({ ...data, source: 'staff' })))
        );
      }
      if (phone) {
        searchPromises.push(
          fetch(`${backendurl}/staff?search=${phone}&status=all`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }).then(res => res.json().then(data => ({ ...data, source: 'staff' })))
        );
      }
    } else {
      // Legacy fallback: search both (for backward compatibility)
      if (attendanceId) {
        const idStr = attendanceId.toString().trim();
        searchPromises.push(
          fetch(`${backendurl}/members?search=${idStr}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }).then(res => res.json().then(data => ({ ...data, source: 'members' })))
        );
        searchPromises.push(
          fetch(`${backendurl}/staff?search=${idStr}&status=all`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }).then(res => res.json().then(data => ({ ...data, source: 'staff' })))
        );
      }
      if (phone) {
        searchPromises.push(
          fetch(`${backendurl}/members?search=${phone}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }).then(res => res.json().then(data => ({ ...data, source: 'members' })))
        );
        searchPromises.push(
          fetch(`${backendurl}/staff?search=${phone}&status=all`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }).then(res => res.json().then(data => ({ ...data, source: 'staff' })))
        );
      }
    }

    try {
      const results = await Promise.all(searchPromises);

      // Find the first successful result with matching data
      for (const result of results) {
        // Handle Member Result
        if (result.success && result.members && result.source === 'members') {
          const foundMember = result.members.find(member => {
            if (attendanceId) {
              const paddedId = attendanceId.toString().trim().padStart(4, '0');
              return member.memberId === paddedId;
            } else if (phone) {
              // Relaxed check for phone: contains the input
              return member.phone && member.phone.includes(phone);
            }
            return false;
          });
          if (foundMember) {
            setDisplayedPerson({
              ...foundMember,
              type: 'member',
              searchQuery: attendanceId || phone
            });
            return { data: foundMember, type: 'member' };
          }
        }

        // Handle Staff Result
        if (result.success && result.staff && result.source === 'staff') {
          const foundStaff = result.staff.find(staff => {
            if (attendanceId) {
              return staff.staffId === attendanceId.toString().trim();
            } else if (phone) {
              // Relaxed check for phone: contains the input
              return staff.phone && staff.phone.includes(phone);
            }
            return false;
          });
          if (foundStaff) {
            setDisplayedPerson({
              ...foundStaff,
              type: 'staff',
              searchQuery: attendanceId || phone
            });
            return { data: foundStaff, type: 'staff' };
          }
        }
      }

      // Clear displayed person if no match found
      setDisplayedPerson(null);
      return null;
    } catch (error) {
      console.error("Error in searchPerson:", error);
      return null;
    }
  };

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time for display
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format person details for display
  const formatPersonDetails = (person) => {
    if (!person) return null;

    return {
      name: person.fullName || `${person.firstName} ${person.lastName}`,
      type: person.type || 'Unknown',
      id: person.memberId || person.staffId || person.attendanceId || 'N/A',
      phone: person.phone || 'N/A',
      email: person.email || 'N/A',
      membership: person.packageName || person.role || 'N/A',
      joinedDate: person.joinDate ? new Date(person.joinDate).toLocaleDateString() : 'N/A',
      status: person.status || 'Active',
      attendanceTime: person.attendanceTime || 'Not checked in',
      attendanceDate: person.attendanceDate || 'Not checked in'
    };
  };

  // Person card component for displaying person details on the right side
  const PersonCard = ({ person }) => {
    const details = formatPersonDetails(person);
    if (!details) return null;

    // Helper function to get profile photo URL
    const getProfilePhotoUrl = (person) => {
      if (!person) return null;

      // Check for profile photo in different possible fields
      const photo = person.profilePhoto || person.photo || person.image;
      if (!photo) return null;

      // If already a placeholder, don't modify it
      if (photo.includes('/api/placeholder/')) {
        return photo;
      }

      // If already a full URL, use it as is
      if (photo.startsWith('http')) {
        return photo;
      }

      // If it's a relative path starting with /uploads/, use direct URL
      if (photo.startsWith('/uploads/')) {
        return `${backendurl.replace('/gym', '')}${photo}`;
      }

      // If it's a relative path, prepend backend URL
      if (photo.startsWith('/')) {
        return `${backendurl}${photo}`;
      }

      // Fallback for any other format
      return `${backendurl}/${photo}`;
    };

    const profilePhotoUrl = getProfilePhotoUrl(person);

    return (
      <div className="person-card">
        <div className="person-header">
          <div className="person-photo">
            {profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
                alt={details.name}
                onError={(e) => {
                  e.target.src = '/api/placeholder/120/120';
                  e.target.style.objectFit = 'cover';
                }}
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--border-subtle)',
                  backgroundColor: '#f3f4f6'
                }}
              />
            ) : (
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid var(--border-subtle)',
                  color: '#9ca3af',
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}
              >
                {details.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="person-info-left">
            <div className="person-name">{details.name}</div>
            <div className={`person-type ${details.type.toLowerCase()}`}>
              {details.type.toUpperCase()}
            </div>
            {person.attendanceTime && person.attendanceDate && (
              <div className="person-attendance">
                <div className="attendance-status checked-in">
                  ✅ CHECKED IN
                </div>
                <div className="attendance-time">
                  <span className="time-label">Time:</span>
                  <span className="time-value">{person.attendanceTime}</span>
                </div>
                <div className="attendance-date">
                  <span className="date-label">Date:</span>
                  <span className="date-value">{person.attendanceDate}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="person-details">
          <div className="person-meta">
            <span className="meta-label">ID:</span>
            <span className="meta-value">{details.id}</span>
          </div>
          <div className="person-meta">
            <span className="meta-label">Phone:</span>
            <span className="meta-value">{details.phone}</span>
          </div>
          <div className="person-meta">
            <span className="meta-label">Email:</span>
            <span className="meta-value">{details.email}</span>
          </div>
          <div className="person-meta">
            <span className="meta-label">Membership/Role:</span>
            <span className="meta-value">{details.membership}</span>
          </div>
          <div className="person-meta">
            <span className="meta-label">Joined:</span>
            <span className="meta-value">{details.joinedDate}</span>
          </div>
          <div className="person-meta">
            <span className="meta-label">Status:</span>
            <span className={`meta-status ${details.status.toLowerCase()}`}>{details.status}</span>
          </div>
          <div className="person-meta">
            <span className="meta-label">Attendance Time:</span>
            <span className="meta-value">{details.attendanceTime}</span>
          </div>
          <div className="person-meta">
            <span className="meta-label">Attendance Date:</span>
            <span className="meta-value">{details.attendanceDate}</span>
          </div>
        </div>
        <div className="person-actions">
          <button
            className="btn-secondary"
            onClick={() => setDisplayedPerson(null)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'white',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f3f4f6';
              e.target.style.color = 'var(--text-main)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'white';
              e.target.style.color = 'var(--text-muted)';
            }}
          >
            Clear Details
          </button>
        </div>
      </div>
    );
  };

  // Helper function to clear inputs
  const clearInputs = () => {
    setMemberIdInput('');
    setMemberPhoneInput('');
    setStaffIdInput('');
    setStaffPhoneInput('');
  };

  // Helper function to update displayed person after attendance
  const updateDisplayedPerson = (attendanceRecord, isExisting) => {
    if (displayedPerson) {
      setDisplayedPerson({
        ...displayedPerson,
        attendanceTime: attendanceRecord ? attendanceRecord.time : currentTime.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        }),
        attendanceDate: attendanceRecord ? new Date(attendanceRecord.date).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }) : currentTime.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }),
        status: isExisting ? 'Already Checked-In' : 'Checked-In'
      });
    }
  };

  // Handle MEMBER attendance submission
  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType('');

    // Clear previous person details when starting new submission
    setDisplayedPerson(null);

    // Audio Feedback System
    const playFeedback = (audioLabel) => {
      if (!audioLabel) return;

      const audioMap = {
        successful: { file: '/audio/successful.mp3', text: 'Successful' },
        expired: { file: '/audio/expired.mp3', text: 'Expired' },
        onleave: { file: '/audio/onleave.mp3', text: 'On Leave' },
        invalid: { file: '/audio/invalid.mp3', text: 'Invalid' }
      };

      const config = audioMap[audioLabel];
      if (!config) return;

      // Try playing file
      const audio = new Audio(config.file);
      audio.play().catch(() => {
        // Fallback to TTS if file fails or missing
        console.log(`Audio file missing for ${audioLabel}, falling back to TTS`);
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(config.text);
          utterance.rate = 1;
          utterance.pitch = 1;
          window.speechSynthesis.speak(utterance);
        }
      });
    };

    // Validate input
    if (!memberIdInput && !memberPhoneInput) {
      setMessage('Please enter either Member ID or Phone Number');
      setMessageType('error');
      playFeedback('invalid');
      setLoading(false);
      return;
    }

    try {
      // 1. Search for the member
      let personData = null;
      let personType = 'member';

      const searchData = {};
      if (memberIdInput) searchData.attendanceId = memberIdInput;
      if (memberPhoneInput) searchData.phone = memberPhoneInput;

      const searchResult = await searchPerson(searchData, 'member');

      if (searchResult) {
        personData = searchResult.data;
        personType = searchResult.type;
      }

      // If person not found
      if (!personData) {
        setMessage('Member not found. Please check the ID or phone number.');
        setMessageType('error');
        playFeedback('invalid');
        setLoading(false);
        return;
      }

      // FIX: Better name logic
      let finalName = personData.fullName;
      if (!finalName) {
        finalName = `${personData.firstName} ${personData.lastName}`;
      }

      // Now mark attendance
      const attendanceData = {
        date: (() => { const d = currentTime; return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })(),
        time: currentTime.toTimeString().split(' ')[0],
        type: 'member',
        personName: finalName,
        personPhone: personData.phone,
        attendanceId: personData.memberId, // Use the canonical ID from database
        phoneNo: memberPhoneInput || personData.phone
      };

      console.log('Marking member attendance for:', attendanceData);

      const response = await fetch(`${backendurl}/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(attendanceData)
      });

      const result = await response.json();
      console.log('Attendance response:', result);

      if (response.ok || result) {
        // Trigger audio feedback from result
        if (result.audio) {
          playFeedback(result.audio);
        }

        if (result.success) {
          // Success case
          const displayName = (result.person?.fullName || personData.fullName ||
            `${result.person?.firstName || personData.firstName} ${result.person?.lastName || personData.lastName}`);

          setMessage(result.message || `Attendance marked successfully for ${displayName}`);
          setMessageType('success');

          updateDisplayedPerson(result.data, false);
          clearInputs();
        } else if (result.existing) {
          // Duplicate case
          const displayName = (result.person?.fullName || personData.fullName ||
            `${result.person?.firstName || personData.firstName} ${result.person?.lastName || personData.lastName}`);

          setMessage(`Attendance ALREADY MARKED for ${displayName} today!`);
          setMessageType('error');

          updateDisplayedPerson(result.data, true);
          clearInputs();
        } else {
          // Error case (Inactive, Expired, or generic)
          const displayName = (result.person?.fullName || personData.fullName ||
            `${result.person?.firstName || personData.firstName} ${result.person?.lastName || personData.lastName}`);

          setMessage(result.message || 'Failed to record attendance');
          setMessageType('error');

          if (result.person) {
            setDisplayedPerson({
              ...result.person,
              type: personType,
              status: result.audio === 'expired' ? 'Expired' : result.person.status
            });
          }
        }
      } else {
        setMessage(result.message || 'Failed to record attendance');
        setMessageType('error');
        playFeedback('invalid');
      }

    } catch (error) {
      console.error('Error recording member attendance:', error);
      setMessage('Network error. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Handle STAFF attendance submission
  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType('');

    // Clear previous person details when starting new submission
    setDisplayedPerson(null);

    // Audio Feedback System
    const playFeedback = (audioLabel) => {
      if (!audioLabel) return;

      const audioMap = {
        successful: { file: '/audio/successful.mp3', text: 'Successful' },
        expired: { file: '/audio/expired.mp3', text: 'Expired' },
        onleave: { file: '/audio/onleave.mp3', text: 'On Leave' },
        invalid: { file: '/audio/invalid.mp3', text: 'Invalid' }
      };

      const config = audioMap[audioLabel];
      if (!config) return;

      // Try playing file
      const audio = new Audio(config.file);
      audio.play().catch(() => {
        // Fallback to TTS if file fails or missing
        console.log(`Audio file missing for ${audioLabel}, falling back to TTS`);
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(config.text);
          utterance.rate = 1;
          utterance.pitch = 1;
          window.speechSynthesis.speak(utterance);
        }
      });
    };

    // Validate input
    if (!staffIdInput && !staffPhoneInput) {
      setMessage('Please enter either Staff ID or Phone Number');
      setMessageType('error');
      playFeedback('invalid');
      setLoading(false);
      return;
    }

    try {
      // 1. Search for the staff
      let personData = null;
      let personType = 'staff';

      const searchData = {};
      if (staffIdInput) searchData.attendanceId = staffIdInput;
      if (staffPhoneInput) searchData.phone = staffPhoneInput;

      const searchResult = await searchPerson(searchData, 'staff');

      if (searchResult) {
        personData = searchResult.data;
        personType = searchResult.type;
      }

      // If person not found
      if (!personData) {
        setMessage('Staff not found. Please check the ID or phone number.');
        setMessageType('error');
        playFeedback('invalid');
        setLoading(false);
        return;
      }

      // FIX: Better name logic
      let finalName = personData.fullName;
      if (!finalName) {
        finalName = `${personData.firstName} ${personData.lastName}`;
      }

      // Now mark attendance
      const attendanceData = {
        date: (() => { const d = currentTime; return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })(),
        time: currentTime.toTimeString().split(' ')[0],
        type: 'staff',
        personName: finalName,
        personPhone: personData.phone,
        attendanceId: personData.staffId, // Use the canonical ID from database
        phoneNo: staffPhoneInput || personData.phone
      };

      console.log('Marking staff attendance for:', attendanceData);

      const response = await fetch(`${backendurl}/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(attendanceData)
      });

      const result = await response.json();
      console.log('Attendance response:', result);

      if (response.ok || result) {
        // Trigger audio feedback from result
        if (result.audio) {
          playFeedback(result.audio);
        }

        if (result.success) {
          // Success case
          const displayName = (result.person?.fullName || personData.fullName ||
            `${result.person?.firstName || personData.firstName} ${result.person?.lastName || personData.lastName}`);

          setMessage(result.message || `Attendance marked successfully for ${displayName}`);
          setMessageType('success');

          updateDisplayedPerson(result.data, false);
          clearInputs();
        } else if (result.existing) {
          // Duplicate case
          const displayName = (result.person?.fullName || personData.fullName ||
            `${result.person?.firstName || personData.firstName} ${result.person?.lastName || personData.lastName}`);

          setMessage(`Attendance ALREADY MARKED for ${displayName} today!`);
          setMessageType('error');

          updateDisplayedPerson(result.data, true);
          clearInputs();
        } else {
          // Error case (Inactive, Expired, or generic)
          const displayName = (result.person?.fullName || personData.fullName ||
            `${result.person?.firstName || personData.firstName} ${result.person?.lastName || personData.lastName}`);

          setMessage(result.message || 'Failed to record attendance');
          setMessageType('error');

          if (result.person) {
            setDisplayedPerson({
              ...result.person,
              type: personType,
              status: result.audio === 'expired' ? 'Expired' : result.person.status
            });
          }
        }
      } else {
        setMessage(result.message || 'Failed to record attendance');
        setMessageType('error');
        playFeedback('invalid');
      }

    } catch (error) {
      console.error('Error recording staff attendance:', error);
      setMessage('Network error. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-breadcrumb">Dashboard / Attendance</div>
        <div className="dash-header-right" style={{ display: 'flex', gap: '10px' }}>
          <ToggleButton isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
          <button
            className="btn-secondary"
            onClick={() => navigate('/attendance/calendar')}
          >
            View Calendar
          </button>
        </div>
      </header>
      <div className="dash-content">
        <div className="attendance-layout">
          <div className="attendance-form-section">
            <div className="attendance-checkin">
              <div className="checkin-header">
                <h2>Member & Staff Attendance</h2>
                <div className="current-time">
                  <div className="time">{formatTime(currentTime)}</div>
                  <div className="date">{formatDate(currentTime)}</div>
                </div>
              </div>

              {message && (
                <div className={`message ${messageType}`}>
                  {message}
                </div>
              )}

              <div className="checkin-form-container">
                {/* MEMBER ATTENDANCE SECTION */}
                <div className="attendance-section member-section">
                  <h3 style={{ color: 'var(--primary-color)', marginBottom: '15px' }}>Member Attendance</h3>
                  <form onSubmit={handleMemberSubmit} className="checkin-form">
                    <div className="form-group">
                      <label>Member ID</label>
                      <input
                        type="text"
                        value={memberIdInput}
                        onChange={(e) => {
                          setMemberIdInput(e.target.value);
                          setDisplayedPerson(null);
                        }}
                        placeholder="Enter ID (e.g., 1 or 0001)"
                        className="attendance-input"
                      />
                    </div>
                    <label style={{ display: "flex", justifyContent: "center" }}>OR</label>

                    <div className="form-group">
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        value={memberPhoneInput}
                        onChange={(e) => {
                          setMemberPhoneInput(e.target.value);
                          setDisplayedPerson(null);
                        }}
                        placeholder="Enter Phone Number"
                        className="attendance-input"
                      />
                    </div>

                    <div className="form-actions">
                      <button
                        type="submit"
                        className="btn-primary checkin-btn"
                        disabled={loading}
                        style={{ zIndex: 1 }}
                      >
                        {loading ? 'Processing...' : 'Submit Member Attendance'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* STAFF ATTENDANCE SECTION */}
                <div className="attendance-section staff-section" style={{ marginTop: '30px', paddingTop: '30px', borderTop: '2px solid var(--border-subtle)' }}>
                  <h3 style={{ color: 'var(--accent-color)', marginBottom: '15px' }}>Staff Attendance</h3>
                  <form onSubmit={handleStaffSubmit} className="checkin-form">
                    <div className="form-group">
                      <label>Staff ID</label>
                      <input
                        type="text"
                        value={staffIdInput}
                        onChange={(e) => {
                          setStaffIdInput(e.target.value);
                          setDisplayedPerson(null);
                        }}
                        placeholder="Enter Staff ID"
                        className="attendance-input"
                      />
                    </div>
                    <label style={{ display: "flex", justifyContent: "center" }}>OR</label>

                    <div className="form-group">
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        value={staffPhoneInput}
                        onChange={(e) => {
                          setStaffPhoneInput(e.target.value);
                          setDisplayedPerson(null);
                        }}
                        placeholder="Enter Phone Number"
                        className="attendance-input"
                      />
                    </div>

                    <div className="form-actions">
                      <button
                        type="submit"
                        className="btn-primary checkin-btn"
                        disabled={loading}
                        style={{ zIndex: 1 }}
                      >
                        {loading ? 'Processing...' : 'Submit Staff Attendance'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Right side person details card */}
          <div className="person-details-section">
            {displayedPerson && <PersonCard person={displayedPerson} />}
          </div>
        </div>

      </div>
    </div>
  );
};