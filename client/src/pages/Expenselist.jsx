// pages/ExpenseListing.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import Sidebar from '../components/Sidebar.jsx';
import ToggleButton from '../components/ToggleButton.jsx';
import '../styles/dashboard.css';
import Swal from 'sweetalert2';

export default function ExpenseListing() {
  const { backendurl, sidebarOpen, setSidebarOpen } = useContext(AppContent);
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'cards' or 'table'
  const [selectedDay, setSelectedDay] = useState(null); // For modal view
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({
    todayExpense: 0,
    thisMonthExpense: 0,
    thisMonthMaintenance: 0,
    thisMonthSalary: 0
  });

  // Pagination and status
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [limit] = useState(20);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debouncing search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 500);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    fetchExpenses();
  }, [currentPage, debouncedSearch, filterCategory, filterMonth, filterDate]);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      const response = await fetch(`${backendurl}/expenses/overview`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching expense overview:', error);
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: limit,
        search: debouncedSearch,
        category: filterCategory !== 'all' ? filterCategory : '',
        month: filterMonth !== 'all' ? filterMonth : '',
        date: filterDate || ''
      });

      const response = await fetch(`${backendurl}/expenses?${params.toString()}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setExpenses(data.expenses || []);
        if (data.pagination) {
          setTotalPages(data.pagination.pages);
          setTotalExpenses(data.pagination.total);
        }
      } else {
        console.error('Failed to fetch expenses:', response.status, response.statusText);
        setExpenses([]);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteExpense = async (expenseId) => {
    const result = await Swal.fire({
      title: 'Delete this expense?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete'
    });
    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await fetch(`${backendurl}/expenses/${expenseId}`, {
        method: 'DELETE',
        credentials: 'include' // Include cookies for authentication
      });

      if (response.ok) {
        fetchExpenses(); // Refresh the list
      } else {
        console.error('Failed to delete expense:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  // Expenses are now filtered on the server
  const filteredExpenses = expenses;

  // Group expenses by date
  const groupedExpenses = filteredExpenses.reduce((acc, expense) => {
    const date = expense.date.split('T')[0]; // Extract date part
    if (!acc[date]) {
      acc[date] = {
        date: date,
        expenses: [],
        totalAmount: 0
      };
    }
    acc[date].expenses.push({
      sno: acc[date].expenses.length + 1,
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      paymentMode: expense.paymentMode,
      attachmentUrl: expense.attachmentUrl,
      attachmentName: expense.attachmentName,
      attachments: expense.attachments || [],
      notes: expense.notes,
      totalWithGst: expense.totalWithGst
    });
    acc[date].totalAmount += expense.totalWithGst;
    return acc;
  }, {});

  const categories = ['all', 'utilities', 'salaries', 'maintenance', 'rent', 'supplies', 'marketing', 'equipment', 'subscriptions', 'miscellaneous'];
  // We don't need to derive months from the current page's expenses since it's paginated
  // Let's keep the filter date and month manual input. 

  const getCategoryColor = (category) => {
    const colors = {
      utilities: 'bg-blue',
      salaries: 'bg-red',
      maintenance: 'bg-orange',
      rent: 'bg-purple',
      supplies: 'bg-green',
      marketing: 'bg-pink',
      equipment: 'bg-indigo',
      subscriptions: 'bg-teal',
      miscellaneous: 'bg-gray'
    };
    return colors[category] || 'bg-gray';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const openDayDetails = (date, group) => {
    setSelectedDay({ date, ...group });
    setShowModal(true);
  };

  const closeDayDetails = () => {
    setShowModal(false);
    setSelectedDay(null);
  };

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-breadcrumb">Dashboard / Expenses</div>
        </div>
        <div className="dash-header-right">

          <button className="btn-primary" onClick={() => navigate('/addexpense')}>
            + Add Expense
          </button>
        </div>
      </header>
      <div className="dash-content">
        <div className="expense-listing">
          {/* Stats Cards */}
          <div className="overview-stats">
            <div className="stat-card today">
              <h3 style={{ fontSize: '24px' }}>{formatCurrency(stats.todayExpense)}</h3>
              <p>Today Expense</p>
            </div>
            <div className="stat-card this-month">
              <h3 style={{ fontSize: '24px' }}>{formatCurrency(stats.thisMonthExpense)}</h3>
              <p>This Month Expense</p>
            </div>
            <div className="stat-card maintenance">
              <h3 style={{ fontSize: '24px' }}>{formatCurrency(stats.thisMonthMaintenance)}</h3>
              <p>This Month Maintenance</p>
            </div>
            <div className="stat-card salary">
              <h3 style={{ fontSize: '24px' }}>{formatCurrency(stats.thisMonthSalary)}</h3>
              <p>This Month Salary</p>
            </div>
          </div>

          {/* Filters */}
          <div className="listing-filters">
            <input
              type="text"
              placeholder="Search by title, vendor, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <div className="date-filter-group">
              <label>Filter by Date:</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="date-input"
              />
              {filterDate && (
                <button
                  className="clear-date"
                  onClick={() => setFilterDate('')}
                  title="Clear date filter"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Expenses Display */}
          {viewMode === 'cards' ? (
            <div className="expenses-grid">
              {loading ? (
                <p>Loading expenses...</p>
              ) : Object.entries(groupedExpenses).map(([date, group]) => (
                <div
                  key={date}
                  className="expense-card"
                  onClick={() => openDayDetails(date, group)}
                  style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'none'}
                >
                  <div className="expense-header">
                    <h4>{formatDate(date)}</h4>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="total-amount">Total: ₹{group.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="expense-items">
                    {group.expenses.map((expense, index) => (
                      <div key={index} className="expense-item">
                        <span className="sno">{expense.sno}.</span>
                        <span className="title">{expense.title}</span>
                        <span className={`category-badge ${getCategoryColor(expense.category)}`}>
                          {expense.category.toUpperCase().replace('-', ' ')}
                        </span>
                        <span className="amount">₹{expense.amount.toLocaleString()}</span>
                        <span className="payment-mode">{expense.paymentMode}</span>
                      </div>
                    ))}
                  </div>
                  <div className="expense-footer">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/addexpense', {
                          replace: true,
                          state: {
                            isEditing: true,
                            expenseData: {
                              date: date,
                              expenses: group.expenses,
                              totalAmount: group.totalAmount
                            }
                          }
                        });
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #fb923c, #ea580c)',
                        color: '#020617',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '700',
                        boxShadow: '0 2px 4px rgba(234, 88, 12, 0.2)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="expenses-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Total Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedExpenses).map(([date, group]) => (
                    <tr key={date} onClick={() => openDayDetails(date, group)} style={{ cursor: 'pointer' }}>
                      <td>{formatDate(date)}</td>
                      <td>₹{group.totalAmount.toLocaleString()}</td>
                      <td>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/addexpense', {
                              replace: true,
                              state: {
                                isEditing: true,
                                expenseData: {
                                  date: date,
                                  expenses: group.expenses,
                                  totalAmount: group.totalAmount
                                }
                              }
                            });
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #fb923c, #ea580c)',
                            color: '#020617',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            boxShadow: '0 2px 4px rgba(234, 88, 12, 0.2)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredExpenses.length === 0 && !loading && (
            <div className="empty-state">
              <p>No expenses found matching your filters.</p>
              <button onClick={() => navigate('/addexpense')} className="btn-primary">
                Add First Expense
              </button>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-controls" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setCurrentPage(prev => Math.max(1, prev - 1));
                  window.scrollTo(0, 0);
                }}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages} • Total: {totalExpenses}
              </span>
              <button
                className="btn-secondary"
                onClick={() => {
                  setCurrentPage(prev => Math.min(totalPages, prev + 1));
                  window.scrollTo(0, 0);
                }}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Expense Details Modal */}
        {showModal && selectedDay && (
          <div
            className="modal-overlay"
            onClick={closeDayDetails}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
          >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                maxWidth: '900px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                animation: 'slideIn 0.3s ease'
              }}
            >
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #fb923c, #ea580c)',
                color: '#ffffff',
                padding: '24px 30px',
                borderRadius: '16px 16px 0 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
                    Expenses for {formatDate(selectedDay.date)}
                  </h2>
                  <p style={{ margin: '8px 0 0', fontSize: '16px', opacity: 0.9 }}>
                    Total: {formatCurrency(selectedDay.totalAmount)}
                  </p>
                </div>
                <button
                  onClick={closeDayDetails}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '24px',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '30px' }}>
                <div style={{
                  display: 'grid',
                  gap: '16px'
                }}>
                  {selectedDay.expenses.map((expense, index) => (
                    <div
                      key={index}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '20px',
                        background: '#f9fafb',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#fb923c';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <span style={{
                              background: 'linear-gradient(135deg, #fb923c, #ea580c)',
                              color: '#ffffff',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700'
                            }}>
                              #{expense.sno}
                            </span>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                              {expense.title}
                            </h3>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              background: '#fed7aa',
                              color: '#9a3412'
                            }}>
                              {expense.category.toUpperCase().replace('-', ' ')}
                            </span>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              background: '#dcfce7',
                              color: '#166534'
                            }}>
                              {expense.paymentMode}
                            </span>
                          </div>
                        </div>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: '700',
                          color: '#ef4444',
                          textAlign: 'right'
                        }}>
                          ₹{expense.amount.toLocaleString()}
                        </div>
                      </div>

                      {expense.notes && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          background: '#ffffff',
                          borderRadius: '8px',
                          borderLeft: '3px solid #fb923c'
                        }}>
                          <p style={{
                            margin: 0,
                            fontSize: '14px',
                            color: '#6b7280',
                            fontStyle: 'italic'
                          }}>
                            <strong style={{ color: '#374151' }}>Note:</strong> {expense.notes}
                          </p>
                        </div>
                      )}


                    </div>
                  ))}
                </div>

                {/* All Attachments Section at the End */}
                {(() => {
                  // Use a Map to deduplicate attachments by URL
                  const attachmentMap = new Map();

                  selectedDay.expenses.forEach(expense => {
                    if (expense.attachments && expense.attachments.length > 0) {
                      expense.attachments.forEach(attachment => {
                        const key = attachment.url || attachment.name;
                        // Only add if we haven't seen this URL before
                        if (!attachmentMap.has(key)) {
                          attachmentMap.set(key, {
                            ...attachment,
                            expenseTitle: expense.title,
                            expenseSno: expense.sno
                          });
                        }
                      });
                    }
                  });

                  const allAttachments = Array.from(attachmentMap.values());

                  if (allAttachments.length > 0) {
                    return (
                      <div style={{
                        marginTop: '30px',
                        padding: '20px',
                        background: '#fff7ed',
                        borderRadius: '12px',
                        border: '2px solid #fb923c'
                      }}>
                        <h4 style={{
                          margin: '0 0 16px 0',
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#9a3412',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          📎 All Attachments ({allAttachments.length})
                        </h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {allAttachments.map((attachment, idx) => (
                            <div key={idx} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px',
                              background: '#ffffff',
                              borderRadius: '8px',
                              border: '1px solid #fed7aa'
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#9a3412', marginBottom: '4px' }}>
                                  #{attachment.expenseSno} - {attachment.expenseTitle}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                  {attachment.name || `Attachment ${idx + 1}`}
                                </div>
                              </div>
                              <a
                                href={`${backendurl.replace('/gym', '')}${attachment.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  padding: '6px 16px',
                                  background: 'linear-gradient(135deg, #fb923c, #ea580c)',
                                  color: '#ffffff',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  textDecoration: 'none',
                                  fontWeight: '600',
                                  transition: 'all 0.2s ease',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                              >
                                View File
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '20px 30px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}>
                <button
                  onClick={closeDayDetails}
                  style={{
                    padding: '10px 24px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#e5e7eb'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#f3f4f6'}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}