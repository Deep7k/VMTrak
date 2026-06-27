import { useEffect, useRef, useState } from 'react';

// Autocomplete input — shows suggestions from existing VM data as the user types.
// Props mirror a regular <input>: name, value, onChange, placeholder, disabled.
// suggestions: string[]
export default function Autocomplete({ name, value, onChange, suggestions = [], placeholder, disabled }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState(value || '');
  const containerRef      = useRef(null);

  // Keep local query in sync if parent resets the form
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const filtered = suggestions
    .filter(s => !query || s.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  const handleChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    onChange(e);
  };

  const select = (val) => {
    setQuery(val);
    setOpen(false);
    // Synthesise a change event so the parent's handleChange works unchanged
    onChange({ target: { name, value: val } });
  };

  const showDropdown = open && filtered.length > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        name={name}
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="input-base"
      />
      {showDropdown && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 200,
          background: '#0D1119',
          border: '1px solid #22304A',
          borderRadius: '4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          overflowY: 'auto',
          maxHeight: '200px',
        }}>
          {filtered.map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={() => select(s)}
              style={{
                width: '100%', textAlign: 'left', padding: '7px 12px',
                fontFamily: '"IBM Plex Mono", monospace', fontSize: '12px',
                color: '#596B88', background: 'none',
                border: 'none', cursor: 'pointer', display: 'block',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#131A27'; e.currentTarget.style.color = '#C8D3E8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#596B88'; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
