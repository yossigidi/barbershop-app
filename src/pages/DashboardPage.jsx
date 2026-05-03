import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { dateToISO, formatDateHe, nextNDays, DAY_LABELS_HE, dayKeyFromDate } from '../utils/slots';
import { registerFcmToken, requestPushPermission } from '../utils/push';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [barber, setBarber] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [pushStatus, setPushStatus] = useState('idle');

  useEffect(() => {
    if (!user) return;
    const unsubBarber = onSnapshot(doc(db, 'barbers', user.uid), (snap) => {
      if (snap.exists()) setBarber({ id: snap.id, ...snap.data() });
    });
    const q = query(
      collection(db, 'barbers', user.uid, 'bookings'),
      where('status', '==', 'booked'),
    );
    const unsubBookings = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      setBookings(list);
    });
    return () => { unsubBarber(); unsubBookings(); };
  }, [user]);

  const days = useMemo(() => nextNDays(14), []);
  const selectedISO = dateToISO(selectedDate);
  const dayBookings = bookings.filter((b) => b.date === selectedISO);
  const upcomingCount = bookings.filter((b) => b.date >= dateToISO(new Date())).length;

  const shortLink = barber?.shortCode
    ? `${window.location.origin}/b/${barber.shortCode}`
    : '';

  async function copyLink() {
    if (!shortLink) return;
    try {
      await navigator.clipboard.writeText(shortLink);
      alert('הלינק הועתק! שלח ללקוחות.');
    } catch {
      prompt('העתק את הלינק:', shortLink);
    }
  }

  async function enablePush() {
    setPushStatus('requesting');
    try {
      const token = await requestPushPermission();
      if (!token) {
        setPushStatus('denied');
        return;
      }
      await registerFcmToken(user.uid, token);
      setPushStatus('enabled');
    } catch (e) {
      console.error(e);
      setPushStatus('error');
    }
  }

  async function cancelBooking(b) {
    if (!confirm(`לבטל את התור של ${b.clientName} ב-${b.time}?`)) return;
    try {
      await updateDoc(doc(db, 'barbers', user.uid, 'bookings', b.id), { status: 'cancelled' });
    } catch (e) {
      alert('שגיאה: ' + e.message);
    }
  }

  if (!barber) return <div className="loading">טוען…</div>;

  const tokenInstalled = (barber.fcmTokens || []).length > 0;

  return (
    <div className="app">
      <div className="header">
        <h1>{barber.businessName || 'הספרות שלי'}</h1>
        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={logout}>יציאה</button>
      </div>

      <div className="card">
        <div className="muted">לינק להזמנת תור — שלח ללקוחות:</div>
        <div className="spacer" />
        <div className="copy-link" onClick={copyLink}>{shortLink || '—'}</div>
        <div className="row" style={{ marginTop: 12 }}>
          <Link to="/settings" style={{ flex: 1 }}>
            <button className="btn-secondary" style={{ width: '100%' }}>הגדרות שעות עבודה</button>
          </Link>
        </div>
      </div>

      {!tokenInstalled && pushStatus !== 'enabled' && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <strong>🔔 הפעל התראות פוש</strong>
          <p className="muted" style={{ marginTop: 6, marginBottom: 12 }}>
            כדי לקבל התראה בכל הזמנת תור חדשה. <strong>באייפון:</strong> תחילה הוסף את האפליקציה למסך הבית
            (כפתור שיתוף ← הוסף למסך הבית) ופתח אותה משם.
          </p>
          <button className="btn-primary" onClick={enablePush} disabled={pushStatus === 'requesting'} style={{ width: '100%' }}>
            {pushStatus === 'requesting' ? 'מבקש הרשאה…' : 'הפעל התראות'}
          </button>
          {pushStatus === 'denied' && <p className="text-danger">הרשאה נדחתה. אפשר לאפשר בהגדרות הדפדפן.</p>}
          {pushStatus === 'error' && <p className="text-danger">שגיאה — ודא שהאפליקציה מותקנת על מסך הבית.</p>}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>📅 תורים — {upcomingCount} צפויים</h3>
        <div className="day-strip">
          {days.map((d) => {
            const iso = dateToISO(d);
            const count = bookings.filter((b) => b.date === iso).length;
            const active = iso === selectedISO;
            return (
              <div key={iso} className={`day-pill ${active ? 'active' : ''}`} onClick={() => setSelectedDate(d)}>
                <div className="day-name">{DAY_LABELS_HE[dayKeyFromDate(d)].slice(0, 3)}</div>
                <div className="day-num">{formatDateHe(d)}</div>
                {count > 0 && <div style={{ fontSize: '0.75rem', marginTop: 4 }}>{count} תורים</div>}
              </div>
            );
          })}
        </div>

        {dayBookings.length === 0 ? (
          <div className="empty">אין תורים ליום זה</div>
        ) : (
          <div>
            {dayBookings.map((b) => (
              <div key={b.id} className="booking-item">
                <div>
                  <div className="time">{b.time}</div>
                  <div className="name">{b.clientName}</div>
                  <div className="phone">
                    <a href={`tel:${b.clientPhone}`} style={{ color: 'inherit' }}>{b.clientPhone}</a>
                  </div>
                </div>
                <button className="btn-secondary" onClick={() => cancelBooking(b)}>בטל</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
