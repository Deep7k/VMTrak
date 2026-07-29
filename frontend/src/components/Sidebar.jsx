import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { hasMinRole } from './Guards';

const NAV = [
    { label: 'Dashboard',   icon: 'ti-layout-dashboard', path: '/dashboard',   minRole: 'readwrite' },
    { label: 'VMs',         icon: 'ti-server',           path: '/vms',         minRole: 'read' },
    { label: 'Hypervisors', icon: 'ti-cpu',              path: '/hypervisors', minRole: 'readwrite' },
    { label: 'Users',       icon: 'ti-users',            path: '/users',       minRole: 'admin' },
    { label: 'Audit Log',   icon: 'ti-list-details',     path: '/audit',       minRole: 'admin' },
    { label: 'Deleted VMs', icon: 'ti-trash',            path: '/vms/deleted', minRole: 'admin' },
];

export default function Sidebar() {
    const { pathname } = useLocation();
    const user = useAuthStore(s => s.user);
    const visibleNav = NAV.filter(item => hasMinRole(user, item.minRole));

    const isActive = (path) => {
        if (path === '/vms') {
            return (pathname === '/vms' || pathname === '/') ||
                (pathname.startsWith('/vms/') && !pathname.startsWith('/vms/deleted'));
        }
        return pathname.startsWith(path);
    };

    return (
        <div style={{
            width: '200px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            background: '#090C12',
            borderRight: '1px solid #192030',
        }}>
            {/* Logo zone */}
            <div style={{
                padding: '20px 16px 16px',
                borderBottom: '1px solid #192030',
                flexShrink: 0,
            }}>
                {/* Wordmark row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Icon: three horizontal rack bars with amber LED dot */}
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Rack bars — noticeably lighter than the bg (#090C12) */}
                        <rect x="0"  y="2"  width="28" height="7" rx="1.5" fill="#1C2E4A" stroke="#2D4870" strokeWidth="1"/>
                        <rect x="0"  y="11" width="28" height="7" rx="1.5" fill="#162340" stroke="#243D62" strokeWidth="1"/>
                        <rect x="0"  y="20" width="28" height="7" rx="1.5" fill="#111C32" stroke="#1B2E50" strokeWidth="1"/>
                        {/* Active amber LED — top unit */}
                        <circle cx="4.5" cy="5.5" r="1.8" fill="#E07B35"/>
                        {/* Inactive LEDs */}
                        <circle cx="4.5" cy="14.5" r="1.8" fill="#1E3050"/>
                        <circle cx="4.5" cy="23.5" r="1.8" fill="#172540"/>
                        {/* Vent slots */}
                        <rect x="9" y="4" width="14" height="1" rx="0.5" fill="#2D4870"/>
                        <rect x="9" y="6" width="10" height="1" rx="0.5" fill="#243D62"/>
                        <rect x="9" y="13" width="14" height="1" rx="0.5" fill="#243D62"/>
                        <rect x="9" y="15" width="10" height="1" rx="0.5" fill="#1B2E50"/>
                        <rect x="9" y="22" width="14" height="1" rx="0.5" fill="#1B2E50"/>
                        <rect x="9" y="24" width="10" height="1" rx="0.5" fill="#162040"/>
                    </svg>
                    <div>
                        <div style={{
                            fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#C8D3E8',
                            letterSpacing: '0.02em',
                            lineHeight: 1.2,
                        }}>
                            VMTrak
                        </div>
                        <div style={{
                            fontFamily: '"IBM Plex Mono", monospace',
                            fontSize: '9px',
                            color: '#2D3D56',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            marginTop: '2px',
                        }}>
                            Infrastructure
                        </div>
                    </div>
                </div>
            </div>

            {/* Nav items */}
            <nav style={{ paddingTop: '4px', paddingBottom: '4px' }}>
                {visibleNav.map((item) => {
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '9px',
                                padding: '7px 16px',
                                width: '100%',
                                textDecoration: 'none',
                                /* The signature: amber left border instead of fill */
                                borderLeft: active ? '2px solid #E07B35' : '2px solid transparent',
                                paddingLeft: active ? '14px' : '14px',
                                transition: 'border-color 0.1s',
                            }}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.borderLeftColor = '#22304A'; }}
                            onMouseLeave={e => { if (!active) e.currentTarget.style.borderLeftColor = 'transparent'; }}
                        >
                            <i
                                className={`ti ${item.icon}`}
                                style={{
                                    fontSize: '15px',
                                    color: active ? '#E07B35' : '#2D3D56',
                                    lineHeight: 1,
                                    transition: 'color 0.1s',
                                    flexShrink: 0,
                                }}
                            />
                            <span style={{
                                fontFamily: '"IBM Plex Sans", -apple-system, sans-serif',
                                fontSize: '13px',
                                fontWeight: active ? 500 : 400,
                                color: active ? '#C8D3E8' : '#596B88',
                                transition: 'color 0.1s',
                            }}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Bottom status strip */}
            <div style={{
                borderTop: '1px solid #192030',
                padding: '10px 16px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
            }}>
                {/* Pulsing amber dot for "online" */}
                <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#34D399',
                    flexShrink: 0,
                }} />
                <span style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '10px',
                    color: '#2D3D56',
                    letterSpacing: '0.03em',
                }}>
                    {import.meta.env.VITE_APP_VERSION ?? 'dev'} · online
                </span>
            </div>
        </div>
    );
}
