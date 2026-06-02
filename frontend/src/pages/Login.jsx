import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function MicrosoftLogo() {
    return (
        <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
            <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
        </svg>
    );
}

const MS_ERRORS = {
    not_found:   null, // handled separately with admin email
    auth_failed: 'Microsoft authentication failed. Please try again.',
    no_email:    'Could not retrieve your email from Microsoft. Contact your administrator.',
};

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();

    // Handle errors redirected back from the Microsoft callback
    const msError = searchParams.get('ms_error');
    const msAdmin = searchParams.get('ms_admin');
    const msErrorMessage = msError === 'not_found'
        ? `Your Microsoft account is not registered in VMTrak. Contact ${msAdmin || 'your administrator'}.`
        : MS_ERRORS[msError] || null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const data = await login(username, password);
            navigate(data.user?.must_change_password ? '/setup' : '/vms', { replace: true });
        } catch (err) {
            setError(err.message || 'Login failed. Check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMicrosoft = () => {
        window.location.href = '/api/auth/microsoft';
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-full max-w-md p-8 space-y-8">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-mono font-bold text-slate-100">VMTrak</h1>
                    <p className="font-mono text-slate-400 text-sm">Infrastructure Management Control System</p>
                </div>

                {/* Microsoft error (from redirect) */}
                {msErrorMessage && (
                    <div className="p-3 bg-amber-900/20 border border-amber-700 rounded font-mono text-sm text-amber-300">
                        {msErrorMessage}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="username" className="block font-mono text-sm text-slate-300 mb-2">Username</label>
                        <input
                            id="username" type="text" required
                            value={username} onChange={(e) => setUsername(e.target.value)}
                            placeholder="admin" className="input-base" disabled={isLoading}
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block font-mono text-sm text-slate-300 mb-2">Password</label>
                        <input
                            id="password" type="password" required
                            value={password} onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••" className="input-base" disabled={isLoading}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/20 border border-red-700 rounded font-mono text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    <button type="submit" disabled={isLoading}
                        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                {/* Microsoft SSO */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-slate-700" />
                        <span className="font-mono text-xs text-slate-500">or</span>
                        <div className="flex-1 h-px bg-slate-700" />
                    </div>

                    <button
                        onClick={handleMicrosoft}
                        type="button"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            width: '100%',
                            padding: '10px 16px',
                            background: '#ffffff',
                            border: '1px solid #8c8c8c',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontFamily: '"Segoe UI", Arial, sans-serif',
                            fontSize: '15px',
                            fontWeight: 600,
                            color: '#5e5e5e',
                            letterSpacing: '0.01em',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f3f3f3'}
                        onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                    >
                        <MicrosoftLogo />
                        Sign in with Microsoft
                    </button>
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-slate-700">
                    <p className="font-mono text-xs text-slate-500 text-center">Secure Infrastructure Management</p>
                </div>
            </div>
        </div>
    );
}
