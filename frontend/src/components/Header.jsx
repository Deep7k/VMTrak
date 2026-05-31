import { useAuth } from '../hooks/useAuth';

export default function Header({ onMenuClick }) {
    const { user, logout } = useAuth();

    return (
        <header className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <button
                    onClick={onMenuClick}
                    className="p-2 hover:bg-slate-800 rounded font-mono text-slate-400 hover:text-slate-200 transition-colors"
                >
                    ☰
                </button>
                <div className="font-mono text-slate-300 text-sm">
                    VMTrak
                    <span className="text-slate-500 ml-2">v0.1</span>
                </div>
            </div>

            <div className="flex items-center space-x-6">
                <div className="font-mono text-sm text-slate-400">
                    {user?.email}
                </div>
                <button
                    onClick={logout}
                    className="btn-secondary"
                >
                    Logout
                </button>
            </div>
        </header>
    );
}
