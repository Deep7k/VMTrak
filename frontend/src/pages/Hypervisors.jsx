import { useEffect, useState } from 'react';
import api from '../api/client';

const HYPERVISOR_TYPES  = ['VMware vSphere', 'Proxmox', 'Hyper-V', 'KVM', 'Other'];
const ENVIRONMENTS      = ['production', 'staging', 'development', 'test'];
const STATUSES          = ['active', 'maintenance', 'decommissioned'];

const TYPE_COLORS = {
  'VMware vSphere': 'bg-blue-900/40 text-blue-300',
  'Proxmox':        'bg-orange-900/40 text-orange-300',
  'Hyper-V':        'bg-sky-900/40 text-sky-300',
  'KVM':            'bg-purple-900/40 text-purple-300',
  'Other':          'bg-slate-700 text-slate-300',
};

const STATUS_COLORS = {
  active:          'bg-emerald-900/40 text-emerald-300',
  maintenance:     'bg-amber-900/40 text-amber-300',
  decommissioned:  'bg-slate-700 text-slate-400',
};

const ENV_COLORS = {
  production:  'bg-red-900/30 text-red-300',
  staging:     'bg-amber-900/30 text-amber-300',
  development: 'bg-blue-900/30 text-blue-300',
  test:        'bg-slate-700 text-slate-300',
};

const REACH_CFG = {
  online:   { color: '#22c55e', shadow: '0 0 6px #22c55e55' },
  offline:  { color: '#ef4444', shadow: 'none' },
  checking: { color: '#f59e0b', shadow: 'none' },
  unknown:  { color: 'rgba(255,255,255,0.18)', shadow: 'none' },
};

function ReachDot({ status }) {
  const cfg = REACH_CFG[status] || REACH_CFG.unknown;
  return (
    <span style={{
      display: 'inline-block', width: '8px', height: '8px',
      borderRadius: '50%', background: cfg.color, boxShadow: cfg.shadow, flexShrink: 0,
    }} title={status} />
  );
}

function TypeBadge({ type }) {
  if (!type) return <span className="font-mono text-xs text-slate-500">—</span>;
  return <span className={`px-2 py-0.5 rounded text-xs font-mono ${TYPE_COLORS[type] ?? 'bg-slate-700 text-slate-300'}`}>{type}</span>;
}

function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`px-2 py-0.5 rounded text-xs font-mono ${STATUS_COLORS[status] ?? 'bg-slate-700 text-slate-300'}`}>{status}</span>;
}

function EnvBadge({ env }) {
  if (!env) return <span className="font-mono text-xs text-slate-500">—</span>;
  return <span className={`px-2 py-0.5 rounded text-xs font-mono ${ENV_COLORS[env] ?? 'bg-slate-700 text-slate-300'}`}>{env}</span>;
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
    status:      hypervisor?.status      ?? 'active',
    environment: hypervisor?.environment ?? '',
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
      status:      form.status      || 'active',
      environment: form.environment || null,
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select name="type" value={form.type} onChange={handleChange} className="input-base">
                <option value="">— Select type —</option>
                {HYPERVISOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select name="status" value={form.status} onChange={handleChange} className="input-base">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Hostname / IP">
              <input name="hostname" value={form.hostname} onChange={handleChange}
                className="input-base" placeholder="e.g. 10.0.0.10" />
            </Field>
            <Field label="Environment">
              <select name="environment" value={form.environment} onChange={handleChange} className="input-base">
                <option value="">— None —</option>
                {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
          </div>

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
  const [hypervisors, setHypervisors]   = useState([]);
  const [reach, setReach]               = useState({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [modal, setModal]               = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError]   = useState('');
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/hypervisors');
      setHypervisors(data);
      // Kick off reachability check non-blocking after list loads
      if (data.length > 0) {
        const ids = data.map(h => h.id).join(',');
        setReach(prev => {
          const next = { ...prev };
          data.forEach(h => { if (!next[h.id]) next[h.id] = 'checking'; });
          return next;
        });
        api.get(`/hypervisors/reachability?ids=${ids}`)
          .then(r => setReach(r.data))
          .catch(() => {});
      }
    } catch {
      setError('Failed to load hypervisors');
    } finally {
      setLoading(false);
    }
  };

  const refreshReach = () => {
    if (hypervisors.length === 0) return;
    const ids = hypervisors.map(h => h.id).join(',');
    setReach(prev => {
      const next = {};
      Object.keys(prev).forEach(k => { next[k] = 'checking'; });
      return next;
    });
    api.get(`/hypervisors/reachability?ids=${ids}`)
      .then(r => setReach(r.data))
      .catch(() => {});
  };

  const handleSaved = () => { setModal(null); load(); };

  const confirmDelete = (hv) => { setDeleteTarget(hv); setDeleteError(''); };

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
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8', margin: 0 }}>Hypervisors</h1>
          <p className="font-mono text-xs text-slate-500 mt-1">{hypervisors.length} registered</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={refreshReach} title="Refresh connectivity"
            className="btn-secondary font-mono text-xs" style={{ padding: '6px 10px' }}>
            ↺ Check
          </button>
          <button onClick={() => setModal('add')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="ti ti-plus" style={{ fontSize: '14px' }} /> Add Hypervisor
          </button>
        </div>
      </div>

      {error && <p className="font-mono text-sm text-red-400 mb-4">{error}</p>}

      {/* Table */}
      <div className="card-base" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['', 'Name', 'Type', 'Environment', 'Hostname / IP', 'Status', 'VMs', 'Actions'].map(h => (
                <th key={h} className="font-mono text-xs text-slate-500 uppercase"
                  style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="font-mono text-xs text-slate-500 text-center" style={{ padding: '32px' }}>Loading…</td></tr>
            ) : hypervisors.length === 0 ? (
              <tr><td colSpan={8} className="font-mono text-xs text-slate-500 text-center" style={{ padding: '32px' }}>No hypervisors yet — add one to get started</td></tr>
            ) : hypervisors.map((hv, i) => (
              <tr key={hv.id}
                style={{ borderBottom: i < hypervisors.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Reach dot */}
                <td style={{ padding: '12px 8px 12px 16px', width: '24px' }}>
                  <ReachDot status={reach[String(hv.id)] || (hv.hostname ? 'checking' : 'unknown')} />
                </td>
                {/* Name */}
                <td style={{ padding: '12px 16px' }}>
                  <span className="font-mono text-sm text-slate-100">{hv.name}</span>
                  {hv.description && (
                    <p className="font-mono text-xs text-slate-500 mt-0.5 truncate" style={{ maxWidth: '200px' }}>{hv.description}</p>
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}><TypeBadge type={hv.type} /></td>
                <td style={{ padding: '12px 16px' }}><EnvBadge env={hv.environment} /></td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="font-mono text-xs text-slate-400">{hv.hostname || '—'}</span>
                </td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={hv.status} /></td>
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

      {modal && (
        <HypervisorModal
          hypervisor={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="glass-modal w-full max-w-sm space-y-4">
            <h2 className="font-mono font-bold text-slate-100">Delete hypervisor?</h2>
            <p className="font-mono text-sm text-slate-400">
              <span className="text-slate-200">{deleteTarget.name}</span> will be permanently removed.
              {deleteTarget.vm_count > 0 && (
                <span className="text-yellow-400"> {deleteTarget.vm_count} VM{deleteTarget.vm_count !== 1 ? 's are' : ' is'} assigned to this hypervisor.</span>
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
