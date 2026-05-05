// Accessibility preferences engine — IS 5568:2020 / Regulation 35 compliant.
// User-preference comfort tool: toggles CSS classes on <html>, never mutates
// content DOM, never injects ARIA, never auto-remediates anything.

export const A11Y_VERSION = 1;
export const A11Y_STORAGE_KEY = 'toron_a11y_prefs_v1';

export const DEFAULT_PREFS = Object.freeze({
  version: A11Y_VERSION,
  links: false,           // highlight all links
  contrast: 'off',        // off | high | invert | mono
  textSize: 100,          // 100 | 115 | 130 | 150
  lineSpacing: 'normal',  // normal | 16 | 20
  readableFont: false,    // OS-stack readable font
  headings: false,        // highlight headings
  cursorBlack: false,
  cursorLarge: false,
  reduceMotion: false,    // stop animations
});

const CONTRAST_CYCLE = ['off', 'high', 'invert', 'mono'];
const TEXT_SIZE_CYCLE = [100, 115, 130, 150];
const LINE_SPACING_CYCLE = ['normal', '16', '20'];

export function nextContrast(c) {
  const i = CONTRAST_CYCLE.indexOf(c);
  return CONTRAST_CYCLE[(i + 1) % CONTRAST_CYCLE.length];
}
export function nextTextSize(s) {
  const i = TEXT_SIZE_CYCLE.indexOf(s);
  return TEXT_SIZE_CYCLE[(i + 1) % TEXT_SIZE_CYCLE.length];
}
export function nextLineSpacing(l) {
  const i = LINE_SPACING_CYCLE.indexOf(l);
  return LINE_SPACING_CYCLE[(i + 1) % LINE_SPACING_CYCLE.length];
}

export function isAnyActive(prefs) {
  return (
    prefs.links ||
    prefs.contrast !== 'off' ||
    prefs.textSize !== 100 ||
    prefs.lineSpacing !== 'normal' ||
    prefs.readableFont ||
    prefs.headings ||
    prefs.cursorBlack ||
    prefs.cursorLarge ||
    prefs.reduceMotion
  );
}

// Single source of truth — drives both the runtime applyPrefsToElement()
// AND the FOUC bootstrap script in index.html. The JS string column lets
// us serialize the same logic into the inline <script> below so they
// can never drift apart.
const CLASS_RULES = [
  ['a11y-links',           (p) => p.links,                  '!!p.links'],
  ['a11y-contrast-high',   (p) => p.contrast === 'high',    "p.contrast==='high'"],
  ['a11y-contrast-invert', (p) => p.contrast === 'invert',  "p.contrast==='invert'"],
  ['a11y-contrast-mono',   (p) => p.contrast === 'mono',    "p.contrast==='mono'"],
  ['a11y-text-115',        (p) => p.textSize === 115,       'p.textSize===115'],
  ['a11y-text-130',        (p) => p.textSize === 130,       'p.textSize===130'],
  ['a11y-text-150',        (p) => p.textSize === 150,       'p.textSize===150'],
  ['a11y-lines-16',        (p) => p.lineSpacing === '16',   "p.lineSpacing==='16'"],
  ['a11y-lines-20',        (p) => p.lineSpacing === '20',   "p.lineSpacing==='20'"],
  ['a11y-readable-font',   (p) => p.readableFont,           '!!p.readableFont'],
  ['a11y-headings',        (p) => p.headings,               '!!p.headings'],
  ['a11y-cursor-black',    (p) => p.cursorBlack,            '!!p.cursorBlack'],
  ['a11y-cursor-large',    (p) => p.cursorLarge,            '!!p.cursorLarge'],
  ['a11y-reduce-motion',   (p) => p.reduceMotion,           '!!p.reduceMotion'],
];

export function applyPrefsToElement(el, prefs) {
  for (const [cls, pred] of CLASS_RULES) el.classList.toggle(cls, pred(prefs));
}

// Inline <script> body — paste into index.html <head> BEFORE Vite's <script>.
// Reads the persisted prefs and applies the matching CSS classes
// synchronously, so users who depend on high-contrast/larger text don't
// see a flash of default styling on first paint.
export const A11Y_BOOTSTRAP_SCRIPT =
  `(function(){try{var raw=localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)});` +
  `if(!raw)return;var p=JSON.parse(raw);if(p.version!==${A11Y_VERSION})return;` +
  `var c=document.documentElement.classList;` +
  CLASS_RULES.map(([cls, , js]) => `c.toggle(${JSON.stringify(cls)},${js})`).join(';') +
  `}catch(e){}})()`;

// Pub-sub store with localStorage persistence
function readStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== A11Y_VERSION) return null;
    return { ...DEFAULT_PREFS, ...parsed, version: A11Y_VERSION };
  } catch {
    return null;
  }
}

function writeStorage(prefs) {
  try { localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

const listeners = new Set();
let cached;

function notify(next) {
  cached = next ?? readStorage() ?? DEFAULT_PREFS;
  for (const cb of listeners) cb();
}

export const a11yStore = {
  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getSnapshot() {
    if (cached === undefined) cached = readStorage() ?? DEFAULT_PREFS;
    return cached;
  },
  getServerSnapshot() {
    return DEFAULT_PREFS;
  },
  set(partial) {
    const next = { ...this.getSnapshot(), ...partial, version: A11Y_VERSION };
    writeStorage(next);
    if (typeof document !== 'undefined') applyPrefsToElement(document.documentElement, next);
    notify(next);
    return next;
  },
  reset() {
    try { localStorage.removeItem(A11Y_STORAGE_KEY); } catch {}
    if (typeof document !== 'undefined') applyPrefsToElement(document.documentElement, DEFAULT_PREFS);
    notify(DEFAULT_PREFS);
    return DEFAULT_PREFS;
  },
};
