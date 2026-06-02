import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ROLE_LEVEL = { read: 1, readwrite: 2, admin: 3 };

export function hasMinRole(user, minRole) {
    return (ROLE_LEVEL[user?.role] || 0) >= (ROLE_LEVEL[minRole] || 0);
}

export function RequireAuth({ children }) {
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const user = useAuthStore(s => s.user);
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.must_change_password) return <Navigate to="/setup" replace />;
    return children;
}

export function RequireAdmin({ children }) {
    const user = useAuthStore(s => s.user);
    return user?.role === 'admin' ? children : <Navigate to="/vms" replace />;
}

export function RequireReadWrite({ children }) {
    const user = useAuthStore(s => s.user);
    return hasMinRole(user, 'readwrite') ? children : <Navigate to="/vms" replace />;
}

// Only allows access when the user still needs to complete initial setup.
// Redirects away once setup is done so the URL can't be bookmarked and reused.
export function RequireSetup({ children }) {
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const user = useAuthStore(s => s.user);
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!user?.must_change_password) return <Navigate to="/" replace />;
    return children;
}
