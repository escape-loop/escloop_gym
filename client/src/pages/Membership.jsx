// MembershipPlan.jsx
import React, { useState, useEffect, useContext } from "react";
import imageCompression from 'browser-image-compression';
import { useNavigate, useLocation } from "react-router-dom";
import { AppContent } from "../context/context.jsx";
import axios from "axios";
import "../styles/dashboard.css";
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

export default function MembershipPlan() {
  const { isauthenticated, getuserdata, userdata, backendurl } = useContext(AppContent);
  const navigate = useNavigate();
  const location = useLocation();
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({
    name: "",
    type: "Monthly",
    price: "",
    durationDays: 30,
    maxMembers: 0,
    description: "",
    features: [],
    status: "Active",
    image: null,
    offerValidTill: "", // This line remains unchanged
    photoPreview: null,
    // New feature-specific fields
    ptSessions: false,
    ptSessionsCount: "",
    steamSaunaAccess: false,
    steamSaunaCount: "",
    dietPlan: false,
  });

  // Function to get duration days based on membership type
  const getDurationDaysByType = (type) => {
    switch (type) {
      case "Monthly":
        return 30;
      case "Quarterly":
        return 90;
      case "Half-Yearly":
        return 180;
      case "Yearly":
        return 365;
      case "Personal Training":
        return 30;
      default:
        return 30;
    }
  };
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Get plan data from location state if editing
  const locationState = location.state;
  const isEditing = locationState?.isEditing;
  const editPlanData = locationState?.plan;

  useEffect(() => {
    if (!isauthenticated) navigate("/");
    else getuserdata();

    // If editing a plan, set the form data
    if (isEditing && editPlanData) {
      console.log('Membership edit state received:', { isEditing, editPlanData });
      // map backend `offerValid` to local `offerValidTill` (date input expects YYYY-MM-DD)
      const mapped = { ...editPlanData };
      if (editPlanData.offerValid) {
        // try to parse ISO or fallback to keeping the string
        const parsed = new Date(editPlanData.offerValid);
        if (!isNaN(parsed.getTime())) {
          // format to yyyy-mm-dd for date input
          const yyyy = parsed.getFullYear();
          const mm = String(parsed.getMonth() + 1).padStart(2, "0");
          const dd = String(parsed.getDate()).padStart(2, "0");
          mapped.offerValidTill = `${yyyy}-${mm}-${dd}`;
        } else {
          mapped.offerValidTill = editPlanData.offerValid;
        }
      }

      // Extract checkbox states from features array
      const features = editPlanData.features || [];
      mapped.ptSessions = features.some(f => f.includes('PT Sessions'));
      mapped.ptSessionsCount = features.find(f => f.includes('PT Sessions'))?.match(/\d+/)?.[0] || '';
      mapped.steamSaunaAccess = features.some(f => f.includes('Steam/Sauna Access'));
      mapped.steamSaunaCount = features.find(f => f.includes('Steam/Sauna Access'))?.match(/\d+/)?.[0] || '';
      mapped.dietPlan = features.includes('Fitness Plan Included');

      // Ensure durationDays is set from the plan data, fallback to type only if missing
      mapped.durationDays = editPlanData.durationDays || getDurationDaysByType(mapped.type);

      // Set photo preview if image exists
      if (editPlanData.image) {
        const plansBaseUrl = backendurl.replace('/gym', '');
        mapped.photoPreview = `${plansBaseUrl}${editPlanData.image}`;
      }

      setForm(mapped);
      setEditingId(editPlanData._id);
    }
  }, [isauthenticated, editPlanData, isEditing]);

  // Sample plans (replace with API)
  const samplePlans = [
    {
      _id: "1",
      name: "Basic Monthly",
      type: "Monthly",
      price: 1500,
      durationDays: 30,
      maxMembers: 0,
      description: "Unlimited access to gym equipment",
      features: ["24/7 Access", "Locker", "Basic Training"],
      status: "Active",
    },
    {
      _id: "2",
      name: "Premium Annual",
      type: "Yearly",
      price: 15000,
      durationDays: 365,
      maxMembers: 0,
      description: "Full access + personal trainer",
      features: ["All Basic", "PT Sessions", "Fitness Plan Included"],
      status: "Active",
    },
    {
      _id: "3",
      name: "Quarterly Pro",
      type: "Quarterly",
      price: 4000,
      durationDays: 90,
      maxMembers: 0,
      description: "Extended access with premium features",
      features: ["All Basic", "Group Classes", "Nutrition Guide"],
      status: "Active",
    },
  ];

  useEffect(() => {
    setPlans(samplePlans);
  }, []);

  // Add state for photo compression loading
  const [compressingPhoto, setCompressingPhoto] = useState(false);

  const handleChange = async (e) => {
    const { name, value, type, checked, files } = e.target;
    if (name === "features") {
      setForm((prev) => ({
        ...prev,
        features: checked
          ? [...prev.features, value]
          : prev.features.filter((f) => f !== value),
      }));
    } else if (name === "image" && files && files[0]) {
      let file = files[0];

      if (file.type.startsWith('image/')) {
        setCompressingPhoto(true);
        try {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true
          };
          const compressedFile = await imageCompression(file, options);
          if (compressedFile instanceof Blob && !(compressedFile instanceof File)) {
            file = new File([compressedFile], file.name, { type: file.type });
          } else {
            file = compressedFile;
          }
        } catch (error) {
          console.error("Compression Error:", error);
        } finally {
          setCompressingPhoto(false);
        }
      }

      setForm((prev) => ({ ...prev, image: file }));
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setForm((prev) => ({ ...prev, photoPreview: e.target.result }));
      };
      reader.readAsDataURL(file);
    } else if (name === "type") {
      // Automatically set duration days based on membership type
      const durationDays = getDurationDaysByType(value);
      setForm((prev) => ({
        ...prev,
        [name]: value,
        durationDays: durationDays
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    }
  };

  const addFeature = () => {
    if (form.features.length < 10) {
      setForm((prev) => ({
        ...prev,
        features: [...prev.features, ""],
      }));
    }
  };

  const updateFeature = (index, value) => {
    const newFeatures = [...form.features];
    newFeatures[index] = value;
    setForm((prev) => ({ ...prev, features: newFeatures }));
  };

  const removeFeature = (index) => {
    const newFeatures = form.features.filter((_, i) => i !== index);
    setForm((prev) => ({ ...prev, features: newFeatures }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (compressingPhoto) {
      toast.warning("Please wait for image compression to complete.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();

      // Add form fields to FormData
      formData.append('name', form.name);
      formData.append('type', form.type);
      formData.append('price', form.price || 0);
      formData.append('durationDays', form.durationDays || 0);
      // Handle maxMembers - ensure it's a number
      const maxMembersValue = form.maxMembers === null || form.maxMembers === '' || form.maxMembers === undefined ? 0 : form.maxMembers;
      formData.append('maxMembers', maxMembersValue);
      formData.append('description', form.description || '');
      formData.append('status', form.status);
      // Send field as `offerValid` to match backend model
      if (form.offerValidTill) {
        // prefer ISO date string for backend storage
        const date = new Date(form.offerValidTill);
        formData.append('offerValid', isNaN(date.getTime()) ? form.offerValidTill : (() => { const d = new Date(form.offerValidTill); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })());
      } else {
        formData.append('offerValid', '');
      }

      // Build features array from checked features and conditional inputs
      const featuresArray = [...form.features];

      // Add PT sessions if enabled
      if (form.ptSessions && form.ptSessionsCount) {
        // Remove any existing PT sessions entry
        const filteredFeatures = featuresArray.filter(f => !f.includes('PT Sessions'));
        filteredFeatures.push(`PT Sessions: ${form.ptSessionsCount}`);
        featuresArray.length = 0;
        featuresArray.push(...filteredFeatures);
      } else if (form.ptSessions) {
        // If checkbox is checked but no count, remove PT sessions
        const filteredFeatures = featuresArray.filter(f => !f.includes('PT Sessions'));
        featuresArray.length = 0;
        featuresArray.push(...filteredFeatures);
      }

      // Add steam/sauna access if enabled
      if (form.steamSaunaAccess && form.steamSaunaCount) {
        // Remove any existing steam/sauna entry
        const filteredFeatures = featuresArray.filter(f => !f.includes('Steam/Sauna Access'));
        filteredFeatures.push(`Steam/Sauna Access: ${form.steamSaunaCount}`);
        featuresArray.length = 0;
        featuresArray.push(...filteredFeatures);
      } else if (form.steamSaunaAccess) {
        // If checkbox is checked but no count, remove steam/sauna
        const filteredFeatures = featuresArray.filter(f => !f.includes('Steam/Sauna Access'));
        featuresArray.length = 0;
        featuresArray.push(...filteredFeatures);
      }

      // Add fitness plan if enabled
      if (form.dietPlan) {
        if (!featuresArray.includes("Fitness Plan Included")) {
          featuresArray.push("Fitness Plan Included");
        }
      } else {
        // Remove fitness plan if unchecked
        const filteredFeatures = featuresArray.filter(f => f !== "Fitness Plan Included");
        featuresArray.length = 0;
        featuresArray.push(...filteredFeatures);
      }

      // Add features as JSON string
      formData.append('features', JSON.stringify(featuresArray));

      // Add image if selected and it's a new file (not a string URL)
      if (form.image && (form.image instanceof File || form.image instanceof Blob)) {
        formData.append('image', form.image, form.image.name);
      }

      // Debug: log the form data being sent
      console.log('Form data to be sent:', {
        name: form.name,
        type: form.type,
        price: form.price,
        durationDays: form.durationDays,
        maxMembers: form.maxMembers, // This should be a number, not null
        features: featuresArray,
        status: form.status,
        offerValid: form.offerValidTill,
      });

      let response;
      // Plans routes are mounted at /plans (without /gym prefix)
      const plansBaseUrl = backendurl.replace('/gym', '');
      console.log('Plans base URL:', plansBaseUrl);
      if (editingId) {
        response = await axios.put(`${plansBaseUrl}/plans/${editingId}`, formData, {
          withCredentials: true,
        });
      } else {
        response = await axios.post(`${plansBaseUrl}/plans/add`, formData, {
          withCredentials: true,
        });
      }

      const result = response.data;

      if (result.success) {
        toast.success('Plan saved successfully!');
        resetForm();
        // Refresh plans list
        fetchPlans();
      } else {
        toast.error(result.message || 'Failed to create plan');
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      if (error.response) {
        // Server responded with error
        console.error('Server error response:', error.response.data);
        console.error('Server error status:', error.response.status);
        toast.error(`Server error: ${error.response.data.message || 'Unknown error'}`);
      } else if (error.request) {
        // Request was made but no response received
        console.error('No response received from server');
        toast.error('No response from server. Please check if the server is running.');
      } else {
        // Something else went wrong
        console.error('Request setup error:', error.message);
        toast.error('Error setting up request: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const editPlan = (plan) => {
    setForm(plan);
    setEditingId(plan._id);
  };

  const deletePlan = async (id) => {
    try {
      // Plans routes are mounted at /plans (without /gym prefix)
      const plansBaseUrl = backendurl.replace('/gym', '');
      const response = await axios.delete(`${plansBaseUrl}/plans/${id}`, {
        withCredentials: true
      });

      const result = response.data;

      if (result.success) {
        // Remove from local state
        setPlans((prev) => prev.filter((plan) => plan._id !== id));
        toast.success('Plan deleted successfully!');
        // Reset form and navigate back to plans listing
        resetForm();
      } else {
        toast.error(result.message || 'Failed to delete plan');
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      if (error.response) {
        toast.error(`Server error: ${error.response.data.message || 'Unknown error'}`);
      } else {
        toast.error('Error deleting plan. Please try again.');
      }
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      type: "Monthly",
      price: "",
      durationDays: getDurationDaysByType("Monthly"),
      maxMembers: 0,
      description: "",
      features: [],
      status: "Active",
      image: null,
      offerValidTill: "",
      photoPreview: null,
      ptSessions: false,
      ptSessionsCount: "",
      steamSaunaAccess: false,
      steamSaunaCount: "",
      dietPlan: false,
    });
    setEditingId(null);
    navigate('/planslisting');
  };

  const fetchPlans = async () => {
    try {
      setLoading(true);
      // Plans routes are mounted at /plans (without /gym prefix)
      const plansBaseUrl = backendurl.replace('/gym', '');
      const response = await axios.get(`${plansBaseUrl}/plans`, {
        withCredentials: true, // Include cookies for authentication
      });
      const result = response.data;
      if (result.success) {
        setPlans(result.plans);
        // Check for expired offers and update them
        checkExpiredOffers(result.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check for expired offers and update them
  const checkExpiredOffers = async (plansList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for date comparison

    console.log('Checking expired offers...');
    console.log('Today:', (() => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })());

    // Create plans API URL (without /gym prefix)
    const plansApiUrl = backendurl.replace('/gym', '');
    console.log('Plans API URL:', plansApiUrl);

    for (const plan of plansList) {
      console.log(`Plan: ${plan.name}, Status: ${plan.status}, Offer Valid: ${plan.offerValid}`);

      if (plan.offerValid && plan.status === 'Active') {
        const offerDate = new Date(plan.offerValid);
        offerDate.setHours(0, 0, 0, 0); // Reset time for date comparison

        console.log(`Offer Date: ${(() => { const d = new Date(plan.offerValid); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })()}`);
        console.log(`Is expired? ${offerDate < today}`);

        if (offerDate < today) {
          // Offer has expired, update the plan status
          try {
            console.log(`Updating plan ${plan.name} status to Inactive...`);
            console.log(`Calling: ${plansApiUrl}/plans/${plan._id}/expire`);

            const response = await axios.patch(`${plansApiUrl}/plans/${plan._id}/expire`, {}, {
              withCredentials: true
            });
            console.log(`Plan ${plan.name} response:`, response.data);

            // Update local state immediately
            setPlans(prev => prev.map(p =>
              p._id === plan._id ? { ...p, status: 'Inactive' } : p
            ));

            console.log(`Plan ${plan.name} status updated to Inactive`);
          } catch (error) {
            console.error(`Error updating expired plan ${plan.name}:`, error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);
          }
        } else {
          console.log(`Plan ${plan.name} offer not expired yet`);
        }
      } else {
        console.log(`Plan ${plan.name} skipped - no offer or not active`);
      }
    }
  };

  // Check all expired offers at once (for admin use)
  const checkAllExpiredOffers = async () => {
    try {
      // Use /plans endpoint instead of /gym/plans
      const plansBaseUrl = backendurl.replace('/gym', '');
      const response = await axios.get(`${plansBaseUrl}/plans`, {
        withCredentials: true
      });

      if (response.data.success) {
        await checkExpiredOffers(response.data.plans);
        toast.info('Checked all plans for expired offers');
      }
    } catch (error) {
      console.error('Error checking expired offers:', error);
      toast.error('Error checking expired offers');
    }
  };

  useEffect(() => {
    if (userdata && isauthenticated) {
      fetchPlans();
    }
  }, [userdata, isauthenticated]);

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-breadcrumb">
            Dashboard / Membership Plans / {editingId ? "Edit" : "Add New"}
          </div>
        </div>
        <div className="dash-header-right">
          {editingId && (
            <button
              type="button"
              className="btn-danger"
              onClick={async () => {
                const result = await Swal.fire({
                  title: 'Delete this plan?',
                  text: 'This action cannot be undone.',
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonColor: '#d33',
                  cancelButtonColor: '#6b7280',
                  confirmButtonText: 'Yes, delete'
                });
                if (result.isConfirmed) {
                  deletePlan(editingId);
                }
              }}
              style={{ marginRight: '10px' }}
            >
              Delete Plan
            </button>
          )}
        </div>
      </header>

      <div className="dash-content new-member-page" style={{ paddingLeft: "30px", marginRight: "0px" }}>
        <h1 className="dash-page-title">
          {editingId ? "Edit Membership Plan" : "New Membership Plan"}
        </h1>

        <div className="nm-grid" style={{ gridTemplateColumns: "1fr" }}>
          {/* Add/Edit Form */}
          <div className="nm-card">
            <div className="nm-card-header">
              <h2>Plan Details</h2>

            </div>

            <form onSubmit={handleSubmit} className="nm-form">
              <div className="nm-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="nm-field">
                  <label>Plan Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Gold Annual"
                    required
                  />
                </div>
                <div className="nm-field">
                  <label>Membership Type *</label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    required
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Half-Yearly">Half-Yearly</option>
                    <option value="Yearly">Yearly</option>
                    <option value="Personal Training">Personal Training</option>
                  </select>
                </div>
                <div className="nm-field">
                  <label>Price (₹) *</label>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="1500"
                    required
                  />
                </div>
              </div>

              <div className="nm-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="nm-field">
                  <label>Offer Valid Till</label>
                  <input
                    type="date"
                    name="offerValidTill"
                    value={form.offerValidTill}
                    onChange={handleChange}
                  />
                </div>
                <div className="nm-field">
                  <label>Duration (days) *</label>
                  <input
                    type="number"
                    name="durationDays"
                    value={form.durationDays}
                    onChange={handleChange}
                    min="1"
                    placeholder="30"
                    required
                  />
                </div>
                <div className="nm-field">
                  <label>Max Members</label>
                  <input
                    type="number"
                    name="maxMembers"
                    value={form.maxMembers}
                    onChange={handleChange}
                    min="0"
                    placeholder="0 (unlimited)"
                  />
                </div>
              </div>

              <div className="nm-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="nm-field">
                  <label>Status</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="nm-field">
                <label>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="What does this plan include? (e.g., access to equipment, classes, personal training)"
                  rows="3"
                />
              </div>

              <div className="nm-field">
                <label>Features</label>
                <div className="mp-features">
                  {form.features.map((feature, index) => (
                    <div key={index} className="mp-feature-item">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => updateFeature(index, e.target.value)}
                        placeholder={`Feature ${index + 1} (e.g., 24/7 Access)`}
                      />
                      <button
                        type="button"
                        className="mp-remove-feature"
                        onClick={() => removeFeature(index)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="mp-add-feature"
                    onClick={addFeature}
                  >
                    + Add Feature
                  </button>
                </div>
              </div>


              {form.offerValidTill && (
                <div className="nm-field offer-info">
                  <div className="offer-badge">
                    <span style={{ color: '#fb923c', fontWeight: 'bold' }}>OFFER</span>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      Valid till: {new Date(form.offerValidTill).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="nm-field photo-upload">
                <div className="photo-upload-container">
                  <div className="photo-input-wrapper">
                    <label className="photo-upload-label">Plan Image</label>
                    <input
                      type="file"
                      name="image"
                      accept="image/*"
                      onChange={handleChange}
                      className="photo-upload-input"
                    />
                    <div className="photo-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, image: null, photoPreview: null }));
                        }}
                      >
                        Remove Image
                      </button>
                      <button type="button" className="btn-primary">
                        Upload Image
                      </button>
                    </div>
                  </div>

                  <div className="photo-preview-wrapper" style={{ position: 'relative' }}>
                    {compressingPhoto ? (
                      <div className="spinner-overlay">
                        <div className="spinner"></div>
                        <div className="spinner-text">Compressing...</div>
                      </div>
                    ) : form.photoPreview ? (
                      <div className="photo-preview">
                        <img src={form.photoPreview} alt="Plan preview" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                      </div>
                    ) : (
                      <div className="photo-placeholder">
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>Upload Plan Image</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Optional plan visual</div>
                        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>PNG, JPG up to 2MB</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="nm-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetForm}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading || compressingPhoto}>
                  {loading ? (editingId ? "Updating..." : "Creating...") : (editingId ? "Update Plan" : "Create Plan")}
                </button>

              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
