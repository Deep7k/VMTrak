import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import CredentialPanel from '../components/CredentialPanel';

export default function VMDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [vm, setVm] = useState(null);
    const [credentials, setCredentials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadVM();
    }, [id]);

    const loadVM = async () => {
        setIsLoading(true);
        try {
            const vmRes = await api.get(`/vms/${id}`);
            setVm(vmRes.data);

            const credsRes = await api.get(`/vms/${id}/credentials`);
            setCredentials(credsRes.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load VM');
        } finally {
            setIsLoading(false);
        }
    };

    const downloadRDP = async () => {
        try {
            const response = await api.get(`/vms/${id}/rdp`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(response.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${vm.vm_name}.rdp`;
            a.click();
        } catch (err) {
            alert('Failed to download RDP file');
        }
    };

    if (isLoading) return <div className="p-6 text-slate-400 font-mono">Loading...</div>;
    if (error) return <div className="p-6 text-red-400 font-mono">{error}</div>;
    if (!vm) return <div className="p-6 text-slate-400 font-mono">VM not found</div>;

    const envColors = {
        production: 'bg-red-900/40 text-red-300',
        staging: 'bg-yellow-900/40 text-yellow-300',
        development: 'bg-blue-900/40 text-blue-300',
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button onClick={() => navigate('/vms')} className="text-emerald-400 hover:text-emerald-300 font-mono text-sm mb-2">
                        ← Back to VMs
                    </button>
                    <h1 className="text-2xl font-mono font-bold text-slate-100">{vm.vm_name}</h1>
                    <p className="text-slate-400 font-mono text-sm mt-1">{vm.ip_address}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={downloadRDP} className="btn-primary">
                        Download RDP
                    </button>
                    <button onClick={() => navigate(`/vms/${id}/edit`)} className="btn-secondary">
                        Edit
                    </button>
                </div>
            </div>

            {/* VM Details */}
            <div className="card-base border border-slate-700 p-6 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                        <label className="text-xs font-mono text-slate-400 uppercase">Hostname</label>
                        <p className="text-slate-100 font-mono mt-1">{vm.hostname || '—'}</p>
                    </div>
                    <div>
                        <label className="text-xs font-mono text-slate-400 uppercase">OS Type</label>
                        <p className="text-slate-100 font-mono mt-1">{vm.os_type || '—'}</p>
                    </div>
                    <div>
                        <label className="text-xs font-mono text-slate-400 uppercase">OS Version</label>
                        <p className="text-slate-100 font-mono mt-1">{vm.os_version || '—'}</p>
                    </div>
                    <div>
                        <label className="text-xs font-mono text-slate-400 uppercase">Environment</label>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-mono mt-1 ${envColors[vm.environment] || 'text-slate-300'}`}>
                            {vm.environment || '—'}
                        </span>
                    </div>
                    <div>
                        <label className="text-xs font-mono text-slate-400 uppercase">Power State</label>
                        <p className="text-slate-100 font-mono mt-1">{vm.power_state}</p>
                    </div>
                    <div>
                        <label className="text-xs font-mono text-slate-400 uppercase">Owner</label>
                        <p className="text-slate-100 font-mono mt-1">{vm.owner || '—'}</p>
                    </div>
                    <div>
                        <label className="text-xs font-mono text-slate-400 uppercase">vCPU</label>
                        <p className="text-slate-100 font-mono mt-1">{vm.vcpu || '—'}</p>
                    </div>
                    <div>
                        <label className="text-xs font-mono text-slate-400 uppercase">RAM (GB)</label>
                        <p className="text-slate-100 font-mono mt-1">{vm.ram_gb || '—'}</p>
                    </div>
                    <div>
                        <label className="text-xs font-mono text-slate-400 uppercase">Disk (GB)</label>
                        <p className="text-slate-100 font-mono mt-1">{vm.disk_gb || '—'}</p>
                    </div>
                </div>

                {vm.description && (
                    <div className="pt-4 border-t border-slate-700">
                        <label className="text-xs font-mono text-slate-400 uppercase">Description</label>
                        <p className="text-slate-100 mt-2 whitespace-pre-wrap">{vm.description}</p>
                    </div>
                )}
            </div>

            {/* Credentials */}
            <CredentialPanel vmId={id} credentials={credentials} />
        </div>
    );
}
