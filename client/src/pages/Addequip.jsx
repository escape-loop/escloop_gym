import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import '../styles/dashboard.css';
import '../styles/addequip.css';
import ToggleButton from '../components/ToggleButton.jsx';
import Sidebar from '../components/Sidebar.jsx';
import '../styles/sidebar.css';
import '../styles/toggle-button.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

export default function EquipmentAdd() {
  const { backendurl, sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const location = useLocation();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'cardio',
    brand: '',
    model: '',
    serialNumbers: [''],
    statuses: ['available'],
    purchaseDate: '',
    unitPrice: 0,
    quantity: 1,
    totalPrice: 0,
    maintenanceSchedule: '',
    lastServiced: '',
    maintenanceDays: 30,
    warrantyExpiry: '',
    serviceContactNumber: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  const categories = [
    'cardio', 'strength', 'free-weights', 'machines', 'accessories', 'functional'
  ];
  const locations = ['Main Floor', 'Upper Level', 'Cardio Zone', 'Weight Room', 'Storage'];
  const statuses = ['available', 'in-use', 'maintenance', 'repair', 'retired'];

  // Get equipment data from location state if editing
  const locationState = location.state;
  const isEditing = locationState?.isEditing;
  const editEquipmentData = locationState?.item;

  useEffect(() => {
    if (isEditing && editEquipmentData) {
      console.log('Edit equipment data received:', editEquipmentData);
      console.log('Available fields in edit data:', Object.keys(editEquipmentData));

      // Log specific key fields
      console.log('Key fields in edit data:', {
        purchaseDate: editEquipmentData.purchaseDate,
        lastServiced: editEquipmentData.lastServiced,
        maintenanceSchedule: editEquipmentData.maintenanceSchedule,
        maintenanceNext: editEquipmentData.maintenanceNext,
        warrantyExpiry: editEquipmentData.warrantyExpiry,
        unitPrice: editEquipmentData.unitPrice,
        totalPrice: editEquipmentData.totalPrice,
        maintenanceDays: editEquipmentData.maintenanceDays
      });

      // Log stringified version to see exact format
      console.log('Stringified edit equipment data:', JSON.stringify(editEquipmentData, null, 2));

      // Handle serial numbers - if it's a single string, convert to array
      const serialNumbers = Array.isArray(editEquipmentData.serialNumbers)
        ? editEquipmentData.serialNumbers
        : editEquipmentData.serialNumbers ? [editEquipmentData.serialNumbers] : [''];

      // Handle statuses - if it's a single status, convert to array for each serial number
      const statuses = Array.isArray(editEquipmentData.statuses)
        ? editEquipmentData.statuses
        : editEquipmentData.statuses ? [editEquipmentData.statuses] : ['available'];

      // Ensure statuses array matches quantity
      const quantity = editEquipmentData.quantity || 1;
      const adjustedStatuses = statuses.length >= quantity
        ? statuses.slice(0, quantity)
        : [...statuses, ...Array(quantity - statuses.length).fill('available')];

      setFormData({
        name: editEquipmentData.name || '',
        category: editEquipmentData.category || 'cardio',
        brand: editEquipmentData.brand || '',
        model: editEquipmentData.model || '',
        serialNumbers: serialNumbers,
        statuses: adjustedStatuses,
        purchaseDate: editEquipmentData.purchaseDate || '',
        unitPrice: editEquipmentData.unitPrice || 0,
        quantity: editEquipmentData.quantity || 1,
        totalPrice: editEquipmentData.totalPrice || 0,
        maintenanceSchedule: editEquipmentData.maintenanceNext || editEquipmentData.maintenanceSchedule || '',
        lastServiced: editEquipmentData.lastServiced || '',
        maintenanceDays: editEquipmentData.maintenanceDays || 30,
        warrantyExpiry: editEquipmentData.warrantyExpiry || '',
        serviceContactNumber: editEquipmentData.serviceContactNumber || '',
        notes: editEquipmentData.notes || ''
      });
      setEditingId(editEquipmentData._id);
    }
  }, [isEditing, editEquipmentData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => {
      const updatedData = {
        ...prev,
        [name]: newValue
      };

      // Calculate total price when unit price or quantity changes
      if (name === 'unitPrice' || name === 'quantity') {
        const unitPrice = name === 'unitPrice' ? parseFloat(value) || 0 : prev.unitPrice;
        const quantity = name === 'quantity' ? parseInt(value) || 1 : prev.quantity;
        updatedData.totalPrice = unitPrice * quantity;

        // Adjust serial numbers array length based on quantity
        if (name === 'quantity') {
          const newQuantity = parseInt(value) || 1;
          const currentSerials = prev.serialNumbers || [];
          const currentStatuses = prev.statuses || [];

          if (newQuantity > currentSerials.length) {
            // Add new empty serial number fields and default statuses
            const newSerials = [...currentSerials, ...Array(newQuantity - currentSerials.length).fill('')];
            const newStatuses = [...currentStatuses, ...Array(newQuantity - currentStatuses.length).fill('available')];
            updatedData.serialNumbers = newSerials;
            updatedData.statuses = newStatuses;
          } else if (newQuantity < currentSerials.length) {
            // Remove excess serial number fields and statuses
            updatedData.serialNumbers = currentSerials.slice(0, newQuantity);
            updatedData.statuses = currentStatuses.slice(0, newQuantity);
          }
        }
      }

      // Auto-calculate maintenance schedule when purchase date or maintenance interval changes
      if (name === 'purchaseDate' || name === 'maintenanceDays') {
        const purchaseDate = name === 'purchaseDate' ? value : prev.purchaseDate;
        const maintenanceDays = name === 'maintenanceDays' ? parseInt(value) || 30 : prev.maintenanceDays;

        if (purchaseDate) {
          const date = new Date(purchaseDate);
          date.setDate(date.getDate() + maintenanceDays);

          // Format date as YYYY-MM-DD for input type="date"
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const nextMaintenanceDate = `${year}-${month}-${day}`;

          updatedData.maintenanceSchedule = nextMaintenanceDate;
        }
      }

      return updatedData;
    });
  };

  const handleSerialNumberChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      serialNumbers: prev.serialNumbers.map((serial, i) => i === index ? value : serial)
    }));
  };

  const handleStatusChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      statuses: prev.statuses.map((status, i) => i === index ? value : status)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      console.log('FormData being sent:', formData);
      console.log('Backend URL:', backendurl);
      console.log('Form data keys:', Object.keys(formData));

      // Check for token in localStorage (for header auth)
      const tokenFromStorage = localStorage.getItem('token');
      console.log('Token from localStorage:', tokenFromStorage ? 'present' : 'missing');

      // Check for token in cookies (for cookie auth)
      const tokenFromCookie = document.cookie.split(';').find(c => c.trim().startsWith('token='));
      console.log('Token from cookies:', tokenFromCookie ? 'present' : 'missing');

      // Validate required fields
      const requiredFields = ['name', 'maintenanceSchedule', 'maintenanceDays'];
      const missingFields = requiredFields.filter(field => !formData[field]);

      if (missingFields.length > 0) {
        throw new Error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      }

      // Create the payload to send
      const payload = {
        name: formData.name,
        category: formData.category,
        brand: formData.brand,
        model: formData.model,
        serialNumbers: formData.serialNumbers,
        statuses: formData.statuses,
        purchaseDate: formData.purchaseDate,
        unitPrice: formData.unitPrice,
        quantity: formData.quantity,
        maintenanceSchedule: formData.maintenanceSchedule,
        lastServiced: formData.lastServiced,
        maintenanceDays: formData.maintenanceDays,
        warrantyExpiry: formData.warrantyExpiry,
        serviceContactNumber: formData.serviceContactNumber,
        notes: formData.notes
      };

      console.log('Payload being sent to backend:', payload);
      console.log('Payload keys:', Object.keys(payload));

      const headers = {
        'Content-Type': 'application/json'
      };

      // Add token to Authorization header if available in localStorage
      if (tokenFromStorage) {
        headers['Authorization'] = `Bearer ${tokenFromStorage}`;
        console.log('Using token from localStorage in Authorization header');
      } else {
        console.log('No token in localStorage, relying on cookies');
      }

      const response = await fetch(`${backendurl}/equipment${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        headers: headers,
        credentials: 'include', // Include cookies in the request
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        let errorData;
        try {
          // Try to parse as JSON first
          errorData = await response.json();
        } catch (jsonError) {
          // If JSON parsing fails, try text
          try {
            errorData = await response.text();
          } catch (textError) {
            // If both fail, use status text
            errorData = response.statusText;
          }
        }
        console.error('Server error response:', errorData);
        throw new Error(`Failed to save equipment: ${response.status} - ${typeof errorData === 'object' ? JSON.stringify(errorData) : errorData}`);
      }

      const result = await response.json();
      console.log('Equipment saved successfully:', result);

      // Navigate to equipment list after successful save
      navigate('/equiplist');
    } catch (error) {
      console.error('Error saving equipment:', error);
      toast.error(`Error saving equipment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;

    const result = await Swal.fire({
      title: 'Delete this equipment?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        // Use same base path as creation endpoint
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${backendurl}/equipment/${editingId}`, {
          method: 'DELETE',
          headers,
          credentials: 'include'
        });

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (e) {
            try { errorData = await response.text(); } catch (_) { errorData = response.statusText; }
          }
          console.error('Server error during delete:', errorData);
          throw new Error(`Failed to delete equipment: ${response.status} - ${typeof errorData === 'object' ? JSON.stringify(errorData) : errorData}`);
        }

        console.log('Equipment deleted successfully');
        toast.success('Equipment deleted successfully');
        setTimeout(() => navigate('/equiplist'), 1500);
      } catch (error) {
        console.error('Error deleting equipment:', error);
        toast.error(`Error deleting equipment: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-breadcrumb">
          Dashboard &gt; Equipment &gt; Add New
        </div>
        {isEditing && (
          <div className="header-actions">
            <button
              className="btn-delete btn-delete-small"
              onClick={handleDelete}
              disabled={loading}
              title="Delete equipment"
            >
              Delete
            </button>
          </div>
        )}
      </header>
      <div className="dash-content">
        <div className="equipment-add">
          <div className="page-header">
            <h2>Add New Equipment</h2>
            <p>Track gym equipment inventory and maintenance.</p>
          </div>

          <form onSubmit={handleSubmit} className="form-section">
            {/* Basic Info */}
            <div className="form-group">
              <h3>Equipment Details</h3>
              <div className="form-row">
                <div className="form-field required">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Treadmill Pro X500"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Category</label>
                  <select name="category" value={formData.category} onChange={handleChange}>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Brand</label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    placeholder="e.g., Life Fitness"
                  />
                </div>
                <div className="form-field">
                  <label>Model</label>
                  <input
                    type="text"
                    name="model"
                    value={formData.model}
                    onChange={handleChange}
                    placeholder="e.g., 95Ti"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    min="1"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Serial Numbers & Status</label>
                  {Array.from({ length: parseInt(formData.quantity) || 1 }, (_, index) => (
                    <div key={index} className="serial-number-field">
                      <div className="serial-status-row">
                        <div className="serial-input">
                          <input
                            type="text"
                            value={formData.serialNumbers[index] || ''}
                            onChange={(e) => handleSerialNumberChange(index, e.target.value)}
                            placeholder={`Serial Number ${index + 1}`}
                          />
                        </div>
                        <div className="status-select">
                          <select
                            value={formData.statuses[index] || 'available'}
                            onChange={(e) => handleStatusChange(index, e.target.value)}
                          >
                            {statuses.map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>



            {/* Financial & Maintenance */}
            <div className="form-group">
              <h3>Financial & Maintenance</h3>
              <div className="form-row">
                <div className="form-field">
                  <label>Purchase Date</label>
                  <input
                    type="date"
                    name="purchaseDate"
                    value={formData.purchaseDate}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-field">
                  <label>Unit Price (₹)</label>
                  <input
                    type="number"
                    name="unitPrice"
                    value={formData.unitPrice}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Total Price (₹)</label>
                  <input
                    type="number"
                    name="totalPrice"
                    value={formData.totalPrice}
                    onChange={handleChange}
                    min="0"
                    placeholder="0"
                    disabled
                  />
                </div>
                <div className="form-field">
                  <label>Warranty Expiry</label>
                  <input
                    type="date"
                    name="warrantyExpiry"
                    value={formData.warrantyExpiry}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Last Serviced</label>
                  <input
                    type="date"
                    name="lastServiced"
                    value={formData.lastServiced}
                    onChange={handleChange}
                  />

                </div>
                <div className="form-field required">
                  <label>Maintenance Schedule</label>
                  <input
                    type="date"
                    name="maintenanceSchedule"
                    value={formData.maintenanceSchedule}
                    onChange={handleChange}
                    placeholder="Auto-calculated from purchase date"
                    required
                  />

                </div>
              </div>
              <div className="form-row">
                <div className="form-field required">
                  <label>Maintenance Interval (Days)</label>
                  <select
                    name="maintenanceDays"
                    value={formData.maintenanceDays}
                    onChange={handleChange}
                    required
                  >
                    <option value={7}>Weekly (7 days)</option>
                    <option value={15}>Bi-weekly (15 days)</option>
                    <option value={30}>Monthly (30 days)</option>
                    <option value={60}>Bi-monthly (60 days)</option>
                    <option value={90}>Quarterly (90 days)</option>
                    <option value={180}>Semi-annual (180 days)</option>
                    <option value={365}>Annual (365 days)</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Service Contact Number</label>
                  <input
                    type="tel"
                    name="serviceContactNumber"
                    value={formData.serviceContactNumber}
                    onChange={handleChange}
                    placeholder="e.g., +91 9876543210"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="form-group notes-section">
              <label>Notes</label>
              <textarea
                name="notes"
                className='notesarea'
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Special instructions, issues, etc."
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/equiplist')}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="loading-spinner"></span>
                    {editingId ? 'Updating...' : 'Saving...'}
                  </>
                ) : (
                  editingId ? 'Update Equipment' : 'Add Equipment'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
