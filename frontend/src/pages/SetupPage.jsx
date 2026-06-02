import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function SetupPage() {
    const navigate = useNavigate();
    const refreshUser = useAuthStore(s => s.refreshUser);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/auth/complete-setup', { email, password });
            await refreshUser();
            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || 'Setup failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-full max-w-md p-8 space-y-8">
                <div className="space-y-2">
                    <h1 className="text-3xl font-mono font-bold text-slate-100">
                        VMTrak
                    </h1>
                    <p className="font-mono text-slate-400 text-sm">
                        Initial account setup
                    </p>
                </div>

                <div className="p-4 bg-amber-900/20 border border-amber-700 rounded font-mono text-sm text-amber-300">
                    You are using the default admin account. Set a real email address and a
                    strong password before continuing.
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block font-mono text-sm text-slate-300 mb-2">
                            Email address
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            className="input-base"
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block font-mono text-sm text-slate-300 mb-2">
                            New password <span className="text-slate-500">(min 8 characters)</span>
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="input-base pr-10"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                                tabIndex={-1}
                            >
                                <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`} />
                            </button>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="confirm" className="block font-mono text-sm text-slate-300 mb-2">
                            Confirm new password
                        </label>
                        <input
                            id="confirm"
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="••••••••"
                            className="input-base"
                            disabled={isLoading}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/20 border border-red-700 rounded font-mono text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Saving...' : 'Complete setup'}
                    </button>
                </form>
            </div>
        </div>
    );
}
