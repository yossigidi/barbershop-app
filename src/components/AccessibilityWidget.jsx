import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Accessibility, X, RotateCcw, Link2, Contrast, Type, AlignJustify,
  Heading, MousePointer2, MousePointerClick, Pause, BookOpen, Check,
} from 'lucide-react';
import { useA11yPrefs } from '../hooks/useA11yPrefs';
import {
  a11yStore, isAnyActive, nextContrast, nextTextSize, nextLineSpacing,
} from '../utils/a11yPrefs';

// Israeli Reg. 35 / IS 5568:2020 accessibility preferences widget.
// Floating trigger button (bottom-start, RTL-aware) opens a modal panel
// with toggles for contrast, text size, line spacing, cursor, motion etc.
// Alt+A keyboard shortcut. Hebrew labels throughout.
//
// Scope: this widget toggles CSS classes on <html>. It does NOT mutate
// content DOM, inject ARIA labels, rewrite alt text, or auto-remediate.
// It is a user-preference comfort tool only.

const CONTRAST_LABEL = {
  off: 'כבוי', high: 'ניגודיות גבוהה', invert: 'היפוך צבעים', mono: 'גווני אפור',
};
const LINE_LABEL = {
  normal: 'רגיל', '16': '160%', '20': '200%',
};

export default function AccessibilityWidget() {
  const prefs = useA11yPrefs();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const active = isAnyActive(prefs);

  // Alt+A keyboard shortcut — layout-independent (uses e.code)
  useEffect(() => {
    function onKey(e) {
      if (e.altKey && e.code === 'KeyA' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.code === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus management: when dialog opens, focus first toggle. When closes,
  // return focus to trigger.
  useEffect(() => {
    if (open && dialogRef.current) {
      const first = dialogRef.current.querySelector('button[data-a11y-toggle]');
      first?.focus();
    } else if (!open && triggerRef.current) {
      // only refocus if the dialog actually had focus — avoid stealing on initial mount
      if (document.activeElement === document.body || document.activeElement === null) return;
    }
  }, [open]);

  function close() { setOpen(false); triggerRef.current?.focus(); }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`a11y-fab ${active ? 'is-active' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="פתח חלון התאמת נגישות"
        aria-expanded={open}
        aria-controls="a11y-panel"
        aria-keyshortcuts="Alt+A"
        title="נגישות (Alt+A)"
      >
        <Accessibility size={22} strokeWidth={2.2} aria-hidden="true" className="a11y-fab-icon" />
        <span className="a11y-fab-text">נגישות</span>
        {active && <span className="a11y-fab-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="a11y-overlay" onClick={close} role="presentation">
          <div
            id="a11y-panel"
            ref={dialogRef}
            className="a11y-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="a11y-title"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
            lang="he"
          >
            <div className="a11y-head">
              <h2 id="a11y-title" className="a11y-title">
                <Accessibility size={20} className="icon-inline" aria-hidden="true" />
                התאמת נגישות
              </h2>
              <button type="button" className="a11y-close" onClick={close} aria-label="סגור">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="a11y-grid">
              <Toggle
                icon={Link2}
                label="הדגשת קישורים"
                state={prefs.links ? 'דלוק' : 'כבוי'}
                on={prefs.links}
                onClick={() => a11yStore.set({ links: !prefs.links })}
              />
              <Toggle
                icon={Contrast}
                label="ניגודיות"
                state={CONTRAST_LABEL[prefs.contrast]}
                on={prefs.contrast !== 'off'}
                onClick={() => a11yStore.set({ contrast: nextContrast(prefs.contrast) })}
                isCycle
              />
              <Toggle
                icon={Type}
                label="גודל טקסט"
                state={`${prefs.textSize}%`}
                on={prefs.textSize !== 100}
                onClick={() => a11yStore.set({ textSize: nextTextSize(prefs.textSize) })}
                isCycle
              />
              <Toggle
                icon={AlignJustify}
                label="ריווח שורות"
                state={LINE_LABEL[prefs.lineSpacing]}
                on={prefs.lineSpacing !== 'normal'}
                onClick={() => a11yStore.set({ lineSpacing: nextLineSpacing(prefs.lineSpacing) })}
                isCycle
              />
              <Toggle
                icon={BookOpen}
                label="גופן קריא"
                state={prefs.readableFont ? 'דלוק' : 'כבוי'}
                on={prefs.readableFont}
                onClick={() => a11yStore.set({ readableFont: !prefs.readableFont })}
              />
              <Toggle
                icon={Heading}
                label="הדגשת כותרות"
                state={prefs.headings ? 'דלוק' : 'כבוי'}
                on={prefs.headings}
                onClick={() => a11yStore.set({ headings: !prefs.headings })}
              />
              <Toggle
                icon={MousePointer2}
                label="סמן שחור"
                state={prefs.cursorBlack ? 'דלוק' : 'כבוי'}
                on={prefs.cursorBlack}
                onClick={() => a11yStore.set({ cursorBlack: !prefs.cursorBlack })}
              />
              <Toggle
                icon={MousePointerClick}
                label="סמן גדול"
                state={prefs.cursorLarge ? 'דלוק' : 'כבוי'}
                on={prefs.cursorLarge}
                onClick={() => a11yStore.set({ cursorLarge: !prefs.cursorLarge })}
              />
              <Toggle
                icon={Pause}
                label="עצירת אנימציות"
                state={prefs.reduceMotion ? 'דלוק' : 'כבוי'}
                on={prefs.reduceMotion}
                onClick={() => a11yStore.set({ reduceMotion: !prefs.reduceMotion })}
              />
            </div>

            <div className="a11y-actions">
              <button
                type="button"
                className="btn-secondary a11y-reset"
                onClick={() => a11yStore.reset()}
                disabled={!active}
              >
                <RotateCcw size={16} className="icon-inline" aria-hidden="true" />
                איפוס הגדרות
              </button>
              <a href="/accessibility" className="a11y-statement-link" onClick={close}>
                הצהרת נגישות מלאה →
              </a>
            </div>

            <p className="a11y-fineprint">
              הכלי מאפשר לך להתאים את התצוגה. הוא <strong>לא משנה</strong> תוכן, ולא מהווה תחליף
              לאמצעי עזר אישי. אם נתקלת בקושי בנגישות, צור איתנו קשר ב-
              <a href="mailto:accessibility@toron.co.il">accessibility@toron.co.il</a>.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Toggle({ icon: Icon, label, state, on, onClick, isCycle = false }) {
  // For binary toggles, aria-pressed correctly conveys on/off. For cycle
  // toggles (contrast, text size, line spacing) — which have 3-4 states —
  // aria-pressed misleads screen readers because "pressed" implies binary.
  // Convey the current value via a richer aria-label instead and omit
  // aria-pressed.
  const ariaProps = isCycle
    ? { 'aria-label': `${label}: ${state}` }
    : { 'aria-pressed': on };
  return (
    <button
      type="button"
      className={`a11y-toggle ${on ? 'is-on' : ''}`}
      onClick={onClick}
      data-a11y-toggle
      {...ariaProps}
    >
      <span className="a11y-toggle-ico"><Icon size={20} aria-hidden="true" /></span>
      <span className="a11y-toggle-label">{label}</span>
      <span className="a11y-toggle-state">
        {on && <Check size={11} aria-hidden="true" />}
        {state}
      </span>
    </button>
  );
}
