import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const NAV = [
    { label: 'Dashboard', icon: 'ti-layout-dashboard', path: '/dashboard', adminOnly: false },
    { label: 'VMs',       icon: 'ti-server',           path: '/vms',       adminOnly: false },
    { label: 'Users',     icon: 'ti-users',            path: '/users',     adminOnly: true },
    { label: 'Audit Log', icon: 'ti-list-details',     path: '/audit',     adminOnly: true },
];

export default function Sidebar() {
    const { pathname } = useLocation();
    const user = useAuthStore(s => s.user);
    const isAdmin = user?.role === 'admin';
    const visibleNav = NAV.filter(item => !item.adminOnly || isAdmin);

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
                height: '52px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                gap: '10px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
            }}>
                <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: '#1d9e75',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '15px',
                    color: '#fff',
                    flexShrink: 0,
                }}>V</div>
                <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: '#e8e8e8' }}>
                    VMTrak
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginLeft: '2px' }}>
                    v0.1
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
