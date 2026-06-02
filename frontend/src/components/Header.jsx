import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const BREADCRUMBS = {
    '/dashboard': ['Dashboard', 'Overview'],
    '/vms':       ['VMs', 'Virtual Machines'],
    '/users':     ['Users', 'User Management'],
    '/audit':     ['Audit Log', 'Activity'],
};

function useBreadcrumb() {
    const { pathname } = useLocation();
    if (pathname.startsWith('/vms/') && pathname.endsWith('/edit')) return ['VMs', 'Edit VM'];
    if (pathname.startsWith('/vms/new')) return ['VMs', 'New VM'];
    if (pathname.startsWith('/vms/') && pathname !== '/vms') return ['VMs', 'VM Detail'];
    return BREADCRUMBS[pathname] || BREADCRUMBS['/vms'];
}

export default function Header() {
    const { user, logout } = useAuth();
    const [section, page] = useBreadcrumb();

    return (
        <header style={{
            height: '44px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: '10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: '#0f1117',
        }}>
            {/* Hamburger — mobile only visual, no-op on desktop */}
            <button
                style={{
                    background: 'none',
                    border: 'none',
                    padding: '0 4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <i className="ti ti-menu-2" style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)' }} />
            </button>

            {/* Breadcrumb */}
            <div style={{ fontFamily: 'monospace', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>{section}</span>
                <span style={{ color: 'rgba(255,255,255,0.25)' }}>/</span>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{page}</span>
            </div>

            {/* Right side */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                    {user?.email || user?.username}
                </span>
                <button
                    onClick={logout}
                    style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '4px 10px',
                        border: '0.5px solid rgba(255,255,255,0.15)',
                        background: 'transparent',
                        color: 'rgba(255,255,255,0.5)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                >
                    Logout
                </button>
            </div>
        </header>
    );
}
