import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { AppContent } from './context.jsx';

export const BranchContext = createContext();

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Helper to get the base API URL (strip the /gym prefix if present)
const getBaseUrl = () => BACKEND_URL?.replace('/gym', '') || '';

export const BranchProvider = ({ children }) => {
    const [branches, setBranches] = useState([]);
    const [activeGymId, setActiveGymId] = useState(() => {
        // Persist active branch across page reloads
        return localStorage.getItem('activeGymId') || null;
    });
    const [primaryGymId, setPrimaryGymId] = useState(null);
    const [loading, setLoading] = useState(false);

    const { isloggedin, authLoading } = useContext(AppContent) || { isloggedin: false, authLoading: false };

    // Fetch branches from server
    const fetchBranches = useCallback(async () => {
        try {
            setLoading(true);
            const activeId = localStorage.getItem('activeGymId');
            const headers = activeId ? { 'x-gym-id': activeId } : {};
            const res = await axios.get(`${getBaseUrl()}/api/branch/list`, {
                withCredentials: true,
                headers
            });
            if (res.data.success) {
                const fetchedBranches = res.data.branches || [];
                setBranches(fetchedBranches);
                setPrimaryGymId(res.data.primaryGymId);

                const currentActive = localStorage.getItem('activeGymId');
                // Check if current active branch still exists in the fetched list
                // Use String() to ensure type mismatch doesn't cause strict equality to fail
                const branchExists = fetchedBranches.some(b => String(b.gymId) === String(currentActive));

                if (!currentActive || (!branchExists && res.data.primaryGymId)) {
                    // Fallback to primary gymId if no active branch, or if active branch is invalid/deleted
                    setActiveGymId(res.data.primaryGymId);
                    localStorage.setItem('activeGymId', res.data.primaryGymId);
                    axios.defaults.headers.common['x-gym-id'] = res.data.primaryGymId;
                }
            }
        } catch (err) {
            console.error('[BranchContext] Failed to fetch branches:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Switch to a different branch
    const switchBranch = useCallback(async (targetGymId) => {
        if (targetGymId === activeGymId) return;

        setActiveGymId(targetGymId);
        localStorage.setItem('activeGymId', targetGymId);

        // Notify backend to trigger background jobs for the new branch
        try {
            const headers = { 'x-gym-id': targetGymId };
            await axios.post(`${getBaseUrl()}/api/branch/switch`, { targetGymId }, {
                withCredentials: true,
                headers
            });
        } catch (err) {
            console.error('[BranchContext] Failed to trigger branch switch jobs:', err);
        } finally {
            // Force a full page reload to clear all React state and ensure components 
            // re-mount to fetch data scoped to the newly selected branch.
            window.location.reload();
        }
    }, [activeGymId]);

    // Create a new branch
    const createBranch = useCallback(async (branchName) => {
        const activeId = localStorage.getItem('activeGymId');
        const headers = activeId ? { 'x-gym-id': activeId } : {};
        const res = await axios.post(`${getBaseUrl()}/api/branch/create`, { branchName }, {
            withCredentials: true,
            headers
        });
        if (res.data.success) {
            await fetchBranches(); // Refresh list
        }
        return res.data;
    }, [fetchBranches]);

    // Delete a branch
    const deleteBranch = useCallback(async (gymId, password) => {
        const activeId = localStorage.getItem('activeGymId');
        const headers = activeId ? { 'x-gym-id': activeId } : {};
        const res = await axios.post(`${getBaseUrl()}/api/branch/delete`, { gymId, password }, {
            withCredentials: true,
            headers
        });
        if (res.data.success) {
            await fetchBranches(); // Refresh list after deletion
        }
        return res.data;
    }, [fetchBranches]);

    // Get active branch info
    const getActiveBranch = useCallback(() => {
        return branches.find(b => b.gymId === activeGymId) || null;
    }, [branches, activeGymId]);

    // When the active gym changes, attach it as a default header to axios globally
    useEffect(() => {
        if (activeGymId) {
            axios.defaults.headers.common['x-gym-id'] = activeGymId;
        }
    }, [activeGymId]);

    // Fetch branches when user logs in, or clear when they log out
    useEffect(() => {
        if (isloggedin) {
            fetchBranches();
        } else if (!authLoading) {
            setBranches([]);
            setActiveGymId(null);
            setPrimaryGymId(null);
            localStorage.removeItem('activeGymId');
            delete axios.defaults.headers.common['x-gym-id'];
        }
    }, [isloggedin, authLoading, fetchBranches]);

    return (
        <BranchContext.Provider value={{
            branches,
            activeGymId,
            primaryGymId,
            loading,
            fetchBranches,
            switchBranch,
            createBranch,
            deleteBranch,
            getActiveBranch
        }}>
            {children}
        </BranchContext.Provider>
    );
};

// Convenience hook
export const useBranch = () => useContext(BranchContext);
