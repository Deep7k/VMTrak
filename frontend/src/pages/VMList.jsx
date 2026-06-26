import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { hasMinRole } from '../components/Guards';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import api from '../api/client';

// ── Column metadata ────────────────────────────────────────────────────────────
const COL_META = [
  { id: 'reach',            label: 'Connectivity',   pinned: false, sortKey: null,          defaultOn: true  },
  { id: 'vm_name',          label: 'VM Name',         pinned: true,  sortKey: 'vm_name',     defaultOn: true  },
  { id: 'ip_address',       label: 'IP Address',      pinned: false, sortKey: 'ip_address',  defaultOn: true  },
  { id: 'hostname',         label: 'Hostname',        pinned: false, sortKey: null,          defaultOn: false },
  { id: 'hypervisor_name',  label: 'Hypervisor',      pinned: false, sortKey: null,          defaultOn: true  },
  { id: 'environment',      label: 'Environment',     pinned: false, sortKey: 'environment', defaultOn: true  },
  { id: 'status',           label: 'Status',          pinned: false, sortKey: 'status',      defaultOn: true  },
  { id: 'power_state',      label: 'Power State',     pinned: false, sortKey: 'power_state', defaultOn: false },
  { id: 'os_type',          label: 'OS Type',         pinned: false, sortKey: null,          defaultOn: false },
  { id: 'os_version',       label: 'OS Version',      pinned: false, sortKey: null,          defaultOn: false },
  { id: 'owner',            label: 'Owner',           pinned: false, sortKey: 'owner',       defaultOn: false },
  { id: 'department',       label: 'Department',      pinned: false, sortKey: 'department',  defaultOn: false },
  { id: 'application',      label: 'Application',     pinned: false, sortKey: null,          defaultOn: false },
  { id: 'vcpu',             label: 'vCPU',            pinned: false, sortKey: null,          defaultOn: false },
  { id: 'ram_gb',           label: 'RAM (GB)',         pinned: false, sortKey: null,          defaultOn: false },
  { id: 'disk_gb',          label: 'Disk (GB)',        pinned: false, sortKey: null,          defaultOn: false },
  { id: 'expiry_date',      label: 'Expiry Date',     pinned: false, sortKey: 'expiry_date', defaultOn: false },
  { id: 'primary_username', label: 'Username',        pinned: false, sortKey: null,          defaultOn: true  },
  { id: 'created_at',       label: 'Created',         pinned: false, sortKey: 'created_at',  defaultOn: false },
  { id: 'actions',          label: '',                pinned: true,  sortKey: null,          defaultOn: true  },
];

const COL_META_MAP  = Object.fromEntries(COL_META.map(c => [c.id, c]));
const DEFAULT_ORDER = COL_META.map(c => c.id);
const DEFAULT_VIS   = Object.fromEntries(COL_META.filter(c => !c.defaultOn).map(c => [c.id, false]));

// ── Cookie helpers ─────────────────────────────────────────────────────────────
const COOKIE_KEY = 'vmtrak_cols_v1';

const saveCols = (order, vis) => {
  const val = encodeURIComponent(JSON.stringify({ order, vis }));
  document.cookie = `${COOKIE_KEY}=${val}; path=/; max-age=${365 * 24 * 3600}`;
};

const loadCols = () => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
  try { return m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch { return null; }
};

const mergeSaved = (saved) => {
  if (!saved) return { order: DEFAULT_ORDER, vis: { ...DEFAULT_VIS } };
  const validIds = new Set(DEFAULT_ORDER);
  const savedOrder = (saved.order || []).filter(id => validIds.has(id));
  const missing = DEFAULT_ORDER.filter(id => !savedOrder.includes(id));
  return {
    order: [...savedOrder, ...missing],
    vis: { ...DEFAULT_VIS, ...(saved.vis || {}) },
  };
};

// ── CSV template ───────────────────────────────────────────────────────────────
const CSV_COLUMNS = [
  'vm_name', 'hostname', 'ip_address', 'hypervisor',
  'os_type', 'os_version', 'vcpu', 'ram_gb', 'disk_gb',
  'environment', 'owner', 'department', 'application', 'expiry_date', 'description',
];

