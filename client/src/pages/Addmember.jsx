// NewMember.jsx
import React, { useState, useEffect, useContext } from "react";
import imageCompression from 'browser-image-compression';
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import ToggleButton from "../components/ToggleButton.jsx";
import axios from "axios";
import { AppContent } from "../context/context.jsx";
import { useLocation } from "react-router-dom";
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const cleanPhoneNumber = (phone) => {
  if (!phone) return '';
  let cleaned = phone.toString().replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
};

const generateAttendanceId = () => {
  const randomNum = Math.floor(Math.random() * 900) + 100; // Generates 100-999
  return randomNum.toString();
};

const AREA_DATA = [
  { name: "Thiruverkadu", distance: "1" },
  { name: "Adambakkam", distance: "20.5" },
  { name: "Adyar", distance: "21.5" },
  { name: "Alandur", distance: "18.5" },
  { name: "Alwarpet", distance: "19.0" },
  { name: "Ambattur", distance: "7.0" },
  { name: "Aminjikarai", distance: "12.0" },
  { name: "Anna Nagar", distance: "13.0" },
  { name: "Anna Salai (Mount Road)", distance: "18.0" },
  { name: "Arumbakkam", distance: "11.0" },
  { name: "Ashok Nagar", distance: "13.0" },
  { name: "Avadi", distance: "7.0" },
  { name: "Ayanavaram", distance: "13.5" },
  { name: "Besant Nagar", distance: "22.5" },
  { name: "Central (Railway Station)", distance: "19.0" },
  { name: "Chetpet", distance: "15.0" },
  { name: "Choolaimedu", distance: "14.0" },
  { name: "Chromepet", distance: "22.0" },
  { name: "Egmore", distance: "17.5" },
  { name: "Ennore", distance: "26.0" },
  { name: "Gopalapuram", distance: "18.0" },
  { name: "Guduvancheri", distance: "33.0" },
  { name: "Guindy", distance: "18.0" },
  { name: "Injambakkam", distance: "28.0" },
  { name: "K.K. Nagar", distance: "12.0" },
  { name: "Kelambakkam", distance: "40.0" },
  { name: "Kilpauk", distance: "14.0" },
  { name: "Kodambakkam", distance: "16.0" },
  { name: "Kolathur", distance: "12.0" },
  { name: "Korattur", distance: "9.0" },
  { name: "Kotturpuram", distance: "20.0" },
  { name: "Koyambedu", distance: "9.0" },
  { name: "Kundrathur", distance: "10.0" },
  { name: "Madhavaram", distance: "21.5" },
  { name: "Madipakkam", distance: "22.0" },
  { name: "Maduravoyal", distance: "4.5" },
  { name: "Mandaveli", distance: "20.0" },
  { name: "Mannady", distance: "20.5" },
  { name: "Medavakkam", distance: "26.0" },
  { name: "Meenambakkam (Airport)", distance: "20.0" },
  { name: "Minjur", distance: "35.0" },
  { name: "Mogappair", distance: "8.0" },
  { name: "Mylapore", distance: "21.5" },
  { name: "Nandanam", distance: "18.0" },
  { name: "Nanganallur", distance: "21.0" },
  { name: "Navallur", distance: "36.0" },
  { name: "Neelankarai", distance: "26.0" },
  { name: "Nungambakkam", distance: "16.5" },
  { name: "OMR (Start/Taramani)", distance: "23.0" },
  { name: "Padi", distance: "10.0" },
  { name: "Pallavaram", distance: "21.0" },
  { name: "Pallikaranai", distance: "25.0" },
  { name: "Parrys Corner", distance: "21.0" },
  { name: "Perambur", distance: "16.0" },
  { name: "Perungalathur", distance: "26.0" },
  { name: "Perungudi", distance: "24.0" },
  { name: "Poonamallee", distance: "4.5" },
  { name: "Porur", distance: "8.0" },
  { name: "Purasawalkam", distance: "16.0" },
  { name: "Ramapuram", distance: "9.0" },
  { name: "Red Hills", distance: "22.0" },
  { name: "Royapettah", distance: "19.0" },
  { name: "Royapuram", distance: "22.0" },
  { name: "Saidapet", distance: "17.5" },
  { name: "Santhome", distance: "21.0" },
  { name: "Selaiyur", distance: "24.0" },
  { name: "Shenoy Nagar", distance: "13.5" },
  { name: "Sholinganallur", distance: "33.0" },
  { name: "Siruseri", distance: "38.0" },
  { name: "Sowcarpet", distance: "20.0" },
  { name: "St. Thomas Mount", distance: "18.5" },
  { name: "T. Nagar", distance: "16.5" },
  { name: "Tambaram", distance: "23.0" },
  { name: "Teynampet", distance: "18.0" },
  { name: "Thiruvanmiyur", distance: "23.0" },
  { name: "Thiruvottiyur", distance: "24.0" },
  { name: "Thoraipakkam", distance: "28.0" },
  { name: "Tondiarpet", distance: "23.0" },
  { name: "Triplicane", distance: "19.5" },
  { name: "Vadapalani", distance: "12.0" },
  { name: "Valasaravakkam", distance: "10.0" },
  { name: "Vanagaram", distance: "3.0" },
  { name: "Velachery", distance: "21.0" },
  { name: "Villivakkam", distance: "11.0" },
  { name: "Virugambakkam", distance: "11.0" },
  { name: "Washermanpet", distance: "22.0" },
  { name: "West Mambalam", distance: "15.5" },
  { name: "Other", distance: "" }
];

