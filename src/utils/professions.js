// Profession presets — defines onboarding catalog + light terminology per
// vertical. Adding another profession is pure data: no scoring, slot, or
// booking logic depends on profession. The barber doc just stores
// `profession: <id>` so the BookingPage and Onboarding know what to show.

const id = () => Math.random().toString(36).slice(2, 9);

export const PROFESSIONS = {
  barber: {
    id: 'barber',
    label: 'ספר/ית',
    businessLabel: 'מספרה',
    professionalLabel: 'ספר',
    defaultBusinessName: (name) => name ? `${name} — ספרות` : 'הספרות שלי',
    icon: 'Scissors',
    color: 'gold',
    serviceDurations: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
    addonDurations: [0, 10, 20, 30, 40, 50, 60],
    services: [
      { name: 'תספורת רגילה', duration: 20, price: 0 },
      { name: 'תספורת + זקן', duration: 40, price: 0 },
      { name: 'ילדים', duration: 20, price: 0 },
      { name: 'תספורת פרימיום', duration: 60, price: 0 },
      { name: 'טיפולי לייזר', duration: 60, price: 0 },
    ],
    addons: [
      { name: 'עיצוב זקן', duration: 10, price: 0 },
      { name: 'שעווה באף', duration: 5, price: 0 },
      { name: 'שעווה באוזניים', duration: 5, price: 0 },
      { name: 'עיצוב גבות', duration: 10, price: 0 },
    ],
  },

  manicurist: {
    id: 'manicurist',
    label: 'מניקוריסטית',
    businessLabel: 'סטודיו לציפורניים',
    professionalLabel: 'מניקוריסטית',
    defaultBusinessName: (name) => name ? `${name} — מניקור` : 'הסטודיו שלי',
    icon: 'Sparkles',
    color: 'rose',
    serviceDurations: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
    addonDurations: [0, 10, 20, 30, 40, 50, 60],
    services: [
      { name: 'מניקור רגיל', duration: 30, price: 0 },
      { name: 'מניקור ג׳ל', duration: 45, price: 0 },
      { name: 'מניקור שלאק', duration: 45, price: 0 },
      { name: 'מניקור בנייה (אקריל)', duration: 90, price: 0 },
      { name: 'מילוי בנייה', duration: 60, price: 0 },
      { name: 'הסרת מניקור', duration: 20, price: 0 },
    ],
    addons: [
      { name: 'דיזיין על ציפורן', duration: 15, price: 0 },
      { name: 'נצנצים / קישוטים', duration: 10, price: 0 },
      { name: 'חיזוק עם בייס', duration: 10, price: 0 },
      { name: 'הסרת ג׳ל קודם', duration: 15, price: 0 },
    ],
  },

  pedicurist: {
    id: 'pedicurist',
    label: 'פדיקוריסטית',
    businessLabel: 'סטודיו לפדיקור',
    professionalLabel: 'פדיקוריסטית',
    defaultBusinessName: (name) => name ? `${name} — פדיקור` : 'הסטודיו שלי',
    icon: 'Sparkles',
    color: 'rose',
    serviceDurations: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
    addonDurations: [0, 10, 20, 30, 40, 50, 60],
    services: [
      { name: 'פדיקור רגיל', duration: 45, price: 0 },
      { name: 'פדיקור רפואי', duration: 60, price: 0 },
      { name: 'פדיקור ג׳ל', duration: 75, price: 0 },
      { name: 'פדיקור + מניקור', duration: 90, price: 0 },
    ],
    addons: [
      { name: 'עיסוי כפות רגליים', duration: 20, price: 0 },
      { name: 'מסכה מזינה', duration: 15, price: 0 },
      { name: 'הסרת ג׳ל', duration: 15, price: 0 },
    ],
  },

  cosmetician: {
    id: 'cosmetician',
    label: 'קוסמטיקאית',
    businessLabel: 'קליניקה לטיפוח',
    professionalLabel: 'קוסמטיקאית',
    defaultBusinessName: (name) => name ? `${name} — קוסמטיקה` : 'הקליניקה שלי',
    icon: 'Sparkles',
    color: 'rose',
    serviceDurations: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
    addonDurations: [0, 10, 20, 30, 40, 50, 60],
    services: [
      { name: 'ניקוי פנים בסיסי', duration: 60, price: 0 },
      { name: 'ניקוי פנים עומק', duration: 90, price: 0 },
      { name: 'טיפול אנטי-אייג׳ינג', duration: 75, price: 0 },
      { name: 'שעווה פנים (שפם/סנטר)', duration: 15, price: 0 },
      { name: 'שעווה רגליים מלאות', duration: 60, price: 0 },
      { name: 'שעווה ביקיני', duration: 30, price: 0 },
      { name: 'שזירת גבות', duration: 20, price: 0 },
      { name: 'איפור ערב', duration: 60, price: 0 },
    ],
    addons: [
      { name: 'מסכה מזינה', duration: 20, price: 0 },
      { name: 'עיסוי פנים', duration: 15, price: 0 },
      { name: 'איפור גבות', duration: 10, price: 0 },
    ],
  },
};

export const PROFESSION_LIST = Object.values(PROFESSIONS);

// Returns the profession config or barber as a safe fallback for legacy
// barber accounts that predate the multi-vertical upgrade.
export function getProfession(key) {
  return PROFESSIONS[key] || PROFESSIONS.barber;
}

// Used to seed services/addons in onboarding from a chosen profession
export function presetCatalogFor(key) {
  const p = getProfession(key);
  return {
    services: p.services.map((s) => ({ id: id(), ...s, offered: false })),
    addons: p.addons.map((a) => ({ id: id(), ...a, offered: false })),
    serviceDurations: p.serviceDurations,
    addonDurations: p.addonDurations,
  };
}

// Multi-profession variant — merges catalogs from several professions,
// deduplicating by name (case-insensitive). Used when a beauty pro
// offers e.g. manicure + pedicure + light cosmetics from one studio.
export function presetCatalogForMany(keys) {
  const list = (keys || []).map(getProfession).filter(Boolean);
  if (list.length === 0) return presetCatalogFor('barber');
  if (list.length === 1) return presetCatalogFor(list[0].id);

  const services = [];
  const addons = [];
  const seenSvc = new Set();
  const seenAdd = new Set();
  for (const p of list) {
    for (const s of p.services) {
      const k = s.name.trim().toLowerCase();
      if (!seenSvc.has(k)) {
        seenSvc.add(k);
        services.push({ id: id(), ...s, offered: false });
      }
    }
    for (const a of p.addons) {
      const k = a.name.trim().toLowerCase();
      if (!seenAdd.has(k)) {
        seenAdd.add(k);
        addons.push({ id: id(), ...a, offered: false });
      }
    }
  }

  const serviceDurations = [...new Set(list.flatMap((p) => p.serviceDurations))]
    .sort((a, b) => a - b);
  const addonDurations = [...new Set(list.flatMap((p) => p.addonDurations))]
    .sort((a, b) => a - b);

  return { services, addons, serviceDurations, addonDurations };
}

// Read a barber doc's profession(s) — accepts both legacy single
// `profession` string and new `professions` array. Always returns array
// with at least one element.
export function readProfessions(data) {
  if (!data) return ['barber'];
  if (Array.isArray(data.professions) && data.professions.length > 0) {
    return data.professions;
  }
  if (typeof data.profession === 'string') return [data.profession];
  return ['barber'];
}
