import { useMemo } from 'react';
import { timeToMin, minToTime } from '../utils/slots';

const MIN_GAP = 45; // minutes

// Scan today's timeline for gaps ≥ MIN_GAP between consecutive bookings/blocks
// and suggest blocking them as breaks before they get booked into.
export default function BreakSuggestions({ todayBookings, todayBlocks, onBlock }) {
  const suggestions = useMemo(() => {
    const items = [
      ...todayBookings
        .filter((b) => b.status === 'booked' || b.status === 'inProgress')
        .map((b) => ({ start: timeToMin(b.time), end: timeToMin(b.time) + (b.duration || 20) })),
      ...todayBlocks.map((b) => ({
        start: timeToMin(b.time),
        end: timeToMin(b.time) + (b.duration || 20),
      })),
    ].sort((a, b) => a.start - b.start);

    const out = [];
    const nowMin = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
    for (let i = 0; i < items.length - 1; i++) {
      const gap = items[i + 1].start - items[i].end;
      if (gap >= MIN_GAP && items[i + 1].start > nowMin) {
        out.push({ start: items[i].end, end: items[i + 1].start, length: gap });
      }
    }
    return out.slice(0, 2); // max 2 suggestions
  }, [todayBookings, todayBlocks]);

  if (suggestions.length === 0) return null;

  return (
    <div className="card break-suggestion">
      <strong>☕ הצעת הפסקה חכמה</strong>
      <p className="muted" style={{ marginTop: 4, marginBottom: 10, fontSize: '0.85rem' }}>
        זיהיתי חלון ריק רצוף — רוצה לחסום אותו לפני שיתפוס לקוח?
      </p>
      {suggestions.map((s, i) => (
        <div key={i} className="break-row">
          <div>
            <div style={{ fontWeight: 700 }}>{minToTime(s.start)}–{minToTime(s.end)}</div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>{s.length} דק׳ רצופות</div>
          </div>
          <button
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.9rem' }}
            onClick={() => onBlock(minToTime(s.start), s.length)}
          >
            ☕ חסום
          </button>
        </div>
      ))}
    </div>
  );
}