function downloadTemplate() {
  const blob = new Blob([CSV_COLUMNS.join(',') + '\n'], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'vmtrak-import-template.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Subcomponents ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImported }) {
  const [file, setFile]       = useState(null);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) { setError('Select a CSV file first.'); return; }
    setError(''); setLoading(true);
    try {
      const text = await file.text();
      const { data } = await api.post('/vms/import', text, { headers: { 'Content-Type': 'text/csv' } });
      setResult(data);
      if (data.imported > 0) onImported();
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed.');
    } finally { setLoading(false); }
  };

  const handleReset = () => { setFile(null); setResult(null); setError(''); };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-modal w-full max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-slate-100">Import VMs from CSV</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none">✕</button>
        </div>
        <div className="p-3 rounded font-mono text-xs text-slate-400" style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
          <p className="mb-2">Only <span className="text-slate-200">vm_name</span> is required. All other columns are optional.</p>
          <button onClick={downloadTemplate} className="text-emerald-400 hover:text-emerald-300">↓ Download template CSV</button>
        </div>
        {!result && (
          <div>
            <label className="block font-mono text-xs text-slate-400 mb-2">CSV file</label>
            <input type="file" accept=".csv,text/csv"
              onChange={e => { setFile(e.target.files[0] || null); setError(''); }}
              className="input-base" style={{ paddingTop: '5px' }} />
          </div>
        )}
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Imported', value: result.imported, color: 'text-emerald-400' },
                { label: 'Skipped',  value: result.skipped,  color: result.skipped > 0 ? 'text-yellow-400' : 'text-slate-500' },
                { label: 'Total',    value: result.imported + result.skipped, color: 'text-slate-300' },
              ].map(s => (
                <div key={s.label} className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                  <div className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="font-mono text-xs text-slate-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '220px' }}>
                {result.errors.map((e, i) => (
                  <div key={i} className="font-mono text-xs p-2 rounded" style={{ background: 'rgba(226,75,74,0.08)', border: '0.5px solid rgba(226,75,74,0.2)' }}>
                    <span className="text-slate-400">Row {e.row}</span>
                    {e.vm_name && <span className="text-slate-300"> · {e.vm_name}</span>}
                    <span className="text-red-300"> — {e.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2 justify-end pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={onClose} className="btn-secondary">Close</button>
          {result
            ? <button onClick={handleReset} className="btn-primary">Import another file</button>
            : <button onClick={handleUpload} disabled={loading || !file} className="btn-primary disabled:opacity-50">{loading ? 'Importing...' : 'Import'}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}

function StatusDot({ status }) {
  const cfg = {
    online:   { color: '#22c55e', shadow: '0 0 6px #22c55e', label: 'Online'    },
    offline:  { color: '#ef4444', shadow: 'none',            label: 'Offline'   },
    unknown:  { color: 'rgba(255,255,255,0.18)', shadow: 'none', label: 'No IP' },
    checking: { color: '#f59e0b', shadow: 'none',            label: 'Checking…' },
  };
  const s = cfg[status] || cfg.unknown;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div title={s.label} style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, boxShadow: s.shadow, flexShrink: 0 }} />
    </div>
  );
}

function DeleteVMModal({ vm, onClose, onDeleted }) {
  const [reason, setReason] = useState('');
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Reason is required'); return; }
    setSaving(true); setError('');
    try {
      await api.delete(`/vms/${vm.id}`, { data: { reason: reason.trim() } });
      onDeleted();
    } catch (err) { setError(err.response?.data?.error || 'Delete failed'); setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass-modal w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-slate-100 text-lg">Delete VM</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 text-2xl leading-none">&times;</button>
        </div>
        <p className="font-mono text-sm text-slate-300">
          <span className="text-slate-100 font-semibold">{vm.vm_name}</span> will be moved to the Deleted VMs page. This action can be undone.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block font-mono text-xs text-slate-400 mb-1">Reason <span className="text-red-400">*</span></label>
            <textarea autoFocus required rows={3} className="input-base resize-none"
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Why is this VM being deleted?" />
          </div>
          {error && <p className="text-red-400 font-mono text-sm">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-danger">{saving ? 'Deleting…' : 'Delete VM'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function ActionsMenu({ vm, canWrite, onDelete }) {
  const navigate = useNavigate();
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

  const downloadRDP = async () => {
    setOpen(false);
    try {
      const response = await api.get(`/vms/${vm.id}/rdp`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url; a.download = `${vm.vm_name}.rdp`; a.click();
      window.URL.revokeObjectURL(url);
    } catch { alert('Failed to download RDP file'); }
  };

  const items = [
    { label: 'View', action: () => { navigate(`/vms/${vm.id}`); setOpen(false); } },
    ...(canWrite ? [{ label: 'Edit', action: () => { navigate(`/vms/${vm.id}/edit`); setOpen(false); } }] : []),
    ...(canWrite ? [{ label: 'Download RDP', action: downloadRDP }] : []),
    ...(canWrite ? [{ label: 'Delete', action: () => { setOpen(false); onDelete(vm); }, danger: true }] : []),
  ];

  return (
    <div onClick={e => e.stopPropagation()}>
      <button ref={btnRef} onClick={handleToggle}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100 text-lg leading-none" title="Actions">
        ⋮
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, width: '160px', background: '#12151e', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '4px 0' }}
          onMouseDown={e => e.stopPropagation()}>
          {items.map(item => (
            <button key={item.label} onClick={item.action}
              style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontFamily: 'monospace', fontSize: '12px', color: item.danger ? '#e87878' : 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; if (!item.danger) e.currentTarget.style.color = '#1d9e75'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = item.danger ? '#e87878' : 'rgba(255,255,255,0.6)'; }}>
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function VMList() {
  const navigate  = useNavigate();
  const user      = useAuthStore(s => s.user);
  const canWrite  = hasMinRole(user, 'readwrite');

  // Data
  const [vms, setVms]         = useState([]);
  const [total, setTotal]     = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [search, setSearch]           = useState('');
  const [environment, setEnvironment] = useState('');
  const [status, setStatus]           = useState('active');
  const [hypervisorId, setHypervisorId] = useState('');
  const [hypervisors, setHypervisors]   = useState([]);

  // Sort
  const [sortCol, setSortCol]     = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Connectivity
  const [reachability, setReachability]   = useState({});
  const [reachChecking, setReachChecking] = useState(false);

  // UI
  const [showImport, setShowImport]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef(null);

  // Column config (cookie-persisted)
  const [colOrder, setColOrder] = useState(() => mergeSaved(loadCols()).order);
  const [colVis,   setColVis]   = useState(() => mergeSaved(loadCols()).vis);

  // Drag
  const [dragId, setDragId]   = useState(null);
  const [dropId, setDropId]   = useState(null);
  const headerRectsRef = useRef({});

  // Persist column config to cookie
  useEffect(() => { saveCols(colOrder, colVis); }, [colOrder, colVis]);

  // Close column picker on outside click
  useEffect(() => {
    if (!showColPicker) return;
    const handler = (e) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target)) setShowColPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColPicker]);

  const fetchReachability = useCallback(async (vmList) => {
    if (!vmList.length) return;
    const ids = vmList.map(v => v.id).join(',');
    setReachability(Object.fromEntries(vmList.map(v => [String(v.id), 'checking'])));
    setReachChecking(true);
    try {
      const { data } = await api.get(`/vms/reachability?ids=${ids}`);
      setReachability(data);
    } catch {
      setReachability(Object.fromEntries(vmList.map(v => [String(v.id), 'unknown'])));
    } finally { setReachChecking(false); }
  }, []);

  useEffect(() => { api.get('/vms/hypervisors').then(r => setHypervisors(r.data)).catch(() => {}); }, []);
  useEffect(() => { loadVMs(); }, [search, environment, status, hypervisorId, sortCol, sortOrder]);

  const loadVMs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: 1, limit: 50, sort: sortCol, order: sortOrder,
        ...(search && { search }),
        ...(environment && { environment }),
        ...(status && { status }),
        ...(hypervisorId && { hypervisor_id: hypervisorId }),
      });
      const { data } = await api.get(`/vms?${params}`);
      setVms(data.data);
      setTotal(data.total);
      fetchReachability(data.data);
    } catch (err) { console.error('Failed to load VMs:', err); }
    finally { setIsLoading(false); }
  };

  const toggleSort = (col) => {
    if (!col) return;
    if (sortCol === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortOrder('asc'); }
  };

  const SortIndicator = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.2, fontSize: '10px', marginLeft: '3px' }}>↕</span>;
    return <span style={{ fontSize: '10px', marginLeft: '3px', color: '#1d9e75' }}>{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const onHeaderMouseDown = (e, colId) => {
    // reach and actions are not interactive for drag/sort
    if (colId === 'reach' || colId === 'actions') return;
    e.preventDefault();
    const startX = e.clientX;
    let dragging = false;
    let overCol  = null;

    const onMove = (mv) => {
      if (!dragging && Math.abs(mv.clientX - startX) > 5) {
        dragging = true;
        setDragId(colId);
        document.querySelectorAll('th[data-col-id]').forEach(th => {
          headerRectsRef.current[th.dataset.colId] = th.getBoundingClientRect();
        });
      }
      if (dragging) {
        let found = null;
        for (const [id, rect] of Object.entries(headerRectsRef.current)) {
          if (mv.clientX >= rect.left && mv.clientX < rect.right) { found = id; break; }
        }
        overCol = (found && found !== colId) ? found : null;
        setDropId(overCol);
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (dragging) {
        if (overCol && overCol !== colId) {
          setColOrder(prev => {
            const arr = [...prev];
            const fi = arr.indexOf(colId), ti = arr.indexOf(overCol);
            if (fi !== -1 && ti !== -1) { arr.splice(fi, 1); arr.splice(ti, 0, colId); }
            return arr;
          });
        }
      } else {
        // Click = sort
        toggleSort(COL_META_MAP[colId]?.sortKey);
      }
      setDragId(null);
      setDropId(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const exportCSV = async () => {
    try {
      const response = await api.get('/vms/export', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vmtrak-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
  };

  // ── All column definitions ─────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      id: 'reach',
      header: () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>Connectivity</span>
          <button title="Refresh" onClick={e => { e.stopPropagation(); fetchReachability(vms); }}
            disabled={reachChecking}
            style={{ background: 'none', border: 'none', cursor: reachChecking ? 'wait' : 'pointer', padding: '0 2px', color: 'rgba(255,255,255,0.35)', fontSize: '11px', lineHeight: 1 }}>↺</button>
        </div>
      ),
      cell: info => <StatusDot status={reachability[String(info.row.original.id)]} />,
    },
    {
      accessorKey: 'vm_name',
      enableHiding: false,
      header: () => <span>VM Name<SortIndicator col="vm_name" /></span>,
      cell: info => <div className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{info.getValue()}</div>,
    },
    {
      accessorKey: 'ip_address',
      header: () => <span>IP Address<SortIndicator col="ip_address" /></span>,
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'hostname',
      header: () => <span>Hostname</span>,
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'hypervisor_name',
      header: () => <span>Hypervisor</span>,
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'environment',
      header: () => <span>Environment<SortIndicator col="environment" /></span>,
      cell: info => {
        const val = info.getValue();
        const c = { production: 'bg-red-900/40 text-red-300', staging: 'bg-yellow-900/40 text-yellow-300', development: 'bg-blue-900/40 text-blue-300', test: 'bg-purple-900/40 text-purple-300' };
        return <span className={`px-2 py-1 rounded text-xs font-mono ${c[val] || 'bg-slate-700 text-slate-300'}`}>{val || '—'}</span>;
      },
    },
    {
      accessorKey: 'status',
      header: () => <span>Status<SortIndicator col="status" /></span>,
      cell: info => {
        const val = info.getValue();
        const c = { active: 'bg-emerald-900/40 text-emerald-300', inactive: 'bg-amber-900/40 text-amber-300', decommissioned: 'bg-slate-700 text-slate-400' };
        return <span className={`px-2 py-1 rounded text-xs font-mono ${c[val] || 'bg-slate-700 text-slate-300'}`}>{val || '—'}</span>;
      },
    },
    {
      accessorKey: 'power_state',
      header: () => <span>Power State<SortIndicator col="power_state" /></span>,
      cell: info => {
        const val = info.getValue();
        const c = { on: 'bg-emerald-900/40 text-emerald-300', off: 'bg-slate-700 text-slate-400', suspended: 'bg-amber-900/40 text-amber-300', unknown: 'bg-slate-700 text-slate-500' };
        return <span className={`px-2 py-1 rounded text-xs font-mono ${c[val] || 'bg-slate-700 text-slate-500'}`}>{val || '—'}</span>;
      },
    },
    {
      accessorKey: 'os_type',
      header: () => <span>OS Type</span>,
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'os_version',
      header: () => <span>OS Version</span>,
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'owner',
      header: () => <span>Owner<SortIndicator col="owner" /></span>,
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'department',
      header: () => <span>Department<SortIndicator col="department" /></span>,
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'application',
      header: () => <span>Application</span>,
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'vcpu',
      header: () => <span>vCPU</span>,
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{info.getValue() ?? '—'}</div>,
    },
    {
      accessorKey: 'ram_gb',
      header: () => <span>RAM (GB)</span>,
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{info.getValue() != null ? `${info.getValue()} GB` : '—'}</div>,
    },
    {
      accessorKey: 'disk_gb',
      header: () => <span>Disk (GB)</span>,
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{info.getValue() != null ? `${info.getValue()} GB` : '—'}</div>,
    },
    {
      accessorKey: 'expiry_date',
      header: () => <span>Expiry Date<SortIndicator col="expiry_date" /></span>,
      cell: info => {
        const val = info.getValue();
        if (!val) return <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>—</div>;
        const days = Math.ceil((new Date(val) - new Date()) / 86400000);
        const color = days < 0 ? '#ef4444' : days <= 7 ? '#f59e0b' : 'rgba(255,255,255,0.5)';
        const suffix = days < 0 ? ' (expired)' : days <= 7 ? ` (${days}d)` : '';
        return <div className="font-mono text-xs" style={{ color }}>{val}{suffix}</div>;
      },
    },
    {
      accessorKey: 'primary_username',
      header: () => <span>Username</span>,
      cell: info => <div className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'created_at',
      header: () => <span>Created<SortIndicator col="created_at" /></span>,
      cell: info => {
        const val = info.getValue();
        return <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {val ? new Date(val.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB') : '—'}
        </div>;
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      header: () => null,
      cell: info => <ActionsMenu vm={info.row.original} canWrite={canWrite} onDelete={setDeleteTarget} />,
    },
  ], [reachability, reachChecking, canWrite, vms, fetchReachability, sortCol, sortOrder]);

  const table = useReactTable({
    data: vms,
    columns,
    state: { columnOrder: colOrder, columnVisibility: colVis },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualSorting: true,
  });

  // Non-pinned columns in current order (for picker)
  const pickerCols = colOrder.filter(id => !COL_META_MAP[id]?.pinned && COL_META_MAP[id]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8', margin: 0 }}>Virtual Machines</h1>
          <p className="font-mono text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Total: {total} VMs</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Column picker */}
          <div style={{ position: 'relative' }} ref={colPickerRef}>
            <button onClick={() => setShowColPicker(p => !p)} className="btn-secondary"
              style={{ background: showColPicker ? 'rgba(255,255,255,0.1)' : undefined }}>
              Columns ▾
            </button>
            {showColPicker && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 200, width: '196px', background: '#12151e', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 6px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Columns</span>
                  <button onClick={() => { setColVis({ ...DEFAULT_VIS }); setColOrder(DEFAULT_ORDER); }}
                    style={{ fontFamily: 'monospace', fontSize: '10px', color: '#1d9e75', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Reset
                  </button>
                </div>
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {pickerCols.map(id => {
                    const meta = COL_META_MAP[id];
                    const visible = colVis[id] !== false;
                    return (
                      <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <input type="checkbox" checked={visible}
                          onChange={() => setColVis(v => ({ ...v, [id]: !visible }))}
                          style={{ accentColor: '#1d9e75', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: visible ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>
                          {meta.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button onClick={exportCSV} className="btn-secondary">↓ Export CSV</button>
          {canWrite && (
            <>
              <button onClick={() => setShowImport(true)} className="btn-secondary">↑ Import CSV</button>
              <button onClick={() => navigate('/vms/new')} className="btn-primary">+ New VM</button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">Search</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Name, IP, owner, OS, notes…" className="input-base" />
        </div>
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">Environment</label>
          <select value={environment} onChange={e => setEnvironment(e.target.value)} className="input-base">
            <option value="">All</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
            <option value="test">Test</option>
          </select>
        </div>
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input-base">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
        </div>
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">Hypervisor</label>
          <select value={hypervisorId} onChange={e => setHypervisorId(e.target.value)} className="input-base">
            <option value="">All</option>
            {hypervisors.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => { setSearch(''); setEnvironment(''); setStatus('active'); setHypervisorId(''); }}
            className="btn-secondary w-full">Reset</button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-slate-400 font-mono">Loading...</div>
      ) : (
        <div className="card-base overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(header => {
                    const colId     = header.column.id;
                    const isDragging   = dragId === colId;
                    const isDropTarget = dropId === colId;
                    const draggable    = colId !== 'reach' && colId !== 'actions';
                    return (
                      <th
                        key={header.id}
                        data-col-id={colId}
                        onMouseDown={draggable ? e => onHeaderMouseDown(e, colId) : undefined}
                        style={{
                          cursor: isDragging ? 'grabbing' : draggable ? 'grab' : 'default',
                          opacity: isDragging ? 0.45 : 1,
                          background: isDropTarget ? 'rgba(29,158,117,0.12)' : undefined,
                          borderLeft: isDropTarget ? '2px solid #1d9e75' : undefined,
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="cursor-pointer" onClick={() => navigate(`/vms/${row.original.id}`)}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {vms.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-mono text-sm">No VMs found</div>
          )}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm font-mono text-slate-400">Showing {vms.length} of {total}</div>
          <div className="flex gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="btn-secondary disabled:opacity-50">← Prev</button>
            <button onClick={() => table.nextPage()}     disabled={!table.getCanNextPage()}     className="btn-secondary disabled:opacity-50">Next →</button>
          </div>
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={loadVMs} />}
      {deleteTarget && (
        <DeleteVMModal vm={deleteTarget} onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); loadVMs(); }} />
      )}
    </div>
  );
}
