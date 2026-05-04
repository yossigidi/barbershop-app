import { useEffect, useState } from 'react';
import { Scissors, Hand, Hourglass, Clock, CalendarDays } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { dateToISO, timeToMin, minToTime } from '../utils/slots';

// Live wait estimate for a client revisiting the booking page after they've made
// a booking. Reads localStorage for the saved bookingId, subscribes to that
// barber's bookings for the day, and shows ETA + delay.
//
// ETA logic: walk through the day's bookings in order; for the in-progress one
// (if any) compute its actual finish-by based on startedAt vs scheduled duration;
// for queued ones, push their start by overrun. Stop when we reach our own.

export default function LiveStatusBanner({ barberId, barberName }) {
  const [myBooking, setMyBooking] = useState(null);
  const [dayBookings, setDayBookings] = useState([]);
  const [now, setNow] = useState(Date.now());

  // Load my booking from localStorage
  useEffect(() => {
    if (!barberId) return;
    const id = localStorage.getItem(`bs_lastBooking_${barberId}`);
    if (!id) return;
    (async () => {
      const snap = await getDoc(doc(db, 'barbers', barberId, 'bookings', id));
      if (!snap.exists()) {
        localStorage.removeItem(`bs_lastBooking_${barberId}`);
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      // Only show banner for bookings today/tomorrow that aren't completed/cancelled
      const todayISO = dateToISO(new Date());
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = dateToISO(tomorrow);
      if (data.date !== todayISO && data.date !== tomorrowISO) return;
      if (data.status === 'cancelled' || data.status === 'completed') {
        if (data.status === 'completed') localStorage.removeItem(`bs_lastBooking_${barberId}`);
        return;
      }
      setMyBooking(data);
    })();
  }, [barberId]);

  // Subscribe to all bookings on my booking's date
  useEffect(() => {
    if (!myBooking) return;
    const q = query(
      collection(db, 'barbers', barberId, 'bookings'),
      where('date', '==', myBooking.date),
    );
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.time.localeCompare(b.time));
      setDayBookings(list);
      // Refresh self in case status changed
      const me = list.find((x) => x.id === myBooking.id);
      if (me) setMyBooking(me);
    });
  }, [myBooking?.id, myBooking?.date, barberId]);

  // Tick every 30s
  useEffect(() => {
    if (!myBooking) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [myBooking]);

  if (!myBooking) return null;
  if (myBooking.status === 'completed' || myBooking.status === 'cancelled') return null;

  const isToday = myBooking.date === dateToISO(new Date());

  // Compute ETA — walk the queue
  const queue = dayBookings.filter(
    (b) => b.status === 'booked' || b.status === 'inProgress',
  );
  let etaMs = null;
  let cursorMs = null;
  for (const b of queue) {
    let bStartMs;
    if (b.status === 'inProgress' && b.startedAt) {
      bStartMs = b.startedAt.toMillis ? b.startedAt.toMillis() : Date.parse(b.startedAt);
    } else {
      const [y, m, d] = b.date.split('-').map(Number);
      const [h, mm] = b.time.split(':').map(Number);
      const sched = new Date(y, m - 1, d, h, mm).getTime();
      bStartMs = cursorMs != null ? Math.max(sched, cursorMs) : sched;
    }
    const bEndMs = bStartMs + (b.duration || 20) * 60000;
    if (b.id === myBooking.id) {
      etaMs = bStartMs;
      break;
    }
    cursorMs = bEndMs;
  }

  if (etaMs == null) return null;

  // Scheduled (no delay) start
  const [y, m, d] = myBooking.date.split('-').map(Number);
  const [h, mm] = myBooking.time.split(':').map(Number);
  const scheduledMs = new Date(y, m - 1, d, h, mm).getTime();
  const delayMin = Math.max(0, Math.round((etaMs - scheduledMs) / 60000));
  const minutesUntil = Math.round((etaMs - now) / 60000);
  const inProgressNow = queue.some((b) => b.status === 'inProgress');

  const timeStr = minToTime(timeToMin(myBooking.time));
  const etaTimeStr = (() => {
    const d = new Date(etaMs);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  })();

  let icon, main, sub;
  if (myBooking.status === 'inProgress') {
    icon = <Scissors size={20} />;
    main = 'אתה בכיסא עכשיו';
    sub = 'בהצלחה!';
  } else if (isToday && minutesUntil <= 5 && minutesUntil >= -5) {
    icon = <Hand size={20} />;
    main = 'הגיע תורך!';
    sub = inProgressNow ? 'הספר כמעט מסיים, הכנס בעוד רגע' : 'אפשר להיכנס';
  } else if (isToday && delayMin >= 5) {
    icon = <Hourglass size={20} />;
    main = `הספר מאחר ${delayMin} דק׳`;
    sub = `התור שלך ב-${timeStr} → הערכה: ${etaTimeStr}`;
  } else if (isToday) {
    icon = <Clock size={20} />;
    main = `התור שלך ב-${timeStr}`;
    sub = minutesUntil > 0 ? `עוד ${minutesUntil} דקות` : 'בקרוב';
  } else {
    icon = <CalendarDays size={20} />;
    main = `התור שלך מחר ב-${timeStr}`;
    sub = `${myBooking.serviceName || ''}${myBooking.duration ? ` • ${myBooking.duration} דק׳` : ''}`;
  }

  return (
    <div className="card live-status">
      <div className="live-main"><span className="icon-inline">{icon}</span>{main}</div>
      <div className="muted live-sub">{sub}</div>
      <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
        {barberName} • מתעדכן אוטומטית
      </div>
    </div>
  );
}
