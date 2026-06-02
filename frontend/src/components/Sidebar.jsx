import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { hasMinRole } from './Guards';

const NAV = [
    { label: 'Dashboard', icon: 'ti-layout-dashboard', path: '/dashboard', minRole: 'readwrite' },
    { label: 'VMs',       icon: 'ti-server',           path: '/vms',       minRole: 'read' },
    { label: 'Users',     icon: 'ti-users',            path: '/users',     minRole: 'admin' },
    { label: 'Audit Log', icon: 'ti-list-details',     path: '/audit',     minRole: 'admin' },
];

export default function Sidebar() {
    const { pathname } = useLocation();
    const user = useAuthStore(s => s.user);
    const visibleNav = NAV.filter(item => hasMinRole(user, item.minRole));

    const isActive = (path) =>
        path === '/vms'
            ? pathname === '/vms' || pathname === '/' || pathname.startsWith('/vms/')
            : pathname.startsWith(path);

    return (
        <div style={{
            width: '220px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            background: '#0f1117',
            borderRight: '1px solid rgba(255,255,255,0.06)',
        }}>
            {/* Logo zone */}
            <div style={{
                padding: '22px 14px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
            }}>
                {/* App icon */}
                <svg width="44" height="44" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '10px' }}>
                    <rect width="40" height="40" rx="9" fill="#1d9e75"/>
                    <rect x="7" y="9"  width="26" height="6" rx="2" fill="white" opacity="0.95"/>
                    <rect x="7" y="18" width="26" height="6" rx="2" fill="white" opacity="0.6"/>
                    <rect x="7" y="27" width="26" height="6" rx="2" fill="white" opacity="0.28"/>
                    <circle cx="12"   cy="12" r="1.6" fill="#bbf7d0"/>
                    <circle cx="16.5" cy="12" r="1.6" fill="#bbf7d0" opacity="0.45"/>
                </svg>
                <span style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: 700, color: '#e8e8e8', letterSpacing: '0.04em' }}>
                    VMTrak
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '3px', letterSpacing: '0.03em' }}>
                    Infrastructure Management
                </span>
            </div>

            {/* Nav items */}
            <nav style={{ paddingTop: '6px' }}>
                {visibleNav.map((item) => {
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 16px',
                                width: '100%',
                                textDecoration: 'none',
                                background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                                borderRadius: 0,
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <i
                                className={`ti ${item.icon}`}
                                style={{
                                    fontSize: '16px',
                                    color: active ? '#1d9e75' : 'rgba(255,255,255,0.4)',
                                    lineHeight: 1,
                                }}
                            />
                            <span style={{
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                color: active ? '#e8e8e8' : 'rgba(255,255,255,0.55)',
                            }}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Bottom status */}
            <div style={{
                borderTop: '1px solid rgba(255,255,255,0.07)',
                padding: '10px 16px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
            }}>
                <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#1d9e75',
                    flexShrink: 0,
                }} />
                <span style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.3)',
                }}>v0.1.0 · online</span>
            </div>
        </div>
    );
}
