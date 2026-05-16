// pages/ExpenseListing.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import '../styles/dashboard.css'; // Same styles as billing.jsx [file:1]
import Swal from 'sweetalert2';

export default function ExpenseListing() {
  const { backendurl } = useContext(AppContent);
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  // Sample expenses data
  const sampleExpenses = [
    {
      _id: 'EXP001',
      title: 'Electricity Bill - January 2026',
      category: 'utilities',
      amount: 12500,
      date: '2026-01-02',
      vendor: 'BESCOM',
      paymentMode: 'bank-transfer',
      recurring: true,
      expenseId: 'EXP2026010001',
      totalWithGst: 12500,
      notes: 'Monthly electricity bill'
    },
    {
      _id: 'EXP002',
      title: 'Trainer Salary - Rahul Kumar',
      category: 'salaries',
      amount: 45000,
      date: '2026-01-01',
      vendor: 'Rahul Kumar',
      paymentMode: 'bank-transfer',
      recurring: true,
      expenseId: 'EXP2026010002',
      totalWithGst: 45000,
      notes: 'Monthly salary payment'
    },
    {
      _id: 'EXP003',
      title: 'Treadmill Maintenance',
      category: 'maintenance',
      amount: 2500,
      date: '2026-01-02',
      vendor: 'Fitness Service Pro',
      paymentMode: 'upi',
      recurring: false,
      expenseId: 'EXP2026010003',
      totalWithGst: 2500,
      notes: 'Quarterly maintenance service'
    },
    {
      _id: 'EXP004',
      title: 'Office Supplies',
      category: 'supplies',
      amount: 1200,
      date: '2026-01-03',
      vendor: 'Stationery Store',
      paymentMode: 'cash',
      recurring: false,
      expenseId: 'EXP2026010004',
      totalWithGst: 1200,
      notes: 'Monthly office supplies'
    }
  ];

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setExpenses(sampleExpenses);
      setLoading(false);
    }, 500);
  }, []);

  const filteredExpenses = expenses.filter(expense =>
    expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.expenseId.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(expense => filterCategory === 'all' || expense.category === filterCategory)
    .filter(expense => filterMonth === 'all' || expense.date.startsWith(filterMonth));

  const categories = ['all', ...new Set(sampleExpenses.map(e => e.category))];
  const months = ['all', ...new Set(sampleExpenses.map(e => e.date.slice(0, 7)))];

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

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-breadcrumb">
          Dashboard / Expenses
        </div>
        <div className="header-tabs">
          <button
            className={`activeTab ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setViewMode('cards')}
          >
            Card View
          </button>
          <button
            className={`activeTab ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Table View
          </button>
          <button onClick={() => navigate('/addexpense')}>
            Add Expense
          </button>
        </div>
      </header>
      <div className="dash-content">
        <div className="expense-listing">
          {/* Stats Cards */}
          <div className="overview-stats">
            <div className="stat-card total">
              <h3>{formatCurrency(filteredExpenses.reduce((total, expense) => total + expense.totalWithGst, 0))}</h3>
              <p>Total Expenses</p>
              <span className="stat-change negative">-12%</span>
            </div>
            <div className="stat-card this-month">
              <h3>{formatCurrency(filteredExpenses.filter(e => e.date.startsWith((() => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0'); })())).reduce((total, expense) => total + expense.totalWithGst, 0))}</h3>
              <p>This Month</p>
              <span className="stat-change warning">+8%</span>
            </div>
            <div className="stat-card recurring">
              <h3>{formatCurrency(filteredExpenses.filter(e => e.recurring).reduce((total, expense) => total + expense.totalWithGst, 0))}</h3>
              <p>Recurring</p>
              <span className="stat-change positive">{filteredExpenses.filter(e => e.recurring).length}</span>
            </div>
            <div className="stat-card utilities">
              <h3>{formatCurrency(filteredExpenses.filter(e => e.category === 'utilities').reduce((total, expense) => total + expense.totalWithGst, 0))}</h3>
              <p>Utilities</p>
              <span className="stat-change negative">-5%</span>
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
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
                </option>
              ))}
            </select>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              {months.map(m => (
                <option key={m} value={m}>
                  {m === 'all' ? 'All Months' : new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>

          {/* Expenses Display */}
          {viewMode === 'cards' ? (
            <div className="plans-grid">
              {loading ? (
                <p>Loading expenses...</p>
              ) : filteredExpenses.map((expense) => (
                <div key={expense._id} className="plan-card">
                  <div className="plan-header">
                    <h3 className="plan-name">{expense.title}</h3>
                    <span className="plan-code">#{expense.expenseId}</span>
                    <div className={`plan-status ${expense.recurring ? 'active' : 'inactive'}`}>
                      {expense.recurring ? 'RECURRING' : 'ONE-TIME'}
                    </div>
                  </div>
                  <div className="plan-price">
                    <div className="price">{formatCurrency(expense.totalWithGst)}</div>
                    <div className="duration">{formatDate(expense.date)}</div>
                  </div>
                  <div className="plan-type">{expense.category.toUpperCase().replace('-', ' ')}</div>
                  <div className="plan-members">
                    <span>{expense.vendor}</span>
                  </div>
                  <div className="plan-actions">
                    <button
                      className="btn-view"
                      onClick={() => navigate('/expenseview', { state: { expense } })}
                    >
                      View
                    </button>
                    <button
                      className="btn-edit"
                      onClick={() => navigate('/addexpense')}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={async () => {
                        const result = await Swal.fire({
                          title: 'Delete this expense?',
                          text: 'This action cannot be undone.',
                          icon: 'warning',
                          showCancelButton: true,
                          confirmButtonColor: '#d33',
                          cancelButtonColor: '#6b7280',
                          confirmButtonText: 'Yes, delete'
                        });
                        if (result.isConfirmed) {
                          setExpenses(prev => prev.filter(e => e._id !== expense._id));
                        }
                      }}
                    >
                      Delete
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
                    <th>Title</th>
                    <th>ID</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Payment Mode</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => (
                    <tr key={expense._id}>
                      <td>
                        <div className="table-cell-name">
                          <div>
                            <div className="plan-name">{expense.title}</div>
                            <div className="plan-code">#{expense.expenseId}</div>
                          </div>
                        </div>
                      </td>
                      <td>{expense.expenseId}</td>
                      <td>{expense.category.toUpperCase().replace('-', ' ')}</td>
                      <td>{formatCurrency(expense.totalWithGst)}</td>
                      <td>{formatDate(expense.date)}</td>
                      <td>{expense.vendor}</td>
                      <td>{expense.paymentMode.toUpperCase().replace('-', ' ')}</td>
                      <td>
                        <span className={`status-badge ${expense.recurring ? 'active' : 'inactive'}`}>
                          {expense.recurring ? 'RECURRING' : 'ONE-TIME'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn-view"
                            onClick={() => navigate('/expenseview', { state: { expense } })}
                          >
                            View
                          </button>
                          <button
                            className="btn-edit"
                            onClick={() => navigate('/addexpense')}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-delete"
                            onClick={async () => {
                              const result = await Swal.fire({
                                title: 'Delete this expense?',
                                text: 'This action cannot be undone.',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#d33',
                                cancelButtonColor: '#6b7280',
                                confirmButtonText: 'Yes, delete'
                              });
                              if (result.isConfirmed) {
                                setExpenses(prev => prev.filter(e => e._id !== expense._id));
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
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
        </div>
      </div>
    </div>
  );
}