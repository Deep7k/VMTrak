import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(username, password);
            navigate('/vms');
        } catch (err) {
            setError(err.message || 'Login failed. Check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-full max-w-md p-8 space-y-8">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-mono font-bold text-slate-100">
                        VMTrak
                    </h1>
                    <p className="font-mono text-slate-400 text-sm">
                        Infrastructure Management Control System
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Username */}
                    <div>
                        <label htmlFor="username" className="block font-mono text-sm text-slate-300 mb-2">
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="admin"
                            className="input-base"
                            disabled={isLoading}
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label htmlFor="password" className="block font-mono text-sm text-slate-300 mb-2">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="input-base"
                            disabled={isLoading}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-900/20 border border-red-700 rounded font-mono text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                {/* Footer */}
                <div className="pt-4 border-t border-slate-700">
                    <p className="font-mono text-xs text-slate-500 text-center">
                        Secure Infrastructure Management
                    </p>
                </div>
            </div>
        </div>
    );
}
