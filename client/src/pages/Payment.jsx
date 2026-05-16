import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import '../styles/dashboard.css';
import ToggleButton from '../components/ToggleButton.jsx';
import Sidebar from '../components/Sidebar.jsx';
import '../styles/sidebar.css';
import '../styles/toggle-button.css';
import axios from 'axios';
import { toast } from 'react-toastify';

export default function Payment() {
  const { isauthenticated, getuserdata, userdata, backendurl, sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    discountType: 'amount',
    discountValue: '',
    paymentMode: 'Cash',
    amountPaid: '',
    balance: 0
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getDurationDaysByType = (type) => {
    switch (type) {
      case "Monthly": return 30;
      case "Quarterly": return 90;
      case "Half-Yearly": return 180;
      case "Yearly": return 365;
      case "Personal Training": return 30; // Default for PT
      default: return 30;
    }
  };

  const calculateInstallments = (amount, durationDays) => {
    // Calculate based on membership type
    const type = member?.plan || '';
    let installments = 1;
    let period = '';

    if (type === 'Monthly') {
      installments = 1;
      period = 'Monthly';
    } else if (type === 'Quarterly') {
      installments = 3;
      period = 'Monthly';
    } else if (type === 'Half-Yearly') {
      installments = 6;
      period = 'Monthly';
    } else if (type === 'Yearly') {
      installments = 12;
      period = 'Monthly';
    } else {
      installments = 1;
      period = 'As per plan';
    }

    const installmentAmount = Math.round(amount / installments);
    return {
      count: installments,
      period: period,
      amount: installmentAmount
    };
  };

  const fetchMember = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check for token in localStorage (for header auth)
      const tokenFromStorage = localStorage.getItem('token');
      console.log('Token from localStorage:', tokenFromStorage ? 'present' : 'missing');

      const headers = {
        'Content-Type': 'application/json'
      };

      // Add token to Authorization header if available in localStorage
      if (tokenFromStorage) {
        headers['Authorization'] = `Bearer ${tokenFromStorage}`;
        console.log('Using token from localStorage in Authorization header');
      }

      // Use the member data from location state if available, otherwise fetch from API
      if (location.state && location.state.member) {
        setMember(location.state.member);
        setLoading(false);
      } else {
        const response = await fetch(`${backendurl}/members/${id}`, {
          method: 'GET',
          headers: headers,
          credentials: 'include',
        });

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server error response:', errorText);
          throw new Error(`Failed to fetch member: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        console.log('Raw backend response:', result);

        if (result.success) {
          setMember(result.member);
        } else {
          throw new Error(result.message || 'Failed to fetch member');
        }
      }
    } catch (err) {
      console.error('Error fetching member:', err);
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
    fetchMember();
  }, [isauthenticated, navigate, id]);

  // Calculate payment details
  useEffect(() => {
    if (member) {
      const totalAmount = member.totalPayments || member.amount || 0;
      const discountValue = paymentForm.discountValue || 0;
      const discountAmount = paymentForm.discountType === 'amount'
        ? discountValue
        : (totalAmount * discountValue) / 100;

      const payableAmount = totalAmount - discountAmount;
      const amountPaid = paymentForm.amountPaid || 0;
      const balance = payableAmount - amountPaid;

      setPaymentForm(prev => ({
        ...prev,
        balance: balance
      }));
    }
  }, [member, paymentForm.discountType, paymentForm.discountValue, paymentForm.amountPaid]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();

    if (!member) return;

    try {
      const totalAmount = member.totalPayments || member.amount || 0;
      const discountValue = paymentForm.discountValue || 0;
      const discountAmount = paymentForm.discountType === 'amount'
        ? discountValue
        : (totalAmount * discountValue) / 100;

      const payableAmount = totalAmount - discountAmount;
      const amountPaid = paymentForm.amountPaid || 0;
      const balance = payableAmount - amountPaid;

      const paymentData = {
        memberId: member._id,
        amount: totalAmount,
        discountType: paymentForm.discountType,
        discountValue: discountValue,
        amountPaid: amountPaid,
        balanceAmount: balance,
        paymentMode: paymentForm.paymentMode
      };

      console.log('Payment data to submit:', paymentData);

      const response = await axios.put(`${backendurl}/members/${member._id}`, paymentData, {
        withCredentials: true
      });

      if (response.data.success) {
        toast.success('Payment updated successfully!');
        // Refresh member data
        fetchMember();
      } else {
        toast.error(response.data.message || 'Failed to update payment');
      }
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error('Error submitting payment. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-breadcrumb">
            Dashboard / Payment
          </div>
        </header>
        <main>
          <div className="dash-content">
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading member details...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-breadcrumb">
            Dashboard / Payment
          </div>
        </header>
        <main>
          <div className="dash-content">
            <div className="error-state">
              <div className="error-icon">⚠️</div>
              <h3>Error Loading Member</h3>
              <p>{error}</p>
              <button
                className="btn-primary"
                onClick={() => navigate('/billlisting')}
              >
                Back to Members
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-breadcrumb">
            Dashboard / Payment
          </div>
        </header>
        <main>
          <div className="dash-content">
            <div className="error-state">
              <div className="error-icon">👤</div>
              <h3>Member Not Found</h3>
              <p>Member details could not be loaded.</p>
              <button
                className="btn-primary"
                onClick={() => navigate('/billlisting')}
              >
                Back to Members
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const durationDays = getDurationDaysByType(member.plan);
  const installments = calculateInstallments(member.totalPayments || member.amount || 0, durationDays);
  const nextDueDate = member.endDate ? new Date(member.endDate) : new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 1);

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-breadcrumb">
          Dashboard / Payment
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => navigate('/billlisting')}
          >
            Back to Members
          </button>
        </div>
      </header>
      <main>
        <div className="dash-content">
          <div className="payment-page">
            {/* Member Details Section */}
            <div className="member-details-card">
              <div className="member-header">
                <div className="member-profile">
                  <img
                    src={
                      member.profilePhoto
                        ? `${backendurl.replace('/gym', '').replace(/\/+$/, '')}${member.profilePhoto.startsWith('/') ? '' : '/'}${member.profilePhoto}`
                        : `https://placehold.co/80x80/e5e7eb/9ca3af?text=${member.name?.charAt(0) || 'U'}`
                    }
                    alt={member.name}
                    className="member-profile-photo"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.parentNode) {
                        const fallback = document.createElement('div');
                        fallback.className = 'member-profile-fallback';
                        fallback.textContent = member.name?.charAt(0) || 'U';
                        e.target.parentNode.appendChild(fallback);
                      }
                    }}
                  />
                </div>
                <div className="member-info">
                  <h2 className="member-name">{member.name}</h2>
                  <div className="member-meta">
                    <span className="member-id">Attendance ID: {member.attendanceId || 'N/A'}</span>
                    <span className="member-phone">Phone: {member.phone}</span>
                  </div>
                </div>
              </div>

              <div className="member-details-grid">
                <div className="detail-item">
                  <label>Package Name</label>
                  <span className="detail-value">{member.plan}</span>
                </div>
                <div className="detail-item">
                  <label>Membership Type</label>
                  <span className="detail-value">{member.plan}</span>
                </div>
                <div className="detail-item">
                  <label>Start Date</label>
                  <span className="detail-value">{formatDate(member.startDate)}</span>
                </div>
                <div className="detail-item">
                  <label>End Date</label>
                  <span className="detail-value">{formatDate(member.endDate)}</span>
                </div>
                <div className="detail-item">
                  <label>Duration</label>
                  <span className="detail-value">{durationDays} days</span>
                </div>
              </div>
            </div>

            {/* Payment & Installment Section */}
            <div className="payment-section">
              <h3>Payment & Installment Details</h3>

              <form onSubmit={handleSubmitPayment} className="payment-form">
                <div className="payment-grid">
                  <div className="form-group">
                    <label htmlFor="amount">Amount (₹)</label>
                    <input
                      type="number"
                      id="amount"
                      name="amount"
                      value={member.totalPayments || member.amount || 0}
                      readOnly
                      className="form-input readonly"
                    />
                  </div>

                  <div className="form-group">
                    <label>Discount</label>
                    <div className="discount-group">
                      <select
                        name="discountType"
                        value={paymentForm.discountType}
                        onChange={handleInputChange}
                        className="form-select"
                      >
                        <option value="amount">Amount (₹)</option>
                        <option value="percent">Percentage (%)</option>
                      </select>
                      <input
                        type="number"
                        name="discountValue"
                        value={paymentForm.discountValue}
                        onChange={handleInputChange}
                        placeholder="Enter discount"
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="amountPaid">Amount Paid (₹)</label>
                    <input
                      type="number"
                      id="amountPaid"
                      name="amountPaid"
                      value={paymentForm.amountPaid}
                      onChange={handleInputChange}
                      placeholder="Enter amount paid"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="balance">Balance (₹)</label>
                    <input
                      type="number"
                      id="balance"
                      name="balance"
                      value={paymentForm.balance}
                      readOnly
                      className="form-input readonly"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="paymentMode">Payment Mode</label>
                    <select
                      id="paymentMode"
                      name="paymentMode"
                      value={paymentForm.paymentMode}
                      onChange={handleInputChange}
                      className="form-select"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                {/* Installment Details */}
                <div className="installment-details">
                  <h4>Installment Information</h4>
                  <div className="installment-grid">
                    <div className="installment-item">
                      <label>No. of Installments</label>
                      <span className="installment-value">{installments.count}</span>
                    </div>
                    <div className="installment-item">
                      <label>Installment Period</label>
                      <span className="installment-value">{installments.period}</span>
                    </div>
                    <div className="installment-item">
                      <label>Installment Amount (₹)</label>
                      <span className="installment-value">{installments.amount.toLocaleString()}</span>
                    </div>
                    <div className="installment-item">
                      <label>Next Due Date</label>
                      <span className="installment-value">{(() => { const d = nextDueDate; return d.getDate().toString().padStart(2, '0') + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getFullYear(); })()}</span>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary">
                    Update Payment
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate('/billlisting')}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}