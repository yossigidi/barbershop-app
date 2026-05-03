// Slot helpers — 30-minute slots, working-hours aware.

export const SLOT_MIN = 30;
export const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const DAY_LABELS_HE = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי',
  saturday: 'שבת',
};

export function defaultWorkingHours() {
  return DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day] = {
      active: day !== 'saturday',
      start: '09:00',
      end: '18:00',
      break: { start: '13:00', end: '14:00' },
    };
    return acc;
  }, {});
}

export function dateToISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayKeyFromDate(date) {
  return DAYS_OF_WEEK[date.getDay()];
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// Compute available 30-min slots for a given date based on workingHours.
// bookedTimes: array of "HH:MM" already booked.
export function computeSlotsForDate(date, workingHours, bookedTimes = []) {
  const dayKey = dayKeyFromDate(date);
  const cfg = workingHours?.[dayKey];
  if (!cfg || !cfg.active) return [];

  const start = timeToMin(cfg.start);
  const end = timeToMin(cfg.end);
  const breakStart = cfg.break?.start ? timeToMin(cfg.break.start) : null;
  const breakEnd = cfg.break?.end ? timeToMin(cfg.break.end) : null;

  const booked = new Set(bookedTimes);
  const slots = [];
  for (let t = start; t + SLOT_MIN <= end; t += SLOT_MIN) {
    if (breakStart != null && breakEnd != null && t >= breakStart && t < breakEnd) continue;
    const time = minToTime(t);
    slots.push({ time, booked: booked.has(time) });
  }
  return slots;
}

export function nextNDays(n = 14) {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push(d);
  }
  return out;
}

export function formatDateHe(date) {
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

export function generateShortCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
