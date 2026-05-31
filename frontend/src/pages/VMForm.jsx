import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function VMForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;

    const [formData, setFormData] = useState({
        vm_name: '',
        hostname: '',
        ip_address: '',
        os_type: '',
        os_version: '',
        vcpu: '',
        ram_gb: '',
        disk_gb: '',
        environment: 'production',
        owner: '',
        department: '',
        application: '',
        description: '',
        notes: '',
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isEditing) {
            loadVM();
        }
    }, [id]);

    const loadVM = async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get(`/vms/${id}`);
            setFormData(data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load VM');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value === '' ? null : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSaving(true);

        try {
            if (isEditing) {
                await api.put(`/vms/${id}`, formData);
                navigate(`/vms/${id}`);
            } else {
                const { data } = await api.post('/vms', formData);
                navigate(`/vms/${data.id}`);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save VM');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-6 text-slate-400 font-mono">Loading...</div>;

    return (
        <div className="p-6 space-y-6 max-w-2xl">
            {/* Header */}
            <div>
                <button onClick={() => navigate(isEditing ? `/vms/${id}` : '/vms')} className="text-emerald-400 hover:text-emerald-300 font-mono text-sm mb-2">
                    ← Back
                </button>
                <h1 className="text-2xl font-mono font-bold text-slate-100">
                    {isEditing ? 'Edit VM' : 'Create New VM'}
                </h1>
            </div>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-700 rounded font-mono text-sm text-red-300">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="card-base border border-slate-700 p-6 space-y-6">
                {/* Identity Section */}
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase mb-4">Identity</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">VM Name *</label>
                            <input
                                type="text"
                                name="vm_name"
                                value={formData.vm_name}
                                onChange={handleChange}
                                required
                                className="input-base"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">Hostname</label>
                            <input
                                type="text"
                                name="hostname"
                                value={formData.hostname || ''}
                                onChange={handleChange}
                                className="input-base"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>

                {/* Network Section */}
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase mb-4">Network</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">IP Address</label>
                            <input
                                type="text"
                                name="ip_address"
                                value={formData.ip_address || ''}
                                onChange={handleChange}
                                className="input-base"
                                placeholder="192.168.1.10"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>

                {/* OS Section */}
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase mb-4">Operating System</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">OS Type</label>
                            <select name="os_type" value={formData.os_type || ''} onChange={handleChange} className="input-base" disabled={isSaving}>
                                <option value="">—</option>
                                <option value="Windows">Windows</option>
                                <option value="Linux">Linux</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">OS Version</label>
                            <input
                                type="text"
                                name="os_version"
                                value={formData.os_version || ''}
                                onChange={handleChange}
                                className="input-base"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>

                {/* Resources Section */}
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase mb-4">Resources</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">vCPU</label>
                            <input
                                type="number"
                                name="vcpu"
                                value={formData.vcpu || ''}
                                onChange={handleChange}
                                className="input-base"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">RAM (GB)</label>
                            <input
                                type="number"
                                name="ram_gb"
                                value={formData.ram_gb || ''}
                                onChange={handleChange}
                                className="input-base"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">Disk (GB)</label>
                            <input
                                type="number"
                                name="disk_gb"
                                value={formData.disk_gb || ''}
                                onChange={handleChange}
                                className="input-base"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>

                {/* Environment & Ownership */}
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase mb-4">Environment & Ownership</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">Environment</label>
                            <select name="environment" value={formData.environment || ''} onChange={handleChange} className="input-base" disabled={isSaving}>
                                <option value="production">Production</option>
                                <option value="staging">Staging</option>
                                <option value="development">Development</option>
                                <option value="test">Test</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">Owner</label>
                            <input
                                type="text"
                                name="owner"
                                value={formData.owner || ''}
                                onChange={handleChange}
                                className="input-base"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">Department</label>
                            <input
                                type="text"
                                name="department"
                                value={formData.department || ''}
                                onChange={handleChange}
                                className="input-base"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">Application</label>
                            <input
                                type="text"
                                name="application"
                                value={formData.application || ''}
                                onChange={handleChange}
                                className="input-base"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>

                {/* Notes Section */}
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase mb-4">Notes</h2>
                    <textarea
                        name="description"
                        value={formData.description || ''}
                        onChange={handleChange}
                        rows={4}
                        placeholder="Description..."
                        className="input-base"
                        disabled={isSaving}
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-slate-700">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="btn-primary disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : isEditing ? 'Update VM' : 'Create VM'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(isEditing ? `/vms/${id}` : '/vms')}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
