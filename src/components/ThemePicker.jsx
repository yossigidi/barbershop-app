import { Check } from 'lucide-react';
import { THEMES } from '../utils/themes';

// Visual theme picker — 5 cards showing a mini preview of the booking
// page (background swatch + circular logo mark + name pill + service
// chip). Picking a card calls onSelect(key).
//
// Props:
//   value: string (current theme key)
//   onSelect: (key) => void
//   businessName: string — shown inside the previews so the operator
//     sees what their actual brand will look like in each theme

export default function ThemePicker({ value, onSelect, businessName }) {
  const initials = (businessName || 'T').slice(0, 2);
  return (
    <div className="theme-picker-grid">
      {THEMES.map((t) => {
        const on = t.key === value;
        const colors = t.preview;
        return (
          <button
            key={t.key}
            type="button"
            className={`theme-card ${on ? 'is-on' : ''}`}
            onClick={() => onSelect(t.key)}
            aria-pressed={on}
          >
            {/* Mini preview — tries to feel like the actual booking page */}
            <div
              className="theme-card-preview"
              style={{ background: colors.bg }}
            >
              <div
                className="theme-card-mark"
                style={{
                  background: `linear-gradient(135deg, ${colors.mark}, ${colors.accent})`,
                  color: '#fff',
                }}
              >
                {initials}
              </div>
              <div
                className="theme-card-pill"
                style={{ background: colors.card, color: colors.accent }}
              >
                {businessName || 'שם העסק'}
              </div>
              <div
                className="theme-card-chip"
                style={{
                  background: colors.card,
                  color: colors.accent,
                  borderColor: colors.mark,
                }}
              >
                09:00
              </div>
            </div>

            <div className="theme-card-meta">
              <div className="theme-card-name">
                {t.label}
                {on && <Check size={14} className="theme-card-check" aria-hidden="true" />}
              </div>
              <div className="theme-card-desc">{t.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
