import { Sun, Moon } from 'lucide-react';
import { useWakeLock } from '../hooks/useWakeLock';

// Small toggle in the dashboard header that flips the screen wake lock on
// or off. Targeted at barbers running the app on a tablet/phone at the
// station — they want the screen to stay on during a workday without
// having to touch it. Hidden entirely on browsers that don't support the
// Wake Lock API, so it never shows a useless control.

export default function WakeLockToggle() {
  const { enabled, supported, toggle } = useWakeLock();
  if (!supported) return null;
  return (
    <button
      type="button"
      className={`wake-lock-toggle ${enabled ? 'is-on' : ''}`}
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'מסך תמיד דלוק — פעיל. לחץ לכיבוי' : 'הדלק מסך תמיד דלוק'}
      title={enabled ? 'מסך תמיד דלוק (פעיל)' : 'הדלק מסך תמיד דלוק'}
    >
      {enabled ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span className="wake-lock-label">{enabled ? 'מסך דלוק' : 'מסך'}</span>
    </button>
  );
}
