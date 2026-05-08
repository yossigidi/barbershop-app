import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Reusable accessible modal — IS 5568 / WCAG 2.1 AA dialog pattern.
// - role=dialog + aria-modal + aria-labelledby
// - Escape closes
// - Focus moves to first focusable element on open
// - Focus returns to the element that opened the modal on close
// - Click outside (backdrop) closes (configurable)
// - Tab/Shift+Tab trapped inside the dialog
//
// Usage:
//   <AccessibleModal open={show} onClose={() => setShow(false)} titleId="foo-title">
//     <h2 id="foo-title">…</h2>
//     <p>…</p>
//     <button>אישור</button>
//   </AccessibleModal>

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function AccessibleModal({
  open, onClose, titleId, children,
  className = '', closeOnBackdrop = true, maxWidth,
  showCloseButton = true,
}) {
  const dialogRef = useRef(null);
  const previousActiveRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    // Remember what had focus before we opened so we can restore it later.
    previousActiveRef.current = document.activeElement;

    // Focus first interactive element inside the dialog. Defer one tick so the
    // dialog DOM is mounted and any autofocus inside has a chance to set first.
    const t = setTimeout(() => {
      if (!dialogRef.current) return;
      const auto = dialogRef.current.querySelector('[autofocus], [data-autofocus]');
      if (auto) { auto.focus(); return; }
      const first = dialogRef.current.querySelector(FOCUSABLE);
      first?.focus();
    }, 0);

    // Keyboard: Escape closes; Tab / Shift+Tab is trapped within the dialog.
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return; }
      if (e.key !== 'Tab') return;
      if (!dialogRef.current) return;
      const focusables = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE))
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (focusables.length === 0) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', onKey);

    // Lock background scroll while the modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Return focus to the trigger that opened the modal (if it still exists)
      const prev = previousActiveRef.current;
      if (prev && typeof prev.focus === 'function' && document.body.contains(prev)) {
        prev.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal ${className}`}
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        lang="he"
      >
        {showCloseButton && (
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="סגור"
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
