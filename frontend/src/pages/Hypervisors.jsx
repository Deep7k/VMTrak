import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

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
  production: 'bg-red-900/30 text-red-300',
  test:       'bg-slate-700 text-slate-300',
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div title={status}
        style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, boxShadow: cfg.shadow, flexShrink: 0 }} />
    </div>
  );
}

function Badge({ label, colorClass }) {
  if (!label) return <span className="font-mono text-xs text-slate-500">—</span>;
  return <span className={`px-2 py-0.5 rounded text-xs font-mono ${colorClass ?? 'bg-slate-700 text-slate-300'}`}>{label}</span>;
}

function ActionsMenu({ hv, onDelete }) {
  const navigate  = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  const items = [
    { label: 'Edit',   action: () => { navigate(`/hypervisors/${hv.id}/edit`); setOpen(false); } },
    { label: 'Delete', action: () => { setOpen(false); onDelete(hv); }, danger: true },
  ];

  return (
    <div onClick={e => e.stopPropagation()}>
      <button ref={btnRef} onClick={handleToggle}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100 text-lg leading-none"
        title="Actions">
        ⋮
      </button>
      {open && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, width: '140px', background: '#12151e', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '4px 0' }}
          onMouseDown={e => e.stopPropagation()}
        >
          {items.map(item => (
            <button key={item.label} onClick={item.action}
              style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontFamily: 'monospace', fontSize: '12px', color: item.danger ? '#e87878' : 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; if (!item.danger) e.currentTarget.style.color = '#1d9e75'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = item.danger ? '#e87878' : 'rgba(255,255,255,0.6)'; }}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function HypervisorsPage() {
  const navigate = useNavigate();
  const [hypervisors, setHypervisors]   = useState([]);
  const [reach, setReach]               = useState({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError]   = useState('');
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/hypervisors');
      setHypervisors(data);
      if (data.length > 0) {
        const ids = data.map(h => h.id).join(',');
        setReach(Object.fromEntries(data.map(h => [String(h.id), h.hostname ? 'checking' : 'unknown'])));
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
    setReach(Object.fromEntries(hypervisors.map(h => [String(h.id), h.hostname ? 'checking' : 'unknown'])));
    api.get(`/hypervisors/reachability?ids=${ids}`)
      .then(r => setReach(r.data))
      .catch(() => {});
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8', margin: 0 }}>Hypervisors</h1>
          <p className="font-mono text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Total: {hypervisors.length} hypervisors</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={refreshReach} className="btn-secondary font-mono text-xs" style={{ padding: '6px 10px' }}>
            ↺ Check
          </button>
          <button onClick={() => navigate('/hypervisors/new')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="ti ti-plus" style={{ fontSize: '14px' }} /> Add Hypervisor
          </button>
        </div>
      </div>

      {error && <p className="font-mono text-sm text-red-400">{error}</p>}

      {/* Table */}
      <div className="card-base overflow-x-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['POWER STATE', 'NAME', 'TYPE', 'ENVIRONMENT', 'HOSTNAME / IP', 'STATUS', 'VMS', ''].map((h, i) => (
                <th key={i} className="font-mono text-xs text-slate-500 uppercase"
                  style={{ padding: '10px 16px', textAlign: i === 7 ? 'right' : 'left', fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="font-mono text-xs text-slate-500 text-center" style={{ padding: '32px' }}>Loading…</td></tr>
            ) : hypervisors.length === 0 ? (
              <tr><td colSpan={8} className="font-mono text-xs text-slate-500 text-center" style={{ padding: '32px' }}>No hypervisors yet — click "Add Hypervisor" to get started</td></tr>
            ) : hypervisors.map((hv, i) => (
              <tr key={hv.id}
                style={{ borderBottom: i < hypervisors.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '12px 8px 12px 16px', width: '32px' }}>
                  <ReachDot status={reach[String(hv.id)] || 'unknown'} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="font-mono text-sm text-slate-100">{hv.name}</span>
                  {hv.version && <p className="font-mono text-xs text-slate-500 mt-0.5">{hv.type ? `${hv.type} ` : ''}{hv.version}</p>}
                  {!hv.version && hv.description && <p className="font-mono text-xs text-slate-500 mt-0.5 truncate" style={{ maxWidth: '220px' }}>{hv.description}</p>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Badge label={hv.type} colorClass={TYPE_COLORS[hv.type]} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Badge label={hv.environment} colorClass={ENV_COLORS[hv.environment]} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="font-mono text-xs text-slate-400">{hv.hostname || '—'}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Badge label={hv.status} colorClass={STATUS_COLORS[hv.status]} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="font-mono text-xs text-slate-300">{hv.vm_count}</span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <ActionsMenu hv={hv} onDelete={setDeleteTarget} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation */}
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
              <button onClick={() => { setDeleteTarget(null); setDeleteError(''); }} className="btn-secondary">Cancel</button>
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
