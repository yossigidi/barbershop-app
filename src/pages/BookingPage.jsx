import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc, getDoc, setDoc, addDoc, collection, query, where, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  computeSlotsForDate, dateToISO, formatDateHe, nextNDays,
  DAY_LABELS_HE, dayKeyFromDate, addMinToTime,
} from '../utils/slots';
import Calendar from '../components/Calendar.jsx';
import { buildIcs, downloadIcs } from '../utils/ics';

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
  const [occupied, setOccupied] = useState([]);
  const [pickedTime, setPickedTime] = useState(null);
  const [pickedService, setPickedService] = useState(null);
  const [pickedAddonIds, setPickedAddonIds] = useState([]);
  const [client, setClient] = useState(null);
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
        if (!codeSnap.exists()) return setError('לינק לא תקין');
        const uid = codeSnap.data().uid;
        const barberSnap = await getDoc(doc(db, 'barbers', uid));
        if (!barberSnap.exists()) return setError('הספר לא נמצא');
        setBarberId(uid);
        setBarber(barberSnap.data());
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [code]);

  // Returning client
  useEffect(() => {
    if (!barberId) return;
    const phone = localStorage.getItem(`${PHONE_KEY}_${barberId}`);
    if (!phone) return;
    (async () => {
      const snap = await getDoc(doc(db, 'barbers', barberId, 'clients', phone));
      if (snap.exists()) setClient(snap.data());
    })();
  }, [barberId]);

  // Default-pick first service when barber loads
  useEffect(() => {
    if (!barber) return;
    const services = barber.services || [];
    if (services.length > 0 && !pickedService) {
      setPickedService(services[0]);
    } else if (services.length === 0 && !pickedService) {
      setPickedService({
        id: '_default',
        name: 'תור',
        duration: barber.defaultDuration || 20,
        price: barber.defaultPrice || 0,
      });
    }
  }, [barber, pickedService]);

  // Load bookings + blocks for selected date → "occupied"
  useEffect(() => {
    if (!barberId) return;
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
      const list = [
        ...bSnap.docs.map((d) => ({ time: d.data().time, duration: d.data().duration || 20 })),
        ...blSnap.docs.map((d) => ({ time: d.data().time, duration: d.data().duration || 20 })),
      ];
      setOccupied(list);
    })();
  }, [barberId, selectedDate, success]);

  const totalDuration = useMemo(() => {
    if (!pickedService) return 20;
    const addonDur = (barber?.addons || [])
      .filter((a) => pickedAddonIds.includes(a.id))
      .reduce((sum, a) => sum + (a.duration || 0), 0);
    return (pickedService.duration || 20) + addonDur;
  }, [pickedService, pickedAddonIds, barber]);

  const totalPrice = useMemo(() => {
    if (!pickedService) return 0;
    const addonPrice = (barber?.addons || [])
      .filter((a) => pickedAddonIds.includes(a.id))
      .reduce((sum, a) => sum + (a.price || 0), 0);
    return (pickedService.price || 0) + addonPrice;
  }, [pickedService, pickedAddonIds, barber]);

  const days = useMemo(() => nextNDays(14), []);
  const slots = useMemo(
    () => computeSlotsForDate(selectedDate, barber?.workingHours, occupied, totalDuration),
    [selectedDate, barber, occupied, totalDuration],
  );

  function pickSlot(time) {
    setPickedTime(time);
    if (client) confirmBooking(time, client);
    else setShowLogin(true);
  }

  function toggleAddon(id) {
    setPickedAddonIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  }

  async function loginByPhone() {
    const phone = normalizePhone(pendingPhone);
    if (phone.length < 9) return alert('מספר טלפון לא תקין');
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
      return alert('מלא את כל השדות');
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
      const selectedAddons = (barber?.addons || [])
        .filter((a) => pickedAddonIds.includes(a.id))
        .map((a) => ({ id: a.id, name: a.name, duration: a.duration || 0, price: a.price || 0 }));
      const ref = await addDoc(collection(db, 'barbers', barberId, 'bookings'), {
        date: iso,
        time,
        duration: totalDuration,
        price: totalPrice,
        serviceId: pickedService.id,
        serviceName: pickedService.name,
        addons: selectedAddons,
        clientName: `${c.firstName} ${c.lastName}`,
        clientPhone: c.phone,
        status: 'booked',
        createdAt: serverTimestamp(),
      });

      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId,
          title: 'תור חדש!',
          body: `${c.firstName} ${c.lastName} — ${formatDateHe(selectedDate)} ב-${time}`,
        }),
      }).catch(() => {});

      setSuccess({ id: ref.id, time, date: iso, addons: selectedAddons });
      setPickedTime(null);
      setPickedAddonIds([]);
    } catch (e) {
      alert('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadCalendarInvite() {
    if (!success) return;
    const summary = `${barber.businessName} — ${pickedService?.name || 'תור'}`;
    const lines = [
      `שירות: ${pickedService?.name || 'תור'}`,
      success.addons?.length ? `תוספות: ${success.addons.map((a) => a.name).join(', ')}` : '',
      `אורך: ${totalDuration} דק׳`,
      totalPrice ? `מחיר: ₪${totalPrice}` : '',
    ].filter(Boolean);
    const ics = buildIcs({
      dateISO: success.date,
      time: success.time,
      durationMin: totalDuration,
      summary,
      description: lines.join('\n'),
      location: barber.businessName || '',
      uid: success.id,
    });
    downloadIcs(`${barber.businessName || 'תור'}-${success.date}-${success.time}.ics`, ics);
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
          <p className="muted">
            {formatDateHe(selectedDate)} ({DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}) בשעה <strong>{success.time}</strong>
            {totalDuration ? ` • ${totalDuration} דק׳` : ''}
            {totalPrice ? ` • ₪${totalPrice}` : ''}
          </p>
          {success.addons?.length > 0 && (
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              כולל: {success.addons.map((a) => a.name).join(' • ')}
            </p>
          )}
          <div className="spacer" />
          <button className="btn-primary" onClick={downloadCalendarInvite} style={{ width: '100%', marginBottom: 8 }}>
            📅 הוסף ליומן (תזכורת אוטומטית)
          </button>
          <button className="btn-secondary" onClick={() => { setSuccess(null); }} style={{ width: '100%' }}>
            הזמנת תור נוסף
          </button>
        </div>
      </div>
    );
  }

  const services = barber.services || [];
  const addons = barber.addons || [];

  return (
    <div className="app">
      <div className="header"><h1>{barber.businessName}</h1></div>

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

      {services.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>בחר שירות</h3>
          <div className="service-list">
            {services.map((s) => {
              const active = pickedService?.id === s.id;
              return (
                <button
                  key={s.id}
                  className={`service-card ${active ? 'active' : ''}`}
                  onClick={() => setPickedService(s)}
                  type="button"
                >
                  <div className="service-card-name">{s.name}</div>
                  <div className="service-card-meta">
                    {s.duration} דק׳{s.price ? ` • ₪${s.price}` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {addons.length > 0 && pickedService && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>תוספות (אופציונלי)</h3>
          <div className="addon-list">
            {addons.map((a) => {
              const checked = pickedAddonIds.includes(a.id);
              return (
                <label key={a.id} className={`addon-row ${checked ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAddon(a.id)}
                  />
                  <div className="addon-info">
                    <div className="addon-name">{a.name}</div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      {a.duration ? `+${a.duration} דק׳` : ''}{a.price ? ` • +₪${a.price}` : ''}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>בחר יום</h3>
        <Calendar
          days={days}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          workingHours={barber.workingHours}
        />
        <div className="muted text-center" style={{ marginBottom: 12 }}>
          {DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}, {formatDateHe(selectedDate)}
          {pickedService && (
            <> • סה״כ {totalDuration} דק׳{totalPrice ? ` • ₪${totalPrice}` : ''}</>
          )}
        </div>

        <h3>בחר שעה</h3>
        {slots.length === 0 ? (
          <div className="empty">סגור ביום זה</div>
        ) : slots.every((s) => !s.available) ? (
          <div className="empty">אין שעות פנויות בתאריך זה</div>
        ) : (
          <div className="slots">
            {slots.map((s) => (
              <div
                key={s.time}
                className={`slot ${!s.available ? 'booked' : ''} ${pickedTime === s.time ? 'selected' : ''}`}
                onClick={() => s.available && pickSlot(s.time)}
              >
                {s.time}
                {s.available && pickedService?.duration > 20 && (
                  <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>עד {addMinToTime(s.time, totalDuration)}</div>
                )}
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
