// Add Lead Page
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import '../styles/dashboard.css';
import '../styles/addlead.css';
import ToggleButton from '../components/ToggleButton.jsx';
import axios from 'axios';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

export default function AddLead() {
  const { isauthenticated, getuserdata, userdata, backendurl, sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const navigate = useNavigate();
  const location = useLocation();

  const [leadData, setLeadData] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'website',
    status: 'new',
    interestLevel: 'medium',
    notes: '',
    nextFollowUpDate: '',
    lastContactedDate: '',
    interestedService: '',
    location: ''
  });

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isauthenticated) {
      navigate("/");
      return;
    }
    getuserdata();

    // Check if editing existing lead
    if (location.state?.lead && location.state?.isEditing) {
      const lead = location.state.lead;
      console.log('Editing lead data received:', lead);
      console.log('nextFollowUpDate from backend:', lead.nextFollowUpDate);
      console.log('nextFollowUpDate type:', typeof lead.nextFollowUpDate);

      // Format date for HTML input
      let formattedDate = '';
      if (lead.nextFollowUpDate) {
        if (typeof lead.nextFollowUpDate === 'string') {
          // If it's a string, convert to Date and format
          const date = new Date(lead.nextFollowUpDate);
          formattedDate = date.getFullYear() + '-' + (date.getMonth() + 1).toString().padStart(2, '0') + '-' + date.getDate().toString().padStart(2, '0');
        } else if (lead.nextFollowUpDate instanceof Date) {
          // If it's already a Date object
          formattedDate = lead.nextFollowUpDate.getFullYear() + '-' + (lead.nextFollowUpDate.getMonth() + 1).toString().padStart(2, '0') + '-' + lead.nextFollowUpDate.getDate().toString().padStart(2, '0');
        }
      }

      console.log('Formatted date for input:', formattedDate);

      setLeadData({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        status: lead.status,
        interestLevel: lead.interestLevel,
        notes: lead.notes,
        nextFollowUpDate: formattedDate,
        lastContactedDate: lead.lastContactedDate ? (() => { const d = new Date(lead.lastContactedDate); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })() : '',
        interestedService: lead.interestedService || '',
        location: lead.location || ''
      });
      setIsEditing(true);
    }
  }, [isauthenticated, navigate, location.state]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLeadData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleConvertToMember = () => {
    // Navigate to add member page with current lead data
    // Ensure we pass the ID from the original lead since leadData state might not have it
    const leadId = location.state?.lead?._id;
    const leadPayload = { ...leadData, _id: leadId };
    navigate('/addmember', { state: { lead: leadPayload, isLead: true } });
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: 'Delete this lead?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete'
    });
    if (result.isConfirmed) {
      try {
        const response = await axios.delete(`${backendurl}/leads/${location.state.lead._id}`, {
          withCredentials: true,
        });

        if (response.data.success) {
          toast.success('Lead deleted successfully');
          setTimeout(() => navigate('/leads'), 1500);
        } else {
          toast.error(response.data.message || 'Failed to delete lead');
        }
      } catch (error) {
        console.error('Error deleting lead:', error);
        toast.error('Error deleting lead. Please try again.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields before sending
      if (!leadData.name?.trim()) {
        toast.error('Please enter a valid name');
        return;
      }

      if (!leadData.phone?.trim()) {
        toast.error('Please enter a valid phone number');
        return;
      }

      // Prepare data for backend
      const submitData = {
        ...leadData,
        // Only include email if it's not empty
        ...(leadData.email?.trim() && { email: leadData.email.trim() }),
        // Only include nextFollowUpDate if it's not empty
        ...(leadData.nextFollowUpDate && { nextFollowUpDate: leadData.nextFollowUpDate }),
        // Only include lastContactedDate if it's not empty
        ...(leadData.lastContactedDate && { lastContactedDate: leadData.lastContactedDate }),
        // Ensure other fields are properly formatted
        name: leadData.name.trim(),
        phone: leadData.phone.trim(),
        location: leadData.location?.trim() || '',
        notes: leadData.notes?.trim() || '',
      };

      console.log('Lead data being sent:', submitData);

      if (isEditing) {
        // Update existing lead
        console.log('Updating lead:', submitData);
        const response = await axios.put(`${backendurl}/leads/${location.state.lead._id}`, submitData, {
          withCredentials: true,
        });

        console.log('Update response:', response);

        if (response.data.success) {
          toast.success('Lead updated successfully');
          setTimeout(() => navigate('/leads'), 1500);
        } else {
          toast.error(response.data.message || 'Failed to update lead');
        }
      } else {
        // Create new lead
        console.log('Creating lead:', submitData);
        const response = await axios.post(`${backendurl}/leads/add`, submitData, {
          withCredentials: true,
        });

        console.log('Create response:', response);

        if (response.data.success) {
          toast.success('Lead created successfully');
          setTimeout(() => navigate('/leads'), 1500);
        } else {
          toast.error(response.data.message || 'Failed to create lead');
        }
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      toast.error(`Error saving lead: ${error.response?.data?.message || 'Please check the console for details'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-header-left">
          <ToggleButton isOpen={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} />
          <div className="dash-breadcrumb">
            Dashboard / {isEditing ? 'Edit Lead' : 'Add New Lead'}
          </div>
        </div>
        <div className="dash-header-right">
          {isEditing && (
            <>
              <button
                className="btn-danger"
                onClick={handleDelete}
                style={{
                  backgroundColor: '#ef4444',
                  borderColor: '#ef4444',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#dc2626';
                  e.target.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#ef4444';
                  e.target.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.2)';
                }}
              >
                Delete Lead
              </button>
              <button
                className="btn-primary"
                onClick={handleConvertToMember}
                style={{
                  backgroundColor: '#22c55e',
                  borderColor: '#22c55e',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#16a34a';
                  e.target.style.boxShadow = '0 4px 8px rgba(34, 197, 94, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#22c55e';
                  e.target.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.2)';
                }}
              >
                Convert to Member
              </button>
            </>
          )}
        </div>
      </header>

      <div className="dash-content">
        <div className="add-lead-form">
          <div className="form-header">
            <h2>{isEditing ? 'Edit Lead' : 'Add New Lead'}</h2>
            <p>Fill in the lead information below</p>
          </div>

          <form onSubmit={handleSubmit} className="lead-form">
            <div className="form-section">
              <h3>Basic Information</h3>
              <div className="nm-grid">
                <div className="nm-field">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={leadData.name}
                    onChange={handleChange}
                    placeholder="Enter full name"
                    required
                    className="nm-field"
                  />
                </div>
                <div className="nm-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={leadData.email}
                    onChange={handleChange}
                    placeholder="Enter email address"
                    className="nm-field"
                  />
                </div>
                <div className="nm-field">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={leadData.phone}
                    onChange={handleChange}
                    placeholder="Enter phone number"
                    required
                    className="nm-field"
                  />
                </div>
                <div className="nm-field">
                  <label>Location</label>
                  <input
                    type="text"
                    name="location"
                    value={leadData.location}
                    onChange={handleChange}
                    placeholder="Enter location"
                    className="nm-field"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Lead Details</h3>
              <div className="nm-grid">
                <div className="nm-field">
                  <label>Lead Source</label>
                  <select
                    name="source"
                    value={leadData.source}
                    onChange={handleChange}
                    className="nm-field"
                  >
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="social_media">Social Media</option>
                    <option value="walk_in">Walk In</option>
                    <option value="event">Event</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="nm-field">
                  <label>Status</label>
                  <select
                    name="status"
                    value={leadData.status}
                    onChange={handleChange}
                    className="nm-field"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                <div className="nm-field">
                  <label>Interest Level</label>
                  <select
                    name="interestLevel"
                    value={leadData.interestLevel}
                    onChange={handleChange}
                    className="nm-field"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="nm-field">
                  <label>Last Contacted Date</label>
                  <input
                    type="date"
                    name="lastContactedDate"
                    value={leadData.lastContactedDate}
                    onChange={handleChange}
                    className="nm-field"
                  />
                </div>
              </div>

              <div className="nm-grid" style={{ marginTop: "15px" }}>
                <div className="nm-field">
                  <label>Next Follow Up Date</label>
                  <input
                    type="date"
                    name="nextFollowUpDate"
                    value={leadData.nextFollowUpDate}
                    onChange={handleChange}
                    className="nm-field"
                  />
                </div>
                <div className="nm-field">
                  <label>Interested Service</label>
                  <select
                    name="interestedService"
                    value={leadData.interestedService}
                    onChange={handleChange}
                    className="nm-field"
                  >
                    <option value="">Select Service</option>
                    <option value="Gym Membership">Gym Membership</option>
                    <option value="Personal Training">Personal Training</option>
                    <option value="Group Classes">Group Classes</option>
                    <option value="Nutrition Plan">Nutrition Plan</option>
                    <option value="Weight Loss Program">Weight Loss Program</option>
                    <option value="Bodybuilding">Bodybuilding</option>
                    <option value="Yoga">Yoga</option>
                    <option value="CrossFit">CrossFit</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Additional Information</h3>
              <div className="nm-field" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={leadData.notes}
                  onChange={handleChange}
                  placeholder="Add any additional notes about this lead..."
                  rows="4"
                  className="nm-field"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/leads')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : (isEditing ? 'Update Lead' : 'Add Lead')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}