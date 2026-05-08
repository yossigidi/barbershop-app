// Custom URL slugs (e.g. toron.co.il/ramos) — shared validation for
// SettingsPage (rejects bad input) and BookingPage (redirects to home
// when a path looks like an internal route, never a barber slug).
//
// Whenever you add a new top-level <Route> in App.jsx, add it here too —
// otherwise a barber could pick a slug that masks an app page.

export const RESERVED_SLUGS = new Set([
  // Top-level app routes
  'auth', 'dashboard', 'settings', 'reports', 'pricing',
  'terms', 'privacy', 'refund', 'accessibility',
  'onboarding', 'b', 'manage', 'api',
  // Common system / future routes — block now to avoid surprises later
  'admin', 'help', 'about', 'contact', 'support', 'home', 'index',
  'login', 'signup', 'register', 'logout', 'profile', 'account',
  'expenses', 'reviews', 'static', 'public', 'assets', 'src',
  // PWA / browser
  'manifest', 'service-worker', 'sw', 'favicon', 'robots', 'sitemap',
]);

export const SLUG_RULES = {
  minLen: 3,
  maxLen: 30,
  pattern: /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
};

export function normalizeSlug(input) {
  return String(input || '').trim().toLowerCase();
}

// Returns null if valid, or a Hebrew error message otherwise.
export function validateSlug(slug) {
  if (!slug) return 'נדרשת כתובת — לפחות 3 תווים';
  if (slug.length < SLUG_RULES.minLen) return 'הכתובת קצרה מדי (לפחות 3 תווים)';
  if (slug.length > SLUG_RULES.maxLen) return 'הכתובת ארוכה מדי (עד 30 תווים)';
  if (!SLUG_RULES.pattern.test(slug)) {
    return 'מותר רק אותיות אנגליות קטנות, ספרות ומקפים — וצריך להתחיל ולהסתיים בתו';
  }
  if (RESERVED_SLUGS.has(slug)) return 'הכתובת הזו שמורה למערכת — בחר/י אחרת';
  return null;
}

export function isReservedSlug(s) {
  return RESERVED_SLUGS.has(normalizeSlug(s));
}

// Auto-derive a slug suggestion from the business name. Handles Latin
// names cleanly ("Ramos Hair" → "ramos-hair"). Hebrew/non-Latin names
// produce an empty string and the caller falls back to the auto-generated
// 6-char shortCode (which is what Toron still serves at toron.co.il/{code}).
export function nameToSlug(name) {
  if (!name) return '';
  let s = String(name).toLowerCase().trim();
  // Strip apostrophes / quotes / dots between letters
  s = s.replace(/['’´`".,&+()/\\]+/g, '');
  // Replace any non-[a-z0-9] run with a single hyphen
  s = s.replace(/[^a-z0-9]+/g, '-');
  // Trim leading/trailing hyphens
  s = s.replace(/^-+|-+$/g, '');
  // Cap length
  if (s.length > SLUG_RULES.maxLen) s = s.slice(0, SLUG_RULES.maxLen).replace(/-+$/, '');
  if (s.length < SLUG_RULES.minLen) return '';
  if (RESERVED_SLUGS.has(s)) return '';
  return s;
}
