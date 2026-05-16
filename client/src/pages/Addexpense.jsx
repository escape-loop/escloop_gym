// pages/ExpenseAdd.jsx
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';
import '../styles/dashboard.css'; // Same styles as billing.jsx [file:1]
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

export default function ExpenseAdd() {
  const { backendurl } = useContext(AppContent);
  const navigate = useNavigate();
  const location = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    date: (() => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })(),
    expenses: [
      {
        sno: 1,
        description: '',
        category: 'utilities',
        amount: 0,
        paymentMode: 'cash'
      }
    ],
    notes: '',
    attachments: []
  });

  // Form data change tracking
  const [previews, setPreviews] = useState([]);

  const isImageFile = (urlOrFile) => {
    if (!urlOrFile) return false;
    const name = (urlOrFile instanceof File) ? urlOrFile.name : urlOrFile;
    if (typeof name !== 'string') return false;
    const lower = name.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.some(ext => lower.endsWith(ext)) || lower.startsWith('data:image') || lower.startsWith('blob:');
  };

  useEffect(() => {
    const generatePreviews = () => {
      const newPreviews = formData.attachments.map(item => {
        if (item instanceof File) {
          return {
            url: URL.createObjectURL(item),
            name: item.name,
            isImage: isImageFile(item),
            isFile: true
          };
        } else if (item && typeof item === 'object' && item.url) {
          // Existing attachment from backend
          const baseUrl = backendurl.split('/gym')[0];
          let fullUrl = item.url;
          if (!fullUrl.startsWith('http') && !fullUrl.startsWith('blob:')) {
            if (!fullUrl.startsWith('/')) fullUrl = '/' + fullUrl;
            fullUrl = `${baseUrl}${fullUrl}`;
          }
          return {
            url: fullUrl,
            name: item.name || 'document',
            isImage: isImageFile(item.url),
            isFile: false
          };
        }
        return null;
      }).filter(Boolean);
      setPreviews(newPreviews);
    };

    generatePreviews();

    // Cleanup object URLs to avoid memory leaks
    return () => {
      previews.forEach(preview => {
        if (preview.url.startsWith('blob:')) {
          URL.revokeObjectURL(preview.url);
        }
      });
    };
  }, [formData.attachments, backendurl]);

  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Initialize form data when editing
  useEffect(() => {
    if (location.state?.isEditing && location.state?.expenseData) {
      setIsEditing(true);
      const expenseData = location.state.expenseData;

      // Format expenses for the form
      const formattedExpenses = expenseData.expenses.map((expense, index) => ({
        sno: index + 1,
        description: expense.title || expense.description || '',
        category: expense.category || 'utilities',
        amount: expense.amount || 0,
        paymentMode: expense.paymentMode || 'cash'
      }));

      setFormData(prev => {
        const existingAttachments = expenseData.expenses[0]?.attachments || [];
        // Support legacy single attachment for backward compatibility
        if (existingAttachments.length === 0 && expenseData.expenses[0]?.attachmentUrl) {
          existingAttachments.push({
            url: expenseData.expenses[0].attachmentUrl,
            name: expenseData.expenses[0].attachmentName || 'Attachment'
          });
        }

        return {
          date: expenseData.date || (() => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })(),
          expenses: formattedExpenses,
          notes: expenseData.expenses[0]?.notes || '',
          attachments: existingAttachments
        };
      });
    }
  }, [location.state]);

  const categories = [
    'utilities', 'rent', 'salaries', 'maintenance', 'supplies',
    'marketing', 'equipment', 'subscriptions', 'miscellaneous'
  ];
  const paymentModes = ['cash', 'bank-transfer', 'upi', 'card', 'cheque'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleExpenseChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      expenses: prev.expenses.map((expense, i) =>
        i === index ? { ...expense, [field]: value } : expense
      )
    }));
  };

  const addExpenseRow = () => {
    setFormData(prev => ({
      ...prev,
      expenses: [...prev.expenses, {
        sno: prev.expenses.length + 1,
        description: '',
        category: 'utilities',
        amount: 0,
        paymentMode: 'cash'
      }]
    }));
  };

  const removeExpenseRow = (index) => {
    setFormData(prev => ({
      ...prev,
      expenses: prev.expenses.filter((_, i) => i !== index).map((expense, i) => ({
        ...expense,
        sno: i + 1
      }))
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files]
    }));
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    return formData.expenses.reduce((total, expense) => total + parseFloat(expense.amount || 0), 0);
  };

  const handleDeleteExpenses = async () => {
    const result = await Swal.fire({
      title: 'Delete all expenses for this date?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete all'
    });
    if (!result.isConfirmed) {
      return;
    }

    setDeleteLoading(true);
    try {
      const response = await fetch(`${backendurl}/expenses/delete-by-date`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: formData.date
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('All expenses for this date have been deleted successfully!');
        // Clear the form data
        setFormData({
          date: (() => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0'); })(),
          expenses: [
            {
              sno: 1,
              description: '',
              category: 'utilities',
              amount: 0,
              paymentMode: 'cash'
            }
          ],
          notes: '',
          attachments: []
        });
      } else {
        toast.error(result.message || 'Failed to delete expenses');
      }
    } catch (error) {
      console.error('Error deleting expenses:', error);
      toast.error('Error deleting expenses. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      console.log('Backend URL:', backendurl);
      console.log('Is editing:', isEditing);

      // Test if backend is accessible
      try {
        const testResponse = await fetch(`${backendurl}/`, { method: 'GET' });
        console.log('Backend accessibility test:', testResponse.status);
        if (testResponse.ok) {
          const testResult = await testResponse.text();
          console.log('Backend test response:', testResult);
        }
      } catch (testError) {
        console.error('Backend accessibility test failed:', testError);
      }

      if (isEditing) {
        // For editing, we need to delete existing expenses for the date and add new ones
        // First, delete existing expenses for this date
        console.log('Attempting to delete existing expenses for date:', formData.date);
        console.log('Date format type:', typeof formData.date);
        console.log('Date value:', formData.date);

        // Ensure date is in correct format
        const dateToUse = formData.date;
        console.log('Sending delete request with date:', dateToUse);

        const deleteUrl = `${backendurl}/expenses/delete-by-date`;
        console.log('Delete URL:', deleteUrl);

        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: dateToUse
          })
        });

        console.log('Delete response status:', deleteResponse.status);
        console.log('Delete response headers:', deleteResponse.headers);

        if (!deleteResponse.ok) {
          throw new Error(`HTTP error! status: ${deleteResponse.status}`);
        }

        const deleteResult = await deleteResponse.json();
        console.log('Delete result:', deleteResult);

        // Don't throw error if deletion fails - just log it and continue
        if (!deleteResult.success) {
          console.warn('Failed to delete existing expenses, but continuing:', deleteResult.message);
          console.warn('Delete result details:', deleteResult);
          // Don't throw error - continue with adding new expenses
        } else {
          console.log('Successfully deleted existing expenses:', deleteResult.message);
        }
      }

      // Use the add-multiple endpoint for both adding and editing
      const expensesData = formData.expenses.map((expense, index) => ({
        title: expense.description || `Expense ${index + 1}`,
        category: expense.category,
        amount: parseFloat(expense.amount || 0),
        gstAmount: 0, // No GST for now
        totalWithGst: parseFloat(expense.amount || 0),
        paymentMode: expense.paymentMode,
        notes: formData.notes || ''
      }));

      // Create FormData for file upload
      const expenseData = new FormData();
      expenseData.append('date', formData.date);
      expenseData.append('expenses', JSON.stringify(expensesData));
      expenseData.append('notes', formData.notes || '');

      // Add all attachments
      formData.attachments.forEach((file) => {
        if (file instanceof File) {
          expenseData.append('attachments', file);
        }
      });

      // Preserve existing attachments for the batch
      const existingAttachments = formData.attachments.filter(item => !(item instanceof File));
      if (existingAttachments.length > 0) {
        expenseData.append('existingAttachments', JSON.stringify(existingAttachments));
      }

      console.log('Submitting expense data:', {
        date: formData.date,
        expensesCount: expensesData.length,
        notes: formData.notes
      });

      const addUrl = `${backendurl}/expenses/add-multiple`;
      console.log('Add URL:', addUrl);

      const response = await fetch(addUrl, {
        method: 'POST',
        credentials: 'include',
        body: expenseData,
      });

      console.log('Add response status:', response.status);
      console.log('Add response headers:', response.headers);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Add result:', result);

      if (result.success) {
        toast.success(isEditing ? 'Expenses updated successfully!' : 'Expenses added successfully!');
        setTimeout(() => navigate('/expenselist'), 1500);
      } else {
        console.error('Add operation failed:', result);
        toast.error(result.message || (isEditing ? 'Failed to update expenses' : 'Failed to add expenses'));
      }
    } catch (error) {
      console.error('Error saving expenses:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      toast.error('Error saving expenses. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-main">
      <header className="dash-header">
        <div className="dash-header-content">
          <div className="dash-breadcrumb">
            Dashboard / Expenses / {isEditing ? 'Edit Expenses' : 'Add Multiple Expenses'}
          </div>
          <div className="header-actions">
            {isEditing && (
              <button className="btn-danger" onClick={handleDeleteExpenses} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting...' : 'Delete All Expenses'}
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="dash-content">
        <div className="expense-add">
          <div className="page-header">
            <h2>{isEditing ? 'Edit Expenses' : 'Add Multiple Expenses'}</h2>
            <p>{isEditing
              ? 'Update the expenses for this date. All existing expenses will be replaced.'
              : 'Track all gym operational expenses for one day with automatic total calculation.'
            }</p>
          </div>

          <form onSubmit={handleSubmit} className="form-section">
            {/* Date Selection */}
            <div className="form-group">
              <h3>Expense Date</h3>
              <div className="form-row">
                <div className="form-field full-width">
                  <label>Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Expenses Table */}
            <div className="form-group">
              <h3>Expense Entries</h3>
              <div className="table-container">
                <table className="expense-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Amount (₹)</th>
                      <th>Payment Mode</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.expenses.map((expense, index) => (
                      <tr key={index}>
                        <td>{expense.sno}</td>
                        <td>
                          <input
                            type="text"
                            value={expense.description}
                            onChange={(e) => handleExpenseChange(index, 'description', e.target.value)}
                            placeholder="Enter expense title"
                            required
                          />
                        </td>
                        <td>
                          <select
                            value={expense.category}
                            onChange={(e) => handleExpenseChange(index, 'category', e.target.value)}
                            required
                          >
                            {categories.map(cat => (
                              <option key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            value={expense.amount}
                            onChange={(e) => handleExpenseChange(index, 'amount', e.target.value)}
                            min="0"
                            step="0.01"
                            required
                          />
                        </td>
                        <td>
                          <select
                            value={expense.paymentMode}
                            onChange={(e) => handleExpenseChange(index, 'paymentMode', e.target.value)}
                            required
                          >
                            {paymentModes.map(mode => (
                              <option key={mode} value={mode}>
                                {mode.charAt(0).toUpperCase() + mode.slice(1).replace('-', ' ')}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-remove"
                            onClick={() => removeExpenseRow(index)}
                            disabled={formData.expenses.length <= 1}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="table-actions">
                  <button type="button" className="btn-secondary" onClick={addExpenseRow}>
                    Add Row
                  </button>
                </div>
              </div>
            </div>

            {/* Total Calculation */}
            <div className="form-group">
              <div className="total-section">
                <h3>Total Amount: ₹{calculateTotal().toFixed(2)}</h3>
              </div>
            </div>

            {/* Attachments */}
            <div className="form-group">
              <h3>Bill Copies (Optional)</h3>
              <div className="form-row">
                <div className="form-field full-width">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    accept="image/*,.pdf"
                    style={{ marginBottom: '10px' }}
                  />
                  <p className="file-upload-hint" style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Upload receipts or invoices (Images and PDF allowed)
                  </p>

                  {previews.length > 0 && (
                    <div className="attachments-preview-grid" style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginTop: '16px',
                      padding: '12px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      {previews.map((preview, index) => (
                        <div key={index} className="preview-card" style={{
                          position: 'relative',
                          width: '100px',
                          height: '100px',
                          borderRadius: '8px',
                          overflow: 'visible',
                          border: '1px solid #d1d5db',
                          background: 'white'
                        }}>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              zIndex: 10,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                          >
                            ✕
                          </button>
                          <div
                            onClick={() => window.open(preview.url, '_blank')}
                            style={{
                              width: '100%',
                              height: '100%',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '4px'
                            }}
                          >
                            {preview.isImage ? (
                              <img
                                src={preview.url}
                                alt={preview.name}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  borderRadius: '6px'
                                }}
                              />
                            ) : (
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ fontSize: '30px' }}>📄</span>
                                <div style={{
                                  fontSize: '10px',
                                  color: '#3b82f6',
                                  marginTop: '4px',
                                  maxWidth: '90px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {preview.name}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <h3>Additional Notes</h3>
              <div className="form-field full-width">
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Additional details, GSTIN, invoice numbers..."
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/expenselist')}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? 'Update Expenses' : 'Add Expenses')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}