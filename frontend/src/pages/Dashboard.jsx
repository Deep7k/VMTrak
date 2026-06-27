import { useEffect, useState } from 'react';
import api from '../api/client';

/* ── helpers ── */
const fmt = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const todayISO = () => new Date().toISOString().slice(0, 10);

const longDate = () =>
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const ENV_STYLE = {
    production: { background: 'rgba(216,90,48,0.2)', color: '#f0997b' },
    staging:    { background: 'rgba(83,74,183,0.2)',  color: '#afa9ec' },
    dev:        { background: 'rgba(83,74,183,0.2)',  color: '#afa9ec' },
    test:       { background: 'rgba(83,74,183,0.2)',  color: '#afa9ec' },
};

const ACTION_ICON = {
    'auth.login':  'ti-login',
    'vm.view':     'ti-eye',
    'vm.create':   'ti-plus',
    'vm.update':   'ti-edit',
    'vm.delete':   'ti-trash',
};

/* ── sub-components ── */

function StatCard({ label, value, dot, sub }) {
    return (
        <div style={{
            background: '#0D1119',
            border: '1px solid #192030',
            borderRadius: '4px',
            padding: '12px 14px',
        }}>
            <div style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontSize: '11px', color: '#2D3D56', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#C8D3E8', marginBottom: '6px', fontFamily: '"IBM Plex Sans", sans-serif' }}>
                {value ?? '—'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: '#2D3D56', fontFamily: '"IBM Plex Mono", monospace' }}>{sub}</span>
            </div>
        </div>
    );
}

function PanelShell({ icon, title, right, children }) {
    return (
        <div style={{
            background: '#0D1119',
            border: '1px solid #192030',
            borderRadius: '4px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 12px',
                borderBottom: '1px solid #192030',
            }}>
                <i className={`ti ${icon}`} style={{ fontSize: '13px', color: '#2D3D56' }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#596B88', fontFamily: '"IBM Plex Sans", sans-serif' }}>{title}</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#2D3D56', fontFamily: '"IBM Plex Mono", monospace' }}>{right}</span>
            </div>
            {children}
        </div>
    );
}

/* ── main ── */

export default function Dashboard() {
    const [stats, setStats]     = useState(null);
    const [users, setUsers]     = useState([]);
    const [audit, setAudit]     = useState({ total: 0, today: 0 });
    const [vms, setVms]         = useState([]);
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const today = todayISO();

        Promise.all([
            api.get('/dashboard/stats'),
            api.get('/users'),
            api.get('/audit?limit=1'),
            api.get(`/audit?limit=1&from=${today}T00:00:00`),
            api.get('/vms?limit=100'),
            api.get('/audit?limit=5'),
        ])
            .then(([statsRes, usersRes, auditTotalRes, auditTodayRes, vmsRes, activityRes]) => {
                setStats(statsRes.data);
                setUsers(usersRes.data);
                setAudit({ total: auditTotalRes.data.total, today: auditTodayRes.data.total });
                setVms(vmsRes.data.data || []);
                setActivity(activityRes.data.data || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    /* derived */
    const activeUsers  = users.filter(u => u.is_active);
    const adminCount     = activeUsers.filter(u => u.role === 'admin').length;
    const readwriteCount = activeUsers.filter(u => u.role === 'readwrite').length;
    const readCount      = activeUsers.filter(u => u.role === 'read').length;

    const envKeys      = stats ? Object.keys(stats.by_environment) : [];
    const envCount     = envKeys.length;
    const envLabel     = envKeys.join(' · ') || '—';

    const activeVmCount = stats?.by_status?.active ?? 0;

    if (loading) {
        return (
            <div style={{ padding: '24px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#2D3D56' }}>
                Loading…
            </div>
        );
    }

    return (
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Page heading */}
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '4px' }}>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#C8D3E8', fontFamily: '"IBM Plex Sans", sans-serif' }}>Dashboard</h1>
                <span style={{ marginLeft: 'auto', fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', color: '#2D3D56' }}>
                    {longDate()}
                </span>
            </div>

            {/* Zone 1 — Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <StatCard
                    label="Total VMs"
                    value={stats?.total ?? 0}
                    dot="#34D399"
                    sub={`${activeVmCount} active`}
                />
                <StatCard
                    label="Active users"
                    value={activeUsers.length}
                    dot="#378ADD"
                    sub={`${adminCount} admin · ${readwriteCount} read/write · ${readCount} read`}
                />
                <StatCard
                    label="Audit events"
                    value={audit.total}
                    dot="#EF9F27"
                    sub={`today: ${audit.today}`}
                />
                <StatCard
                    label="Environments"
                    value={envCount}
                    dot="#E24B4A"
                    sub={envLabel}
                />
            </div>

            {/* Zone 2 — Panels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

                {/* Left — VM list */}
                <PanelShell icon="ti-server" title="VMs" right={`${vms.length} total`}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['NAME', 'IP', 'ENV'].map(h => (
                                    <th key={h} style={{
                                        padding: '6px 10px',
                                        textAlign: 'left',
                                        fontSize: '10px',
                                        color: '#2D3D56',
                                        fontWeight: 500,
                                        letterSpacing: '0.09em',
                                        fontFamily: '"IBM Plex Mono", monospace',
                                        borderBottom: '1px solid #192030',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {vms.map((vm, i) => (
                                <tr key={vm.id} style={{ borderBottom: i < vms.length - 1 ? '1px solid #192030' : 'none' }}>
                                    <td style={{ padding: '7px 10px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#C8D3E8' }}>
                                        {vm.vm_name}
                                    </td>
                                    <td style={{ padding: '7px 10px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#596B88' }}>
                                        {vm.ip_address}
                                    </td>
                                    <td style={{ padding: '7px 10px' }}>
                                        {vm.environment ? (
                                            <span style={{
                                                ...(ENV_STYLE[vm.environment] || { background: '#131A27', color: '#596B88' }),
                                                fontSize: '11px',
                                                fontFamily: '"IBM Plex Mono", monospace',
                                                padding: '2px 7px',
                                                borderRadius: '3px',
                                            }}>{vm.environment}</span>
                                        ) : <span style={{ color: '#2D3D56', fontSize: '12px' }}>—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </PanelShell>

                {/* Right — Recent activity */}
                <PanelShell icon="ti-activity" title="Recent activity" right="last 5">
                    {activity.map((entry, i) => {
                        const icon = ACTION_ICON[entry.action] || 'ti-clock';
                        const detail = entry.entity_name
                            ? `${entry.action} · ${entry.entity_name}`
                            : entry.action;
                        return (
                            <div key={entry.id} style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                padding: '7px 12px',
                                borderBottom: i < activity.length - 1 ? '1px solid #192030' : 'none',
                            }}>
                                <i className={`ti ${icon}`} style={{ fontSize: '13px', color: '#2D3D56', marginTop: '1px', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '11px', fontWeight: 500, color: '#C8D3E8', fontFamily: '"IBM Plex Sans", sans-serif' }}>
                                        {entry.username}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#596B88', marginTop: '1px', fontFamily: '"IBM Plex Sans", sans-serif' }}>
                                        {detail}
                                    </div>
                                </div>
                                <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', color: '#2D3D56', flexShrink: 0, marginTop: '2px' }}>
                                    {fmt(entry.created_at)}
                                </span>
                            </div>
                        );
                    })}
                </PanelShell>

            </div>
        </div>
    );
}
