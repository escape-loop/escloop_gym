import React, { useState, useContext } from 'react';
import { Building2, Plus, ArrowRightLeft, CheckCircle, Lock, Trash2, Key, Edit2, Users, DollarSign, UserCheck } from 'lucide-react';
import { BranchContext } from '../context/BranchContext.jsx';
import { PlanContext } from '../context/PlanContext.jsx';
import { AppContent } from '../context/context.jsx';
import { toast } from 'react-toastify';
import axios from 'axios';

export default function BranchManagement() {
    const { branches, activeGymId, primaryGymId, loading, switchBranch, createBranch, deleteBranch, fetchBranches } = useContext(BranchContext);
    const { hasFeature } = useContext(PlanContext);

    const [showModal, setShowModal] = useState(false);
    const [branchName, setBranchName] = useState('');
    const [creating, setCreating] = useState(false);
    const [switching, setSwitching] = useState(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [branchToDelete, setBranchToDelete] = useState(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleting, setDeleting] = useState(false);

    // Rename Modal State
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [branchToRename, setBranchToRename] = useState(null);
    const [newName, setNewName] = useState('');
    const [renaming, setRenaming] = useState(false);

    // Credentials Modal State
    const [showCredModal, setShowCredModal] = useState(false);
    const [credGymId, setCredGymId] = useState(null);
    const [credEmail, setCredEmail] = useState('');
    const [credPassword, setCredPassword] = useState('');
    const [settingCreds, setSettingCreds] = useState(false);

    const { userdata, backendurl } = useContext(AppContent);
    const isElite = hasFeature('multiBranch');
    const isBranchManager = userdata?.role === 'branch_manager';

    // Lock screen for non-Elite users or branch managers
    if (!isElite || isBranchManager) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '60px 24px', textAlign: 'center', gap: '20px'
            }}>
                <div style={{ width: '72px', height: '72px', background: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Lock size={32} color="#f59e0b" />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                    {isBranchManager ? 'Branch Access Only' : 'Multi-Branch Portal'}
                </h2>
                <p style={{ color: '#64748b', maxWidth: '380px', lineHeight: 1.6, margin: 0 }}>
                    {isBranchManager 
                        ? 'As a branch manager, you have access only to your designated gym branch. Multi-branch switching is disabled.'
                        : 'Manage multiple gym locations from a single account. This feature is exclusive to the Elite plan.'}
                </p>
                {!isBranchManager && (
                    <div style={{
                        padding: '12px 24px', background: '#fef3c7',
                        borderRadius: '8px', border: '1px solid #fcd34d', color: '#92400e', fontWeight: 600, fontSize: '0.875rem'
                    }}>
                        🔒 Available on ELITE plan — Upgrade to unlock
                    </div>
                )}
            </div>
        );
    }

    const handleSwitch = async (gymId) => {
        if (gymId === activeGymId || switching) return;
        setSwitching(gymId);
        try {
            await switchBranch(gymId);
            toast.success('Branch switched! Data will refresh shortly.', { autoClose: 2000 });
            setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
            toast.error('Failed to switch branch.');
        } finally {
            setSwitching(null);
        }
    };

    const handleCreateBranch = async () => {
        if (!branchName.trim()) {
            toast.error('Please enter a branch name.');
            return;
        }
        setCreating(true);
        try {
            const result = await createBranch(branchName.trim());
            if (result.success) {
                toast.success(result.message || 'Branch created!');
                setBranchName('');
                setShowModal(false);
                fetchBranches();
            } else {
                toast.error(result.message || 'Failed to create branch.');
            }
        } catch (err) {
            toast.error('An error occurred while creating the branch.');
        } finally {
            setCreating(false);
        }
    };

    const handleRename = async () => {
        if (!newName.trim()) {
            toast.error('New name is required.');
            return;
        }
        setRenaming(true);
        try {
            const baseUrl = backendurl.replace('/gym', '');
            const res = await axios.post(`${baseUrl}/api/branch/rename`, {
                gymId: branchToRename.gymId, newName: newName.trim()
            }, { withCredentials: true });
            
            if (res.data.success) {
                toast.success('Branch renamed successfully');
                setShowRenameModal(false);
                fetchBranches();
            } else {
                toast.error(res.data.message || 'Failed to rename branch');
            }
        } catch (err) {
            toast.error('An error occurred during rename.');
        } finally {
            setRenaming(false);
        }
    };

    const handleDeleteBranch = async () => {
        if (!deletePassword) {
            toast.error('Please enter your password to confirm deletion.');
            return;
        }
        setDeleting(true);
        try {
            const result = await deleteBranch(branchToDelete.gymId, deletePassword);
            if (result.success) {
                toast.success('Branch deleted successfully.');
                setShowDeleteModal(false);
                setBranchToDelete(null);
                setDeletePassword('');
                fetchBranches();
            } else {
                toast.error(result.message || 'Failed to delete branch.');
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'An error occurred while deleting the branch.';
            toast.error(msg);
        } finally {
            setDeleting(false);
        }
    };

    const handleSetCredentials = async () => {
        if (!credEmail || !credPassword) {
            toast.error('Email and password are required.');
            return;
        }
        setSettingCreds(true);
        try {
            const baseUrl = backendurl.replace('/gym', '');
            const res = await axios.post(`${baseUrl}/api/branch/set-credentials`, {
                gymId: credGymId, email: credEmail, password: credPassword
            }, { withCredentials: true });
            
            if (res.data.success) {
                toast.success(res.data.message);
                setShowCredModal(false);
                setCredEmail('');
                setCredPassword('');
                setCredGymId(null);
            } else {
                toast.error(res.data.message);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to set credentials.');
        } finally {
            setSettingCreds(false);
        }
    };

    const activeBranch = branches.find(b => b.gymId === activeGymId);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>Branch Management</h3>
                    <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
                        Manage and switch between your gym locations. All data is fully isolated per branch.
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 20px', background: '#f97316', color: '#fff',
                        border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
                        fontSize: '0.875rem', whiteSpace: 'nowrap'
                    }}
                >
                    <Plus size={16} /> Add Branch
                </button>
            </div>

            {/* Active Branch Indicator */}
            {activeBranch && (
                <div style={{
                    padding: '16px 20px', background: '#eff6ff', borderRadius: '12px',
                    border: '1.5px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    <CheckCircle size={20} color="#3b82f6" />
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Currently Active Branch
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                            {activeBranch.gymName}
                            {activeBranch.isPrimary && <span style={{ marginLeft: '8px', fontSize: '0.7rem', background: '#dbeafe', color: '#2563eb', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>Main</span>}
                        </div>
                    </div>
                </div>
            )}

            {/* Branch List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading branches...</div>
                ) : branches.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        <Building2 size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                        <p>No branches found. Click "Add Branch" to create one.</p>
                    </div>
                ) : (
                    branches.map((branch) => {
                        const isActive = branch.gymId === activeGymId;
                        const isSwitching = switching === branch.gymId;
                        const stats = branch.stats || { activeMembers: 0, thisMonthRevenue: 0, staffCount: 0 };

                        return (
                            <div key={branch.gymId} style={{
                                borderRadius: '16px',
                                border: isActive ? '2.5px solid #3b82f6' : '1.5px solid #e2e8f0',
                                background: isActive ? '#f8faff' : '#fff',
                                overflow: 'hidden',
                                transition: 'all 0.2s ease'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{
                                            width: '46px', height: '46px', borderRadius: '12px',
                                            background: isActive ? '#bfdbfe' : '#f1f5f9',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <Building2 size={24} color={isActive ? '#3b82f6' : '#94a3b8'} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {branch.gymName}
                                                <button 
                                                    onClick={() => { setBranchToRename(branch); setNewName(branch.gymName); setShowRenameModal(true); }}
                                                    style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
                                                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                {branch.isPrimary && (
                                                    <span style={{ fontSize: '0.68rem', background: '#dbeafe', color: '#2563eb', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                                                        Main
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
                                                ID: {branch.gymId}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {isActive ? (
                                            <div style={{
                                                padding: '8px 16px', background: '#3b82f6', color: '#fff',
                                                borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px'
                                            }}>
                                                <CheckCircle size={14} /> Active Only
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleSwitch(branch.gymId)}
                                                disabled={!!switching}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '8px 16px', background: isSwitching ? '#e2e8f0' : '#fff',
                                                    color: '#334155', border: '1.5px solid #e2e8f0',
                                                    borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem',
                                                    cursor: isSwitching ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                }}
                                                onMouseEnter={e => !(!!switching) && (e.currentTarget.style.background = '#f97316', e.currentTarget.style.color = '#fff', e.currentTarget.style.borderColor = '#f97316')}
                                                onMouseLeave={e => (e.currentTarget.style.background = '#fff', e.currentTarget.style.color = '#334155', e.currentTarget.style.borderColor = '#e2e8f0')}
                                            >
                                                <ArrowRightLeft size={14} />
                                                {isSwitching && switching === branch.gymId ? 'Switching...' : 'Switch Branch'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setCredGymId(branch.gymId); setCredEmail(''); setCredPassword(''); setShowCredModal(true); }}
                                            title="Set Manager Credentials"
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: '36px', height: '36px', background: '#fef3c7',
                                                color: '#d97706', border: 'none',
                                                borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.color = '#fff'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.color = '#d97706'; }}
                                        >
                                            <Key size={16} />
                                        </button>
                                        {!branch.isPrimary && (
                                            <button
                                                onClick={() => { setBranchToDelete(branch); setShowDeleteModal(true); setDeletePassword(''); }}
                                                title="Delete Branch"
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    width: '36px', height: '36px', background: '#fee2e2',
                                                    color: '#ef4444', border: 'none',
                                                    borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Snapshot Stats Grid */}
                                <div style={{ 
                                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', 
                                    padding: '12px 20px', background: isActive ? '#f1f7ff' : '#fcfcfc',
                                    borderTop: '1px solid #f1f5f9'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Users size={14} color="#10b981" />
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                                            {stats.activeMembers} <span style={{ fontWeight: 500, color: '#94a3b8', fontSize: '0.75rem' }}>Active</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1.5px solid #f1f5f9', borderRight: '1.5px solid #f1f5f9', padding: '0 20px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <DollarSign size={14} color="#d97706" />
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                                            ₹{stats.thisMonthRevenue.toLocaleString('en-IN')} <span style={{ fontWeight: 500, color: '#94a3b8', fontSize: '0.75rem' }}>This Month</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '20px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <UserCheck size={14} color="#8b5cf6" />
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                                            {stats.staffCount} <span style={{ fontWeight: 500, color: '#94a3b8', fontSize: '0.75rem' }}>Staff</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Rename Modal */}
            {showRenameModal && branchToRename && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}
                    onClick={() => setShowRenameModal(false)}
                >
                    <div
                        style={{
                            background: '#fff', borderRadius: '16px', padding: '32px',
                            width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ width: '44px', height: '44px', background: '#fff7ed', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Edit2 size={20} color="#f97316" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>Rename Branch</h3>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                                New Branch Name
                            </label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRename()}
                                placeholder="Branch Name"
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '8px',
                                    border: '1.5px solid #e2e8f0', outlineColor: '#f97316',
                                    fontSize: '0.95rem', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowRenameModal(false)}
                                style={{
                                    flex: 1, padding: '12px', background: '#f8fafc', border: '1.5px solid #e2e8f0',
                                    borderRadius: '8px', color: '#64748b', fontWeight: 700, cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRename}
                                disabled={renaming || !newName.trim()}
                                style={{
                                    flex: 1, padding: '12px', background: renaming || !newName.trim() ? '#e2e8f0' : '#f97316',
                                    border: 'none', borderRadius: '8px', color: '#fff',
                                    fontWeight: 700, cursor: renaming || !newName.trim() ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {renaming ? 'Updating...' : 'Save Name'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Branch Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        style={{
                            background: '#fff', borderRadius: '16px', padding: '32px',
                            width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ width: '44px', height: '44px', background: '#fff7ed', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Building2 size={22} color="#f97316" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>Add New Branch</h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Create a new gym location with isolated data</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                                Branch Name *
                            </label>
                            <input
                                type="text"
                                value={branchName}
                                onChange={e => setBranchName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateBranch()}
                                placeholder="e.g. Downtown Branch, Main Campus..."
                                autoFocus
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '8px',
                                    border: '1.5px solid #e2e8f0', outlineColor: '#f97316',
                                    fontSize: '0.95rem', fontWeight: 500, boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => { setShowModal(false); setBranchName(''); }}
                                style={{
                                    flex: 1, padding: '12px', background: '#f8fafc', border: '1.5px solid #e2e8f0',
                                    borderRadius: '8px', color: '#64748b', fontWeight: 700, cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateBranch}
                                disabled={creating || !branchName.trim()}
                                style={{
                                    flex: 1, padding: '12px', background: creating || !branchName.trim() ? '#e2e8f0' : '#f97316',
                                    border: 'none', borderRadius: '8px', color: creating || !branchName.trim() ? '#94a3b8' : '#fff',
                                    fontWeight: 700, cursor: creating || !branchName.trim() ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                <Plus size={16} />
                                {creating ? 'Creating...' : 'Create Branch'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && branchToDelete && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}
                    onClick={() => { setShowDeleteModal(false); setBranchToDelete(null); }}
                >
                    <div
                        style={{
                            background: '#fff', borderRadius: '16px', padding: '32px',
                            width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ width: '44px', height: '44px', background: '#fef2f2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trash2 size={22} color="#ef4444" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>Delete Branch</h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>This action is permanent and cannot be undone.</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px', fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                            You are about to permanently delete <strong style={{ color: "black" }}>{branchToDelete.gymName}</strong> and all its associated data including members, staff, and bills.
                            To confirm, please enter your account password.
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <input
                                type="password"
                                value={deletePassword}
                                onChange={e => setDeletePassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleDeleteBranch()}
                                placeholder="Enter account password"
                                autoFocus
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '8px',
                                    border: '1.5px solid #e2e8f0', outlineColor: '#ef4444',
                                    fontSize: '0.95rem', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => { setShowDeleteModal(false); setBranchToDelete(null); }}
                                style={{
                                    flex: 1, padding: '12px', background: '#f8fafc', border: '1.5px solid #e2e8f0',
                                    borderRadius: '8px', color: '#64748b', fontWeight: 700, cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteBranch}
                                disabled={deleting || !deletePassword}
                                style={{
                                    flex: 1, padding: '12px', background: deleting || !deletePassword ? '#fca5a5' : '#ef4444',
                                    border: 'none', borderRadius: '8px', color: '#fff',
                                    fontWeight: 700, cursor: deleting || !deletePassword ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                {deleting ? 'Deleting...' : 'Permanently Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Set Credentials Modal */}
            {showCredModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}
                    onClick={() => setShowCredModal(false)}
                >
                    <div
                        style={{
                            background: '#fff', borderRadius: '16px', padding: '32px',
                            width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ width: '44px', height: '44px', background: '#fef3c7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Key size={22} color="#f59e0b" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>Set Credentials</h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Create login for this branch</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                                Email *
                            </label>
                            <input
                                type="email"
                                value={credEmail}
                                onChange={e => setCredEmail(e.target.value)}
                                placeholder="manager@example.com"
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '8px',
                                    border: '1.5px solid #e2e8f0', outlineColor: '#f59e0b',
                                    fontSize: '0.95rem', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                                Password *
                            </label>
                            <input
                                type="password"
                                value={credPassword}
                                onChange={e => setCredPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSetCredentials()}
                                placeholder="Enter secure password"
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '8px',
                                    border: '1.5px solid #e2e8f0', outlineColor: '#f59e0b',
                                    fontSize: '0.95rem', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowCredModal(false)}
                                style={{
                                    flex: 1, padding: '12px', background: '#f8fafc', border: '1.5px solid #e2e8f0',
                                    borderRadius: '8px', color: '#64748b', fontWeight: 700, cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSetCredentials}
                                disabled={settingCreds || !credEmail || !credPassword}
                                style={{
                                    flex: 1, padding: '12px', background: settingCreds || !credEmail || !credPassword ? '#fcd34d' : '#f59e0b',
                                    border: 'none', borderRadius: '8px', color: '#fff',
                                    fontWeight: 700, cursor: settingCreds || !credEmail || !credPassword ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                {settingCreds ? 'Saving...' : 'Save Credentials'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
