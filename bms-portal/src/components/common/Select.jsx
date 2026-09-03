import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// Custom-styled dropdown replacing raw native <select> elements app-wide -
// native selects only picked up the app's `.form-input` box styling, not a
// themed option list (unlike the app's own `.dropdown-menu`/`.dropdown-item`
// pattern already used for the profile/notification menus). Same controlled
// `value`/`onChange` contract as a native select, options as [{value, label}].
export default function Select({ value, onChange, options, placeholder = 'Select...', disabled = false, style }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        className="form-input"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.5rem', cursor: disabled ? 'default' : 'pointer', textAlign: 'left', opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ color: selected ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div className="dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, bottom: 'auto', width: 'auto', minWidth: '160px', maxHeight: '260px', overflowY: 'auto', zIndex: 60 }}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className="dropdown-item"
              role="option"
              aria-selected={String(opt.value) === String(value)}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: String(opt.value) === String(value) ? 'var(--accent-primary)' : 'var(--text-primary)' }}
            >
              <span>{opt.label}</span>
              {String(opt.value) === String(value) && <Check size={14} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
