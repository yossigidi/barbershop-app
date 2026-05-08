import { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { dateToISO, dayKeyFromDate, DAYS_OF_WEEK } from '../utils/slots';

// Full-month calendar with prev/next month navigation. Used in the
// public BookingPage so clients can pick a date 2+ months ahead, and on
// the operator dashboard for past-month review.
//
// Props:
//   selectedDate: Date — the currently picked day
//   onSelect: (Date) => void
//   workingHours: WorkingHours map (to grey-out closed days)
//   maxMonthsAhead: number (default 12) — how far the user can navigate
//   allowPast: boolean (default true) — controls whether the user can
//     navigate to months BEFORE the current month. When true (barber
//     dashboard) the prev button always renders so the operator can
//     review past days. When false (public booking page) the prev button
//     is hidden while the user is on the current month, but appears
//     again the moment they navigate forward, so they can return.
//   bookingsByDate: { 'YYYY-MM-DD': count } — optional badge on each day

const SHORT_DAY = {
  sunday: 'א', monday: 'ב', tuesday: 'ג', wednesday: 'ד',
  thursday: 'ה', friday: 'ו', saturday: 'ש',
};

const HEB_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function MonthCalendar({
  selectedDate,
  onSelect,
  workingHours,
  maxMonthsAhead = 12,
  bookingsByDate,
  compact = false,
  allowPast = true,
}) {
  // Anchor month — drives the visible grid. Default = month of selectedDate.
  const [anchor, setAnchor] = useState(() => {
    const d = new Date(selectedDate || new Date());
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + maxMonthsAhead, 1);
  const canGoBack = anchor > todayMonth;
  const canGoForward = anchor < maxMonth;

  function changeMonth(delta) {
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + delta, 1));
  }

  // Build the 7-column grid of days for this month, padding with empty
  // leading cells so the 1st falls under the right weekday column.
  const cells = useMemo(() => {
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startCol = firstDay.getDay();
    const result = [];
    for (let i = 0; i < startCol; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(new Date(year, month, d));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [anchor]);

  const todayISO = dateToISO(today);
  const selectedISO = selectedDate ? dateToISO(selectedDate) : '';

  return (
    <div className={`month-calendar ${compact ? 'is-compact' : ''}`}>
      <div className="month-nav">
        <button
          type="button"
          className="month-nav-btn month-nav-next"
          onClick={() => changeMonth(1)}
          disabled={!canGoForward}
          aria-label="חודש הבא"
        >
          <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <div className="month-label">
          {HEB_MONTHS[anchor.getMonth()]} {anchor.getFullYear()}
        </div>
        {(allowPast || canGoBack) ? (
          <button
            type="button"
            className="month-nav-btn month-nav-prev"
            onClick={() => changeMonth(-1)}
            disabled={!canGoBack}
            aria-label="חודש קודם"
          >
            <ChevronRight size={22} strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : (
          // Visual spacer so the month label stays centered while the
          // back-button is hidden (public booking page, on current month).
          <div className="month-nav-spacer" aria-hidden="true" />
        )}
      </div>

      <div className="calendar-row calendar-headers">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="calendar-head">{SHORT_DAY[day]}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="calendar-cell empty" />;
          const iso = dateToISO(d);
          const dayKey = dayKeyFromDate(d);
          const dayCfg = workingHours?.[dayKey];
          const closed = workingHours && !dayCfg?.active;
          const isToday = iso === todayISO;
          const isSelected = iso === selectedISO;
          const isPast = d < today;
          const disabled = closed || isPast;
          const count = bookingsByDate?.[iso] || 0;

          let cls = 'calendar-cell';
          if (isSelected) cls += ' active';
          else if (isToday) cls += ' today';
          if (disabled) cls += ' closed';

          return (
            <button
              key={iso}
              className={cls}
              onClick={() => !disabled && onSelect(d)}
              disabled={disabled}
              type="button"
              aria-label={`${d.getDate()}/${d.getMonth() + 1}${disabled ? ' — לא זמין' : ''}`}
            >
              <span className="calendar-num">{d.getDate()}</span>
              {count > 0 && <span className="calendar-badge">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
