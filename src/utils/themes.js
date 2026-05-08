// Theme presets for the public-facing booking page (and the manage-token
// page). Each theme is a name + a set of preview colours used to render
// the picker cards. The actual CSS variables live in styles.css under
// `[data-theme="..."]` selectors.
//
// Apply by setting `data-theme={key}` on the BookingPage / Manage wrapper.
// Default key is 'gold-premium' — that's the existing visual identity.

export const THEMES = [
  {
    key: 'gold-premium',
    label: 'Gold Premium',
    description: 'יוקרתי, קלאסי — מתאים לברברים מובחרים',
    preview: { bg: '#faf8f3', card: '#ffffff', accent: '#18181b', mark: '#b8893a' },
  },
  {
    key: 'soft-cream',
    label: 'Soft Cream',
    description: 'חמים ורך — מתאים לקוסמטיקה וטיפוח',
    preview: { bg: '#f6efe4', card: '#fffaf0', accent: '#5c4830', mark: '#c9974a' },
  },
  {
    key: 'dark-modern',
    label: 'Dark Modern',
    description: 'מצב כהה מלא — סטודיו מודרני',
    preview: { bg: '#0a0a0c', card: '#18181b', accent: '#e8b15c', mark: '#f4c478' },
  },
  {
    key: 'rose-studio',
    label: 'Rose Studio',
    description: 'ורוד עדין — מניקור, פדיקור, יופי',
    preview: { bg: '#fdf2f4', card: '#ffffff', accent: '#9f1239', mark: '#e89db0' },
  },
  {
    key: 'minimal-white',
    label: 'Minimal White',
    description: 'נקי ופשוט — קליניקות וטיפול',
    preview: { bg: '#ffffff', card: '#ffffff', accent: '#111827', mark: '#6b7280' },
  },
];

export const DEFAULT_THEME = 'gold-premium';

export function getThemeKey(barber) {
  const k = barber?.theme;
  if (!k) return DEFAULT_THEME;
  if (THEMES.some((t) => t.key === k)) return k;
  return DEFAULT_THEME;
}
