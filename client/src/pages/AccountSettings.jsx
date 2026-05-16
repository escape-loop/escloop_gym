import React, { useState, useContext, useEffect } from "react";
import { AppContent } from "../context/context.jsx";
import { User, Mail, Lock, CheckCircle, AlertCircle, Eye, EyeOff, Building, MapPin, Globe, Instagram, Facebook, Twitter, Image, FileText, Phone } from "lucide-react";
import axios from "axios";
import ToggleButton from "../components/ToggleButton.jsx";
import { toast } from "react-toastify";
import "../styles/dashboard.css"; // Reuse dashboard layout styles
import WhatsAppConnection from "./WhatsAppConnection.jsx";
import AutomationEngine from "./AutomationEngine.jsx";
import BranchManagement from "./BranchManagement.jsx";

export default function AccountSettings() {
    const { userdata, backendurl, getuserdata, fetchGymSettings: refreshGlobalSettings } = useContext(AppContent);
    const [activeTab, setActiveTab] = useState("profile");

    // Gym Settings State
    const [gymSettings, setGymSettings] = useState({
        gymName: "",
        address: "",
        email: "",
        mobile: "",
        landmark: "",
        instagram: "",
        facebook: "",
        twitter: "",
        website: "",
        gymLogo: null,
        authorizerSignature: null,
        latitude: null,
        longitude: null
    });
    const [gymSettingsPreview, setGymSettingsPreview] = useState({
        gymLogo: null,
        authorizerSignature: null
    });

    // Password State
    const [passwords, setPasswords] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getuserdata();
        fetchGymSettings();
    }, []);

    const fetchGymSettings = async () => {
        try {
            const response = await axios.get(`${backendurl}/settings`, { withCredentials: true });
            if (response.data.success) {
                const settings = response.data.settings;
                setGymSettings({
                    ...settings,
                    gymLogo: null, // Keep file objects null in state, use strings from backend for preview
                    authorizerSignature: null
                });
                // Construct preview URLs for existing images
                const baseUrl = backendurl.replace('/gym', '');
                setGymSettingsPreview({
                    gymLogo: settings.gymLogo ? `${baseUrl}${settings.gymLogo}` : null,
                    authorizerSignature: settings.authorizerSignature ? `${baseUrl}${settings.authorizerSignature}` : null
                });
            }
        } catch (error) {
            console.error("Error fetching gym settings:", error);
        }
    };

    const handleGymSettingsChange = (e) => {
        setGymSettings({ ...gymSettings, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setGymSettings({ ...gymSettings, [e.target.name]: file });
            setGymSettingsPreview({ ...gymSettingsPreview, [e.target.name]: URL.createObjectURL(file) });
        }
    };

    const handleSubmitGymSettings = async (e) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData();
        const systemFields = ['_id', 'createdAt', 'updatedAt', '__v'];

        Object.keys(gymSettings).forEach(key => {
            if (systemFields.includes(key)) return;

            if (gymSettings[key] !== null && gymSettings[key] !== undefined) {
                formData.append(key, gymSettings[key]);
            }
        });

        try {
            const response = await axios.post(`${backendurl}/settings`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });

            if (response.data.success) {
                toast.success("Gym settings updated successfully!");
                await fetchGymSettings(); // Refresh local settings
                await refreshGlobalSettings(); // Refresh global settings used by other pages
            } else {
                toast.error(response.data.message || "Failed to update gym settings.");
            }
        } catch (error) {
            console.error("Gym settings update error:", error);
            toast.error(error.response?.data?.message || "An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = (e) => {
        setPasswords({ ...passwords, [e.target.name]: e.target.value });
    };

    const togglePasswordVisibility = (field) => {
        setShowPasswords({ ...showPasswords, [field]: !showPasswords[field] });
    };

    const handleSubmitPassword = async (e) => {
        e.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) {
            toast.error("New passwords do not match!");
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${backendurl}/change-password`, {
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword
            }, { withCredentials: true });

            if (response.data.success) {
                toast.success("Password updated successfully!");
                setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
            } else {
                toast.error(response.data.message || "Failed to update password.");
            }
        } catch (error) {
            console.error("Password update error:", error);
            toast.error(error.response?.data?.message || "An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dash-root">
            <main className="dash-main">
                <header className="dash-header">
                    <div className="dash-header-left">
                        <div className="dash-breadcrumb">
                            Dashboard / Account Settings
                        </div>
                    </div>
                    <div className="dash-header-right">
                        <button className="dash- avatar-pill">
                            {userdata?.Name?.[0] || "U"}
                        </button>
                    </div>
                </header>

                <div className="dash-content" style={{ maxWidth: '800px', margin: '0 0' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '24px' }}>Account Settings</h1>

                    <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <button
                                onClick={() => setActiveTab("profile")}
                                style={{
                                    padding: '16px 24px',
                                    border: 'none',
                                    background: activeTab === "profile" ? '#fff' : 'transparent',
                                    borderBottom: activeTab === "profile" ? '2px solid #f97316' : 'none',
                                    color: activeTab === "profile" ? '#f97316' : '#64748b',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Profile Overview
                            </button>
                            <button
                                onClick={() => setActiveTab("security")}
                                style={{
                                    padding: '16px 24px',
                                    border: 'none',
                                    background: activeTab === "security" ? '#fff' : 'transparent',
                                    borderBottom: activeTab === "security" ? '2px solid #f97316' : 'none',
                                    color: activeTab === "security" ? '#f97316' : '#64748b',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Security & Password
                            </button>
                            <button
                                onClick={() => setActiveTab("gym")}
                                style={{
                                    padding: '16px 24px',
                                    border: 'none',
                                    background: activeTab === "gym" ? '#fff' : 'transparent',
                                    borderBottom: activeTab === "gym" ? '2px solid #f97316' : 'none',
                                    color: activeTab === "gym" ? '#f97316' : '#64748b',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Gym Profile
                            </button>
                            <button
                                onClick={() => setActiveTab("branches")}
                                style={{
                                    padding: '16px 24px',
                                    border: 'none',
                                    background: activeTab === "branches" ? '#fff' : 'transparent',
                                    borderBottom: activeTab === "branches" ? '2px solid #f97316' : 'none',
                                    color: activeTab === "branches" ? '#f97316' : '#64748b',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                🏢 Branches
                            </button>
                            <button
                                onClick={() => setActiveTab("whatsapp")}
                                style={{
                                    padding: '16px 24px',
                                    border: 'none',
                                    background: activeTab === "whatsapp" ? '#fff' : 'transparent',
                                    borderBottom: activeTab === "whatsapp" ? '2px solid #f97316' : 'none',
                                    color: activeTab === "whatsapp" ? '#f97316' : '#64748b',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                WhatsApp
                            </button>
                            <button
                                onClick={() => setActiveTab("automation")}
                                style={{
                                    padding: '16px 24px',
                                    border: 'none',
                                    background: activeTab === "automation" ? '#fff' : 'transparent',
                                    borderBottom: activeTab === "automation" ? '2px solid #f97316' : 'none',
                                    color: activeTab === "automation" ? '#f97316' : '#64748b',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Automation
                            </button>
                        </div>

                        <div style={{ padding: '32px' }}>
                            {activeTab === "profile" ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            backgroundColor: '#f9731620',
                                            color: '#f97316',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '32px',
                                            fontWeight: 700
                                        }}>
                                            {userdata?.Name?.[0] || "U"}
                                        </div>
                                        <div>
                                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{userdata?.Name}</h2>
                                            <p style={{ color: '#64748b' }}>Gym Administrator</p>
                                        </div>
                                    </div>

                                    <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9' }} />

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Full Name</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <User size={18} color="#94a3b8" />
                                                <span style={{ fontWeight: 500, color: '#1e293b' }}>{userdata?.Name}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Email Address</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <Mail size={18} color="#94a3b8" />
                                                <span style={{ fontWeight: 500, color: '#1e293b' }}>{userdata?.email}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : activeTab === "security" ? (
                                <form onSubmit={handleSubmitPassword} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Change Password</h3>
                                        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Update your account password to keep your gym data secure.</p>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
                                        <div style={{ position: 'relative' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Current Password</label>
                                            <input
                                                type={showPasswords.current ? "text" : "password"}
                                                name="currentPassword"
                                                value={passwords.currentPassword}
                                                onChange={handlePasswordChange}
                                                placeholder="••••••••"
                                                style={{ width: '100%', padding: '12px 40px 12px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outlineColor: '#f97316' }}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => togglePasswordVisibility("current")}
                                                style={{ position: 'absolute', right: '12px', top: '38px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                            >
                                                {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>

                                        <div style={{ position: 'relative' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>New Password</label>
                                            <input
                                                type={showPasswords.new ? "text" : "password"}
                                                name="newPassword"
                                                value={passwords.newPassword}
                                                onChange={handlePasswordChange}
                                                placeholder="••••••••"
                                                style={{ width: '100%', padding: '12px 40px 12px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outlineColor: '#f97316' }}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => togglePasswordVisibility("new")}
                                                style={{ position: 'absolute', right: '12px', top: '38px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                            >
                                                {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>

                                        <div style={{ position: 'relative' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Confirm New Password</label>
                                            <input
                                                type={showPasswords.confirm ? "text" : "password"}
                                                name="confirmPassword"
                                                value={passwords.confirmPassword}
                                                onChange={handlePasswordChange}
                                                placeholder="••••••••"
                                                style={{ width: '100%', padding: '12px 40px 12px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outlineColor: '#f97316' }}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => togglePasswordVisibility("confirm")}
                                                style={{ position: 'absolute', right: '12px', top: '38px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                            >
                                                {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            style={{
                                                marginTop: '8px',
                                                padding: '12px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                background: '#f97316',
                                                color: '#fff',
                                                fontWeight: 700,
                                                cursor: loading ? 'not-allowed' : 'pointer',
                                                opacity: loading ? 0.7 : 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            {loading ? "Updating..." : <><Lock size={18} /> Update Password</>}
                                        </button>
                                    </div>
                                </form>
                            ) : activeTab === "gym" ? (
                                <form onSubmit={handleSubmitGymSettings} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>Gym Identity</h3>
                                            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>This information will appear on billing receipts and invoices.</p>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            style={{ padding: '10px 24px', background: '#f97316', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
                                        >
                                            {loading ? "Saving..." : "Save Changes"}
                                        </button>
                                    </div>

                                    {/* Logo & Signature Uploads */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                        <div style={{ padding: '20px', border: '2px dashed #e2e8f0', borderRadius: '12px', textAlign: 'center' }}>
                                            <label style={{ cursor: 'pointer', display: 'block' }}>
                                                <input type="file" name="gymLogo" onChange={handleFileChange} hidden accept="image/*" />
                                                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                                                    {gymSettingsPreview.gymLogo ? (
                                                        <img src={gymSettingsPreview.gymLogo} alt="Logo" style={{ maxHeight: '100px', maxWidth: '100%', borderRadius: '8px' }} />
                                                    ) : (
                                                        <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Image size={32} color="#94a3b8" />
                                                        </div>
                                                    )}
                                                </div>
                                                <span style={{ fontWeight: 600, color: '#f97316', fontSize: '0.9rem' }}>Upload Gym Logo</span>
                                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>PNG, JPG up to 2MB</p>
                                            </label>
                                        </div>

                                        <div style={{ padding: '20px', border: '2px dashed #e2e8f0', borderRadius: '12px', textAlign: 'center' }}>
                                            <label style={{ cursor: 'pointer', display: 'block' }}>
                                                <input type="file" name="authorizerSignature" onChange={handleFileChange} hidden accept="image/*" />
                                                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                                                    {gymSettingsPreview.authorizerSignature ? (
                                                        <img src={gymSettingsPreview.authorizerSignature} alt="Signature" style={{ maxHeight: '100px', maxWidth: '100%', borderRadius: '8px' }} />
                                                    ) : (
                                                        <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <FileText size={32} color="#94a3b8" />
                                                        </div>
                                                    )}
                                                </div>
                                                <span style={{ fontWeight: 600, color: '#f97316', fontSize: '0.9rem' }}>Authorizer Signature</span>
                                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Transparent PNG recommended</p>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Gym Details */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Gym Name</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <Building size={18} color="#94a3b8" />
                                                <input type="text" name="gymName" value={gymSettings.gymName} onChange={handleGymSettingsChange} placeholder="Enter Gym Name" style={{ border: 'none', outline: 'none', width: '100%', fontWeight: 500 }} />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Support Email</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <Mail size={18} color="#94a3b8" />
                                                <input type="email" name="email" value={gymSettings.email} onChange={handleGymSettingsChange} placeholder="contact@gym.com" style={{ border: 'none', outline: 'none', width: '100%', fontWeight: 500 }} />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Primary Mobile</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <Phone size={18} color="#94a3b8" />
                                                <input type="text" name="mobile" value={gymSettings.mobile} onChange={handleGymSettingsChange} placeholder="+91 XXXXX XXXXX" style={{ border: 'none', outline: 'none', width: '100%', fontWeight: 500 }} />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Website</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <Globe size={18} color="#94a3b8" />
                                                <input type="text" name="website" value={gymSettings.website} onChange={handleGymSettingsChange} placeholder="www.gym.com" style={{ border: 'none', outline: 'none', width: '100%', fontWeight: 500 }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Full Address</label>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <MapPin size={18} color="#94a3b8" style={{ marginTop: '4px' }} />
                                            <textarea name="address" value={gymSettings.address} onChange={handleGymSettingsChange} placeholder="Full street address..." rows="2" style={{ border: 'none', outline: 'none', width: '100%', fontWeight: 500, resize: 'none' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Landmark</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <MapPin size={18} color="#94a3b8" />
                                            <input type="text" name="landmark" value={gymSettings.landmark} onChange={handleGymSettingsChange} placeholder="e.g. Near RAM Park" style={{ border: 'none', outline: 'none', width: '100%', fontWeight: 500 }} />
                                        </div>
                                    </div>

                                    <div>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Geofencing (Attendance Restriction)</h4>
                                        <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '16px' }}>Set gym coordinates to restrict QR attendance within 200 meters.</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'flex-end' }}>
                                            <div>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Latitude</label>
                                                <input type="number" step="any" name="latitude" value={gymSettings.latitude ?? ''} onChange={handleGymSettingsChange} placeholder="e.g. 13.0827" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outlineColor: '#f97316' }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Longitude</label>
                                                <input type="number" step="any" name="longitude" value={gymSettings.longitude ?? ''} onChange={handleGymSettingsChange} placeholder="e.g. 80.2707" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outlineColor: '#f97316' }} />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (navigator.geolocation) {
                                                        navigator.geolocation.getCurrentPosition((pos) => {
                                                            setGymSettings({ ...gymSettings, latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                                                            toast.info("Location captured!");
                                                        }, (err) => {
                                                            console.error("Geolocation error:", err);
                                                            let msg = "Location lookup failed.";
                                                            switch (err.code) {
                                                                case err.PERMISSION_DENIED: msg = "Location permission denied. Please enable it in browser settings."; break;
                                                                case err.POSITION_UNAVAILABLE: msg = "Location unavailable. Ensure you are using HTTPS or localhost."; break;
                                                                case err.TIMEOUT: msg = "Location request timed out."; break;
                                                                default: msg = err.message;
                                                            }
                                                            toast.error(msg);
                                                        });
                                                    } else {
                                                        toast.error("Geolocation is not supported by this browser.");
                                                    }
                                                }}
                                                style={{ padding: '10px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                Get Current Location
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '16px' }}>Social Presence</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <Instagram size={18} color="#f97316" />
                                                <input type="text" name="instagram" value={gymSettings.instagram} onChange={handleGymSettingsChange} placeholder="Instagram" style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem' }} />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <Facebook size={18} color="#3b82f6" />
                                                <input type="text" name="facebook" value={gymSettings.facebook} onChange={handleGymSettingsChange} placeholder="Facebook" style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem' }} />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <Twitter size={18} color="#0ea5e9" />
                                                <input type="text" name="twitter" value={gymSettings.twitter} onChange={handleGymSettingsChange} placeholder="Twitter" style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem' }} />
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            ) : activeTab === "branches" ? (
                                <BranchManagement />
                            ) : activeTab === "whatsapp" ? (
                                <WhatsAppConnection />
                            ) : activeTab === "automation" ? (
                                <AutomationEngine />
                            ) : null}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
