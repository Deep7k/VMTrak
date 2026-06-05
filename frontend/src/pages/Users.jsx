import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/client';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass-modal space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-slate-100 text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 text-2xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
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

const ROLE_LABEL = { admin: 'Admin', readwrite: 'Read/Write', read: 'Read' };

function RoleBadge({ role }) {
  const cls = role === 'admin'
    ? 'bg-amber-900/40 text-amber-300'
    : role === 'readwrite'
      ? 'bg-blue-900/40 text-blue-300'
      : 'bg-slate-700 text-slate-300';
  return <span className={`px-2 py-1 rounded text-xs font-mono ${cls}`}>{ROLE_LABEL[role] ?? role}</span>;
}

function ActiveBadge({ active }) {
  return active
    ? <span className="px-2 py-1 rounded text-xs font-mono bg-emerald-900/40 text-emerald-300">active</span>
    : <span className="px-2 py-1 rounded text-xs font-mono bg-slate-700 text-slate-400">inactive</span>;
}

function NotifyToggle({ userId, enabled, onChange }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await api.put(`/users/${userId}`, { notify_expiry: !enabled });
      onChange();
    } catch {
      // silently fail — parent will reload
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={enabled ? 'Notifications on — click to disable' : 'Notifications off — click to enable'}
      style={{
        position: 'relative',
        width: '36px',
        height: '20px',
        borderRadius: '10px',
        border: 'none',
        cursor: busy ? 'wait' : 'pointer',
        background: enabled ? '#1d9e75' : 'rgba(255,255,255,0.12)',
        transition: 'background 0.2s',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: '3px',
        left: enabled ? '19px' : '3px',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'readwrite', department: '', notify_expiry: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/users', form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
      setSaving(false);
    }
  };

  return (
    <Modal title="New User" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username">
          <input required autoFocus className="input-base" value={form.username} onChange={set('username')} />
        </Field>
        <Field label="Email">
          <input required type="email" className="input-base" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password">
          <input required type="password" className="input-base" value={form.password} minLength={8}
            onChange={set('password')} placeholder="Min 8 characters" />
        </Field>
        <Field label="Role">
          <select className="input-base" value={form.role} onChange={set('role')}>
            <option value="read">Read</option>
            <option value="readwrite">Read/Write</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Department">
          <input className="input-base" value={form.department} onChange={set('department')}
            placeholder="e.g. IT Infrastructure" />
        </Field>
        <Field label="Expiry Notifications">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" checked={form.notify_expiry}
              onChange={e => setForm(f => ({ ...f, notify_expiry: e.target.checked }))}
              className="w-4 h-4 accent-emerald-500" />
            <span className="font-mono text-sm text-slate-300">Send VM expiry alerts to this user</span>
          </label>
        </Field>
        {error && <p className="text-red-400 font-mono text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    email:         user.email,
    role:          user.role,
    department:    user.department || '',
    is_active:     !!user.is_active,
    notify_expiry: !!user.notify_expiry,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(`/users/${user.id}`, form);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit — ${user.username}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input required type="email" className="input-base" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label="Role">
          <select className="input-base" value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="read">Read</option>
            <option value="readwrite">Read/Write</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Department">
          <input className="input-base" value={form.department}
            onChange={e => setForm(f => ({ ...f, department: e.target.value || null }))}
            placeholder="e.g. IT Infrastructure" />
        </Field>
        <Field label="Active">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 accent-emerald-500" />
            <span className="font-mono text-sm text-slate-300">User is active</span>
          </label>
        </Field>
        <Field label="Expiry Notifications">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" checked={form.notify_expiry}
              onChange={e => setForm(f => ({ ...f, notify_expiry: e.target.checked }))}
              className="w-4 h-4 accent-emerald-500" />
            <span className="font-mono text-sm text-slate-300">Send VM expiry alerts to this user</span>
          </label>
        </Field>
        {error && <p className="text-red-400 font-mono text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/users/${user.id}/reset-password`, { new_password: password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Reset Password — ${user.username}`} onClose={onClose}>
      {done ? (
        <div className="space-y-4">
          <p className="text-emerald-400 font-mono text-sm">Password reset successfully.</p>
          <div className="flex justify-end">
            <button onClick={onClose} className="btn-primary">Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New Password">
            <input required autoFocus type="password" className="input-base" value={password} minLength={8}
              onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" />
          </Field>
          {error && <p className="text-red-400 font-mono text-sm">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ConfirmDeactivate({ user, onClose, onConfirmed }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setSaving(true);
    setError('');
    try {
      await api.delete(`/users/${user.id}`);
      onConfirmed();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deactivate user');
      setSaving(false);
    }
  };

  return (
    <Modal title="Confirm Deactivation" onClose={onClose}>
      <p className="font-mono text-sm text-slate-300">
        Deactivate <span className="text-slate-100 font-semibold">{user.username}</span>?
        They will no longer be able to log in and all their sessions will be revoked.
      </p>
      {error && <p className="text-red-400 font-mono text-sm">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={confirm} disabled={saving} className="btn-danger">
          {saving ? 'Deactivating…' : 'Deactivate'}
        </button>
      </div>
    </Modal>
  );
}

function ActionsMenu({ user, onEdit, onReset, onDeactivate }) {
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
    { label: 'Edit',       action: () => { setOpen(false); onEdit(user); } },
    { label: 'Reset PW',   action: () => { setOpen(false); onReset(user); } },
    ...(user.is_active ? [{ label: 'Deactivate', action: () => { setOpen(false); onDeactivate(user); }, danger: true }] : []),
  ];

  return (
    <div onClick={e => e.stopPropagation()}>
      <button ref={btnRef} onClick={handleToggle}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100 text-lg leading-none"
        title="Actions">⋮</button>
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
            >{item.label}</button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch {
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8', margin: 0 }}>Users</h1>
          <p className="font-mono text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{users.length} users</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ New User</button>
      </div>

      {error && <div className="text-red-400 font-mono text-sm">{error}</div>}

      {isLoading ? (
        <div className="text-slate-400 font-mono">Loading...</div>
      ) : (
        <div className="card-base overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Username', 'Email', 'Role', 'Department', 'Status', 'Notifications', 'Created', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{u.username}</td>
                  <td className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{u.email}</td>
                  <td><RoleBadge role={u.role} /></td>
                  <td className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{u.department || '—'}</td>
                  <td><ActiveBadge active={u.is_active} /></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <NotifyToggle userId={u.id} enabled={!!u.notify_expiry} onChange={loadUsers} />
                      <span className="font-mono text-xs" style={{ color: u.notify_expiry ? '#1d9e75' : 'rgba(255,255,255,0.25)' }}>
                        {u.notify_expiry ? 'on' : 'off'}
                      </span>
                    </div>
                  </td>
                  <td className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {u.created_at ? new Date(u.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td>
                    <ActionsMenu
                      user={u}
                      onEdit={setEditTarget}
                      onReset={setResetTarget}
                      onDeactivate={setDeactivateTarget}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-mono text-sm">No users found</div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadUsers(); }}
        />
      )}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadUsers(); }}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
      {deactivateTarget && (
        <ConfirmDeactivate
          user={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onConfirmed={() => { setDeactivateTarget(null); loadUsers(); }}
        />
      )}
    </div>
  );
}
