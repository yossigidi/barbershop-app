// Slot helpers — 30-minute granularity, variable service durations.

export const STEP_MIN = 20;
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

export function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
export function minToTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}
export function addMinToTime(time, min) {
  return minToTime(timeToMin(time) + min);
}

// Compute available start times for a slot of `duration` minutes.
// occupied: array of { time: "HH:MM", duration: number } — bookings + blocks.
// Returns: array of { time, available, reason? }
// For today, slots whose start time has already passed are filtered out so
// clients can't book earlier than "now".
export function computeSlotsForDate(date, workingHours, occupied = [], duration = 20) {
  const dayKey = dayKeyFromDate(date);
  const cfg = workingHours?.[dayKey];
  if (!cfg || !cfg.active) return [];

  const dayStart = timeToMin(cfg.start);
  const dayEnd = timeToMin(cfg.end);

  // If `date` is today, drop any slots starting in the past
  const now = new Date();
  const dAtMidnight = new Date(date); dAtMidnight.setHours(0, 0, 0, 0);
  const todayAtMidnight = new Date(now); todayAtMidnight.setHours(0, 0, 0, 0);
  const isToday = dAtMidnight.getTime() === todayAtMidnight.getTime();
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1;

  // Build occupied ranges in minutes-since-midnight
  const ranges = [];
  for (const o of occupied) {
    const s = timeToMin(o.time);
    ranges.push({ start: s, end: s + (o.duration || 20) });
  }
  if (cfg.break?.start && cfg.break?.end) {
    ranges.push({ start: timeToMin(cfg.break.start), end: timeToMin(cfg.break.end) });
  }

  const out = [];
  for (let t = dayStart; t + duration <= dayEnd; t += STEP_MIN) { // 20-min step
    if (isToday && t < nowMin) continue;

    let available = true;
    for (const r of ranges) {
      if (t < r.end && t + duration > r.start) {
        available = false;
        break;
      }
    }
    out.push({ time: minToTime(t), available });
  }
  return out;
}

// Returns all 30-min steps in the working day (used for the day-management view in
// the dashboard so the barber can mark any 30-min cell as blocked even outside booking flow).
export function listAllSlotsForDate(date, workingHours) {
  const dayKey = dayKeyFromDate(date);
  const cfg = workingHours?.[dayKey];
  if (!cfg || !cfg.active) return [];
  const dayStart = timeToMin(cfg.start);
  const dayEnd = timeToMin(cfg.end);
  const breakStart = cfg.break?.start ? timeToMin(cfg.break.start) : null;
  const breakEnd = cfg.break?.end ? timeToMin(cfg.break.end) : null;
  const out = [];
  for (let t = dayStart; t + STEP_MIN <= dayEnd; t += STEP_MIN) {
    const inBreak = breakStart != null && breakEnd != null && t >= breakStart && t < breakEnd;
    out.push({ time: minToTime(t), inBreak });
  }
  return out;
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
