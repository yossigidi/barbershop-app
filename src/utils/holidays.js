// Major Israeli / Jewish holidays for 2026–2027 (approximate Gregorian dates).
// For richer Hebrew-calendar awareness, swap in @hebcal/core later.

export const HOLIDAYS = [
  { date: '2026-01-01', name: 'ראש השנה האזרחית', emoji: '🎊' },
  { date: '2026-03-03', name: 'פורים', emoji: '🎭' },
  { date: '2026-04-02', name: 'ערב פסח', emoji: '🍷' },
  { date: '2026-04-03', name: 'פסח', emoji: '🍷' },
  { date: '2026-04-09', name: 'שביעי של פסח', emoji: '🍷' },
  { date: '2026-04-21', name: 'יום הזיכרון', emoji: '🕯️' },
  { date: '2026-04-22', name: 'יום העצמאות', emoji: '🇮🇱' },
  { date: '2026-05-26', name: 'שבועות', emoji: '🌾' },
  { date: '2026-07-23', name: 'תשעה באב', emoji: '🕯️' },
  { date: '2026-09-12', name: 'ראש השנה', emoji: '🍯' },
  { date: '2026-09-13', name: 'ראש השנה (יום ב׳)', emoji: '🍯' },
  { date: '2026-09-21', name: 'יום כיפור', emoji: '🤍' },
  { date: '2026-09-26', name: 'סוכות', emoji: '🌿' },
  { date: '2026-10-03', name: 'שמחת תורה', emoji: '📖' },
  { date: '2026-12-05', name: 'חנוכה — נר ראשון', emoji: '🕎' },
  { date: '2026-12-12', name: 'חנוכה — נר אחרון', emoji: '🕎' },
  { date: '2027-01-01', name: 'ראש השנה האזרחית', emoji: '🎊' },
  { date: '2027-03-23', name: 'פורים', emoji: '🎭' },
  { date: '2027-04-22', name: 'פסח', emoji: '🍷' },
];

export function holidayOn(dateISO) {
  return HOLIDAYS.find((h) => h.date === dateISO);
}

export function upcomingHolidays(fromISO, limit = 10) {
  return HOLIDAYS.filter((h) => h.date >= fromISO).slice(0, limit);
}
