import { dateToISO, dayKeyFromDate, DAYS_OF_WEEK } from '../utils/slots';

const SHORT_DAY = {
  sunday: 'א',
  monday: 'ב',
  tuesday: 'ג',
  wednesday: 'ד',
  thursday: 'ה',
  friday: 'ו',
  saturday: 'ש',
};

export default function Calendar({ days, selectedDate, onSelect, workingHours, bookingsByDate }) {
  if (!days?.length) return null;
  const todayISO = dateToISO(new Date());

  // Pad leading cells so the first day appears under its weekday column
  const startCol = days[0].getDay();
  const totalCells = Math.ceil((startCol + days.length) / 7) * 7;
  const cells = [];
  for (let i = 0; i < startCol; i++) cells.push(null);
  for (const d of days) cells.push(d);
  while (cells.length < totalCells) cells.push(null);

  const selectedISO = dateToISO(selectedDate);

  return (
    <div className="calendar">
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
          const count = bookingsByDate?.[iso] || 0;

          let cls = 'calendar-cell';
          if (isSelected) cls += ' active';
          else if (isToday) cls += ' today';
          if (closed) cls += ' closed';

          return (
            <button
              key={iso}
              className={cls}
              onClick={() => !closed && onSelect(d)}
              disabled={closed}
              type="button"
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
