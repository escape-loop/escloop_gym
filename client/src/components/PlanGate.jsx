import React, { useContext, useState } from 'react';
import { PlanContext } from '../context/PlanContext.jsx';
import { toast } from 'react-toastify';
import '../styles/PlanGate.css';

export default function PlanGate({ feature, requiredPlan, children }) {
    const { hasFeature, loading, refreshPlan } = useContext(PlanContext);
    const [activating, setActivating] = useState(false);

    if (loading) {
        return <div className="loading-spinner">Checking Access...</div>;
    }

    if (hasFeature(feature)) {
        return children;
    }

    const handleTrialActivation = async () => {
        try {
            setActivating(true);
            const backendOrigin = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/gym\/?$/, '') || '';
            const response = await fetch(`${backendOrigin}/api/license/trial`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ feature })
            });
            const data = await response.json();

            if (data.success) {
                toast.success(`7-Day Trial activated for ${feature}!`);
                await refreshPlan(); // Refresh context to immediately grant access
            } else {
                toast.error(data.message || 'Failed to activate trial.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error activating trial.');
        } finally {
            setActivating(false);
        }
    };

    const handleUpgrade = () => {
        // Eventually link to an upgrade modal or pricing page
        toast.info('Please contact admin to upgrade your license.');
    };

    return (
        <div className="plan-gate-overlay">
            <div className="plan-gate-card">
                <h2 className="title">🔒 Upgrade Required</h2>
                <p className="description">
                    This feature is available on the <strong className="required-plan">{requiredPlan}</strong> plan.
                </p>
                <p className="sub-description">Upgrade to unlock this and more powerful features!</p>

                <div className="plan-gate-actions">
                    <button
                        className="btn-trial"
                        onClick={handleTrialActivation}
                        disabled={activating}
                    >
                        {activating ? 'Activating...' : '🚀 Try 7-Day Trial'}
                    </button>
                    <button className="btn-upgrade" onClick={handleUpgrade}>
                        ⬆️ Upgrade Plan
                    </button>
                </div>
            </div>
        </div>
    );
}
