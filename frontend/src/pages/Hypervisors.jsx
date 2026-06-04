import { useEffect, useState } from 'react';
import api from '../api/client';

const HYPERVISOR_TYPES = ['VMware vSphere', 'Proxmox', 'Hyper-V', 'KVM', 'Other'];

const TYPE_COLORS = {
  'VMware vSphere': 'bg-blue-900/40 text-blue-300',
  'Proxmox':        'bg-orange-900/40 text-orange-300',
  'Hyper-V':        'bg-sky-900/40 text-sky-300',
  'KVM':            'bg-purple-900/40 text-purple-300',
  'Other':          'bg-slate-700 text-slate-300',
};

function TypeBadge({ type }) {
  if (!type) return <span className="font-mono text-xs text-slate-500">—</span>;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${TYPE_COLORS[type] ?? 'bg-slate-700 text-slate-300'}`}>
      {type}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block font-mono text-xs text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function HypervisorModal({ hypervisor, onClose, onSaved }) {
  const isEditing = !!hypervisor;
  const [form, setForm]     = useState({
    name:        hypervisor?.name        ?? '',
    hostname:    hypervisor?.hostname    ?? '',
    type:        hypervisor?.type        ?? '',
    description: hypervisor?.description ?? '',
  });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      name:        form.name        || undefined,
      hostname:    form.hostname    || null,
      type:        form.type        || null,
      description: form.description || null,
    };
    try {
      if (isEditing) {
        await api.put(`/hypervisors/${hypervisor.id}`, payload);
      } else {
        await api.post('/hypervisors', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass-modal w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-slate-100 text-lg">
            {isEditing ? 'Edit Hypervisor' : 'Add Hypervisor'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name *">
            <input name="name" value={form.name} onChange={handleChange} required
              className="input-base" placeholder="e.g. ESXi-Prod-01" autoFocus />
          </Field>
          <Field label="Type">
            <select name="type" value={form.type} onChange={handleChange} className="input-base">
              <option value="">— Select type —</option>
              {HYPERVISOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Hostname / IP">
            <input name="hostname" value={form.hostname} onChange={handleChange}
              className="input-base" placeholder="e.g. 10.0.0.10 or esxi01.lan" />
          </Field>
          <Field label="Description">
            <textarea name="description" value={form.description} onChange={handleChange}
              rows={2} className="input-base" placeholder="Optional notes…" />
          </Field>

          {error && <p className="font-mono text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 justify-end pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add hypervisor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HypervisorsPage() {
  const [hypervisors, setHypervisors] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [modal, setModal]             = useState(null); // null | 'add' | hypervisor object
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError]   = useState('');
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/hypervisors');
      setHypervisors(data);
    } catch {
      setError('Failed to load hypervisors');
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = () => {
    setModal(null);
    load();
  };

  const confirmDelete = (hv) => {
    setDeleteTarget(hv);
    setDeleteError('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/hypervisors/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '960px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8', margin: 0 }}>Hypervisors</h1>
          <p className="font-mono text-xs text-slate-500 mt-1">{hypervisors.length} registered</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="ti ti-plus" style={{ fontSize: '14px' }} /> Add Hypervisor
        </button>
      </div>

      {error && <p className="font-mono text-sm text-red-400 mb-4">{error}</p>}

      {/* Table */}
      <div className="card-base" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Name', 'Type', 'Hostname / IP', 'VMs', 'Actions'].map(h => (
                <th key={h} className="font-mono text-xs text-slate-500 uppercase" style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="font-mono text-xs text-slate-500 text-center" style={{ padding: '32px' }}>Loading…</td></tr>
            ) : hypervisors.length === 0 ? (
              <tr><td colSpan={5} className="font-mono text-xs text-slate-500 text-center" style={{ padding: '32px' }}>No hypervisors yet — add one to get started</td></tr>
            ) : hypervisors.map((hv, i) => (
              <tr key={hv.id}
                style={{ borderBottom: i < hypervisors.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '12px 16px' }}>
                  <span className="font-mono text-sm text-slate-100">{hv.name}</span>
                  {hv.description && (
                    <p className="font-mono text-xs text-slate-500 mt-0.5">{hv.description}</p>
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}><TypeBadge type={hv.type} /></td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="font-mono text-xs text-slate-400">{hv.hostname || '—'}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="font-mono text-xs text-slate-300">{hv.vm_count}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setModal(hv)}
                      className="font-mono text-xs text-slate-400 hover:text-slate-100"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Edit
                    </button>
                    <button onClick={() => confirmDelete(hv)}
                      className="font-mono text-xs text-red-400 hover:text-red-300"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <HypervisorModal
          hypervisor={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="glass-modal w-full max-w-sm space-y-4">
            <h2 className="font-mono font-bold text-slate-100">Delete hypervisor?</h2>
            <p className="font-mono text-sm text-slate-400">
              <span className="text-slate-200">{deleteTarget.name}</span> will be permanently removed.
              {deleteTarget.vm_count > 0 && (
                <span className="text-yellow-400"> This hypervisor has {deleteTarget.vm_count} VM{deleteTarget.vm_count !== 1 ? 's' : ''} assigned.</span>
              )}
            </p>
            {deleteError && <p className="font-mono text-xs text-red-400">{deleteError}</p>}
            <div className="flex gap-2 justify-end pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
