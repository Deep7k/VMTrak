import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import CredentialPanel from '../components/CredentialPanel';
import { useAuthStore } from '../store/authStore';
import { hasMinRole } from '../components/Guards';

const REACH_CFG = {
    online:   { color: '#22c55e', shadow: '0 0 6px #22c55e', label: 'Online'    },
    offline:  { color: '#ef4444', shadow: 'none',            label: 'Offline'   },
    checking: { color: '#f59e0b', shadow: 'none',            label: 'Checking…' },
    unknown:  { color: 'rgba(255,255,255,0.2)', shadow: 'none', label: 'Unknown' },
};

function StatusBadge({ status }) {
    const cfg = REACH_CFG[status] || REACH_CFG.unknown;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, boxShadow: cfg.shadow, flexShrink: 0, display: 'inline-block' }} />
            <span className="font-mono text-xs" style={{ color: cfg.color }}>{cfg.label}</span>
        </span>
    );
}

export default function VMDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);
    const canWrite = hasMinRole(user, 'readwrite');
    const [vm, setVm] = useState(null);
    const [credentials, setCredentials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [reach, setReach] = useState('checking');

    useEffect(() => {
        loadVM();
    }, [id]);

    const loadVM = async () => {
        setIsLoading(true);
        try {
            const vmRes = await api.get(`/vms/${id}`);
            setVm(vmRes.data);

            if (canWrite) {
                const credsRes = await api.get(`/vms/${id}/credentials`);
                setCredentials(credsRes.data);
            }

            // Fetch connectivity non-blocking
            if (vmRes.data.ip_address) {
                api.get(`/vms/reachability?ids=${id}`)
                    .then(r => setReach(r.data[String(id)] || 'unknown'))
                    .catch(() => setReach('unknown'));
            } else {
                setReach('unknown');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load VM');
        } finally {
            setIsLoading(false);
        }
    };

    const downloadRDP = async () => {
        try {
            const response = await api.get(`/vms/${id}/rdp`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(response.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${vm.vm_name}.rdp`;
            a.click();
        } catch {
            alert('Failed to download RDP file');
        }
    };

    if (isLoading) return <div className="p-6 text-slate-400 font-mono">Loading...</div>;
    if (error) return <div className="p-6 text-red-400 font-mono">{error}</div>;
    if (!vm) return <div className="p-6 text-slate-400 font-mono">VM not found</div>;

    const isLinux = vm.os_type === 'Linux';

    const envColors = {
        production:  'bg-red-900/40 text-red-300',
        staging:     'bg-yellow-900/40 text-yellow-300',
        development: 'bg-blue-900/40 text-blue-300',
        test:        'bg-purple-900/40 text-purple-300',
    };

    const Field = ({ label, children }) => (
        <div>
            <label className="text-xs font-mono text-slate-400 uppercase">{label}</label>
            <div className="mt-1">{children}</div>
        </div>
    );

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button onClick={() => navigate('/vms')} className="text-emerald-400 hover:text-emerald-300 font-mono text-sm mb-2">
                        ← Back to VMs
                    </button>
                    <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8', margin: 0 }}>{vm.vm_name}</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>{vm.ip_address || 'No IP'}</span>
                        <span className="font-mono text-xs text-slate-500">Power State:</span>
                        <StatusBadge status={reach} />
                    </div>
                </div>
                <div className="flex gap-2">
                    {canWrite && !isLinux && (
                        <button onClick={downloadRDP} className="btn-primary">
                            Download RDP
                        </button>
                    )}
                    {canWrite && (
                        <button onClick={() => navigate(`/vms/${id}/edit`)} className="btn-secondary">
                            Edit
                        </button>
                    )}
                </div>
            </div>

            {/* VM Details */}
            <div className="card-base p-6 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <Field label="Hostname">
                        <p className="text-slate-100 font-mono">{vm.hostname || '—'}</p>
                    </Field>
                    <Field label="OS Type">
                        <p className="text-slate-100 font-mono">{vm.os_type || '—'}</p>
                    </Field>
                    <Field label="OS Version">
                        <p className="text-slate-100 font-mono">{vm.os_version || '—'}</p>
                    </Field>
                    <Field label="Environment">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-mono ${envColors[vm.environment] || 'text-slate-300'}`}>
                            {vm.environment || '—'}
                        </span>
                    </Field>
                    <Field label="Status">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-mono ${
                            vm.status === 'active' ? 'bg-emerald-900/40 text-emerald-300' :
                            vm.status === 'inactive' ? 'bg-amber-900/40 text-amber-300' :
                            'bg-slate-700 text-slate-400'
                        }`}>{vm.status || 'active'}</span>
                    </Field>
                    <Field label="State">
                        <p className="text-slate-100 font-mono">{vm.power_state}</p>
                    </Field>
                    <Field label="Owner">
                        <p className="text-slate-100 font-mono">{vm.owner || '—'}</p>
                    </Field>
                    <Field label="vCPU">
                        <p className="text-slate-100 font-mono">{vm.vcpu || '—'}</p>
                    </Field>
                    <Field label="RAM (GB)">
                        <p className="text-slate-100 font-mono">{vm.ram_gb || '—'}</p>
                    </Field>
                    <Field label="Disk (GB)">
                        <p className="text-slate-100 font-mono">{vm.disk_gb || '—'}</p>
                    </Field>
                    {vm.hypervisor_name && (
                        <Field label="Hypervisor Host">
                            <p className="text-slate-100 font-mono">{vm.hypervisor_name}</p>
                        </Field>
                    )}
                    {vm.expiry_date && (
                        <Field label="Expiry Date">
                            <p className="font-mono" style={{ color: '#f59e0b' }}>{vm.expiry_date}</p>
                        </Field>
                    )}
                </div>

                {vm.description && (
                    <div style={{ paddingTop: '16px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                        <label className="text-xs font-mono text-slate-400 uppercase">Description</label>
                        <p className="text-slate-100 mt-2 whitespace-pre-wrap">{vm.description}</p>
                    </div>
                )}
            </div>

            {/* Credentials — hidden for read-only role */}
            {canWrite && <CredentialPanel vmId={id} credentials={credentials} />}
        </div>
    );
}
