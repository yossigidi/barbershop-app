import { useMemo } from 'react';
import { Coffee, Ban, Check, Repeat, Circle } from 'lucide-react';
import { dayKeyFromDate, timeToMin, minToTime, addMinToTime } from '../utils/slots';

const PX_PER_MIN = 1.0; // 60 min = 60 px tall — compact mobile-first

export default function DayTimeline({ date, workingHours, bookings, blocks, onBookingTap, onFreeSlotTap, onBlockTap }) {
  const dayKey = dayKeyFromDate(date);
  const cfg = workingHours?.[dayKey];

  const layout = useMemo(() => {
    if (!cfg?.active) return null;
    const dayStart = timeToMin(cfg.start);
    const dayEnd = timeToMin(cfg.end);

    // Build a sorted list of all "occupied" intervals (bookings + blocks + break)
    const occ = [];
    for (const b of bookings) {
      occ.push({ kind: 'booking', data: b, start: timeToMin(b.time), end: timeToMin(b.time) + (b.duration || 20) });
    }
    for (const bl of blocks) {
      occ.push({ kind: 'block', data: bl, start: timeToMin(bl.time), end: timeToMin(bl.time) + (bl.duration || 20) });
    }
    if (cfg.break?.start && cfg.break?.end) {
      occ.push({ kind: 'break', start: timeToMin(cfg.break.start), end: timeToMin(cfg.break.end) });
    }
    occ.sort((a, b) => a.start - b.start);

    // Free intervals = gaps between occupied
    const free = [];
    let cursor = dayStart;
    for (const o of occ) {
      if (o.start > cursor) free.push({ start: cursor, end: o.start });
      cursor = Math.max(cursor, o.end);
    }
    if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd });

    return { dayStart, dayEnd, occ, free };
  }, [cfg, bookings, blocks]);

  if (!cfg?.active) {
    return <div className="empty">סגור ביום זה</div>;
  }
  if (!layout) return null;

  const { dayStart, dayEnd, occ, free } = layout;
  const totalHeight = (dayEnd - dayStart) * PX_PER_MIN;

  // Whole-hour markers
  const startHour = Math.ceil(dayStart / 60);
  const endHour = Math.floor(dayEnd / 60);
  const hours = [];
  for (let h = startHour; h <= endHour; h++) {
    hours.push({ h, top: (h * 60 - dayStart) * PX_PER_MIN });
  }

  return (
    <div className="day-timeline" style={{ height: totalHeight + 10 }}>
      {hours.map(({ h, top }) => (
        <div key={h} className="dt-hour" style={{ top }}>
          <span className="dt-hour-label">{`${String(h).padStart(2, '0')}:00`}</span>
          <div className="dt-hour-line" />
        </div>
      ))}

      {free.flatMap((f, fi) => {
        // Render each free gap as discrete 20-min sub-slots so the barber
        // can block any specific 20-min cell, not just the start of a merged gap.
        if (f.end - f.start < 20) return [];
        const cells = [];
        for (let s = f.start; s + 20 <= f.end; s += 20) {
          const top = (s - dayStart) * PX_PER_MIN;
          const height = 20 * PX_PER_MIN - 1; // 1px gap between cells
          cells.push(
            <div
              key={`f${fi}-${s}`}
              className="dt-free"
              style={{ top, height }}
              onClick={() => onFreeSlotTap?.(minToTime(s), 20)}
            >
              <span className="dt-free-label">+ {minToTime(s)}</span>
            </div>
          );
        }
        return cells;
      })}

      {occ.map((o, i) => {
        const top = (o.start - dayStart) * PX_PER_MIN;
        const height = (o.end - o.start) * PX_PER_MIN;
        if (o.kind === 'break') {
          return (
            <div key={`br${i}`} className="dt-break" style={{ top, height }}>
              <Coffee size={13} className="icon-inline" />הפסקה
            </div>
          );
        }
        if (o.kind === 'block') {
          const bl = o.data;
          return (
            <div
              key={bl.id}
              className={`dt-block ${bl.wholeDay ? 'whole-day' : ''}`}
              style={{ top, height }}
              onClick={() => !bl.wholeDay && onBlockTap?.(bl)}
            >
              <Ban size={13} className="icon-inline" />{bl.reason || 'חסום'}
              {height > 40 && bl.duration > 60 && <div className="dt-block-meta">{Math.round(bl.duration / 60)} שעות</div>}
            </div>
          );
        }
        // booking
        const b = o.data;
        const inProgress = b.status === 'inProgress';
        const completed = b.status === 'completed';
        return (
          <div
            key={b.id}
            className={`dt-booking ${inProgress ? 'in-progress' : ''} ${completed ? 'completed' : ''}`}
            style={{ top, height }}
            onClick={() => onBookingTap?.(b)}
          >
            <div className="dt-time">
              {b.time}–{addMinToTime(b.time, b.duration || 20)}
              {inProgress && <span className="dt-badge" style={{ color: '#4ade80' }}><Circle size={9} fill="currentColor" /></span>}
              {completed && <span className="dt-badge"><Check size={11} /></span>}
              {b.recurringId && <span className="dt-badge"><Repeat size={11} /></span>}
            </div>
            <div className="dt-name">{b.clientName}</div>
            {(b.serviceName || b.addons?.length) && height > 50 && (
              <div className="dt-svc">
                {b.serviceName}
                {b.addons?.length > 0 && ` + ${b.addons.length} תוספות`}
                {b.price > 0 && ` • ₪${b.price}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
