import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

// Custom-styled dropdown replacing raw native <select> elements app-wide -
// native selects only picked up the app's `.form-input` box styling, not a
// themed option list (unlike the app's own `.dropdown-menu`/`.dropdown-item`
// pattern already used for the profile/notification menus). Same controlled
// `value`/`onChange` contract as a native select, options as [{value, label}].
//
// The option menu is rendered through a portal into document.body rather
// than as a normal `position: absolute` child - this component gets used
// inside scrollable table cells (User Management's per-row device-assign
// select, Device Registry's forms, etc.), and any ancestor with
// `overflow: hidden`/`auto` between the trigger and this menu clips or
// forces its own scrollbar onto an absolutely-positioned descendant
// regardless of z-index. A portal escapes that clipping entirely; its
// position is then tracked against the trigger's own bounding rect instead
// of relying on normal document flow.
export default function Select({ value, onChange, options, placeholder = 'Select...', disabled = false, style }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null); // { top, left, width } in viewport (fixed) coordinates
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      const insideTrigger = wrapperRef.current && wrapperRef.current.contains(e.target);
      const insideMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!insideTrigger && !insideMenu) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recompute the menu's position against the trigger whenever it opens, and
  // keep tracking it while open - a portal no longer moves with the trigger
  // via normal layout, so a scroll/resize of any ancestor needs to reposition
  // it explicitly (capture:true so this catches scroll on any container, not
  // just window).
  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return;
    const updatePosition = () => {
      const rect = wrapperRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <div ref={wrapperRef} style={{ position: 'relative', ...style }}>
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

      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          className="dropdown-menu"
          style={{
            position: 'fixed', top: menuPos.top, left: menuPos.left,
            width: 'auto', minWidth: Math.max(menuPos.width, 160), maxHeight: '260px', overflowY: 'auto', zIndex: 1000,
          }}
        >
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
        </div>,
        document.body
      )}
    </div>
  );
}
