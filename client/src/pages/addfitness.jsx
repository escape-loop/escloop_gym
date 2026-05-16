import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import axios from 'axios';
import '../styles/dashboard.css'; // Same styles as billing.jsx [file:1]
import { toast } from 'react-toastify';

export default function FitnessPlansAdd() {
  const { backendurl } = useContext(AppContent);
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = location.state?.isEditing || false;
  const planToEdit = location.state?.plan || null;
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    durationWeeks: 12,
    price: 0,
    category: 'strength',
    intensity: 'medium',
    targetAudience: 'beginner',
    workoutsPerWeek: 4,
    includesDiet: false,
    includesTracking: false,
    status: 'active'
  });
  const [loading, setLoading] = useState(false);

  const categories = ['strength', 'cardio', 'weight-loss', 'muscle-gain', 'yoga', 'flexibility'];
  const intensities = ['low', 'medium', 'high'];
  const targetAudiences = ['beginner', 'intermediate', 'advanced'];
  const statuses = ['active', 'inactive', 'draft'];

  useEffect(() => {
    if (isEditing && planToEdit) {
      setFormData({
        name: planToEdit.name || '',
        description: planToEdit.description || '',
        durationWeeks: planToEdit.durationWeeks || 12,
        price: planToEdit.price || 0,
        category: planToEdit.category || 'strength',
        intensity: planToEdit.intensity || 'medium',
        targetAudience: planToEdit.targetAudience || 'beginner',
        workoutsPerWeek: planToEdit.workoutsPerWeek || 4,
        includesDiet: planToEdit.includesDiet || false,
        includesTracking: planToEdit.includesTracking || false,
        status: planToEdit.status || 'active'
      });
    }
  }, [isEditing, planToEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEditing && planToEdit && planToEdit.planId) {
        await axios.put(`${backendurl}/fitness/${planToEdit.planId}`, formData, { withCredentials: true });
      } else {
        await axios.post(`${backendurl}/fitness/create`, formData, { withCredentials: true });
      }
      navigate('/fitnesslisting'); // Redirect to plans list
    } catch (error) {
      console.error('Error saving plan:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save plan';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-breadcrumb">
          Dashboard &gt; Fitness Plans &gt; Add New
        </div>
        <div className="header-tabs">
          <button className="activeTab" onClick={() => navigate('/fitnesslisting')}>
            Plans List
          </button>
          <button className="activeTab">{isEditing ? 'Edit Plan' : 'Add Plan'}</button>
        </div>
      </header>
      <div className="dash-content">
        <div className="fitness-plan-add">
          <div className="page-header">
            <h2>{isEditing ? 'Edit Fitness Plan' : 'Add New Fitness Plan'}</h2>
            <p>{isEditing ? 'Update the details of your fitness plan.' : 'Create customized workout plans for your gym members.'}</p>
          </div>

          <form onSubmit={handleSubmit} className="form-section">
            {/* Basic Info */}
            <div className="form-group">
              <h3>Plan Details</h3>
              <div className="form-row">
                <div className="form-field">
                  <label>Plan Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., 12-Week Strength Builder"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Price (₹) *</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    min="0"
                    step="100"
                    required
                  />
                </div>
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Describe the plan benefits, target results..."
                />
              </div>
            </div>

            {/* Plan Specs */}
            <div className="form-group">
              <h3>Plan Specifications</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label>Duration (Weeks)</label>
                  <select name="durationWeeks" value={formData.durationWeeks} onChange={handleChange}>
                    {[4, 6, 8, 12, 16, 24, 52].map(w => (
                      <option key={w} value={w}>{w} weeks</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Workouts/Week</label>
                  <select name="workoutsPerWeek" value={formData.workoutsPerWeek} onChange={handleChange}>
                    {[3, 4, 5, 6, 7].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Category</label>
                  <select name="category" value={formData.category} onChange={handleChange}>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Intensity</label>
                  <select name="intensity" value={formData.intensity} onChange={handleChange}>
                    {intensities.map(int => (
                      <option key={int} value={int}>{int.charAt(0).toUpperCase() + int.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Target Audience</label>
                  <select name="targetAudience" value={formData.targetAudience} onChange={handleChange}>
                    {targetAudiences.map(aud => (
                      <option key={aud} value={aud}>{aud.charAt(0).toUpperCase() + aud.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="form-group">
              <h3>Features</h3>
              <div className="checkbox-grid">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="includesDiet"
                    checked={formData.includesDiet}
                    onChange={handleChange}
                  />
                  Includes Diet Plan
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="includesTracking"
                    checked={formData.includesTracking}
                    onChange={handleChange}
                  />
                  Progress Tracking
                </label>
              </div>
            </div>

            {/* Status */}
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                {statuses.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/fitnesslisting')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : (isEditing ? 'Update Plan' : 'Create Plan')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}