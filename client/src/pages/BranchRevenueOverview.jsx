import React, { useState, useContext } from 'react';
import { Building2, Lock, BarChart2, Users, DollarSign, ArrowUpRight, ShieldCheck, Mail, Key, LayoutDashboard } from 'lucide-react';
import { AppContent } from '../context/context.jsx';
import { PlanContext } from '../context/PlanContext.jsx';
import { toast } from 'react-toastify';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function BranchRevenueOverview() {
    const { userdata, backendurl } = useContext(AppContent);
    const { hasFeature } = useContext(PlanContext);
    
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [error, setError] = useState('');

    const isElite = hasFeature('multiBranch');
    const isBranchManager = userdata?.role === 'branch_manager';

    // Access control: Only Elite owners can see this
    if (!isElite || isBranchManager) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '100px 24px', textAlign: 'center', gap: '20px'
            }}>
                <div style={{ width: '80px', height: '80px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={40} color="#ef4444" />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>Access Restricted</h2>
                <p style={{ color: '#64748b', maxWidth: '400px', lineHeight: 1.6 }}>
                    This consolidated revenue overview is reserved for gym owners with multiple branches on the Elite plan.
                </p>
            </div>
        );
    }

    const handleUnlock = async (e) => {
        if (e) e.preventDefault();
        if (!email || !password) {
            toast.error('Please enter both email and password.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const baseUrl = backendurl.replace('/gym', '');
            const res = await axios.post(`${baseUrl}/api/branch/revenue-overview`, {
                email, password
            }, { withCredentials: true });

            if (res.data.success) {
                setData(res.data.overview);
                setIsUnlocked(true);
                toast.success('Identity verified. Revenue data loaded.');
            } else {
                setError(res.data.message || 'Verification failed');
            }
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || 'Failed to verify credentials';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!isUnlocked) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '80vh', padding: '24px'
            }}>
                <div className="card-shadow" style={{
                    width: '100%', maxWidth: '440px', background: '#fff',
                    borderRadius: '24px', padding: '40px', textAlign: 'center'
                }}>
                    <div style={{
                        width: '64px', height: '64px', background: '#fef3c7',
                        borderRadius: '16px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', margin: '0 auto 24px'
                    }}>
                        <Lock size={32} color="#f59e0b" />
                    </div>
                    
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                        Admin Verification
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '32px' }}>
                        Enter your credentials to unlock the consolidated revenue overview for all branch locations.
                    </p>

                    <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Mail size={12} /> Admin Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="owner@gym.com"
                                style={{
                                    width: '100%', padding: '14px', borderRadius: '12px',
                                    border: '1.5px solid #e2e8f0', outlineColor: '#f97316',
                                    fontSize: '1rem', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Key size={12} /> Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{
                                    width: '100%', padding: '14px', borderRadius: '12px',
                                    border: '1.5px solid #e2e8f0', outlineColor: '#f97316',
                                    fontSize: '1rem', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {error && (
                            <div style={{ 
                                padding: '12px', background: '#fef2f2', border: '1px solid #fee2e2', 
                                color: '#ef4444', fontSize: '0.85rem', borderRadius: '8px', fontWeight: 500
                            }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: '12px', padding: '16px', background: '#1e293b',
                                color: '#fff', border: 'none', borderRadius: '14px',
                                fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                            }}
                        >
                            {loading ? 'Verifying...' : <>Unlock Data <ShieldCheck size={18} /></>}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const totalCombinedRevenue = data.reduce((sum, b) => sum + b.totalRevenue, 0);
    const totalCombinedExpense = data.reduce((sum, b) => sum + (b.totalExpense || 0), 0);
    const totalCombinedNetProfit = data.reduce((sum, b) => sum + (b.netProfit || 0), 0);
    const totalMembers = data.reduce((sum, b) => sum + b.memberCount, 0);
    const topBranch = [...data].sort((a, b) => b.totalRevenue - a.totalRevenue)[0];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '10px 0' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                        Branch Revenue Overview
                    </h2>
                    <p style={{ color: '#64748b', margin: 0 }}>
                        Aggregated financial performance and membership metrics across all locations.
                    </p>
                </div>
                <div style={{ 
                    padding: '8px 16px', background: '#dcfce7', color: '#16a34a', 
                    borderRadius: '99px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                    <ShieldCheck size={14} /> Verified Session
                </div>
            </div>

            {/* Summary Grid */}
            <div style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' 
            }}>
                <div className="card-shadow" style={{ padding: '24px', background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <DollarSign size={20} color="#0ea5e9" />
                        </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Total Combined Revenue</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>
                        ₹{totalCombinedRevenue.toLocaleString('en-IN')}
                    </div>
                </div>

                <div className="card-shadow" style={{ padding: '24px', background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowUpRight size={20} color="#ef4444" style={{ transform: 'rotate(90deg)' }} />
                        </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Total Combined Expenses</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>
                        ₹{totalCombinedExpense.toLocaleString('en-IN')}
                    </div>
                </div>

                <div className="card-shadow" style={{ padding: '24px', background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', borderLeft: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShieldCheck size={20} color="#10b981" />
                        </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Total Net Profit</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: totalCombinedNetProfit >= 0 ? '#10b981' : '#ef4444', marginTop: '4px' }}>
                        ₹{totalCombinedNetProfit.toLocaleString('en-IN')}
                    </div>
                </div>

                <div className="card-shadow" style={{ padding: '24px', background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={20} color="#8b5cf6" />
                        </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Total Members (All Branches)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>
                        {totalMembers.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Charts & Table Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
                {/* Revenue & Expense Comparison Chart */}
                <div className="card-shadow" style={{ padding: '28px', background: '#fff', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BarChart2 size={18} color="#f97316" /> Revenue vs. Expense by Branch
                        </h3>
                    </div>
                    <div style={{ height: '350px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} barGap={8}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="gymName" 
                                    tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis 
                                    tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 700 }}
                                    formatter={(value, name) => [`₹${value.toLocaleString('en-IN')}`, name === 'totalRevenue' ? 'Revenue' : 'Expense']}
                                />
                                <Bar dataKey="totalRevenue" name="Revenue" fill="#1e293b" radius={[6, 6, 0, 0]} barSize={24} />
                                <Bar dataKey="totalExpense" name="Expense" fill="#f97316" radius={[6, 6, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#1e293b' }}></div> Revenue
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f97316' }}></div> Total Expense
                        </div>
                    </div>
                </div>

                {/* Branch Details Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LayoutDashboard size={18} color="#1e293b" /> Branch Performance Breakdown
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '470px', overflowY: 'auto', paddingRight: '4px' }}>
                        {data.sort((a,b) => (b.netProfit || 0) - (a.netProfit || 0)).map((branch) => (
                            <div key={branch.gymId} style={{ 
                                padding: '18px', background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                transition: 'transform 0.2s ease', borderLeft: `4px solid ${branch.netProfit >= 0 ? '#10b981' : '#ef4444'}`
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ 
                                        width: '44px', height: '44px', borderRadius: '12px', 
                                        background: branch.isPrimary ? '#1e293b' : '#f8fafc',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Building2 size={20} color={branch.isPrimary ? '#fff' : '#94a3b8'} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                                            {branch.gymName}
                                            {branch.isPrimary && <span style={{ marginLeft: '6px', fontSize: '0.65rem', background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '99px' }}>Main</span>}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Users size={12} /> {branch.memberCount} Members
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                                        Rev: ₹{branch.totalRevenue.toLocaleString('en-IN')}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 500 }}>
                                        Exp: ₹{branch.totalExpense.toLocaleString('en-IN')}
                                    </div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: branch.netProfit >= 0 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                                        ₹{branch.netProfit.toLocaleString('en-IN')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
