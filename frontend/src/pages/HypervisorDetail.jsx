import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import { hasMinRole } from '../components/Guards';

const REACH_CFG = {
    online:   { color: '#34D399', shadow: '0 0 6px #34D39988', label: 'Online'    },
    offline:  { color: '#F87171', shadow: 'none',              label: 'Offline'   },
    checking: { color: '#FBBF24', shadow: 'none',              label: 'Checking…' },
    unknown:  { color: '#2D3D56', shadow: 'none',              label: 'Unknown'   },
};

const TYPE_COLORS = {
    'VMware vSphere': 'bg-blue-900/40 text-blue-300',
    'Proxmox':        'bg-orange-900/40 text-orange-300',
    'Hyper-V':        'bg-sky-900/40 text-sky-300',
    'KVM':            'bg-purple-900/40 text-purple-300',
    'Other':          'bg-slate-700 text-slate-300',
};

const STATUS_COLORS = {
    active:         'bg-emerald-900/40 text-emerald-300',
    inactive:       'bg-amber-900/40 text-amber-300',
    decommissioned: 'bg-slate-700 text-slate-400',
};

const ENV_COLORS = {
    production:  'bg-red-900/40 text-red-300',
    staging:     'bg-yellow-900/40 text-yellow-300',
    development: 'bg-blue-900/40 text-blue-300',
    test:        'bg-purple-900/40 text-purple-300',
};

function StatusBadge({ status }) {
    const cfg = REACH_CFG[status] || REACH_CFG.unknown;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, boxShadow: cfg.shadow, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', color: cfg.color }}>{cfg.label}</span>
        </span>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', color: '#2D3D56', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                {label}
            </div>
            <div>{children}</div>
        </div>
    );
}

