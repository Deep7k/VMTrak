import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

function CredentialsSubCard({ vmId }) {
    const [credentials, setCredentials] = useState([]);
    const [newCred, setNewCred] = useState({ username: '', password: '', account_type: 'primary' });
    const [showPassword, setShowPassword] = useState(false);
    const [credError, setCredError] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        api.get(`/vms/${vmId}/credentials`)
            .then(({ data }) => setCredentials(data))
            .catch(() => {});
    }, [vmId]);

    const handleAdd = async () => {
        if (!newCred.username.trim() || !newCred.password.trim()) {
            setCredError('Username and password are required');
            return;
        }
        setCredError('');
        setIsAdding(true);
        try {
            const { data } = await api.post(`/vms/${vmId}/credentials`, newCred);
            setCredentials(prev => [...prev, data]);
            setNewCred({ username: '', password: '', account_type: 'primary' });
        } catch (err) {
            setCredError(err.response?.data?.error || 'Failed to add credential');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async (credId) => {
        try {
            await api.delete(`/vms/${vmId}/credentials/${credId}`);
            setCredentials(prev => prev.filter(c => c.id !== credId));
        } catch {
            setCredError('Failed to delete credential');
        }
    };

    return (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '16px 20px' }} className="space-y-4">
            <h2 className="text-sm font-mono font-bold text-slate-300 uppercase">Credentials</h2>

            {/* Existing credentials */}
            {credentials.length > 0 && (
                <div className="space-y-2">
                    {credentials.map(cred => (
                        <div key={cred.id} className="flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '5px', padding: '8px 14px' }}>
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-sm text-slate-100">{cred.username}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-mono ${cred.account_type === 'primary' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                                    {cred.account_type}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleDelete(cred.id)}
                                className="text-red-400 hover:text-red-300 font-mono text-xs"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add new credential */}
            <div className="grid grid-cols-1 gap-3 pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs font-mono text-slate-500 uppercase">Add Credential</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block font-mono text-xs text-slate-400 mb-1">Username</label>
                        <input
                            type="text"
                            value={newCred.username}
                            onChange={e => setNewCred(prev => ({ ...prev, username: e.target.value }))}
                            className="input-base"
                            placeholder="administrator"
                        />
                    </div>
                    <div>
                        <label className="block font-mono text-xs text-slate-400 mb-1">Type</label>
                        <select
                            value={newCred.account_type}
                            onChange={e => setNewCred(prev => ({ ...prev, account_type: e.target.value }))}
                            className="input-base"
                        >
                            <option value="primary">Primary</option>
                            <option value="others">Others</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block font-mono text-xs text-slate-400 mb-1">Password</label>
                    <div className="flex gap-2">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={newCred.password}
                            onChange={e => setNewCred(prev => ({ ...prev, password: e.target.value }))}
                            className="input-base flex-1"
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="btn-secondary px-3 text-xs"
                        >
                            {showPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                </div>
                {credError && (
                    <p className="text-red-400 font-mono text-xs">{credError}</p>
                )}
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={isAdding}
                    className="btn-primary self-start disabled:opacity-50"
                >
                    {isAdding ? 'Adding...' : 'Add Credential'}
                </button>
            </div>
        </div>
    );
}

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
        expiry_date: '',
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
                <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8', margin: 0 }}>
                    {isEditing ? 'Edit VM' : 'Create New VM'}
                </h1>
            </div>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-700 rounded font-mono text-sm text-red-300">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="card-base p-6 space-y-6">
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

                {/* Lifecycle */}
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-300 uppercase mb-4">Lifecycle</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block font-mono text-xs text-slate-400 mb-2">
                                Expiry Date
                                <span className="text-slate-600 ml-1">(EOL)</span>
                            </label>
                            <input
                                type="date"
                                name="expiry_date"
                                value={formData.expiry_date || ''}
                                onChange={handleChange}
                                className="input-base"
                                disabled={isSaving}
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <div className="flex items-end pb-1">
                            <p className="font-mono text-xs text-slate-500">
                                Notifications sent at 30d, 14d, 7d, 1d and on expiry day to admin and VM owner (if email).
                            </p>
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

                {/* Credentials (edit mode only) */}
                {isEditing && <CredentialsSubCard vmId={id} />}

                {/* Actions */}
                <div className="flex gap-2 pt-4" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
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
