import { Clock, Play, AlarmClock, RotateCcw, X } from 'lucide-react';
import AccessibleModal from './AccessibleModal.jsx';

// Live running-schedule manager. The barber's day drifts — they fall
// behind, they catch up. These two pieces keep them oriented:
//
//  • RunningStatusBanner — always-visible "you're X min behind" strip.
//  • AppointmentDueModal — pops when an appointment's (offset-adjusted)
//    time arrives: start it now, or declare a delay that pushes the rest
//    of the day. The client's confirmed time never changes — this is a
//    display-only offset the barber sees.

function fmtOffset(min) {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  if (h && m) return `${h} שע׳ ${m} דק׳`;
  if (h) return `${h} שעות`;
  return `${m} דק׳`;
}

export function RunningStatusBanner({ offsetMin, onReset }) {
  if (!offsetMin) return null;
  return (
    <div className="run-banner" role="status">
      <span className="run-banner-icon"><Clock size={16} /></span>
      <span className="run-banner-text">
        אתה בפיגור של <strong>{fmtOffset(offsetMin)}</strong> — הזמנים בלוח מעודכנים בהתאם
      </span>
      <button type="button" className="run-banner-reset" onClick={onReset}>
        <RotateCcw size={13} /> אפס
      </button>
    </div>
  );
}

export function AppointmentDueModal({ booking, offsetMin, onStart, onDelay, onSnooze, onClose }) {
  if (!booking) return null;
  const adjusted = offsetMin > 0
    ? ` (בפועל ~${shiftTime(booking.time, offsetMin)})`
    : '';
  return (
    <AccessibleModal open onClose={onClose} titleId="appt-due-title" maxWidth="420px" showCloseButton={false}>
      <div className="appt-due">
        <div className="appt-due-pulse"><AlarmClock size={30} /></div>
        <h2 id="appt-due-title" className="appt-due-title">הגיע הזמן לתור</h2>
        <div className="appt-due-card">
          <div className="appt-due-time">{booking.time}{adjusted}</div>
          <div className="appt-due-name">{booking.clientName || 'לקוח'}</div>
          <div className="appt-due-svc">{booking.serviceName || 'תור'} · {booking.duration || 20} דק׳</div>
        </div>

        <button type="button" className="btn-mint appt-due-start" onClick={onStart}>
          <Play size={18} className="icon-inline" /> התחל תור עכשיו
        </button>

        <div className="appt-due-delay-label">מתעכב? דחה את שאר היום:</div>
        <div className="appt-due-delays">
          {[10, 20, 30].map((m) => (
            <button key={m} type="button" className="appt-due-delay" onClick={() => onDelay(m)}>
              +{m} דק׳
            </button>
          ))}
        </div>

        <button type="button" className="appt-due-snooze" onClick={onSnooze}>
          תזכיר לי בעוד 5 דקות
        </button>
        <button type="button" className="appt-due-close" onClick={onClose} aria-label="סגור">
          <X size={18} />
        </button>
      </div>
    </AccessibleModal>
  );
}

// "HH:MM" + minutes → "HH:MM"
function shiftTime(time, addMin) {
  const [h, m] = String(time || '0:0').split(':').map(Number);
  let total = h * 60 + m + addMin;
  total = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
