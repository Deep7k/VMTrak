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
    if (pathname.startsWith('/vms/deleted')) return ['VMs', 'Deleted VMs'];
    if (pathname.startsWith('/vms/') && pathname !== '/vms') return ['VMs', 'VM Detail'];
    if (pathname.startsWith('/hypervisors/new')) return ['Hypervisors', 'New Hypervisor'];
    if (pathname.startsWith('/hypervisors/') && pathname.endsWith('/edit')) return ['Hypervisors', 'Edit Hypervisor'];
    if (pathname.startsWith('/hypervisors')) return ['Hypervisors', 'Hypervisors'];
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
            padding: '0 20px',
            gap: '10px',
            borderBottom: '1px solid #192030',
            background: '#090C12',
        }}>
            {/* Breadcrumb */}
            <div style={{
                fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
            }}>
                <span style={{ color: '#2D3D56' }}>{section}</span>
                <span style={{ color: '#192030', fontSize: '11px' }}>›</span>
                <span style={{ color: '#C8D3E8', fontWeight: 500 }}>{page}</span>
            </div>

            {/* Right side */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '11px',
                    color: '#2D3D56',
                }}>
                    {user?.email || user?.username}
                </span>
                <button
                    onClick={logout}
                    style={{
                        fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
                        fontSize: '11px',
                        padding: '4px 10px',
                        border: '1px solid #22304A',
                        background: 'transparent',
                        color: '#596B88',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        transition: 'border-color 0.12s, color 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#596B88'; e.currentTarget.style.color = '#C8D3E8'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#22304A'; e.currentTarget.style.color = '#596B88'; }}
                >
                    Logout
                </button>
            </div>
        </header>
    );
}
