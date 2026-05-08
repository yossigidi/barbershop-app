// Phone-number import utilities — used by BroadcastModal to bring
// contacts in from the device (Web Contact Picker API where available)
// or from any pasted text (loose extraction).

// Normalize a single phone string to a clean Israeli local format
// (0XX-XXXXXXX → 05XXXXXXXXX). Returns '' if it can't be cleaned.
export function normalizeIsraeliPhone(raw) {
  if (!raw) return '';
  let p = String(raw).replace(/[^\d+]/g, '');
  // International → local
  if (p.startsWith('+972')) p = '0' + p.slice(4);
  else if (p.startsWith('972') && p.length >= 11) p = '0' + p.slice(3);
  // Strip leading double zeros
  p = p.replace(/^00/, '+').replace(/^\+972/, '0');
  return p;
}

export function isValidIsraeliPhone(p) {
  // 9-10 digits, starts with 0, second char 2-9 (not 0/1)
  return /^0[2-9]\d{7,8}$/.test(String(p));
}

// Loose extraction — pull every phone-looking blob out of an arbitrary
// text dump (a WhatsApp share, a CSV paste, comma-separated). Dedupes
// and returns only Israeli-shaped numbers.
export function extractPhones(text) {
  if (!text) return [];
  const matches = String(text).match(/(?:\+972|972|0)[\s\-.]?\d[\s\-.]?\d?[\s\-.]?\d{3}[\s\-.]?\d{4}/g) || [];
  const cleaned = matches.map(normalizeIsraeliPhone).filter(isValidIsraeliPhone);
  return [...new Set(cleaned)];
}

// Try the Web Contact Picker API (Android Chrome supports this; iOS
// Safari does not yet). Returns array of { phone, firstName, lastName }.
// On unsupported browsers, throws so the caller can fall back to paste.
export async function pickContactsFromDevice() {
  // eslint-disable-next-line no-undef
  if (typeof navigator === 'undefined' || !navigator.contacts || !navigator.contacts.select) {
    throw new Error('הדפדפן הזה לא תומך בבחירת אנשי קשר — נסה הדבקה במקום');
  }
  // eslint-disable-next-line no-undef
  const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: true });
  const out = [];
  for (const c of contacts) {
    const name = (c.name?.[0] || '').trim();
    const [firstName, ...rest] = name.split(/\s+/);
    const lastName = rest.join(' ');
    for (const tel of (c.tel || [])) {
      const phone = normalizeIsraeliPhone(tel);
      if (isValidIsraeliPhone(phone)) {
        out.push({ phone, firstName: firstName || '', lastName });
      }
    }
  }
  // Dedup by phone, prefer the version with a name attached
  const map = new Map();
  for (const e of out) {
    const existing = map.get(e.phone);
    if (!existing || (!existing.firstName && e.firstName)) map.set(e.phone, e);
  }
  return [...map.values()];
}

export function isContactPickerSupported() {
  // eslint-disable-next-line no-undef
  return typeof navigator !== 'undefined' && !!navigator.contacts && !!navigator.contacts.select;
}
