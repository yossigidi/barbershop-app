import { Coffee, Ban, Plus, CalendarPlus } from 'lucide-react';
import { dayKeyFromDate, timeToMin, minToTime, addMinToTime } from '../utils/slots';

// Clean appointments-first day list — the dashboard hero. A vertical
// list of real appointments (avatar · name · service · status · price),
// breaks and blocks as thin dividers, and one subtle tappable "free"
// row per gap (not a noisy per-20-min grid). Replaces the old
// pixel-positioned DayTimeline on the schedule view.

export default function ScheduleList({
  date, workingHours, bookings, blocks, chairsCount = 1, offsetMin = 0,
  onBookingTap, onFreeSlotTap, onBlockTap,
}) {
  const dayKey = dayKeyFromDate(date);
  const cfg = workingHours?.[dayKey];
  if (!cfg?.active) return <div className="sl-closed">סגור ביום זה</div>;

  const wholeDayBlock = (blocks || []).find((bl) => bl.wholeDay);
  if (wholeDayBlock) {
    return <div className="sl-closed">{wholeDayBlock.reason || 'סגור'} — אין תורים ביום זה</div>;
  }

  const dayStart = timeToMin(cfg.start);
  const dayEnd = timeToMin(cfg.end);

  // Occupied list — bookings + timed blocks + lunch break.
  const items = [];
  for (const b of bookings) {
    items.push({ kind: 'booking', data: b, start: timeToMin(b.time), end: timeToMin(b.time) + (b.duration || 20) });
  }
  for (const bl of (blocks || [])) {
    if (bl.wholeDay) continue;
    items.push({ kind: 'block', data: bl, start: timeToMin(bl.time), end: timeToMin(bl.time) + (bl.duration || 20) });
  }
  if (cfg.break?.start && cfg.break?.end && (cfg.break.mode || 'closed') === 'closed') {
    items.push({ kind: 'break', start: timeToMin(cfg.break.start), end: timeToMin(cfg.break.end) });
  }
  items.sort((a, b) => a.start - b.start);

  // Friendly empty state — whole day open.
  if (items.length === 0) {
    return (
      <button type="button" className="sl-empty" onClick={() => onFreeSlotTap?.(cfg.start)}>
        <CalendarPlus size={30} />
        <strong>היום עוד פנוי לגמרי</strong>
        <span>לחץ "+ תור חדש" למעלה, או כאן כדי לקבוע תור</span>
      </button>
    );
  }

  // Weave free-gap rows between occupied items.
  const rows = [];
  let cursor = dayStart;
  for (const it of items) {
    if (it.start - cursor >= 20) rows.push({ kind: 'free', start: cursor, end: it.start });
    rows.push(it);
    cursor = Math.max(cursor, it.end);
  }
  if (dayEnd - cursor >= 20) rows.push({ kind: 'free', start: cursor, end: dayEnd });

  const range = (s, e) => <span dir="ltr">{minToTime(s)}–{minToTime(e)}</span>;

  return (
    <div className="sl">
      {rows.map((row, i) => {
        if (row.kind === 'free') {
          return (
            <button
              key={`f${i}`}
              type="button"
              className="sl-free"
              onClick={() => onFreeSlotTap?.(minToTime(row.start))}
            >
              <Plus size={14} />
              <span>פנוי · {range(row.start, row.end)}</span>
            </button>
          );
        }
        if (row.kind === 'break') {
          return (
            <div key={`br${i}`} className="sl-divider sl-break">
              <Coffee size={14} /> הפסקה · {range(row.start, row.end)}
            </div>
          );
        }
        if (row.kind === 'block') {
          const bl = row.data;
          return (
            <button
              key={bl.id}
              type="button"
              className="sl-divider sl-block"
              onClick={() => onBlockTap?.(bl)}
            >
              <Ban size={14} /> חסום · {range(row.start, row.end)}{bl.reason ? ` · ${bl.reason}` : ''}
            </button>
          );
        }
        // booking row
        const b = row.data;
        const inProgress = b.status === 'inProgress';
        const completed = b.status === 'completed';
        const shifted = offsetMin > 0 && b.status === 'booked' ? addMinToTime(b.time, offsetMin) : null;
        return (
          <button
            key={b.id}
            type="button"
            className={`sl-row ${inProgress ? 'is-now' : ''} ${completed ? 'is-done' : ''}`}
            onClick={() => onBookingTap?.(b)}
          >
            <span className="sl-time">
              <span className="sl-time-hh" dir="ltr">{b.time}</span>
              <span className="sl-time-dur">{b.duration || 20} ד׳</span>
              {shifted && <span className="sl-time-shift" dir="ltr">≈{shifted}</span>}
            </span>
            <span className="sl-card">
              <span className="sl-avatar">{(b.clientName || '?').trim().charAt(0) || '?'}</span>
              <span className="sl-info">
                <span className="sl-name">{b.clientName || 'תור'}</span>
                <span className="sl-svc">
                  {b.serviceName || 'תור'}
                  {chairsCount > 1 && b.chairNumber ? ` · כיסא ${b.chairNumber}` : ''}
                  {b.addons?.length > 0 ? ` · +${b.addons.length}` : ''}
                </span>
              </span>
              <span className="sl-side">
                {b.price > 0 && <span className="sl-price">₪{b.price}</span>}
                <span className={`sl-status sl-status-${b.status}`}>
                  {completed ? 'הושלם' : inProgress ? 'עכשיו' : 'מתוכנן'}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
