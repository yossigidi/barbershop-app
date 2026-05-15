import { useRef, useState } from 'react';
import { Coffee, Ban, Plus, CalendarPlus, Play, Check } from 'lucide-react';
import { dayKeyFromDate, timeToMin, minToTime, addMinToTime } from '../utils/slots';

// Clean appointments-first day list — the dashboard hero. A vertical
// list of real appointments (avatar · name · service · status · price),
// breaks and blocks as thin dividers, and one subtle tappable "free"
// row per gap. Booking rows are swipeable: swipe right → start the
// appointment, swipe left → complete it (+ thank-you WhatsApp).

const SWIPE_THRESHOLD = 64;
const SWIPE_MAX = 120;

function SwipeableBookingRow({ booking, offsetMin, chairsCount, onTap, onStart, onComplete }) {
  const [dx, setDx] = useState(0);
  const startPt = useRef(null);
  const moved = useRef(false);

  const b = booking;
  const inProgress = b.status === 'inProgress';
  const completed = b.status === 'completed';
  const pending = b.status === 'pendingApproval';
  // Pending bookings can't be swipe-started/completed — they need an
  // approval decision first (tap to open the action sheet).
  const canStart = b.status === 'booked';
  const canComplete = b.status === 'booked' || b.status === 'inProgress';
  const shifted = offsetMin > 0 && b.status === 'booked' ? addMinToTime(b.time, offsetMin) : null;

  function onPointerDown(e) {
    startPt.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  }
  function onPointerMove(e) {
    if (!startPt.current) return;
    const dX = e.clientX - startPt.current.x;
    const dY = e.clientY - startPt.current.y;
    if (!moved.current) {
      if (Math.abs(dX) < 8) return;
      // vertical intent → let the page scroll, abandon the swipe
      if (Math.abs(dY) > Math.abs(dX)) { startPt.current = null; return; }
      moved.current = true;
    }
    let v = dX;
    if (v > 0 && !canStart) v = v * 0.15;     // resist if action unavailable
    if (v < 0 && !canComplete) v = v * 0.15;
    setDx(Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, v)));
  }
  function onPointerUp() {
    if (!startPt.current && !moved.current) { setDx(0); return; }
    const wasMoved = moved.current;
    const finalDx = dx;
    startPt.current = null;
    moved.current = false;
    setDx(0);
    if (!wasMoved) { onTap?.(); return; }
    if (finalDx >= SWIPE_THRESHOLD && canStart) onStart?.();
    else if (finalDx <= -SWIPE_THRESHOLD && canComplete) onComplete?.();
  }

  // RTL note: dx>0 is a finger-move to the right → "start"; dx<0 → "complete".
  const startActive = dx >= SWIPE_THRESHOLD;
  const doneActive = dx <= -SWIPE_THRESHOLD;

  return (
    <div className="sl-swipe">
      <div className={`sl-swipe-bg sl-swipe-start ${startActive ? 'armed' : ''}`}
           style={{ opacity: canStart ? Math.min(1, Math.max(0, dx) / SWIPE_THRESHOLD) : 0 }}>
        <Play size={18} /> התחל
      </div>
      <div className={`sl-swipe-bg sl-swipe-done ${doneActive ? 'armed' : ''}`}
           style={{ opacity: canComplete ? Math.min(1, Math.max(0, -dx) / SWIPE_THRESHOLD) : 0 }}>
        <Check size={18} /> סיים
      </div>
      <div
        className={`sl-row ${inProgress ? 'is-now' : ''} ${completed ? 'is-done' : ''} ${pending ? 'is-pending' : ''}`}
        style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? 'transform 0.22s var(--ease-back)' : 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { startPt.current = null; moved.current = false; setDx(0); }}
        onPointerLeave={onPointerUp}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap?.(); } }}
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
              {pending ? 'ממתין' : completed ? 'הושלם' : inProgress ? 'עכשיו' : 'מתוכנן'}
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}

export default function ScheduleList({
  date, workingHours, bookings, blocks, chairsCount = 1, offsetMin = 0,
  onBookingTap, onStartBooking, onCompleteBooking, onFreeSlotTap, onBlockTap,
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

  if (items.length === 0) {
    return (
      <button type="button" className="sl-empty" onClick={() => onFreeSlotTap?.(cfg.start)}>
        <CalendarPlus size={30} />
        <strong>היום עוד פנוי לגמרי</strong>
        <span>לחץ "+ תור חדש" למעלה, או כאן כדי לקבוע תור</span>
      </button>
    );
  }

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
      <p className="sl-hint">החלק תור ימינה כדי להתחיל · שמאלה כדי לסיים ולשלוח תודה</p>
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
        const b = row.data;
        return (
          <SwipeableBookingRow
            key={b.id}
            booking={b}
            offsetMin={offsetMin}
            chairsCount={chairsCount}
            onTap={() => onBookingTap?.(b)}
            onStart={() => onStartBooking?.(b)}
            onComplete={() => onCompleteBooking?.(b)}
          />
        );
      })}
    </div>
  );
}
