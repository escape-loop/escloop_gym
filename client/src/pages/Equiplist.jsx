import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import '../styles/dashboard.css';
import ToggleButton from '../components/ToggleButton.jsx';
import Sidebar from '../components/Sidebar.jsx';
import '../styles/sidebar.css';
import '../styles/toggle-button.css';
import EquipmentDetailsModal from '../components/EquipmentDetailsModal.jsx';
import axios from 'axios';

export default function EquipmentListing() {
  const { isauthenticated, getuserdata, userdata, backendurl, sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState(null);

  // Modal state
  const [selectedEquipmentForView, setSelectedEquipmentForView] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEquipment, setTotalEquipment] = useState(0);
  const [limit] = useState(50);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await axios.get(`${backendurl}/equipment`, {
        headers,
        params: {
          page: currentPage,
          limit: limit,
          search: searchName || undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        },
        withCredentials: true,
      });

      if (response.data.success) {
        // Transform the data to match the frontend structure
        const transformedEquipment = response.data.data.map(item => {
          const transformedItem = {
            _id: item._id,
            name: item.name,
            category: item.category,
            brand: item.brand,
            model: item.model,
            serialNumbers: item.serialNumbers || [],
            quantity: item.quantity || 1,
            location: 'Main Floor',
            status: item.statuses?.[0] || 'available',
            purchasePrice: item.unitPrice || 0,
            maintenanceNext: item.maintenanceSchedule ? item.maintenanceSchedule.split('T')[0] : '',
            createdAt: item.createdAt,
            statuses: item.statuses || [],
            purchaseDate: item.purchaseDate ? item.purchaseDate.split('T')[0] : '',
            lastServiced: item.lastServiced ? item.lastServiced.split('T')[0] : '',
            maintenanceDays: item.maintenanceDays || 30,
            warrantyExpiry: item.warrantyExpiry ? item.warrantyExpiry.split('T')[0] : '',
            serviceContactNumber: item.serviceContactNumber || '',
            notes: item.notes || '',
            unitPrice: item.unitPrice || 0,
            totalPrice: (item.unitPrice || 0) * (item.quantity || 1)
          };
          return transformedItem;
        });

        setEquipment(transformedEquipment);

        if (response.data.pagination) {
          setTotalPages(response.data.pagination.pages);
          setTotalEquipment(response.data.pagination.total);
        }
      } else {
        throw new Error(response.data.message || 'Failed to fetch equipment');
      }
    } catch (err) {
      console.error('Error fetching equipment:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isauthenticated) {
      navigate("/");
      return;
    }
    getuserdata();
    fetchEquipment();
    window.scrollTo(0, 0);
  }, [isauthenticated, navigate, currentPage, searchName, categoryFilter, statusFilter]);

  // Removed client-side filtering
  const filteredEquipment = equipment;

  const handleAddEquipment = () => {
    navigate('/addequip');
  };



  const handleEdit = (item, e) => {
    if (e) e.stopPropagation();
    navigate('/addequip', { state: { item: item, isEditing: true } });
  };

  const handleViewDetails = (item) => {
    setSelectedEquipmentForView(item);
    setShowDetailsModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      available: '#10b981',
      'in-use': '#3b82f6',
      maintenance: '#f59e0b',
      repair: '#ef4444',
      retired: '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const getCategoryColor = (category) => {
    const colors = {
      cardio: '#3b82f6',
      strength: '#ef4444',
      'free-weights': '#10b981',
      machines: '#f59e0b',
      accessories: '#8b5cf6',
      functional: '#ec4899'
    };
    return colors[category] || '#6b7280';
  };

  return (
    <div className="dash-main">
      <header className="dash-header" style={{ zIndex: 10, justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="dash-breadcrumb">
          Dashboard &gt; Equipment
        </div>
        <button
          className="btn-primary"
          onClick={handleAddEquipment}
        >
          Add Equipment
        </button>
      </header>
      <main>
        <div className="dash-content">
          <div className="equipment-listing">
            {/* Stats Cards */}
            <div className="overview-stats">
              <div className="stat-card total">
                <h3>{equipment.reduce((total, e) => total + (e.serialNumbers?.length || 1), 0)}</h3>
                <p>Total Equipment</p>
                <span className="stat-change positive">+{equipment.reduce((total, e) => total + (e.serialNumbers?.length || 1), 0)}</span>
              </div>
              <div className="stat-card available">
                <h3>{equipment.reduce((total, e) => total + (e.statuses?.filter(s => s === 'available').length || (e.status === 'available' ? 1 : 0)), 0)}</h3>
                <p>Available</p>
                <span className="stat-change positive">
                  {equipment.length > 0 ? Math.round((equipment.reduce((total, e) => total + (e.statuses?.filter(s => s === 'available').length || (e.status === 'available' ? 1 : 0)), 0) / equipment.reduce((total, e) => total + (e.serialNumbers?.length || 1), 0)) * 100) : 0}%
                </span>
              </div>
              <div className="stat-card maintenance">
                <h3>{equipment.reduce((total, e) => total + (e.statuses?.filter(s => s === 'maintenance').length || (e.status === 'maintenance' ? 1 : 0)), 0)}</h3>
                <p>In Maintenance</p>
                <span className="stat-change warning">
                  {equipment.reduce((total, e) => total + (e.statuses?.filter(s => s === 'maintenance').length || (e.status === 'maintenance' ? 1 : 0)), 0)}
                </span>
              </div>
              <div className="stat-card value">
                <h3>
                  ₹{equipment.reduce((total, e) => total + (e.purchasePrice * (e.serialNumbers?.length || 1)), 0).toLocaleString()}
                </h3>
                <p>Total Value</p>
                <span className="stat-change positive">+{equipment.reduce((total, e) => total + (e.serialNumbers?.length || 1), 0)}</span>
              </div>
            </div>

            {/* Filters */}
            <div className="listing-filters">
              <div className="search-controls">
                <input
                  className="dash-search"
                  placeholder="Search equipment..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>
              <select
                className="status-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="cardio">Cardio</option>
                <option value="strength">Strength</option>
                <option value="free-weights">Free Weights</option>
                <option value="machines">Machines</option>
                <option value="accessories">Accessories</option>
                <option value="functional">Functional</option>
              </select>
              <select
                className="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="in-use">In Use</option>
                <option value="maintenance">Maintenance</option>
                <option value="repair">Repair</option>
                <option value="retired">Retired</option>
              </select>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading equipment...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <h3>Error Loading Equipment</h3>
                <p>{error}</p>
                <button
                  className="btn-primary"
                  onClick={fetchEquipment}
                >
                  Try Again
                </button>
              </div>
            ) : filteredEquipment.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏋️‍♂️</div>
                <h3>No equipment found</h3>
                <p>
                  {searchName || categoryFilter !== "all" || statusFilter !== "all"
                    ? "No equipment matches your current filters. Try adjusting them."
                    : "No equipment has been added yet. Add your first equipment to get started."}
                </p>
                <button
                  className="btn-primary"
                  onClick={handleAddEquipment}
                >
                  + Add Equipment
                </button>
              </div>
            ) : (
              <div className="members-table-container">
                <table className="members-table">
                  <thead>
                    <tr>
                      <th>Equipment Name</th>
                      <th>Category</th>
                      <th>Service Contact</th>
                      <th>Serial Numbers</th>
                      <th>Status</th>
                      <th>Next Maintenance</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEquipment.map((item) => (
                      <React.Fragment key={item._id}>
                        {item.serialNumbers.length > 0 ? (
                          item.serialNumbers.map((serial, index) => (
                            <tr
                              key={`${item._id}-${index}`}
                              onClick={() => handleViewDetails(item)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>
                                <div className="table-cell-name">
                                  <div className="plan-name">{item.name}</div>
                                  <div className="plan-desc">{item.brand && item.model ? `${item.brand} | ${item.model}` : 'Brand | Model'}</div>
                                </div>
                              </td>
                              <td>
                                <span
                                  className="category-badge"
                                  style={{ backgroundColor: getCategoryColor(item.category) + '20', color: getCategoryColor(item.category) }}
                                >
                                  {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                                </span>
                              </td>
                              <td>{item.serviceContactNumber || 'N/A'}</td>
                              <td>
                                <span className="serial-number">{serial}</span>
                              </td>
                              <td>
                                <span
                                  className={`status-badge ${item.statuses[index] || item.statuses[0] || 'available'}`}
                                  style={{ backgroundColor: getStatusColor(item.statuses[index] || item.statuses[0] || 'available') + '20', color: getStatusColor(item.statuses[index] || item.statuses[0] || 'available') }}
                                >
                                  {(item.statuses[index] || item.statuses[0] || 'available').charAt(0).toUpperCase() + (item.statuses[index] || item.statuses[0] || 'available').slice(1)}
                                </span>
                              </td>
                              <td>{formatDate(item.maintenanceNext)}</td>
                              <td>
                                <button
                                  className="btn-edit"
                                  onClick={(e) => handleEdit(item, e)}
                                  title="Edit Equipment"
                                >
                                  <i className="fas fa-edit"></i> Edit
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr
                            onClick={() => handleViewDetails(item)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <div className="table-cell-name">
                                <div className="plan-name">{item.name}</div>
                                <div className="plan-desc">{item.brand && item.model ? `${item.brand} | ${item.model}` : 'Brand | Model'}</div>
                              </div>
                            </td>
                            <td>
                              <span
                                className="category-badge"
                                style={{ backgroundColor: getCategoryColor(item.category) + '20', color: getCategoryColor(item.category) }}
                              >
                                {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                              </span>
                            </td>
                            <td>{item.serviceContactNumber || 'N/A'}</td>
                            <td>
                              <span className="serial-number">N/A</span>
                            </td>
                            <td>
                              <span
                                className={`status-badge ${item.status}`}
                                style={{ backgroundColor: getStatusColor(item.status) + '20', color: getStatusColor(item.status) }}
                              >
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                              </span>
                            </td>
                            <td>{formatDate(item.maintenanceNext)}</td>
                            <td>
                              <button
                                className="btn-edit"
                                onClick={(e) => handleEdit(item, e)}
                                title="Edit Equipment"
                              >
                                <i className="fas fa-edit"></i> Edit
                              </button>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-controls" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {currentPage} of {totalPages} • Total: {totalEquipment}
                </span>
                <button
                  className="btn-secondary"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <EquipmentDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        equipment={selectedEquipmentForView}
        backendurl={backendurl}
      />
    </div>
  );
}