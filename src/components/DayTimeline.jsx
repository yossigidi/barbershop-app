import { useMemo } from 'react';
import { Coffee, Ban, Check, Repeat, Circle, Scissors } from 'lucide-react';
import { dayKeyFromDate, timeToMin, minToTime, addMinToTime } from '../utils/slots';

// 1.8 px/min → 20-min cell = 36px tall. Reliable finger-tap target on
// phone/tablet without making a 10-hour workday a 2-screen scroll.
const PX_PER_MIN = 1.8;

// Multi-chair barbershops: each booking can carry a `chairNumber` (1..N).
// The timeline arranges them into one column per chair so the operator
// can see "who's in chair 2 right now" at a glance. When chairsCount is
// 1 (the default), we render the previous single-column layout.

export default function DayTimeline({
  date, workingHours, bookings, blocks, chairsCount = 1,
  onBookingTap, onFreeSlotTap, onBlockTap,
}) {
  const dayKey = dayKeyFromDate(date);
  const cfg = workingHours?.[dayKey];
  const chairs = Math.max(1, Math.min(10, Number(chairsCount) || 1));

  const layout = useMemo(() => {
    if (!cfg?.active) return null;
    const dayStart = timeToMin(cfg.start);
    const dayEnd = timeToMin(cfg.end);

    // Bookings can have a chairNumber 1..N. Anything without one (legacy
    // bookings or single-chair shops) falls into chair 1.
    const occByChair = Array.from({ length: chairs }, () => []);
    for (const b of bookings) {
      const ch = Math.max(1, Math.min(chairs, Number(b.chairNumber) || 1));
      occByChair[ch - 1].push({
        kind: 'booking',
        data: b,
        start: timeToMin(b.time),
        end: timeToMin(b.time) + (b.duration || 20),
      });
    }
    // Blocks are shop-wide — they apply to every chair (the whole shop
    // is closed). Render them in every column.
    const sharedBlocks = blocks.map((bl) => ({
      kind: 'block',
      data: bl,
      start: timeToMin(bl.time),
      end: timeToMin(bl.time) + (bl.duration || 20),
    }));
    // Lunch break, same — applies to all chairs.
    let sharedBreak = null;
    if (cfg.break?.start && cfg.break?.end && (cfg.break.mode || 'closed') === 'closed') {
      sharedBreak = {
        kind: 'break',
        start: timeToMin(cfg.break.start),
        end: timeToMin(cfg.break.end),
      };
    }
    // Per-chair occupied list (bookings on that chair + shared blocks/break)
    const perChair = occByChair.map((own) => {
      const all = [...own, ...sharedBlocks, ...(sharedBreak ? [sharedBreak] : [])];
      all.sort((a, b) => a.start - b.start);
      return all;
    });
    // Free intervals per chair (gaps between occupied)
    const freePerChair = perChair.map((occ) => {
      const free = [];
      let cursor = dayStart;
      for (const o of occ) {
        if (o.start > cursor) free.push({ start: cursor, end: o.start });
        cursor = Math.max(cursor, o.end);
      }
      if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd });
      return free;
    });
    return { dayStart, dayEnd, perChair, freePerChair };
  }, [cfg, bookings, blocks, chairs]);

  if (!cfg?.active) {
    return <div className="empty">סגור ביום זה</div>;
  }
  if (!layout) return null;

  const { dayStart, dayEnd, perChair, freePerChair } = layout;
  const totalHeight = (dayEnd - dayStart) * PX_PER_MIN;

  // Hour gridlines — drawn once, sit BEHIND the chair columns
  const startHour = Math.ceil(dayStart / 60);
  const endHour = Math.floor(dayEnd / 60);
  const hours = [];
  for (let h = startHour; h <= endHour; h++) {
    hours.push({ h, top: (h * 60 - dayStart) * PX_PER_MIN });
  }

  return (
    <div className={`day-timeline ${chairs > 1 ? 'is-multi-chair' : ''}`}>
      {/* Per-chair column header (only when multi-chair) */}
      {chairs > 1 && (
        <div className="dt-chair-headers" style={{ display: 'grid', gridTemplateColumns: `repeat(${chairs}, 1fr)`, gap: 6, marginBottom: 8 }}>
          {Array.from({ length: chairs }).map((_, i) => (
            <div key={i} className="dt-chair-header">
              <Scissors size={13} aria-hidden="true" className="icon-inline" />
              כסא {i + 1}
            </div>
          ))}
        </div>
      )}

      <div
        className="dt-grid"
        style={{
          position: 'relative',
          height: totalHeight + 10,
          display: 'grid',
          gridTemplateColumns: `repeat(${chairs}, 1fr)`,
          gap: 6,
        }}
      >
        {/* Hour gridlines — span ALL columns */}
        {hours.map(({ h, top }) => (
          <div
            key={h}
            className="dt-hour"
            style={{ top, gridColumn: `1 / span ${chairs}`, position: 'absolute', left: 0, right: 0 }}
          >
            <span className="dt-hour-label">{`${String(h).padStart(2, '0')}:00`}</span>
            <div className="dt-hour-line" />
          </div>
        ))}

        {/* Per-chair columns */}
        {Array.from({ length: chairs }).map((_, chairIdx) => {
          const free = freePerChair[chairIdx];
          const occ = perChair[chairIdx];
          return (
            <div
              key={chairIdx}
              className="dt-chair-column"
              style={{ position: 'relative', height: totalHeight }}
            >
              {/* Free 20-min cells — clickable to block */}
              {free.flatMap((f, fi) => {
                if (f.end - f.start < 20) return [];
                const cells = [];
                for (let s = f.start; s + 20 <= f.end; s += 20) {
                  const top = (s - dayStart) * PX_PER_MIN;
                  const height = 20 * PX_PER_MIN - 1;
                  cells.push(
                    <div
                      key={`f${chairIdx}-${fi}-${s}`}
                      className="dt-free"
                      style={{ top, height }}
                      onClick={() => onFreeSlotTap?.(minToTime(s), 20, chairIdx + 1)}
                    >
                      <span className="dt-free-label">+ {minToTime(s)}</span>
                    </div>
                  );
                }
                return cells;
              })}

              {/* Occupied: bookings + blocks + break */}
              {occ.map((o, i) => {
                const top = (o.start - dayStart) * PX_PER_MIN;
                const height = (o.end - o.start) * PX_PER_MIN;
                if (o.kind === 'break') {
                  return (
                    <div key={`br${chairIdx}-${i}`} className="dt-break" style={{ top, height }}>
                      <Coffee size={13} className="icon-inline" />הפסקה
                    </div>
                  );
                }
                if (o.kind === 'block') {
                  const bl = o.data;
                  return (
                    <div
                      key={`bl${chairIdx}-${bl.id}`}
                      className={`dt-block ${bl.wholeDay ? 'whole-day' : ''}`}
                      style={{ top, height }}
                      onClick={() => !bl.wholeDay && onBlockTap?.(bl)}
                    >
                      <Ban size={13} className="icon-inline" />{bl.reason || 'חסום'}
                      {height > 40 && bl.duration > 60 && (
                        <div className="dt-block-meta">{Math.round(bl.duration / 60)} שעות</div>
                      )}
                    </div>
                  );
                }
                // Booking — the polished card. Always shows: client name,
                // service line, time range. Status badges (in-progress
                // dot, completed check, recurring) line up next to the
                // time. Compact mode kicks in for very short cells.
                const b = o.data;
                const inProgress = b.status === 'inProgress';
                const completed = b.status === 'completed';
                const compact = height < 32;
                return (
                  <div
                    key={`bk${chairIdx}-${b.id}`}
                    className={`dt-booking ${inProgress ? 'in-progress' : ''} ${completed ? 'completed' : ''} ${compact ? 'compact' : ''}`}
                    style={{ top, height }}
                    onClick={() => onBookingTap?.(b)}
                  >
                    {compact ? (
                      <div className="dt-compact">
                        <span className="dt-name-compact">{b.clientName || 'תור'}</span>
                        <span className="dt-time-compact">
                          {b.time}
                          {inProgress && (
                            <span className="dt-badge" style={{ color: '#4ade80', marginInlineStart: 4 }}>
                              <Circle size={8} fill="currentColor" />
                            </span>
                          )}
                          {completed && (
                            <span className="dt-badge" style={{ marginInlineStart: 4 }}>
                              <Check size={9} />
                            </span>
                          )}
                          {b.recurringId && (
                            <span className="dt-badge" style={{ marginInlineStart: 4 }}>
                              <Repeat size={9} />
                            </span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="dt-name">
                          {b.clientName || 'תור'}
                          {inProgress && (
                            <span className="dt-badge" style={{ color: '#4ade80', marginInlineStart: 6 }}>
                              <Circle size={9} fill="currentColor" />
                            </span>
                          )}
                          {completed && (
                            <span className="dt-badge" style={{ marginInlineStart: 6 }}>
                              <Check size={11} />
                            </span>
                          )}
                          {b.recurringId && (
                            <span className="dt-badge" style={{ marginInlineStart: 6 }}>
                              <Repeat size={11} />
                            </span>
                          )}
                        </div>
                        <div className="dt-time">{b.time}–{addMinToTime(b.time, b.duration || 20)}</div>
                        {b.serviceName && (
                          <div className="dt-svc">
                            {b.serviceName}
                            {b.addons?.length > 0 && ` + ${b.addons.length} תוספות`}
                            {b.price > 0 && ` • ₪${b.price}`}
                          </div>
                        )}
                        {b.employeeName && height > 60 && (
                          <div className="dt-svc" style={{ fontStyle: 'italic', marginTop: 2 }}>
                            עם {b.employeeName}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
