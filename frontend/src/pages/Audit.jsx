import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'vm.create',          label: 'vm.create' },
  { value: 'vm.update',          label: 'vm.update' },
  { value: 'vm.delete',          label: 'vm.delete' },
  { value: 'vm.view',            label: 'vm.view' },
  { value: 'rdp.download',       label: 'rdp.download' },
  { value: 'credential.create',  label: 'credential.create' },
  { value: 'credential.update',  label: 'credential.update' },
  { value: 'credential.delete',  label: 'credential.delete' },
  { value: 'credential.view',    label: 'credential.view' },
  { value: 'user.create',        label: 'user.create' },
  { value: 'user.update',        label: 'user.update' },
  { value: 'user.deactivate',    label: 'user.deactivate' },
  { value: 'user.password_reset', label: 'user.password_reset' },
  { value: 'auth.login',         label: 'auth.login' },
  { value: 'auth.logout',        label: 'auth.logout' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'vm',         label: 'VM' },
  { value: 'credential', label: 'Credential' },
  { value: 'user',       label: 'User' },
  { value: 'auth',       label: 'Auth' },
];

function ActionBadge({ action }) {
  const color =
    action.endsWith('.delete') || action.endsWith('.deactivate')
      ? 'bg-red-900/40 text-red-300'
      : action.endsWith('.create')
        ? 'bg-emerald-900/40 text-emerald-300'
        : action.endsWith('.update') || action.endsWith('.password_reset')
          ? 'bg-amber-900/40 text-amber-300'
          : 'bg-slate-700 text-slate-300';
  return <span className={`px-2 py-0.5 rounded text-xs font-mono ${color}`}>{action}</span>;
}

function DetailView({ detail }) {
  if (!detail) return <span className="text-slate-500 text-xs font-mono">—</span>;

  let parsed;
  try {
    parsed = typeof detail === 'string' ? JSON.parse(detail) : detail;
  } catch {
    return <span className="font-mono text-xs text-slate-400">{String(detail)}</span>;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return <span className="font-mono text-xs text-slate-400">{String(parsed)}</span>;
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) return <span className="text-slate-500 text-xs font-mono">—</span>;

  return (
    <div className="mt-3 ml-2 space-y-1">
      {entries.map(([field, val]) => {
        if (val && typeof val === 'object' && 'from' in val && 'to' in val) {
          return (
            <div key={field} className="font-mono text-xs flex gap-2 items-start">
              <span className="text-slate-400 min-w-[120px]">{field}</span>
              <span className="text-red-400 line-through">{String(val.from ?? '—')}</span>
              <span className="text-slate-500">→</span>
              <span className="text-emerald-400">{String(val.to ?? '—')}</span>
            </div>
          );
        }
        return (
          <div key={field} className="font-mono text-xs flex gap-2">
            <span className="text-slate-400 min-w-[120px]">{field}</span>
            <span className="text-slate-300">{String(val ?? '—')}</span>
          </div>
        );
      })}
    </div>
  );
}

function AuditRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = entry.detail && entry.detail !== '{}' && entry.detail !== 'null';

  return (
    <>
      <tr
        className={hasDetail ? 'cursor-pointer' : ''}
        onClick={() => hasDetail && setExpanded(e => !e)}
      >
        <td className="font-mono text-xs whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {entry.created_at?.replace('T', ' ').slice(0, 19)}
        </td>
        <td className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{entry.username || '—'}</td>
        <td><ActionBadge action={entry.action} /></td>
        <td className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {entry.entity_type && <span style={{ color: 'rgba(255,255,255,0.3)' }}>{entry.entity_type} </span>}
          {entry.entity_name}
        </td>
        <td className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{entry.ip_address || '—'}</td>
        <td className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {hasDetail && (
            <span className="font-mono">{expanded ? '▲ hide' : '▼ detail'}</span>
          )}
        </td>
      </tr>
      {expanded && hasDetail && (
        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
          <td colSpan={6} className="px-6 pb-3 pt-1">
            <DetailView detail={entry.detail} />
          </td>
        </tr>
      )}
    </>
  );
}

const LIMIT = 50;

export default function AuditPage() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    entity_type: '',
    from: '',
    to: '',
  });

  useEffect(() => {
    api.get('/users').then(({ data }) => setUsers(data)).catch(() => {});
  }, []);

  const load = useCallback(async (pg, f) => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: pg, limit: LIMIT });
      if (f.user_id)     params.set('user_id', f.user_id);
      if (f.action)      params.set('action', f.action);
      if (f.entity_type) params.set('entity_type', f.entity_type);
      if (f.from)        params.set('from', f.from);
      if (f.to)          params.set('to', f.to + 'T23:59:59');
      const { data } = await api.get(`/audit?${params}`);
      setEntries(data.data);
      setTotal(data.total);
    } catch {
      setError('Failed to load audit log');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(page, filters); }, [page, filters, load]);

  const applyFilter = (field) => (e) => {
    setPage(1);
    setFilters(f => ({ ...f, [field]: e.target.value }));
  };

  const resetFilters = () => {
    setPage(1);
    setFilters({ user_id: '', action: '', entity_type: '', from: '', to: '' });
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8', margin: 0 }}>Audit Log</h1>
        <p className="font-mono text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{total} events</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">User</label>
          <select value={filters.user_id} onChange={applyFilter('user_id')} className="input-base">
            <option value="">All Users</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">Action</label>
          <select value={filters.action} onChange={applyFilter('action')} className="input-base">
            {ACTION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">Entity Type</label>
          <select value={filters.entity_type} onChange={applyFilter('entity_type')} className="input-base">
            {ENTITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">From</label>
          <input type="date" value={filters.from} onChange={applyFilter('from')} className="input-base" />
        </div>
        <div>
          <label className="block font-mono text-xs text-slate-400 mb-2">To</label>
          <input type="date" value={filters.to} onChange={applyFilter('to')} className="input-base" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={resetFilters} className="btn-secondary">Reset Filters</button>
        {(filters.user_id || filters.action || filters.entity_type || filters.from || filters.to) && (
          <span className="font-mono text-xs text-slate-400">Filters active</span>
        )}
      </div>

      {error && <div className="text-red-400 font-mono text-sm">{error}</div>}

      {isLoading ? (
        <div className="text-slate-400 font-mono">Loading...</div>
      ) : (
        <div className="card-base overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Timestamp', 'User', 'Action', 'Entity', 'IP Address', ''].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-mono text-sm">No events found</div>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm font-mono text-slate-400">
            Page {page} of {totalPages} — {total} events
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-secondary disabled:opacity-50"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
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