export default function NewMember() {
  const { backendurl } = useContext(AppContent);
  const location = useLocation();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [photoPreview, setPhotoPreview] = useState(null);
  const [form, setForm] = useState({
    memberId: "",
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    phone: "",
    email: "",
    address: "",
    area: "",
    customArea: "",
    distanceFromGym: "",
    city: "",
    state: "",
    pincode: "",
    hearAboutUs: "",
    profilePhoto: null,
    // Medical Records
    medicalConditions: "",
    injuryHistory: "",
    doctorRestrictions: "",
    medicalReports: null,
    emergencyName: "",
    emergencyPhone: "",
    goal: "",
    lockerNumber: "",
  });

  useEffect(() => {
    const state = location.state;

    // Helper to fetch next ID from backend
    const fetchNextId = async () => {
      try {
        const response = await axios.get(`${backendurl}/members/next-id`, { withCredentials: true });
        if (response.data.success) {
          setForm(prev => ({ ...prev, memberId: response.data.nextId }));
        }
      } catch (error) {
        console.error("Error fetching next member ID:", error);
      }
    };

    if (state?.isEditing && state.member) {
      const m = state.member;
      const formatDateForInput = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0');
      };

      setForm({
        memberId: m.memberId || '',
        firstName: m.firstName || (m.fullName ? m.fullName.split(' ')[0] : ''),
        lastName: m.lastName || (m.fullName ? m.fullName.split(' ').slice(1).join(' ') : ''),
        gender: m.gender || '',
        dob: formatDateForInput(m.dob) || '',
        email: m.email || '',
        phone: m.phone || '',
        address: m.address || '',
        area: AREA_DATA.some(a => a.name === m.area) ? m.area : 'Other',
        customArea: AREA_DATA.some(a => a.name === m.area) ? '' : m.area || '',
        distanceFromGym: m.distanceFromGym || '',
        city: m.city || '',
        state: m.state || '',
        pincode: m.pincode || '',
        hearAboutUs: m.hearAboutUs || '',
        profilePhoto: m.profilePhoto || null,
        medicalConditions: m.medicalConditions || '',
        injuryHistory: m.injuryHistory || '',
        doctorRestrictions: m.doctorRestrictions || '',
        medicalReports: m.medicalReports || null,
        emergencyName: m.emergencyName || '',
        emergencyPhone: m.emergencyPhone || '',
        goal: m.goal || '',
        lockerNumber: m.lockerNumber || '',
      });
      setEditingId(m._id);
      if (m.profilePhoto) {
        let photoUrl = m.profilePhoto;
        // Handle path correction
        const baseUrl = backendurl.replace(/\/gym$/, '');
        if (!photoUrl.startsWith('http') && !photoUrl.startsWith('blob:')) {
          if (!photoUrl.startsWith('/')) photoUrl = '/' + photoUrl;
          photoUrl = `${baseUrl}${photoUrl}`;
        }
        setPhotoPreview(photoUrl);
      }
    } else if (state?.isLead && state.lead) {
      const lead = state.lead;
      setForm(prev => ({
        ...prev,
        firstName: lead.name?.split(' ')[0] || lead.firstName || '',
        lastName: lead.name?.split(' ').slice(1).join(' ') || lead.lastName || '',
        email: lead.email || '',
        phone: lead.phone || '',
        address: lead.location || '',
        hearAboutUs: lead.source || '',
        memberId: '', // Will be filled by effect below if needed, or we call fetchNextId()
      }));
      fetchNextId();
    } else if (state?.isConvertingFromLead && state.leadData) {
      // Handle conversion from Leadslisting page
      const leadData = state.leadData;
      setForm(prev => ({
        ...prev,
        firstName: leadData.firstName || '',
        lastName: leadData.lastName || '',
        email: leadData.email || '',
        phone: leadData.phone || '',
        area: leadData.area || '',
        memberId: '',
      }));
      fetchNextId();
    } else {
      // New member - fetch next ID
      fetchNextId();
    }
  }, [location.state, backendurl]);

  // Add state for photo compression loading
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [medicalReportPreview, setMedicalReportPreview] = useState(null);

  // Initialize medical report preview when editing
  useEffect(() => {
    // Helper to generate preview object
    const generatePreview = (item) => {
      if (item instanceof File) {
        return { url: URL.createObjectURL(item), type: 'file', isImage: isImageFile(item.name) };
      } else if (typeof item === 'string') {
        if (!item.trim()) return null; // Ignore empty strings to prevent ghost documents
        const baseUrl = backendurl.replace(/\/gym$/, '');
        let path = item;
        if (!path.startsWith('/') && !path.startsWith('http')) path = '/' + path;
        const fullUrl = (path.startsWith('http') || path.startsWith('blob:')) ? path : `${baseUrl}${path}`;
        return { url: fullUrl, type: 'url', isImage: isImageFile(path), originalPath: item };
      }
      return null;
    };

    let reports = form.medicalReports;
    if (!reports) {
      setMedicalReportPreview([]);
      return;
    }

    // Normalize to array
    if (!Array.isArray(reports)) reports = [reports];

    const previews = reports.map(generatePreview).filter(Boolean);
    setMedicalReportPreview(previews);

  }, [form.medicalReports, backendurl]);

  const isImageFile = (urlOrFile) => {
    if (!urlOrFile) return false;
    const name = (urlOrFile instanceof File) ? urlOrFile.name : urlOrFile;
    if (typeof name !== 'string') return true; // Fallback
    const lower = name.toLowerCase();
    // Common image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.some(ext => lower.endsWith(ext)) || lower.startsWith('data:image') || lower.startsWith('blob:');
  };

  const handleRemoveMedicalReport = (index) => {
    setForm(prev => {
      let current = prev.medicalReports;
      if (!current) return prev;
      if (!Array.isArray(current)) current = [current];

      const updated = [...current];
      updated.splice(index, 1);
      return { ...prev, medicalReports: updated.length > 0 ? updated : null };
    });
    // Preview will update via useEffect
  };

  const handleChange = async (e) => {
    const { name, value, files, type } = e.target;
    if (type === "file") {
      if (name === 'medicalReports') {
        if (files && files.length > 0) {
          const newFiles = Array.from(files);
          setForm(prev => {
            let current = prev.medicalReports || [];
            if (!Array.isArray(current)) current = [current];
            // Filter out empty strings from current if any exist
            current = current.filter(item => typeof item !== 'string' || item.trim() !== '');
            return { ...prev, medicalReports: [...current, ...newFiles] };
          });
        }
        // Clear input value to allow re-selecting same file
        e.target.value = '';
        return;
      }

      let file = files[0];
      if (file) {
        // Compress if it is an image
        if (file.type.startsWith('image/')) {
          setCompressingPhoto(true);
          try {
            console.log('Original file:', file);
            const options = {
              maxSizeMB: 1,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            };
            const compressedFile = await imageCompression(file, options);
            console.log('Compressed file:', compressedFile);

            // If it's a Blob but not a File, or if we want to ensure name is preserved
            if (compressedFile instanceof Blob && !(compressedFile instanceof File)) {
              file = new File([compressedFile], file.name, { type: file.type });
            } else {
              file = compressedFile;
            }
          } catch (error) {
            console.error("Image compression error:", error);
          } finally {
            setCompressingPhoto(false);
          }
        }

        setForm((prev) => ({ ...prev, [name]: file }));
        if (name === 'profilePhoto') {
          const reader = new FileReader();
          reader.onload = (e) => setPhotoPreview(e.target.result);
          reader.readAsDataURL(file);
        }
      }
      return;
    }

    // Auto-fill distance if area is selected
    if (name === 'area') {
      const selectedArea = AREA_DATA.find(a => a.name === value);
      if (selectedArea && value !== 'Other') {
        setForm((prev) => ({
          ...prev,
          [name]: value,
          distanceFromGym: selectedArea.distance,
          customArea: ''
        }));
        if (errors.area) setErrors({ ...errors, area: null });
        if (errors.distanceFromGym) setErrors({ ...errors, distanceFromGym: null });
        return;
      } else if (value === 'Other') {
        setForm((prev) => ({
          ...prev,
          [name]: value,
          distanceFromGym: '',
          customArea: ''
        }));
        return;
      }
    }

    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors({ ...errors, [name]: null });
  };

  const handleRemovePhoto = () => {
    setForm((prev) => ({ ...prev, profilePhoto: null }));
    setPhotoPreview(null);
  };

  const handleDelete = async () => {
    if (!editingId) return;
    const result = await Swal.fire({
      title: 'Delete this member?',
      text: 'ALL THE MEMBERS DETAIL AND SUBSCRIPTION DETAIL WILL GET DELETED WHICH CANT BE RETRIEVED IN THE FUTURE',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete'
    });
    if (result.isConfirmed) {
      try {
        const response = await axios.delete(`${backendurl}/members/${editingId}`, { withCredentials: true });
        if (response.data.success) {
          Swal.fire({
            title: 'Success',
            text: 'MEMBER DELETED SUCCESSFULLY',
            icon: 'success',
            confirmButtonColor: '#f97316'
          }).then(() => {
            navigate('/members');
          });
        } else {
          toast.error(response.data.message || 'Failed to delete member');
        }
      } catch (error) {
        toast.error('Error deleting member. Please try again.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (compressingPhoto) {
      toast.warning("Please wait for image compression to complete.");
      return;
    }
    const newErrors = {};

    if (!form.firstName?.trim()) newErrors.firstName = "First Name is required";
    if (!form.phone?.trim()) newErrors.phone = "Phone is required";
    if (!form.gender) newErrors.gender = "Gender is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const formData = new FormData();
    Object.keys(form).forEach(key => {
      if (key === 'profilePhoto' || key === 'medicalReports') return;
      let value = form[key];
      if (key === 'phone' || key === 'emergencyPhone') value = cleanPhoneNumber(value);

      // Handle Area logic
      if (key === 'area') {
        value = form.area === 'Other' ? form.customArea : form.area;
      }
      if (key === 'customArea') return;

      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });

    if (form.profilePhoto && form.profilePhoto instanceof File) {
      formData.append('profilePhoto', form.profilePhoto);
    }

    // Handle Medical Reports
    if (form.medicalReports) {
      const reports = Array.isArray(form.medicalReports) ? form.medicalReports : [form.medicalReports];
      const newFiles = [];
      const existingPaths = [];

      reports.forEach(item => {
        if (item instanceof File) {
          newFiles.push(item);
        } else if (typeof item === 'string') {
          if (item.trim()) existingPaths.push(item);
        }
      });

      // Append new files
      newFiles.forEach(file => {
        formData.append('medicalReports', file);
      });

      // Send existing paths for retention
      if (existingPaths.length > 0) {
        formData.append('existingMedicalReports', JSON.stringify(existingPaths));
      } else if (editingId) {
        // If editing and no existing paths (meaning all removed), send empty array
        formData.append('existingMedicalReports', JSON.stringify([]));
      }
    } else if (editingId) {
      // Explicitly clear if null/empty
      formData.append('existingMedicalReports', JSON.stringify([]));
    }

    const url = editingId ? `${backendurl}/members/${editingId}` : `${backendurl}/members/add`;
    const method = editingId ? 'put' : 'post';

    axios[method](url, formData, { withCredentials: true })
      .then(async (response) => {
        if (response.data.success) {
          toast.success(editingId ? 'Member updated successfully!' : 'Member added successfully!');

          // Update lead status to 'converted' if converting from lead
          const leadId = location.state?.lead?._id || location.state?.leadData?.leadId;
          if (leadId && (location.state?.isLead || location.state?.isConvertingFromLead)) {
            try {
              console.log("Deleting converted lead:", leadId);
              await axios.delete(`${backendurl}/leads/${leadId}`, { withCredentials: true });
            } catch (ce) { console.error('Error deleting converted lead:', ce); }
          }

          setTimeout(() => navigate('/members'), 1500);
        } else {
          toast.error(response.data.message || 'Failed to save member');
        }
      })
      .catch((error) => {
        console.error('Save error:', error);
        toast.error('Error saving member. Please try again.');
      });
  };

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-header-left">
          <ToggleButton isOpen={false} onClick={() => { }} />
          <div className="dash-breadcrumb">Dashboard / Members / {editingId ? 'Edit' : 'Add New'}</div>
        </div>
        <div className="dash-header-right">
          {editingId && (
            <button type="button" className="btn-danger" onClick={handleDelete} style={{ marginRight: '10px' }}>
              Delete Member
            </button>
          )}
        </div>
      </header>

      <div className="dash-content new-member-page" style={{ paddingLeft: "30px", marginRight: "0px" }}>
        <h1 className="dash-page-title">{editingId ? "Edit Member" : "Add New Member"}</h1>
        <form className="nm-form" onSubmit={handleSubmit} noValidate>
          <section className="nm-card">
            <div className="nm-card-header" style={{ marginBottom: "30px" }}>
              <h2 style={{ padding: "10px" }}>Personal Details</h2>
            </div>
            <div className="nm-grid">
              <div className="nm-field">
                <label>Member ID</label>
                <input type="text" value={form.memberId || ""} readOnly placeholder="Auto-generated" />
              </div>
              <div className="nm-field">
                <label>First Name <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  style={{ border: errors.firstName ? '1px solid red' : '' }}
                />
                {errors.firstName && <span style={{ color: 'red', fontSize: '11px' }}>{errors.firstName}</span>}
              </div>
              <div className="nm-field">
                <label>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  style={{ border: errors.lastName ? '1px solid red' : '' }}
                />
                {errors.lastName && <span style={{ color: 'red', fontSize: '11px' }}>{errors.lastName}</span>}
              </div>
              <div className="nm-field">
                <label>Gender <span style={{ color: 'red' }}>*</span></label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  style={{ border: errors.gender ? '1px solid red' : '' }}
                >
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
                {errors.gender && <span style={{ color: 'red', fontSize: '11px' }}>{errors.gender}</span>}
              </div>
              <div className="nm-field">
                <label>Date of Birth</label>
                <input type="date" name="dob" value={form.dob} onChange={handleChange} />
              </div>
              <div className="nm-field">
                <label>Phone Number <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  style={{ border: errors.phone ? '1px solid red' : '' }}
                />
                {errors.phone && <span style={{ color: 'red', fontSize: '11px' }}>{errors.phone}</span>}
              </div>
              <div className="nm-field">
                <label>Email ID</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  style={{ border: errors.email ? '1px solid red' : '' }}
                />
                {errors.email && <span style={{ color: 'red', fontSize: '11px' }}>{errors.email}</span>}
              </div>
              <div className="nm-field full">
                <label>Address</label>
                <input type="text" name="address" value={form.address} onChange={handleChange} />
              </div>
              <div className="nm-field">
                <label>Area</label>
                <select
                  name="area"
                  value={form.area}
                  onChange={handleChange}
                  style={{ border: errors.area ? '1px solid red' : '' }}
                >
                  <option value="">Select Area</option>
                  {AREA_DATA.map((item) => (
                    <option key={item.name} value={item.name}>{item.name}</option>
                  ))}
                </select>
                {errors.area && <span style={{ color: 'red', fontSize: '11px' }}>{errors.area}</span>}
              </div>
              {form.area === 'Other' && (
                <div className="nm-field">
                  <label>Specify Area</label>
                  <input
                    type="text"
                    name="customArea"
                    value={form.customArea}
                    onChange={handleChange}
                    placeholder="Enter Area Name"
                    style={{ border: errors.customArea ? '1px solid red' : '' }}
                  />
                  {errors.customArea && <span style={{ color: 'red', fontSize: '11px' }}>{errors.customArea}</span>}
                </div>
              )}
              <div className="nm-field">
                <label>Distance from Gym (km)</label>
                <input
                  type="text"
                  name="distanceFromGym"
                  value={form.distanceFromGym}
                  onChange={handleChange}
                  placeholder="e.g. 5"
                  readOnly={form.area !== 'Other'}
                  style={{
                    border: errors.distanceFromGym ? '1px solid red' : '',
                    backgroundColor: form.area !== 'Other' ? '#f0f0f0' : 'white'
                  }}
                />
                {errors.distanceFromGym && <span style={{ color: 'red', fontSize: '11px' }}>{errors.distanceFromGym}</span>}
              </div>
              <div className="nm-field">
                <label>City</label>
                <input type="text" name="city" value={form.city} onChange={handleChange} />
              </div>
              <div className="nm-field">
                <label>Pincode</label>
                <input type="text" name="pincode" value={form.pincode} onChange={handleChange} />
              </div>
              <div className="nm-field">
                <label>How did you hear about us?</label>
                <select name="hearAboutUs" value={form.hearAboutUs} onChange={handleChange}>
                  <option value="">Select</option>
                  <option>Friend/Family</option>
                  <option>Social Media</option>
                  <option>Google Search</option>
                  <option>Billboard/Advertisement</option>
                  <option>Walk-in</option>
                  <option>Referral</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="nm-field">
                <label>Fitness Goal</label>
                <select name="goal" value={form.goal} onChange={handleChange}>
                  <option value="">Select Goal</option>
                  <option>Weight Loss</option>
                  <option>Muscle Gain</option>
                  <option>General Fitness</option>
                  <option>Athletic Performance</option>
                  <option>Rehabilitation</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="nm-field">
                <label>Locker Number</label>
                <input
                  type="text"
                  name="lockerNumber"
                  value={form.lockerNumber}
                  onChange={handleChange}
                  placeholder="Locker #"
                />
              </div>
              <div className="nm-field photo-upload">
                <div className="photo-upload-container">
                  <div className="photo-input-wrapper">
                    <label className="photo-upload-label">Profile Photo</label>
                    <input type="file" name="profilePhoto" accept="image/*" onChange={handleChange} className="photo-upload-input" />
                    <div className="photo-actions">
                      <button type="button" onClick={handleRemovePhoto} className="btn-secondary">Remove Photo</button>
                    </div>
                  </div>
                  <div className={`photo-preview-wrapper ${photoPreview ? 'has-photo' : ''}`}>
                    {compressingPhoto ? (
                      <div className="spinner-overlay">
                        <div className="spinner"></div>
                        <div className="spinner-text">Compressing...</div>
                      </div>
                    ) : photoPreview ? (
                      <img src={photoPreview} alt="Profile Preview" className="photo-preview" />
                    ) : (
                      <div className="photo-placeholder">
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>Upload Member Photo</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Click to upload</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="nm-card">
            <div className="nm-card-header" style={{ marginBottom: "30px" }}>
              <h2 style={{ padding: "10px" }}>Medical Records</h2>
            </div>
            <div className="nm-grid">
              <div className="nm-field full">
                <label>Medical Conditions</label>
                <textarea name="medicalConditions" value={form.medicalConditions} onChange={handleChange} placeholder="Any pre-existing conditions..." />
              </div>
              <div className="nm-field full">
                <label>Injury History</label>
                <textarea name="injuryHistory" value={form.injuryHistory} onChange={handleChange} placeholder="Past injuries or surgeries..." />
              </div>
              <div className="nm-field full">
                <label>Doctor Restrictions</label>
                <textarea name="doctorRestrictions" value={form.doctorRestrictions} onChange={handleChange} placeholder="Any specific activities to avoid..." />
              </div>
              <div className="nm-field full">
                <label>Medical Reports</label>
                <div className="file-upload-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                    <input
                      type="file"
                      name="medicalReports"
                      accept="image/*,.pdf,.doc,.docx"
                      multiple // Enable multiple files
                      onChange={handleChange}
                      ref={(input) => {
                        // No strict reset needed here as we clear value in handleChange
                      }}
                    />
                    <span className="file-upload-hint">Upload reports or certificates (PDF, Images)</span>
                  </div>

                  {/* Render list of previews */}
                  {medicalReportPreview && medicalReportPreview.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px' }}>
                      {medicalReportPreview.map((preview, index) => (
                        <div key={index} className="medical-report-preview" style={{ position: 'relative', display: 'inline-block', border: '1px solid #e5e7eb', padding: '10px', borderRadius: '8px', background: '#f9fafb' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveMedicalReport(index)}
                            style={{
                              position: 'absolute',
                              top: '-10px',
                              right: '-10px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 'bold',
                              zIndex: 10
                            }}
                            title="Remove file"
                          >
                            ✕
                          </button>

                          {/* Check if preview is an image or document */}
                          {preview.isImage ? (
                            <div onClick={() => window.open(preview.url, '_blank')} style={{ cursor: 'pointer' }}>
                              <img
                                src={preview.url}
                                alt={`Report ${index + 1}`}
                                style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'cover', borderRadius: '4px' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.currentTarget.innerHTML = '<span style="font-size: 30px">📄</span><div style="font-size: 10px; margin-top: 5px; color: #0369a1; text-align: center;">View Document</div>';
                                }}
                              />
                              {!preview.url.includes('blob:') && <div style={{ fontSize: '10px', marginTop: '5px', color: '#0369a1', textAlign: 'center' }}>Click</div>}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: '30px' }}>📄</span>
                              <a
                                href={preview.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-text"
                                style={{ fontSize: '12px', textDecoration: 'underline' }}
                              >
                                View
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="nm-field">
                <label>Emergency Contact Name</label>
                <input type="text" name="emergencyName" value={form.emergencyName} onChange={handleChange} />
              </div>
              <div className="nm-field">
                <label>Emergency Contact Number</label>
                <input type="tel" name="emergencyPhone" value={form.emergencyPhone} onChange={handleChange} />
              </div>
            </div>
          </section>

          <div className="nm-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/members')}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={compressingPhoto}>{editingId ? "Update Member" : "Save Member"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
