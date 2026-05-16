import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../context/context.jsx";
import "../styles/dashboard.css";
import PlanDetailsModal from "../components/PlanDetailsModal.jsx"; // Import Modal
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

export default function PlansListing() {
    const { isauthenticated, getuserdata, userdata, backendurl } = useContext(AppContent);
    const navigate = useNavigate();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState("cards"); // "cards" | "table"
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all"); // Add membership type filter

    // State for pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalPlans, setTotalPlans] = useState(0);
    const [limit] = useState(20);

    // State for details modal
    const [selectedPlanForView, setSelectedPlanForView] = useState(null);
    const [showPlanModal, setShowPlanModal] = useState(false);

    console.log('PlansListing component mounted with backendurl:', backendurl);

    const formatOfferDate = (val) => {
        if (!val) return '-';
        // Try to parse ISO date strings
        const parsed = new Date(val);
        if (!isNaN(parsed.getTime()) && /T|\d{4}-\d{2}-\d{2}/.test(val)) {
            const dd = String(parsed.getDate()).padStart(2, '0');
            const mm = String(parsed.getMonth() + 1).padStart(2, '0');
            const yyyy = parsed.getFullYear();
            return `${dd}-${mm}-${yyyy}`;
        }
        // If not ISO but non-empty string, return as-is
        return val || '-';
    };

    // Helper function to get proper image URL
    const getImageUrl = (image) => {
        if (!image) return '/api/placeholder/300/200';
        if (image.includes('/api/placeholder/')) return image;
        if (image.startsWith('http')) return image;

        if (image.startsWith('/uploads/')) {
            return `${backendurl.replace('/gym', '')}${image}`;
        }
        if (image.startsWith('/')) {
            return `${backendurl}${image}`;
        }
        return `${backendurl}/${image}`;
    };

    // Sample data for fallback (remove when API is ready)
    const samplePlans = [
        {
            _id: "66f7b8c9e7b8a4f123456789",
            name: "Basic Monthly",
            type: "Monthly",
            price: 1500,
            durationDays: 30,
            maxMembers: 0,
            status: "Active",
            planCode: "M202600123",
            description: "Unlimited access to gym equipment",
            features: ["24/7 Access", "Locker", "Basic Training"],
            image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop",
            offerValid: "Till 31 Dec 2026",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
        // ... other samples
    ];

    useEffect(() => {
        if (!isauthenticated) {
            navigate("/");
            return;
        }

        fetchPlans();
        window.scrollTo(0, 0);
        document.querySelector('.dash-content')?.scrollTo(0, 0);
        document.querySelector('.app-container')?.scrollTo(0, 0);
    }, [isauthenticated, navigate, statusFilter, typeFilter, search, currentPage]); // Added dependencies to trigger fetch

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams({
                status: statusFilter,
                type: typeFilter !== 'all' ? typeFilter : '',
                search: search,
                page: currentPage.toString(),
                limit: limit.toString()
            });

            console.log('Fetching plans with params:', queryParams.toString());

            const response = await fetch(`${backendurl}/plans?${queryParams}`, {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                if (Array.isArray(result.plans)) {
                    // Ensure images are properly formatted
                    const plansWithImages = result.plans.map(plan => ({
                        ...plan,
                        image: plan.image || null
                    }));
                    setPlans(plansWithImages);

                    if (result.pagination) {
                        setTotalPages(result.pagination.pages);
                        setTotalPlans(result.pagination.total);
                    }
                } else {
                    setPlans(samplePlans);
                }
            } else {
                console.error('Failed to fetch plans:', result.message);
                setPlans(samplePlans);
            }
        } catch (error) {
            console.error('Error fetching plans:', error);
            setPlans(samplePlans);
        } finally {
            setLoading(false);
        }
    };

    // removed fetchPlanMemberCounts

    // Client-side filtering is no longer needed as server handles it.
    // Just pass 'plans' to render.
    const filteredPlans = plans;

    // ... edit/view/delete handlers ...
    const handleEdit = (plan) => {
        const editPlan = { ...plan, image: plan.image || null };
        navigate('/membership', { state: { plan: editPlan, isEditing: true } });
    };

    const handleView = (plan) => {
        setSelectedPlanForView(plan);
        setShowPlanModal(true);
    };

    const handleDelete = async (id) => {
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
            try {
                const response = await fetch(`${backendurl}/plans/${id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });
                const apiResult = await response.json();

                if (apiResult.success) {
                    setPlans((prev) => prev.filter((p) => p._id !== id));
                    toast.success('Plan deleted successfully');
                    // Should theoretically refetch to update pages, but local update is faster for UX
                    fetchPlans();
                } else {
                    toast.error(apiResult.message || 'Failed to delete plan');
                }
            } catch (error) {
                console.error('Error deleting plan:', error);
                toast.error('Error deleting plan. Please try again.');
            }
        }
    };

    const toggleStatus = async (id) => {
        try {
            const response = await fetch(`${backendurl}/plans/${id}/toggle`, {
                method: 'PATCH',
                credentials: 'include',
            });
            const result = await response.json();

            if (result.success) {
                setPlans((prev) =>
                    prev.map((plan) =>
                        plan._id === id
                            ? { ...plan, status: plan.status === "Active" ? "Inactive" : "Active" }
                            : plan
                    )
                );
                toast.success(`Plan ${result.status.toLowerCase()}d successfully`);
            } else {
                toast.error(result.message || 'Failed to toggle status');
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            toast.error('Error toggling status. Please try again.');
        }
    };

    return (
        <div className="dash-main">
            <header className="dash-header">
                <div className="dash-breadcrumb">Dashboard / Membership Plans {statusFilter !== 'all' && `(${statusFilter})`}</div>
                <div className="dash-header-right">
                    <div className="search-container">
                        <input
                            className="dash-search"
                            placeholder="Search plans..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1); // Reset page on search
                            }}
                        />
                    </div>
                    <select
                        className="status-filter"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                    >
                        <option value="all">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                    <select
                        className="status-filter"
                        value={typeFilter}
                        onChange={(e) => {
                            setTypeFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                    >
                        <option value="all">All Types</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Half-Yearly">Half-Yearly</option>
                        <option value="Yearly">Yearly</option>
                        <option value="Personal Training">Personal Training</option>
                        <option value="Custom">Custom</option>
                    </select>
                    <button
                        className="btn-primary"
                        onClick={() => navigate("/membership")}
                    >
                        + Add New Plan
                    </button>
                </div>
            </header>

            <div className="dash-content">
                <div className="plans-controls">
                    <div className="stats">
                        <span>Total Plans: {totalPlans}</span>
                    </div>
                    <div className="view-toggle">
                        <button
                            className={`view-btn ${viewMode === "cards" ? "active" : ""}`}
                            onClick={() => setViewMode("cards")}
                        >
                            Cards
                        </button>
                        <button
                            className={`view-btn ${viewMode === "table" ? "active" : ""}`}
                            onClick={() => setViewMode("table")}
                        >
                            Table
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading" style={{
                        display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', color: '#6b7280', fontSize: '14px'
                    }}>
                        Loading plans...
                    </div>
                ) : filteredPlans.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <h3>No plans found</h3>
                        <p>
                            {search || statusFilter !== "all"
                                ? "No plans match your current filters. Try adjusting them."
                                : "No membership plans have been created yet. Create your first plan to get started."}
                        </p>
                        <button
                            className="btn-primary"
                            onClick={() => navigate("/membership")}
                        >
                            + Add New Plan
                        </button>
                    </div>
                ) : (
                    <>
                        {viewMode === "cards" ? (
                            <div className="plans-grid">
                                {filteredPlans.map((plan) => (
                                    <div
                                        key={plan._id}
                                        className="plan-card"
                                        onClick={() => handleView(plan)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="plan-image" style={{ position: 'relative', zIndex: 1, backgroundColor: 'transparent', height: '140px', overflow: 'hidden', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                                            <img
                                                src={getImageUrl(plan.image)}
                                                alt={plan.name || 'Plan Image'}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                onError={(e) => {
                                                    if (e.target.src.includes('/api/placeholder/')) return;
                                                    e.target.src = '/api/placeholder/300/200';
                                                }}
                                            />
                                        </div>
                                        <div className="plan-title-center" style={{ textAlign: 'center', padding: '8px 12px' }}>
                                            <h3 className="plan-name" style={{ margin: 0 }}>{plan.name || 'Unnamed Plan'}</h3>
                                            <div className="plan-code" style={{ fontSize: 12, color: '#6b7280' }}>#{plan.planCode || 'N/A'}</div>
                                        </div>
                                        <div className={`status-badge ${plan.status?.toLowerCase() || 'inactive'}`} style={{
                                            position: 'absolute', top: '10px', right: '10px', zIndex: 20
                                        }}>
                                            {plan.status || 'Inactive'}
                                        </div>
                                        <div className="plan-price">
                                            <div className="price">₹{plan.price || 0}</div>
                                            <div className="duration">{plan.durationDays || 0} days</div>
                                        </div>
                                        <div className="plan-type">{plan.type || 'Unknown Type'}</div>
                                        <div className="plan-offer" style={{ marginTop: 8, color: '#fb923c', fontSize: 13 }}>
                                            <span>Offer: {formatOfferDate(plan.offerValid)}</span>
                                        </div>
                                        <div className="plan-members">
                                            <span>{plan.memberCount || 0}</span> / {plan.maxMembers > 0 ? plan.maxMembers : 'Unlimited'} members
                                        </div>
                                        <div className="plan-actions">
                                            <button
                                                className="btn-secondary"
                                                onClick={(e) => { e.stopPropagation(); handleEdit(plan); }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="btn-secondary"
                                                onClick={(e) => { e.stopPropagation(); toggleStatus(plan._id); }}
                                            >
                                                {plan.status === "Active" ? "Pause" : "Activate"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="plans-table-container">
                                <table className="plans-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Code</th>
                                            <th>Type</th>
                                            <th>Price</th>
                                            <th>Duration</th>
                                            <th>Offer Valid</th>
                                            <th>Members</th>
                                            <th>Max Members</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPlans.map((plan) => (
                                            <tr key={plan._id} onClick={() => handleView(plan)} style={{ cursor: 'pointer' }}>
                                                <td>
                                                    <div className="table-cell-name">
                                                        <img
                                                            src={getImageUrl(plan.image)}
                                                            alt={plan.name || 'Plan Image'}
                                                            className="table-plan-img"
                                                            style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                                                            onError={(e) => {
                                                                if (e.target.src.includes('/api/placeholder/')) return;
                                                                e.target.src = '/api/placeholder/40/40';
                                                            }}
                                                        />
                                                        {plan.name || 'Unnamed Plan'}
                                                    </div>
                                                </td>
                                                <td>#{plan.planCode || 'N/A'}</td>
                                                <td>{plan.type || 'Unknown Type'}</td>
                                                <td>₹{plan.price || 0}</td>
                                                <td>{plan.durationDays || 0}d</td>
                                                <td>{formatOfferDate(plan.offerValid)}</td>
                                                <td>{plan.memberCount || 0}</td>
                                                <td>{plan.maxMembers > 0 ? plan.maxMembers : 'Unlimited'}</td>
                                                <td>
                                                    <span className={`status-badge ${plan.status.toLowerCase()}`}>
                                                        {plan.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="table-actions">
                                                        <button
                                                            className="btn-secondary small"
                                                            onClick={(e) => { e.stopPropagation(); handleEdit(plan); }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            className="btn-secondary small"
                                                            onClick={(e) => { e.stopPropagation(); toggleStatus(plan._id); }}
                                                        >
                                                            {plan.status === "Active" ? "Pause" : "Activate"}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
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
                                    Page {currentPage} of {totalPages}
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
                    </>
                )}

            </div>

            <PlanDetailsModal
                isOpen={showPlanModal}
                onClose={() => setShowPlanModal(false)}
                plan={selectedPlanForView}
                backendurl={backendurl}
            />
        </div>
    );

}