import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

const HYPERVISOR_TYPES = ['VMware vSphere', 'Proxmox', 'Hyper-V', 'KVM', 'Other'];

export default function HypervisorForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;

    const [formData, setFormData] = useState({
        name:        '',
        type:        '',
        version:     '',
        hostname:    '',
        status:      'active',
        environment: '',
        vcpu:        '',
        ram_gb:      '',
        disk_gb:     '',
        description: '',
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError]         = useState('');
    const [isSaving, setIsSaving]   = useState(false);

    useEffect(() => {
        if (isEditing) loadHypervisor();
    }, [id]);

    const loadHypervisor = async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get(`/hypervisors/${id}`);
            setFormData({
                name:        data.name        ?? '',
                type:        data.type        ?? '',
                version:     data.version     ?? '',
                hostname:    data.hostname    ?? '',
                status:      data.status      ?? 'active',
                environment: data.environment ?? '',
                vcpu:        data.vcpu        ?? '',
                ram_gb:      data.ram_gb      ?? '',
                disk_gb:     data.disk_gb     ?? '',
                description: data.description ?? '',
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load hypervisor');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value === '' ? null : type === 'number' ? Number(value) : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSaving(true);
        const payload = Object.fromEntries(
            Object.entries(formData).map(([k, v]) => [k, v === '' ? null : v])
        );
        try {
            if (isEditing) {
                await api.put(`/hypervisors/${id}`, payload);
            } else {
                await api.post('/hypervisors', payload);
            }
            navigate('/hypervisors');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save hypervisor');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-6 font-mono text-slate-400">Loading…</div>;

    return (
        <div className="p-6 space-y-6 max-w-2xl">
            {/* Header */}
            <div>
                <button onClick={() => navigate('/hypervisors')} className="text-emerald-400 hover:text-emerald-300 font-mono text-sm mb-2">
                    ← Back
                </button>
                <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8', margin: 0 }}>
                    {isEditing ? 'Edit Hypervisor' : 'Add Hypervisor'}
                </h1>
            </div>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-700 rounded font-mono text-sm text-red-300">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="card-base p-6 space-y-6">

                {/* Identity */}
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase mb-4">Identity</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">Name *</label>
                            <input
                                type="text" name="name" required
                                value={formData.name || ''} onChange={handleChange}
                                className="input-base" placeholder="e.g. ESXi-Prod-01" disabled={isSaving}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block font-mono text-xs text-slate-400 mb-2">Type</label>
                                <select name="type" value={formData.type || ''} onChange={handleChange}
                                    className="input-base" disabled={isSaving}>
                                    <option value="">— Select type —</option>
                                    {HYPERVISOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block font-mono text-xs text-slate-400 mb-2">Version</label>
                                <input
                                    type="text" name="version"
                                    value={formData.version || ''} onChange={handleChange}
                                    className="input-base" placeholder="e.g. 8.0.1" disabled={isSaving}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Host */}
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase mb-4">Host</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">Hostname / IP</label>
                            <input
                                type="text" name="hostname"
                                value={formData.hostname || ''} onChange={handleChange}
                                className="input-base" placeholder="e.g. 10.0.0.10" disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">Status</label>
                            <select name="status" value={formData.status || 'active'} onChange={handleChange}
                                className="input-base" disabled={isSaving}>
                                <option value="active">Active</option>
                                <option value="maintenance">Maintenance</option>
                                <option value="decommissioned">Decommissioned</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">Environment</label>
                            <select name="environment" value={formData.environment || ''} onChange={handleChange}
                                className="input-base" disabled={isSaving}>
                                <option value="">— None —</option>
                                <option value="production">Production</option>
                                <option value="test">Testing</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Resources */}
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase mb-4">Resources</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">vCPU</label>
                            <input
                                type="number" name="vcpu" min="1"
                                value={formData.vcpu || ''} onChange={handleChange}
                                className="input-base" disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">RAM (GB)</label>
                            <input
                                type="number" name="ram_gb" min="0" step="any"
                                value={formData.ram_gb || ''} onChange={handleChange}
                                className="input-base" disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">Disk (GB)</label>
                            <input
                                type="number" name="disk_gb" min="0" step="any"
                                value={formData.disk_gb || ''} onChange={handleChange}
                                className="input-base" disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase mb-4">Notes</h2>
                    <textarea
                        name="description"
                        value={formData.description || ''}
                        onChange={handleChange}
                        rows={4}
                        placeholder="Description…"
                        className="input-base"
                        disabled={isSaving}
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
                        {isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Add hypervisor'}
                    </button>
                    <button type="button" onClick={() => navigate('/hypervisors')} className="btn-secondary" disabled={isSaving}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