export default function HypervisorDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);
    const canWrite = hasMinRole(user, 'readwrite');

    const [hv, setHv]         = useState(null);
    const [vms, setVms]       = useState([]);
    const [reach, setReach]   = useState('checking');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError]   = useState('');

    useEffect(() => { load(); }, [id]);

    const load = async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get(`/hypervisors/${id}`);
            setHv(data);

            // Probe reachability non-blocking
            if (data.hostname) {
                api.get(`/hypervisors/reachability?ids=${id}`)
                    .then(r => setReach(r.data[String(id)] || 'unknown'))
                    .catch(() => setReach('unknown'));
            } else {
                setReach('unknown');
            }

            // Fetch VMs on this hypervisor
            api.get(`/vms?hypervisor_id=${id}&limit=200`)
                .then(r => setVms(r.data.vms || []))
                .catch(() => setVms([]));

        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load hypervisor');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div style={{ padding: '24px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#2D3D56' }}>Loading…</div>;
    if (error)     return <div style={{ padding: '24px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#F87171' }}>{error}</div>;
    if (!hv)       return <div style={{ padding: '24px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#2D3D56' }}>Hypervisor not found</div>;

    return (
        <div style={{ padding: '24px', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <button
                        onClick={() => navigate('/hypervisors')}
                        style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontSize: '12px', color: '#E07B35', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '10px', display: 'block' }}
                    >
                        ← Back to Hypervisors
                    </button>
                    <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#C8D3E8', fontFamily: '"IBM Plex Sans", sans-serif' }}>
                        {hv.name}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                        {hv.hostname && (
                            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#596B88' }}>
                                {hv.hostname}
                            </span>
                        )}
                        <StatusBadge status={reach} />
                    </div>
                </div>
                {canWrite && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => navigate(`/hypervisors/${id}/edit`)} className="btn-secondary">
                            Edit
                        </button>
                    </div>
                )}
            </div>

            {/* Details card */}
            <div className="card-base" style={{ padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                    <Field label="Type">
                        {hv.type
                            ? <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${TYPE_COLORS[hv.type] || 'bg-slate-700 text-slate-300'}`}>{hv.type}</span>
                            : <span style={{ color: '#2D3D56', fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px' }}>—</span>
                        }
                    </Field>
                    <Field label="Version">
                        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#C8D3E8' }}>{hv.version || '—'}</span>
                    </Field>
                    <Field label="Status">
                        {hv.status
                            ? <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${STATUS_COLORS[hv.status] || 'bg-slate-700 text-slate-300'}`}>{hv.status}</span>
                            : <span style={{ color: '#2D3D56', fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px' }}>—</span>
                        }
                    </Field>
                    <Field label="Environment">
                        {hv.environment
                            ? <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${ENV_COLORS[hv.environment] || 'bg-slate-700 text-slate-300'}`}>{hv.environment}</span>
                            : <span style={{ color: '#2D3D56', fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px' }}>—</span>
                        }
                    </Field>
                    <Field label="vCPU">
                        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#C8D3E8' }}>{hv.vcpu ?? '—'}</span>
                    </Field>
                    <Field label="RAM (GB)">
                        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#C8D3E8' }}>{hv.ram_gb ?? '—'}</span>
                    </Field>
                    <Field label="Disk (GB)">
                        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#C8D3E8' }}>{hv.disk_gb ?? '—'}</span>
                    </Field>
                    <Field label="Created">
                        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#596B88' }}>
                            {hv.created_at ? new Date(hv.created_at).toLocaleDateString('en-GB') : '—'}
                        </span>
                    </Field>
                    <Field label="Last Updated">
                        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#596B88' }}>
                            {hv.updated_at ? new Date(hv.updated_at).toLocaleDateString('en-GB') : '—'}
                        </span>
                    </Field>
                </div>

                {hv.description && (
                    <div style={{ paddingTop: '16px', marginTop: '16px', borderTop: '1px solid #192030' }}>
                        <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', color: '#2D3D56', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                            Description
                        </div>
                        <p style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontSize: '13px', color: '#C8D3E8', margin: 0, whiteSpace: 'pre-wrap' }}>{hv.description}</p>
                    </div>
                )}
            </div>

            {/* VMs on this hypervisor */}
            <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                    <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#C8D3E8', fontFamily: '"IBM Plex Sans", sans-serif' }}>
                        Virtual Machines
                    </h2>
                    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '11px', color: '#2D3D56' }}>
                        {vms.length} assigned
                    </span>
                </div>
                <div className="card-base" style={{ overflow: 'hidden' }}>
                    {vms.length === 0 ? (
                        <div style={{ padding: '24px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#2D3D56', textAlign: 'center' }}>
                            No VMs assigned to this hypervisor
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['VM Name', 'IP Address', 'Status', 'Environment', 'Owner'].map(h => (
                                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', fontWeight: 500, color: '#2D3D56', letterSpacing: '0.09em', textTransform: 'uppercase', borderBottom: '1px solid #192030' }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {vms.map((vm, i) => (
                                    <tr key={vm.id}
                                        onClick={() => navigate(`/vms/${vm.id}`)}
                                        style={{ borderBottom: i < vms.length - 1 ? '1px solid #192030' : 'none', cursor: 'pointer', transition: 'background 0.08s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#131A27'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '9px 14px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '13px', color: '#C8D3E8' }}>{vm.vm_name}</td>
                                        <td style={{ padding: '9px 14px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#596B88' }}>{vm.ip_address || '—'}</td>
                                        <td style={{ padding: '9px 14px' }}>
                                            <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                                                vm.status === 'active'        ? 'bg-emerald-900/40 text-emerald-300' :
                                                vm.status === 'inactive'      ? 'bg-amber-900/40 text-amber-300' :
                                                'bg-slate-700 text-slate-400'
                                            }`}>{vm.status || '—'}</span>
                                        </td>
                                        <td style={{ padding: '9px 14px' }}>
                                            {vm.environment
                                                ? <span className={`px-2 py-0.5 rounded text-xs font-mono ${ENV_COLORS[vm.environment] || 'bg-slate-700 text-slate-300'}`}>{vm.environment}</span>
                                                : <span style={{ color: '#2D3D56', fontSize: '12px' }}>—</span>
                                            }
                                        </td>
                                        <td style={{ padding: '9px 14px', fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px', color: '#596B88' }}>{vm.owner || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
