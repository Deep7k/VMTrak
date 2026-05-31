import { Link } from 'react-router-dom';

const menuItems = [
  { label: 'Dashboard', icon: '⊞', path: '/dashboard' },
  { label: 'VMs', icon: '◼', path: '/vms' },
  { label: 'Credentials', icon: '◆', path: '/credentials' },
  { label: 'Users', icon: '⊙', path: '/users' },
  { label: 'Audit Log', icon: '⊕', path: '/audit' },
];

export default function Sidebar({ open }) {
  return (
    <div
      className={`${
        open ? 'w-64' : 'w-0'
      } transition-all duration-200 bg-slate-900 border-r border-slate-700 overflow-hidden flex flex-col`}
    >
      <div className="flex-1 pt-8 pb-4">
        <nav className="space-y-1 px-4">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center space-x-3 px-4 py-3 rounded font-mono text-sm text-slate-300 hover:bg-slate-800 hover:text-emerald-400 transition-colors"
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-700">
        <div className="text-xs font-mono text-slate-500 space-y-1">
          <div>v0.1.0</div>
          <div>Status: ✓ online</div>
        </div>
      </div>
    </div>
  );
}
