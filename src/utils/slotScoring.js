import { timeToMin } from './slots.js';

// Smart Slot Engine — picks 1-3 "best" slots for the client based on the
// barber's day shape. Pure heuristic, no LLM.
//
// Scoring intuition:
//   - Slots that chain directly with an existing booking are PRIME (no dead time)
//   - The earliest available slot today is usually attractive
//   - Slots far from any other booking get a "quiet" tag (good for clients
//     who hate waiting) — but not pushed too aggressively
//
// We avoid picking 3 adjacent slots: top picks must be ≥40 minutes apart so
// the user gets variety.

export const SLOT_REASONS = {
  'usual': {
    label: 'השעה הרגילה שלך',
    badge: 'מותאם לך',
    tone: 'usual',
  },
  'chain-after': {
    label: 'מיד אחרי תור — בלי המתנה',
    badge: 'הכי מהיר',
    tone: 'fast',
  },
  'chain-before': {
    label: 'משלים את היום של הספר',
    badge: 'סוגר פער',
    tone: 'fill',
  },
  'earliest': {
    label: 'השעה הזמינה הקרובה ביותר',
    badge: 'מיידי',
    tone: 'fast',
  },
  'quiet': {
    label: 'שקט — אין תורים סביב',
    badge: 'שקט',
    tone: 'quiet',
  },
};

const SAME_TONE_GAP_MIN = 40;
const MAX_PICKS = 3;

/**
 * Score available slots and return up to 3 recommended ones, each tagged
 * with a "reason" key from SLOT_REASONS.
 *
 * @param {Array<{time, available}>} slots
 * @param {Array<{time, duration}>} occupied bookings + breaks + blocks
 * @param {Date} selectedDate
 * @param {Date} now
 * @param {number} duration total minutes for THIS booking
 * @returns {Array<{time, score, reason}>}
 */
export function getRecommendedSlots(slots, occupied, selectedDate, now, duration) {
  const available = (slots || []).filter((s) => s.available);
  // Need at least 4 options before "recommending" makes sense — fewer than that,
  // showing all is just as easy.
  if (available.length < 4) return [];

  const bookingStarts = (occupied || []).map((o) => timeToMin(o.time));
  const bookingEnds = (occupied || []).map((o) => timeToMin(o.time) + (o.duration || 20));

  const sameDay = isSameDay(selectedDate, now);
  const nowMin = sameDay ? now.getHours() * 60 + now.getMinutes() : -1;

  const earliestSlotTime = available[0].time;

  const scored = available.map((slot) => {
    const slotStart = timeToMin(slot.time);
    const slotEnd = slotStart + duration;
    let score = 0;
    let reason = null;

    // 1. Chain-after — slot starts close to a booking that just ended
    const closestEndBefore = closestAtMost(bookingEnds, slotStart);
    if (closestEndBefore !== null) {
      const gap = slotStart - closestEndBefore;
      if (gap <= 5) { score += 35; reason = 'chain-after'; }
      else if (gap <= 20) { score += 18; }
    }

    // 2. Chain-before — slot ends close to a booking that's about to start
    const closestStartAfter = closestAtLeast(bookingStarts, slotEnd);
    if (closestStartAfter !== null) {
      const gap = closestStartAfter - slotEnd;
      if (gap <= 5) { score += 30; if (!reason) reason = 'chain-before'; }
      else if (gap <= 20) { score += 14; }
    }

    // 3. Earliest available today
    if (sameDay && slot.time === earliestSlotTime) {
      const minutesAway = slotStart - nowMin;
      if (minutesAway >= 0 && minutesAway <= 180) {
        score += 22;
        if (!reason) reason = 'earliest';
      }
    }

    // 4. Quiet — far from any booking (or no bookings at all)
    const distances = [
      ...bookingStarts.map((s) => Math.abs(s - slotStart)),
      ...bookingEnds.map((e) => Math.abs(e - slotEnd)),
    ];
    const nearest = distances.length ? Math.min(...distances) : Infinity;
    if (nearest >= 90) {
      score += 8;
      if (!reason) reason = 'quiet';
    }

    return { time: slot.time, score, reason };
  });

  const sorted = scored
    .filter((s) => s.reason !== null)
    .sort((a, b) => b.score - a.score);

  // Pick top, ensuring picks are spread out (≥40 min apart) so the user
  // doesn't get 11:00 / 11:20 / 11:40 — boring.
  const picks = [];
  for (const s of sorted) {
    if (picks.length >= MAX_PICKS) break;
    const tooClose = picks.some(
      (p) => Math.abs(timeToMin(p.time) - timeToMin(s.time)) < SAME_TONE_GAP_MIN,
    );
    if (!tooClose) picks.push(s);
  }

  // Display in chronological order
  return picks.sort((a, b) => a.time.localeCompare(b.time));
}

function closestAtMost(arr, target) {
  let best = null;
  for (const n of arr) if (n <= target && (best === null || n > best)) best = n;
  return best;
}
function closestAtLeast(arr, target) {
  let best = null;
  for (const n of arr) if (n >= target && (best === null || n < best)) best = n;
  return best;
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
