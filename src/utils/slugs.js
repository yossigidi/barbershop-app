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

// Hebrew → Latin transliteration. Hebrew is consonantal (no written
// vowels) so a perfect mapping isn't possible without a name dictionary,
// but we use two heuristics to get close:
//
//   1. ו (vav) and י (yud) are *matres lectionis* — they act as
//      consonants ("v"/"y") at word start but as vowels ("o"/"i")
//      everywhere else. This handles the most common Hebrew name shapes.
//   2. Sin/Shin and final-form letters collapse to their base value.
//
// Examples:
//   יוסי גידני     → "yosi gidni"
//   מספרת רמוס     → "msprt rmos"
//   ספרת ישראל     → "sprt yshral"
//
// Result isn't always pretty for very vowel-light words, but it's a
// readable URL — strictly better than the random shortCode it replaces.
// Users can always edit it manually in Settings.
const HEB_CONSONANT = {
  'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h',
  'ז': 'z', 'ח': 'ch', 'ט': 't',
  'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
  'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a',
  'פ': 'p', 'ף': 'f', 'צ': 'tz', 'ץ': 'tz',
  'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't',
};

function transliterateHebrew(input) {
  if (!input) return '';
  // Strip nikud (vowel marks) so they don't confuse the loop.
  const stripped = String(input)
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[׳״]/g, ''); // Hebrew geresh / gershayim
  const out = [];
  let prevHeb = false;
  for (const c of stripped) {
    if (HEB_CONSONANT[c] !== undefined) {
      out.push(HEB_CONSONANT[c]);
      prevHeb = true;
    } else if (c === 'ו') {
      out.push(prevHeb ? 'o' : 'v');
      prevHeb = true;
    } else if (c === 'י') {
      out.push(prevHeb ? 'i' : 'y');
      prevHeb = true;
    } else if (/[a-zA-Z0-9]/.test(c)) {
      out.push(c);
      prevHeb = false;
    } else {
      // Whitespace or punctuation — emit a separator and reset position.
      out.push(' ');
      prevHeb = false;
    }
  }
  return out.join('');
}

// Auto-derive a slug suggestion from the business name. Handles Latin
// names directly ("Ramos Hair" → "ramos-hair") and Hebrew names via
// transliteration ("יוסי גידני" → "yosi-gidni"). Returns '' only when
// the source has nothing usable at all.
export function nameToSlug(name) {
  if (!name) return '';
  let s = String(name).trim();
  // If there's any Hebrew, transliterate first; harmless on Latin input.
  if (/[֐-׿]/.test(s)) s = transliterateHebrew(s);
  s = s.toLowerCase();
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
