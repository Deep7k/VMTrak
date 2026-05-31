import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import api from '../api/client';

export default function VMList() {
  const navigate = useNavigate();
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
      cell: info => <div className="font-mono text-sm">{info.getValue()}</div>,
    },
    {
      accessorKey: 'ip_address',
      header: 'IP Address',
      cell: info => <div className="font-mono text-xs text-slate-400">{info.getValue() || '—'}</div>,
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
      accessorKey: 'power_state',
      header: 'Power',
      cell: info => {
        const val = info.getValue();
        const colors = {
          on:        'bg-emerald-900/40 text-emerald-300',
          off:       'bg-slate-700 text-slate-300',
          suspended: 'bg-yellow-900/40 text-yellow-300',
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-mono ${colors[val] || 'text-slate-400'}`}>
            {val}
          </span>
        );
      },
    },
    {
      accessorKey: 'owner',
      header: 'Owner',
      cell: info => <div className="text-sm text-slate-400">{info.getValue() || '—'}</div>,
    },
    {
      accessorKey: 'id',
      header: '',
      enableSorting: false,
      cell: info => (
        <button
          onClick={() => navigate(`/vms/${info.getValue()}`)}
          className="text-emerald-400 hover:text-emerald-300 font-mono text-sm"
        >
          View →
        </button>
      ),
    },
  ], [navigate]);

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
          <h1 className="text-2xl font-mono font-bold text-slate-100">Virtual Machines</h1>
          <p className="text-slate-400 font-mono text-sm mt-1">Total: {total} VMs</p>
        </div>
        <button onClick={() => navigate('/vms/new')} className="btn-primary">
          + New VM
        </button>
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
        <div className="card-base border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 border-b border-slate-700">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left font-mono font-semibold text-slate-300 text-xs uppercase tracking-wide"
                    >
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
                  className="border-b border-slate-700 hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/vms/${row.original.id}`)}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3" onClick={e => e.stopPropagation()}>
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
