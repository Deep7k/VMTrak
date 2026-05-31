import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import api from '../api/client';

function ActionsMenu({ vm, isAdmin }) {
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
    ...(isAdmin ? [{ label: 'Edit', action: () => { navigate(`/vms/${vm.id}/edit`); setOpen(false); } }] : []),
    { label: 'Download RDP', action: () => downloadRDP() },
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
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
  const [vms, setVms] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [environment, setEnvironment] = useState('');
  const [status, setStatus] = useState('active');

  const columns = useMemo(() => [
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
      accessorKey: 'primary_username',
      header: 'Username',
      cell: info => <div className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{info.getValue() || '—'}</div>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: info => <ActionsMenu vm={info.row.original} isAdmin={isAdmin} />,
    },
  ], []);

  useEffect(() => {
    loadVMs();
  }, [search, environment, status]);

  const loadVMs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: 1,
        limit: 50,
        ...(search && { search }),
        ...(environment && { environment }),
        ...(status && { status }),
      });
      const { data } = await api.get(`/vms?${params}`);
      setVms(data.data);
      setTotal(data.total);
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
        {isAdmin && (
          <button onClick={() => navigate('/vms/new')} className="btn-primary">
            + New VM
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <option value="maintenance">Maintenance</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => { setSearch(''); setEnvironment(''); setStatus('active'); }}
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
    </div>
  );
}
