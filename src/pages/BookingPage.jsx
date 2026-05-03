import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc, getDoc, setDoc, addDoc, collection, query, where, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  computeSlotsForDate, dateToISO, formatDateHe, nextNDays,
  DAY_LABELS_HE, dayKeyFromDate,
} from '../utils/slots';

const PHONE_KEY = 'bs_phone';

function normalizePhone(raw) {
  return (raw || '').replace(/[^\d]/g, '');
}

export default function BookingPage() {
  const { code } = useParams();
  const [barber, setBarber] = useState(null);
  const [barberId, setBarberId] = useState(null);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [bookedTimes, setBookedTimes] = useState([]);
  const [pickedTime, setPickedTime] = useState(null);
  const [client, setClient] = useState(null); // {firstName,lastName,phone}
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null);

  // Resolve short code → barber
  useEffect(() => {
    (async () => {
      try {
        const codeSnap = await getDoc(doc(db, 'shortCodes', code));
        if (!codeSnap.exists()) {
          setError('לינק לא תקין');
          return;
        }
        const uid = codeSnap.data().uid;
        const barberSnap = await getDoc(doc(db, 'barbers', uid));
        if (!barberSnap.exists()) {
          setError('הספר לא נמצא');
          return;
        }
        setBarberId(uid);
        setBarber(barberSnap.data());
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [code]);

  // Try to auto-load returning client from localStorage
  useEffect(() => {
    if (!barberId) return;
    const phone = localStorage.getItem(`${PHONE_KEY}_${barberId}`);
    if (!phone) return;
    (async () => {
      const snap = await getDoc(doc(db, 'barbers', barberId, 'clients', phone));
      if (snap.exists()) setClient(snap.data());
    })();
  }, [barberId]);

  // Load bookings for selected date
  useEffect(() => {
    if (!barberId) return;
    (async () => {
      const iso = dateToISO(selectedDate);
      const q = query(
        collection(db, 'barbers', barberId, 'bookings'),
        where('date', '==', iso),
        where('status', '==', 'booked'),
      );
      const snap = await getDocs(q);
      setBookedTimes(snap.docs.map((d) => d.data().time));
    })();
  }, [barberId, selectedDate, success]);

  const days = useMemo(() => nextNDays(14), []);
  const slots = useMemo(
    () => computeSlotsForDate(selectedDate, barber?.workingHours, bookedTimes),
    [selectedDate, barber, bookedTimes],
  );

  function pickSlot(time) {
    setPickedTime(time);
    if (client) {
      // confirm immediately
      confirmBooking(time, client);
    } else {
      setShowLogin(true);
    }
  }

  async function loginByPhone() {
    const phone = normalizePhone(pendingPhone);
    if (phone.length < 9) {
      alert('מספר טלפון לא תקין');
      return;
    }
    setBusy(true);
    try {
      const snap = await getDoc(doc(db, 'barbers', barberId, 'clients', phone));
      if (snap.exists()) {
        const data = snap.data();
        setClient(data);
        localStorage.setItem(`${PHONE_KEY}_${barberId}`, phone);
        setShowLogin(false);
        if (pickedTime) confirmBooking(pickedTime, data);
      } else {
        // first time — show signup
        setShowLogin(false);
        setShowSignup(true);
      }
    } catch (e) {
      alert('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function signup() {
    const phone = normalizePhone(pendingPhone);
    if (!firstName.trim() || !lastName.trim() || phone.length < 9) {
      alert('מלא את כל השדות');
      return;
    }
    setBusy(true);
    try {
      const data = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'barbers', barberId, 'clients', phone), data);
      setClient(data);
      localStorage.setItem(`${PHONE_KEY}_${barberId}`, phone);
      setShowSignup(false);
      if (pickedTime) confirmBooking(pickedTime, data);
    } catch (e) {
      alert('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmBooking(time, c) {
    setBusy(true);
    try {
      const iso = dateToISO(selectedDate);
      const ref = await addDoc(collection(db, 'barbers', barberId, 'bookings'), {
        date: iso,
        time,
        clientName: `${c.firstName} ${c.lastName}`,
        clientPhone: c.phone,
        status: 'booked',
        createdAt: serverTimestamp(),
      });

      // Fire push notification (non-blocking; OK if it fails)
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId,
          title: 'תור חדש!',
          body: `${c.firstName} ${c.lastName} — ${formatDateHe(selectedDate)} ב-${time}`,
        }),
      }).catch(() => {});

      setSuccess({ id: ref.id, time, date: iso });
      setPickedTime(null);
    } catch (e) {
      alert('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="app"><div className="card text-center text-danger">{error}</div></div>;
  if (!barber) return <div className="loading">טוען…</div>;

  if (success) {
    return (
      <div className="app">
        <div className="header"><h1>{barber.businessName}</h1></div>
        <div className="card text-center">
          <div style={{ fontSize: '3rem' }}>✅</div>
          <h2>התור נקבע!</h2>
          <p className="muted">{formatDateHe(selectedDate)} ({DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}) בשעה <strong>{success.time}</strong></p>
          <div className="spacer" />
          <button className="btn-secondary" onClick={() => { setSuccess(null); }} style={{ width: '100%' }}>
            הזמנת תור נוסף
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <h1>{barber.businessName}</h1>
      </div>

      {client && (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>שלום</div>
            <strong>{client.firstName} {client.lastName}</strong>
          </div>
          <button
            className="btn-secondary"
            style={{ padding: '6px 12px' }}
            onClick={() => {
              localStorage.removeItem(`${PHONE_KEY}_${barberId}`);
              setClient(null);
            }}
          >
            לא אני
          </button>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>בחר יום</h3>
        <div className="day-strip">
          {days.map((d) => {
            const iso = dateToISO(d);
            const active = iso === dateToISO(selectedDate);
            const dayKey = dayKeyFromDate(d);
            const dayCfg = barber.workingHours?.[dayKey];
            const closed = !dayCfg?.active;
            return (
              <div
                key={iso}
                className={`day-pill ${active ? 'active' : ''}`}
                onClick={() => !closed && setSelectedDate(d)}
                style={closed ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
              >
                <div className="day-name">{DAY_LABELS_HE[dayKey].slice(0, 3)}</div>
                <div className="day-num">{formatDateHe(d)}</div>
              </div>
            );
          })}
        </div>

        <h3>בחר שעה</h3>
        {slots.length === 0 ? (
          <div className="empty">סגור ביום זה</div>
        ) : (
          <div className="slots">
            {slots.map((s) => (
              <div
                key={s.time}
                className={`slot ${s.booked ? 'booked' : ''} ${pickedTime === s.time ? 'selected' : ''}`}
                onClick={() => !s.booked && pickSlot(s.time)}
              >
                {s.time}
              </div>
            ))}
          </div>
        )}
      </div>

      {showLogin && (
        <div className="modal-backdrop" onClick={() => setShowLogin(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>הזן טלפון</h2>
            <p className="muted">אם הזמנת אצלנו בעבר, נזהה אותך אוטומטית.</p>
            <div className="field">
              <input
                type="tel"
                inputMode="tel"
                placeholder="050-1234567"
                value={pendingPhone}
                onChange={(e) => setPendingPhone(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={loginByPhone} disabled={busy} style={{ width: '100%' }}>
              {busy ? 'בודק…' : 'המשך'}
            </button>
          </div>
        </div>
      )}

      {showSignup && (
        <div className="modal-backdrop" onClick={() => setShowSignup(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>פעם ראשונה? נכיר! 👋</h2>
            <div className="field">
              <label>שם פרטי</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="field">
              <label>שם משפחה</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="field">
              <label>טלפון</label>
              <input type="tel" value={pendingPhone} onChange={(e) => setPendingPhone(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={signup} disabled={busy} style={{ width: '100%' }}>
              {busy ? 'שומר…' : 'אשר וקבע תור'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
