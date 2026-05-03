import { useMemo } from 'react';
import { dateToISO, formatDateHe, dayKeyFromDate, DAY_LABELS_HE, timeToMin, addMinToTime } from '../utils/slots';

// Heuristic-based scheduling tips:
// 1. Find the largest free windows in the next 7 days (helps the barber recommend
//    walk-in slots).
// 2. Identify "slow days" — working days in the next 14 days with 0-1 bookings.
// 3. Identify the busiest day-of-week from the last 60 days.

function timelineGapsForDay(date, workingHours, bookings, blocks) {
  const dayKey = dayKeyFromDate(date);
  const cfg = workingHours?.[dayKey];
  if (!cfg?.active) return [];

  const dayStart = timeToMin(cfg.start);
  const dayEnd = timeToMin(cfg.end);
  // Build occupied intervals
  const occ = [];
  if (cfg.break?.start && cfg.break?.end) {
    occ.push({ start: timeToMin(cfg.break.start), end: timeToMin(cfg.break.end) });
  }
  for (const b of bookings) {
    const s = timeToMin(b.time);
    occ.push({ start: s, end: s + (b.duration || 20) });
  }
  for (const bl of blocks) {
    const s = timeToMin(bl.time);
    occ.push({ start: s, end: s + (bl.duration || 20) });
  }
  occ.sort((a, b) => a.start - b.start);

  const gaps = [];
  let cursor = dayStart;
  for (const r of occ) {
    if (r.start > cursor) {
      gaps.push({ from: cursor, to: r.start, length: r.start - cursor });
    }
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < dayEnd) gaps.push({ from: cursor, to: dayEnd, length: dayEnd - cursor });
  return gaps.filter((g) => g.length >= 20);
}

export default function SmartTipsCard({ workingHours, bookings, blocks }) {
  const tips = useMemo(() => {
    const todayISO = dateToISO(new Date());
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sevenAhead = new Date(today); sevenAhead.setDate(today.getDate() + 7);

    // Per-day analysis next 7 days
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const iso = dateToISO(d);
      const dBookings = bookings.filter((b) => b.date === iso && b.status === 'booked');
      const dBlocks = blocks.filter((b) => b.date === iso);
      const gaps = timelineGapsForDay(d, workingHours, dBookings, dBlocks);
      const totalGap = gaps.reduce((sum, g) => sum + g.length, 0);
      days.push({ date: d, iso, bookingsCount: dBookings.length, gaps, totalGapMin: totalGap });
    }

    // Largest gaps across the week
    const largestGaps = days
      .flatMap((d) => d.gaps.map((g) => ({ ...g, date: d.date })))
      .sort((a, b) => b.length - a.length)
      .slice(0, 3);

    // Slow days (next 14 days with 0-1 bookings)
    const slowDays = [];
    for (let i = 1; i < 14; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const iso = dateToISO(d);
      const cfg = workingHours?.[dayKeyFromDate(d)];
      if (!cfg?.active) continue;
      const cnt = bookings.filter((b) => b.date === iso && b.status === 'booked').length;
      if (cnt <= 1) slowDays.push({ date: d, count: cnt });
    }

    // Busiest day of week from last 60 days
    const sixtyAgoISO = dateToISO(new Date(today.getTime() - 60 * 86400000));
    const dowCount = Array(7).fill(0);
    for (const b of bookings) {
      if (b.status !== 'booked' && b.status !== 'completed') continue;
      if (b.date < sixtyAgoISO) continue;
      const [y, m, dd] = b.date.split('-').map(Number);
      dowCount[new Date(y, m - 1, dd).getDay()]++;
    }
    const maxDow = Math.max(...dowCount);
    const busyDow = maxDow > 0 ? dowCount.indexOf(maxDow) : -1;

    return { largestGaps, slowDays: slowDays.slice(0, 3), busyDow, dowCount };
  }, [workingHours, bookings, blocks]);

  if (!tips.largestGaps.length && !tips.slowDays.length && tips.busyDow === -1) {
    return null;
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>🧠 תזמון חכם</h3>

      {tips.largestGaps.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 6 }}>חלונות פנויים גדולים השבוע:</div>
          {tips.largestGaps.map((g, i) => (
            <div key={i} className="timeline-row">
              <span className="timeline-time">{formatDateHe(g.date)}</span>
              <span style={{ flex: 1 }}>
                {minToTimeStr(g.from)}–{minToTimeStr(g.to)}
              </span>
              <span className="text-dim">{g.length} דק׳ פנויות</span>
            </div>
          ))}
        </div>
      )}

      {tips.slowDays.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 6 }}>ימים שקטים (תזמון ל-promo):</div>
          {tips.slowDays.map((d) => (
            <div key={d.date.toISOString()} className="timeline-row">
              <span className="timeline-time">{formatDateHe(d.date)}</span>
              <span style={{ flex: 1 }}>{DAY_LABELS_HE[dayKeyFromDate(d.date)]}</span>
              <span className="text-dim">{d.count === 0 ? 'ריק' : 'תור אחד בלבד'}</span>
            </div>
          ))}
        </div>
      )}

      {tips.busyDow >= 0 && (
        <div className="muted" style={{ fontSize: '0.85rem' }}>
          📈 היום העמוס ביותר שלך: <strong>{DAY_LABELS_HE[['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][tips.busyDow]]}</strong>
          {' '}({tips.dowCount[tips.busyDow]} תורים ב-60 הימים האחרונים)
        </div>
      )}
    </div>
  );
}

function minToTimeStr(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}
