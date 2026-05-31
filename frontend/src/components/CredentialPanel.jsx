import { useState, useEffect } from 'react';
import api from '../api/client';

export default function CredentialPanel({ vmId, credentials }) {
  const [revealed, setRevealed] = useState({});
  const [timers, setTimers] = useState({});

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      Object.values(timers).forEach(timer => clearInterval(timer));
    };
  }, [timers]);

  const revealPassword = async (credId) => {
    try {
      const { data } = await api.get(`/vms/${vmId}/credentials/${credId}/reveal`);
      setRevealed(prev => ({
        ...prev,
        [credId]: data.password,
      }));

      // Start 30-second countdown
      let remaining = 30;
      const interval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(interval);
          setRevealed(prev => {
            const updated = { ...prev };
            delete updated[credId];
            return updated;
          });
          setTimers(prev => {
            const updated = { ...prev };
            delete updated[credId];
            return updated;
          });
        } else {
          setTimers(prev => ({
            ...prev,
            [credId]: remaining,
          }));
        }
      }, 1000);

      setTimers(prev => ({
        ...prev,
        [credId]: remaining,
      }));
    } catch (err) {
      alert('Failed to reveal password');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  return (
    <div className="card-base p-6">
      <h2 className="text-lg font-mono font-bold text-slate-100 mb-4">Credentials</h2>

      {credentials.length === 0 ? (
        <p className="text-slate-400 font-mono text-sm">No credentials configured for this VM.</p>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => (
            <div key={cred.id} className="space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '12px 16px' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm text-slate-100">{cred.username}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {cred.account_type && (
                      <span className="inline-block px-2 py-0.5 bg-slate-700 rounded mr-2">
                        {cred.account_type}
                      </span>
                    )}
                    {cred.notes && <span className="text-slate-400">{cred.notes}</span>}
                  </div>
                </div>

                {revealed[cred.id] ? (
                  <div className="text-right">
                    <button
                      onClick={() => copyToClipboard(revealed[cred.id])}
                      className="text-emerald-400 hover:text-emerald-300 font-mono text-xs"
                    >
                      Copy
                    </button>
                    <div className="text-xs text-red-400 mt-1">
                      Expires in {timers[cred.id]}s
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => revealPassword(cred.id)}
                    className="text-emerald-400 hover:text-emerald-300 font-mono text-xs"
                  >
                    Reveal
                  </button>
                )}
              </div>

              {revealed[cred.id] && (
                <div className="font-mono text-sm break-all" style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px 10px', color: '#e8e8e8' }}>
                  {revealed[cred.id]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
