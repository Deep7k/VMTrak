import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { hasMinRole } from '../components/Guards';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import api from '../api/client';

// Columns match the VM Create form fields, in section order
const CSV_COLUMNS = [
  'vm_name', 'hostname',
  'ip_address',
  'hypervisor',
  'os_type', 'os_version',
  'vcpu', 'ram_gb', 'disk_gb',
  'environment', 'owner', 'department', 'application',
  'expiry_date',
  'description',
];

function downloadTemplate() {
  const blob = new Blob([CSV_COLUMNS.join(',') + '\n'], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'vmtrak-import-template.csv'; a.click();
  URL.revokeObjectURL(url);
}

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
      const { data } = await api.post('/vms/import', text, {
        headers: { 'Content-Type': 'text/csv' },
      });
      setResult(data);
      if (data.imported > 0) onImported();
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError('');
  };

  const allFailed = result && result.imported === 0 && result.skipped > 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-modal w-full max-w-lg space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-slate-100">Import VMs from CSV</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none">✕</button>
        </div>

        {/* Template download */}
        <div className="p-3 rounded font-mono text-xs text-slate-400" style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
          <p className="mb-2">Only <span className="text-slate-200">vm_name</span> is required. All other columns are optional.</p>
          <button onClick={downloadTemplate} className="text-emerald-400 hover:text-emerald-300">
            ↓ Download template CSV
          </button>
        </div>

        {/* File picker */}
        {!result && (
          <div>
            <label className="block font-mono text-xs text-slate-400 mb-2">CSV file</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={e => { setFile(e.target.files[0] || null); setError(''); }}
              className="input-base"
              style={{ paddingTop: '5px' }}
            />
          </div>
        )}

        {error && (
          <p className="font-mono text-xs text-red-400">{error}</p>
        )}

        {/* Result summary */}
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
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs text-slate-500 uppercase tracking-wide">
                    {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped
                  </p>
                </div>
                <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '220px' }}>
                  {result.errors.map((e, i) => (
                    <div key={i} className="font-mono text-xs p-2 rounded" style={{ background: 'rgba(226,75,74,0.08)', border: '0.5px solid rgba(226,75,74,0.2)' }}>
                      <span className="text-slate-400">Row {e.row}</span>
                      {e.vm_name && <span className="text-slate-300"> · {e.vm_name}</span>}
                      <span className="text-red-300"> — {e.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={onClose} className="btn-secondary">Close</button>
          {result ? (
            <button onClick={handleReset} className="btn-primary">
              Import another file
            </button>
          ) : (
            <button onClick={handleUpload} disabled={loading || !file} className="btn-primary disabled:opacity-50">
              {loading ? 'Importing...' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function StatusDot({ status }) {
  const cfg = {
    online:   { color: '#22c55e', shadow: '0 0 6px #22c55e', label: 'Online'     },
    offline:  { color: '#ef4444', shadow: 'none',            label: 'Offline'    },
    unknown:  { color: 'rgba(255,255,255,0.18)', shadow: 'none', label: 'No IP'  },
    checking: { color: '#f59e0b', shadow: 'none',            label: 'Checking…'  },
  };
  const s = cfg[status] || cfg.unknown;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        title={s.label}
        style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, boxShadow: s.shadow, flexShrink: 0 }}
      />
    </div>
  );
}

function ActionsMenu({ vm, canWrite }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
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
      a.href = url;
      a.download = `${vm.vm_name}.rdp`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download RDP file');
    }
  };

  const menuItems = [
    { label: 'View',         action: () => { navigate(`/vms/${vm.id}`);     setOpen(false); } },
    ...(canWrite ? [{ label: 'Edit', action: () => { navigate(`/vms/${vm.id}/edit`); setOpen(false); } }] : []),
    ...(canWrite ? [{ label: 'Download RDP', action: () => downloadRDP() }] : []),
  ];

  return (
    <div onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100 text-lg leading-none"
        title="Actions"
      >
        ⋮
      </button>
      {open && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, width: '160px', background: '#12151e', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '4px 0' }}
          onMouseDown={e => e.stopPropagation()}
        >
          {menuItems.map(item => (
            <button
              key={item.label}
              onClick={item.action}
              style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontFamily: 'monospace', fontSize: '12px', color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#1d9e75'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
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

export default function VMList() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const canWrite = hasMinRole(user, 'readwrite');
  const [vms, setVms] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [environment, setEnvironment] = useState('');
  const [status, setStatus] = useState('active');
  const [showImport, setShowImport] = useState(false);
  const [reachability, setReachability] = useState({});
  const [reachChecking, setReachChecking] = useState(false);
  const [hypervisorId, setHypervisorId] = useState('');
  const [hypervisors, setHypervisors]   = useState([]);

  const fetchReachability = useCallback(async (vmList) => {
    if (!vmList.length) return;
    const ids = vmList.map(v => v.id).join(',');
    // Immediately mark all as "checking"
    setReachability(Object.fromEntries(vmList.map(v => [String(v.id), 'checking'])));
    setReachChecking(true);
    try {
      const { data } = await api.get(`/vms/reachability?ids=${ids}`);
      setReachability(data);
    } catch {
      setReachability(Object.fromEntries(vmList.map(v => [String(v.id), 'unknown'])));
    } finally {
      setReachChecking(false);
    }
  }, []);

  const columns = useMemo(() => [
    {
      id: 'reach',
      header: () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Power State</span>
          <button
            title="Refresh connectivity"
            onClick={e => { e.stopPropagation(); fetchReachability(vms); }}
            disabled={reachChecking}
            style={{ background: 'none', border: 'none', cursor: reachChecking ? 'wait' : 'pointer', padding: '0 2px', color: 'rgba(255,255,255,0.35)', fontSize: '11px', lineHeight: 1 }}
          >↺</button>
        </div>
      ),
      enableSorting: false,
      cell: info => <StatusDot status={reachability[String(info.row.original.id)]} />,
    },
    {
      accessorKey: 'vm_name',
      header: 'VM Name',
      cell: info => <div className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{info.getValue()}</div>,
    },
    {
      accessorKey: 'ip_address',
      header: 'IP Address',
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'hypervisor_name',
      header: 'Hypervisor',
      cell: info => <div className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'environment',
      header: 'Environment',
      cell: info => {
        const val = info.getValue();
        const colors = {
          production:  'bg-red-900/40 text-red-300',
          staging:     'bg-yellow-900/40 text-yellow-300',
          development: 'bg-blue-900/40 text-blue-300',
          test:        'bg-purple-900/40 text-purple-300',
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-mono ${colors[val] || 'bg-slate-700 text-slate-300'}`}>
            {val || '—'}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: info => {
        const val = info.getValue();
        const colors = {
          active:          'bg-emerald-900/40 text-emerald-300',
          inactive:        'bg-amber-900/40 text-amber-300',
          decommissioned:  'bg-slate-700 text-slate-400',
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-mono ${colors[val] || 'bg-slate-700 text-slate-300'}`}>
            {val || '—'}
          </span>
        );
      },
    },
    {
      accessorKey: 'primary_username',
      header: 'Username',
      cell: info => <div className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{info.getValue() || '—'}</div>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: info => <ActionsMenu vm={info.row.original} canWrite={canWrite} />,
    },
  ], [reachability, reachChecking, canWrite, vms, fetchReachability]);

  useEffect(() => {
    api.get('/vms/hypervisors').then(r => setHypervisors(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadVMs();
  }, [search, environment, status, hypervisorId]);

  const loadVMs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: 1,
        limit: 50,
        ...(search && { search }),
        ...(environment && { environment }),
        ...(status && { status }),
        ...(hypervisorId && { hypervisor_id: hypervisorId }),
      });
      const { data } = await api.get(`/vms?${params}`);
      setVms(data.data);
      setTotal(data.total);
      fetchReachability(data.data);
    } catch (err) {
      console.error('Failed to load VMs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const table = useReactTable({
    data: vms,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8', margin: 0 }}>Virtual Machines</h1>
          <p className="font-mono text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Total: {total} VMs</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="btn-secondary">
              ↑ Import CSV
            </button>
            <button onClick={() => navigate('/vms/new')} className="btn-primary">
              + New VM
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="VM name, IP, hostname..."
            className="input-base"
          />
        </div>
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">Environment</label>
          <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className="input-base">
            <option value="">All</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
            <option value="test">Test</option>
          </select>
        </div>
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-base">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
        </div>
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">Hypervisor</label>
          <select value={hypervisorId} onChange={(e) => setHypervisorId(e.target.value)} className="input-base">
            <option value="">All</option>
            {hypervisors.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => { setSearch(''); setEnvironment(''); setStatus('active'); setHypervisorId(''); }}
            className="btn-secondary w-full"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-slate-400 font-mono">Loading...</div>
      ) : (
        <div className="card-base overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/vms/${row.original.id}`)}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
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
          <div className="text-sm font-mono text-slate-400">
            Showing {vms.length} of {total}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="btn-secondary disabled:opacity-50"
            >
              ← Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="btn-secondary disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={loadVMs}
        />
      )}
    </div>
  );
}
