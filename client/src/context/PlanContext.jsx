import React, { createContext, useState, useEffect, useContext } from 'react';
import { AppContent } from './context.jsx';

export const PlanContext = createContext();

export const PlanProvider = ({ children }) => {
    const [plan, setPlan] = useState('lite');
    const [features, setFeatures] = useState({});
    const [loading, setLoading] = useState(false);

    // We need to know when the user logs in to fetch their new plan
    const { isloggedin } = useContext(AppContent) || { isloggedin: false };

    const fetchPlanFromCloud = async () => {
        try {
            setLoading(true);
            // VITE_BACKEND_URL is 'http://localhost:5000/gym' but the license API
            // is mounted at '/api/license' (not under /gym). Extract just the origin.
            const backendOrigin = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/gym\/?$/, '') || '';
            const response = await fetch(`${backendOrigin}/api/license/plan`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                setPlan(data.plan);
                setFeatures(data.features || {});
            }
        } catch (error) {
            console.error('Failed to fetch plan context:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isloggedin) {
            fetchPlanFromCloud();
        } else {
            // User logged out
            setPlan('lite');
            setFeatures({});
        }
    }, [isloggedin]);

    const hasFeature = (featureName) => {
        // If not loaded yet, assume no access to be safe
        if (loading) return false;
        return features[featureName] === true;
    };

    const refreshPlan = () => {
        fetchPlanFromCloud();
    };

    return (
        <PlanContext.Provider value={{ plan, features, hasFeature, loading, refreshPlan }}>
            {children}
        </PlanContext.Provider>
    );
};
