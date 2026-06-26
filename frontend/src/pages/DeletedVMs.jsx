import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/client';

function RestoreModal({ vm, onClose, onRestored }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/vms/${vm.id}/restore`);
      onRestored();
    } catch (err) {
      setError(err.response?.data?.error || 'Restore failed');
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass-modal w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-slate-100 text-lg">Restore VM</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 text-2xl leading-none">&times;</button>
        </div>
        <p className="font-mono text-sm text-slate-300">
          Restore <span className="text-slate-100 font-semibold">{vm.vm_name}</span> back to the active VM list?
        </p>
        {error && <p className="text-red-400 font-mono text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={confirm} disabled={saving} className="btn-primary">
            {saving ? 'Restoring…' : 'Restore'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function DeletedVMs() {
  const [vms, setVms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [restoreTarget, setRestoreTarget] = useState(null);

  useEffect(() => { loadDeleted(); }, []);

  const loadDeleted = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.get('/vms/deleted');
      setVms(data);
    } catch {
      setError('Failed to load deleted VMs');
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (ts) => {
    if (!ts) return '—';
    // Backend stores ISO strings (already contain 'T' and 'Z'); SQLite datetime()
    // strings have a space separator and no 'Z'. Handle both formats.
    const iso = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8', margin: 0 }}>Deleted VMs</h1>
        <p className="font-mono text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {vms.length} deleted VM{vms.length !== 1 ? 's' : ''}
        </p>
      </div>

      {error && <div className="text-red-400 font-mono text-sm">{error}</div>}

      {isLoading ? (
        <div className="text-slate-400 font-mono">Loading...</div>
      ) : (
        <div className="card-base overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['VM Name', 'IP Address', 'Environment', 'Deleted By', 'Deleted At', 'Reason', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vms.map(vm => (
                <tr key={vm.id}>
                  <td className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{vm.vm_name}</td>
                  <td className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{vm.ip_address || '—'}</td>
                  <td>
                    {vm.environment ? (
                      <span className={`px-2 py-1 rounded text-xs font-mono ${
                        vm.environment === 'production'  ? 'bg-red-900/40 text-red-300'    :
                        vm.environment === 'staging'     ? 'bg-yellow-900/40 text-yellow-300' :
                        vm.environment === 'development' ? 'bg-blue-900/40 text-blue-300'  :
                        'bg-purple-900/40 text-purple-300'
                      }`}>{vm.environment}</span>
                    ) : <span className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
                  </td>
                  <td className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{vm.deleted_by_username || '—'}</td>
                  <td className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{fmt(vm.deleted_at)}</td>
                  <td className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.55)', maxWidth: '220px' }}>
                    <span title={vm.delete_reason} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {vm.delete_reason || '—'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => setRestoreTarget(vm)}
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vms.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-mono text-sm">No deleted VMs</div>
          )}
        </div>
      )}

      {restoreTarget && (
        <RestoreModal
          vm={restoreTarget}
          onClose={() => setRestoreTarget(null)}
          onRestored={() => { setRestoreTarget(null); loadDeleted(); }}
        />
      )}
    </div>
  );
}
