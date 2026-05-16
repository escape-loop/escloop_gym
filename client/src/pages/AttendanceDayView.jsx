import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import ToggleButton from '../components/ToggleButton.jsx';
import Sidebar from '../components/Sidebar.jsx';
import '../styles/dashboard.css';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const AttendanceDayView = () => {
    const { type, date } = useParams();
    const navigate = useNavigate();
    const { backendurl, sidebarOpen, setSidebarOpen } = useContext(AppContent);
    const [attendanceData, setAttendanceData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Manual Attendance States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [marking, setMarking] = useState(false);

    // List Filter State
    const [filterQuery, setFilterQuery] = useState('');

    useEffect(() => {
        console.log("AttendanceDayView Mounted. Params:", { type, date });
        console.log("Backend URL:", backendurl);

        const fetchAttendance = async () => {
            if (!backendurl) {
                console.error("Backend URL is missing!");
                return;
            }
            try {
                console.log(`Fetching: ${backendurl}/attendance/${type}/${date}`);
                const response = await fetch(`${backendurl}/attendance/${type}/${date}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                const data = await response.json();
                console.log("Fetch Response:", data);

                if (data.success) {
                    setAttendanceData(data.data);
                } else {
                    console.error('Failed response:', data);
                }
            } catch (error) {
                console.error('Error fetching attendance:', error);
            } finally {
                setLoading(false);
            }
        };

        if (backendurl) {
            fetchAttendance();
        } else {
            // If no backendurl, stop loading to show something (or error)
            console.warn("No backendurl available, skipping fetch");
            setLoading(false);
        }
    }, [type, date, backendurl]);

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Delete this attendance record?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, delete'
        });
        if (result.isConfirmed) {
            try {
                const response = await fetch(`${backendurl}/attendance/${id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                const data = await response.json();

                if (data.success) {
                    setAttendanceData(prev => prev.filter(item => item._id !== id));
                    toast.success('Attendance record deleted successfully');
                } else {
                    toast.error('Failed to delete: ' + data.message);
                }
            } catch (error) {
                console.error('Error deleting attendance:', error);
                toast.error('Error deleting attendance');
            }
        }
    };

    // Helper to search for person
    const searchPerson = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        try {
            // Search both APIs
            const [membersRes, staffRes] = await Promise.all([
                fetch(`${backendurl}/members?search=${searchQuery}`, { credentials: 'include' }),
                fetch(`${backendurl}/staff?search=${searchQuery}`, { credentials: 'include' })
            ]);

            const membersData = await membersRes.json();
            const staffData = await staffRes.json();

            // processing results
            let foundPerson = null;
            let foundType = null;

            if (membersData.success && membersData.members && membersData.members.length > 0) {
                // Determine best match if multiple - for now take first
                foundPerson = membersData.members[0];
                foundType = 'member';
            } else if (staffData.success && staffData.staff && staffData.staff.length > 0) {
                foundPerson = staffData.staff[0];
                foundType = 'staff';
            }

            if (foundPerson) {
                setSearchResult({ ...foundPerson, type: foundType });
            } else {
                toast.info('No member or staff found with that detail.');
                setSearchResult(null);
            }

        } catch (error) {
            console.error("Search error:", error);
            toast.error("Error searching for person");
        }
    };

    const handleMarkAttendance = async () => {
        if (!searchResult) return;
        setMarking(true);

        try {
            const payload = {
                type: searchResult.type,
                date: date, // Using the date from params
                attendanceId: searchResult.type === 'member' ? searchResult.memberId : searchResult.staffId,
                phoneNo: searchResult.phone
            };

            const response = await fetch(`${backendurl}/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                toast.success(data.message);
                // Refresh list
                const newRecord = {
                    _id: data.data._id || Date.now(), // Fallback if not returned fully
                    name: searchResult.fullName || `${searchResult.firstName} ${searchResult.lastName}`,
                    attendanceId: payload.attendanceId,
                    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                    status: 'present',
                    image: searchResult.profilePhoto || searchResult.photo || searchResult.image,
                    mobile: searchResult.phone
                };
                setAttendanceData(prev => [newRecord, ...prev]);
                setSearchResult(null);
                setSearchQuery('');
            } else {
                if (data.existing) {
                    toast.warning(data.message);
                } else {
                    toast.error(data.message);
                }
            }
        } catch (error) {
            console.error("Marking error:", error);
            toast.error("Failed to mark attendance.");
        } finally {
            setMarking(false);
        }
    };

    // Helper to construct image URL
    const getImageUrl = (imagePath) => {
        if (!imagePath) return null;
        if (imagePath.startsWith('http')) return imagePath;
        // Handle uploads path if needed
        if (imagePath.startsWith('/uploads')) return `${backendurl.replace('/gym', '')}${imagePath}`; // Adjust based on how backend serves files
        // Default fallback
        return `${backendurl}/${imagePath}`;
    };

    return (
        <div className="dash-main">
            <header className="dash-header">
                <div className="dash-header-left">
                    <ToggleButton isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
                    <div className="dash-breadcrumb">
                        Dashboard / <span style={{ cursor: 'pointer', color: '#007bff' }} onClick={() => navigate('/attendance/calendar', { state: { type } })}>Attendance Calendar</span> / {date}
                    </div>
                </div>
                <div className="dash-header-right">
                    <button
                        className="btn-secondary"
                        onClick={() => navigate('/attendance/calendar', { state: { type } })}
                    >
                        Back to Calendar
                    </button>
                </div>
            </header>

            <div className="dash-content">
                <div className="card-container" style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 className="page-title">{type.charAt(0).toUpperCase() + type.slice(1)} Attendance - {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                        <div style={{ fontSize: '1rem', color: '#666' }}>
                            Total: <strong>{attendanceData.length}</strong>
                        </div>
                    </div>

                    {/* Filter Section */}
                    <div style={{ marginBottom: '20px' }}>
                        <input
                            type="text"
                            placeholder="Search in today's list (Name, ID, Phone)..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: 'none',
                                outline: 'none',
                                backgroundColor: '#f0f2f5',
                                fontSize: '1rem'
                            }}
                        />
                    </div>

                    {/* Manual Add Section */}
                    <div style={{
                        marginBottom: '20px',
                        padding: '15px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #e9ecef'
                    }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Mark Manual Attendance for {date}</h4>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <form onSubmit={searchPerson} style={{ display: 'flex', gap: '10px', flex: 1 }}>
                                <input
                                    type="text"
                                    placeholder="Enter Member ID, Phone or Name"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        outline: 'none',
                                        flex: 1
                                    }}
                                />
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    style={{ padding: '8px 16px' }}
                                >
                                    Search
                                </button>
                            </form>
                        </div>

                        {searchResult && (
                            <div style={{
                                marginTop: '15px',
                                padding: '10px',
                                backgroundColor: 'white',
                                border: '1px solid #dee2e6',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        backgroundColor: '#e9ecef',
                                        overflow: 'hidden'
                                    }}>
                                        {getImageUrl(searchResult.profilePhoto || searchResult.photo || searchResult.image) ? (
                                            <img
                                                src={getImageUrl(searchResult.profilePhoto || searchResult.photo || searchResult.image)}
                                                alt="Profile"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {(searchResult.firstName || searchResult.name || '?').charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>
                                            {searchResult.fullName || `${searchResult.firstName} ${searchResult.lastName}`}
                                            <span style={{
                                                marginLeft: '8px',
                                                fontSize: '11px',
                                                backgroundColor: '#e2e3e5',
                                                padding: '2px 6px',
                                                borderRadius: '4px'
                                            }}>
                                                {searchResult.type.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>
                                            ID: {searchResult.memberId || searchResult.staffId} | Phone: {searchResult.phone}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <button
                                        onClick={() => setSearchResult(null)}
                                        style={{
                                            marginRight: '10px',
                                            padding: '6px 12px',
                                            border: '1px solid #ced4da',
                                            backgroundColor: 'white',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleMarkAttendance}
                                        disabled={marking}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#28a745',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            opacity: marking ? 0.7 : 1
                                        }}
                                    >
                                        {marking ? 'Marking...' : 'Mark Present'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div style={{ padding: '20px', textAlign: 'center' }}>Loading attendance data...</div>
                    ) : attendanceData.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                            <h3>No attendance records found for this date.</h3>
                            <p>No {type}s checked in on {date}.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef', textAlign: 'left' }}>
                                        <th style={{ padding: '12px' }}>Photo</th>
                                        <th style={{ padding: '12px' }}>Name</th>
                                        <th style={{ padding: '12px' }}>ID</th>
                                        <th style={{ padding: '12px' }}>Time</th>
                                        <th style={{ padding: '12px' }}>Status</th>
                                        <th style={{ padding: '12px' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {attendanceData.filter(record => {
                                        if (!filterQuery) return true;
                                        const query = filterQuery.toLowerCase();
                                        return (
                                            (record.name && record.name.toLowerCase().includes(query)) ||
                                            (record.attendanceId && record.attendanceId.toLowerCase().includes(query)) ||
                                            (record.mobile && record.mobile.includes(query))
                                        );
                                    }).map((record) => (
                                        <tr key={record._id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                            <td style={{ padding: '12px' }}>
                                                <div className="user-avatar-small" style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#e9ecef' }}>
                                                    {record.image ? (
                                                        <img
                                                            src={getImageUrl(record.image)}
                                                            alt={record.name}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.parentElement.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#666">' + record.name.charAt(0) + '</div>';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#666' }}>
                                                            {record.name.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px', fontWeight: '500' }}>{record.name}</td>
                                            <td style={{ padding: '12px', color: '#666' }}>
                                                {record.attendanceId !== 'N/A' ? record.attendanceId : (record.mobile || 'N/A')}
                                            </td>
                                            <td style={{ padding: '12px' }}>{record.time}</td>
                                            <td style={{ padding: '12px' }}>
                                                <span className={`status-badge status-${record.status.toLowerCase()}`}
                                                    style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        fontWeight: 'bold',
                                                        backgroundColor: record.status === 'present' ? '#d4edda' : '#f8d7da',
                                                        color: record.status === 'present' ? '#155724' : '#721c24'
                                                    }}>
                                                    {record.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <button
                                                    onClick={() => handleDelete(record._id)}
                                                    style={{
                                                        backgroundColor: '#ff4d4f',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '6px 12px',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceDayView;