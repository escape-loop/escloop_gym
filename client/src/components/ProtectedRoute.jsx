import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContent } from '../context/context.jsx';

/**
 * ProtectedRoute — wraps any route that requires authentication.
 *
 * On initial page load / refresh, `isauthenticated` is false while the
 * async cookie-check is in-flight. Without this component every protected
 * page would immediately redirect to "/" before the check finishes.
 *
 * Behaviour:
 *  - authLoading = true  → show a spinner (check still running)
 *  - authLoading = false + isauthenticated = false → redirect to "/"
 *  - authLoading = false + isauthenticated = true  → render the page
 */
export default function ProtectedRoute({ children }) {
    const { isauthenticated, authLoading } = useContext(AppContent);

    if (authLoading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: '#f8fafc'
            }}>
                <div style={{
                    width: 44,
                    height: 44,
                    border: '4px solid #e2e8f0',
                    borderTopColor: '#f97316',
                    borderRadius: '50%',
                    animation: 'pr-spin 0.7s linear infinite'
                }} />
                <style>{`@keyframes pr-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!isauthenticated) {
        return <Navigate to="/" replace />;
    }

    return children;
}
