import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  computeSlotsForDate, dateToISO, formatDateHe, nextNDays,
  DAY_LABELS_HE, dayKeyFromDate,
} from '../utils/slots';
import Calendar from './Calendar.jsx';

export default function RescheduleModal({ booking, barber, barberId, onClose, onConfirm }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const [y, m, d] = booking.date.split('-').map(Number);
    return new Date(y, m - 1, d);
  });
  const [occupied, setOccupied] = useState([]);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    (async () => {
      const iso = dateToISO(selectedDate);
      const bq = query(
        collection(db, 'barbers', barberId, 'bookings'),
        where('date', '==', iso),
        where('status', '==', 'booked'),
      );
      const blq = query(
        collection(db, 'barbers', barberId, 'blocks'),
        where('date', '==', iso),
      );
      const [bSnap, blSnap] = await Promise.all([getDocs(bq), getDocs(blq)]);
      // Exclude the booking being rescheduled from the "occupied" list so its
      // current slot stays selectable on the same day
      const list = [
        ...bSnap.docs
          .filter((d) => d.id !== booking.id)
          .map((d) => ({ time: d.data().time, duration: d.data().duration || 20 })),
        ...blSnap.docs.map((d) => ({ time: d.data().time, duration: d.data().duration || 20 })),
      ];
      setOccupied(list);
    })();
  }, [selectedDate, barberId, booking.id]);

  const days = useMemo(() => nextNDays(14), []);
  const duration = booking.duration || 20;
  const slots = useMemo(
    () => computeSlotsForDate(selectedDate, barber?.workingHours, occupied, duration),
    [selectedDate, barber, occupied, duration],
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>📅 העברת תור</h2>
        <p className="muted" style={{ marginTop: -8 }}>
          {booking.clientName} • כרגע: {formatDateHe(new Date(booking.date))} ב-{booking.time}
        </p>
        <Calendar
          days={days}
          selectedDate={selectedDate}
          onSelect={(d) => { setSelectedDate(d); setPicked(null); }}
          workingHours={barber.workingHours}
        />
        <div className="muted text-center" style={{ marginBottom: 12 }}>
          {DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}, {formatDateHe(selectedDate)}
        </div>
        {slots.length === 0 ? (
          <div className="empty">סגור ביום זה</div>
        ) : (
          <div className="slots">
            {slots.map((s) => (
              <div
                key={s.time}
                className={`slot ${!s.available ? 'booked' : ''} ${picked === s.time ? 'selected' : ''}`}
                onClick={() => s.available && setPicked(s.time)}
              >
                {s.time}
              </div>
            ))}
          </div>
        )}
        <div className="spacer" />
        <button
          className="btn-primary"
          onClick={() => onConfirm(dateToISO(selectedDate), picked)}
          disabled={!picked}
          style={{ width: '100%' }}
        >
          ✓ אשר העברה
        </button>
      </div>
    </div>
  );
}
