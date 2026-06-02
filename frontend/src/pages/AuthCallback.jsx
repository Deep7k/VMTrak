import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const checkAuth = useAuthStore(s => s.checkAuth);
    const [error, setError] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');

        if (!token) {
            setError('No token received. Please try again.');
            return;
        }

        localStorage.setItem('token', token);
        checkAuth().then(() => {
            navigate('/vms', { replace: true });
        }).catch(() => {
            localStorage.removeItem('token');
            setError('Failed to verify session. Please try again.');
        });
    }, []);

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-full max-w-md p-8 space-y-4 text-center">
                    <p className="font-mono text-sm text-red-400">{error}</p>
                    <button onClick={() => navigate('/login')}
                        className="font-mono text-sm text-emerald-400 hover:text-emerald-300">
                        ← Back to login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <p className="font-mono text-sm text-slate-400">Signing in...</p>
        </div>
    );
}
