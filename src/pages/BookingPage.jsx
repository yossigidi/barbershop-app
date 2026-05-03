import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc, getDoc, setDoc, addDoc, collection, query, where, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  computeSlotsForDate, dateToISO, formatDateHe, nextNDays,
  DAY_LABELS_HE, dayKeyFromDate, addMinToTime, timeToMin,
} from '../utils/slots';
import Calendar from '../components/Calendar.jsx';
import LiveStatusBanner from '../components/LiveStatusBanner.jsx';
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
  const [recurring, setRecurring] = useState(false);
  const [recurEvery, setRecurEvery] = useState(3); // weeks
  const [recurTimes, setRecurTimes] = useState(8);

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

      const baseDoc = {
        time,
        duration: totalDuration,
        price: totalPrice,
        serviceId: pickedService.id,
        serviceName: pickedService.name,
        addons: selectedAddons,
        clientName: `${c.firstName} ${c.lastName}`,
        clientPhone: c.phone,
        status: 'booked',
      };

      // Build dates: first one + optional recurring
      const dates = [iso];
      let recurringId = null;
      if (recurring && recurEvery > 0 && recurTimes > 1) {
        recurringId = `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        for (let i = 1; i < recurTimes; i++) {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() + i * 7 * recurEvery);
          dates.push(dateToISO(d));
        }
      }

      // Check conflicts in advance for each date (single doc query each).
      const created = [];
      const skipped = [];
      for (const d of dates) {
        const conflictQ = query(
          collection(db, 'barbers', barberId, 'bookings'),
          where('date', '==', d),
          where('status', '==', 'booked'),
        );
        const blockQ = query(
          collection(db, 'barbers', barberId, 'blocks'),
          where('date', '==', d),
        );
        const [bSnap, blSnap] = await Promise.all([getDocs(conflictQ), getDocs(blockQ)]);
        const occ = [
          ...bSnap.docs.map((x) => ({ time: x.data().time, duration: x.data().duration || 20 })),
          ...blSnap.docs.map((x) => ({ time: x.data().time, duration: x.data().duration || 20 })),
        ];
        const slotMin = timeToMin(time);
        const slotEnd = slotMin + totalDuration;
        const conflict = occ.some((o) => {
          const oS = timeToMin(o.time), oE = oS + o.duration;
          return slotMin < oE && slotEnd > oS;
        });
        if (conflict) { skipped.push(d); continue; }

        const ref = await addDoc(collection(db, 'barbers', barberId, 'bookings'), {
          ...baseDoc,
          date: d,
          recurringId: recurringId || null,
          createdAt: serverTimestamp(),
        });
        created.push({ id: ref.id, date: d });
      }

      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId,
          bookingId: created[0]?.id,
          title: created.length > 1 ? `${created.length} תורים חדשים!` : 'תור חדש!',
          body: `${c.firstName} ${c.lastName} — ${formatDateHe(selectedDate)} ב-${time}${created.length > 1 ? ` + ${created.length - 1} תורים נוספים` : ''}`,
        }),
      }).catch(() => {});

      // Save first booking id for client revisit
      if (created.length > 0) {
        try { localStorage.setItem(`bs_lastBooking_${barberId}`, created[0].id); } catch {}
      }

      setSuccess({
        id: created[0]?.id,
        time,
        date: iso,
        addons: selectedAddons,
        createdCount: created.length,
        skipped: skipped.length,
      });
      setPickedTime(null);
      setPickedAddonIds([]);
      setRecurring(false);
    } catch (e) {
      alert('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinWaitlist() {
    if (!client) return;
    try {
      const iso = dateToISO(selectedDate);
      await addDoc(collection(db, 'barbers', barberId, 'waitlist'), {
        clientName: `${client.firstName} ${client.lastName}`,
        clientPhone: client.phone,
        fromDate: iso,
        toDate: iso,
        createdAt: serverTimestamp(),
      });
      alert('נרשמת לרשימת ההמתנה. הספר ייצור איתך קשר אם יתפנה משהו.');
    } catch (e) {
      alert('שגיאה: ' + e.message);
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
          <h2>{success.createdCount > 1 ? `${success.createdCount} תורים נקבעו!` : 'התור נקבע!'}</h2>
          <p className="muted">
            {formatDateHe(selectedDate)} ({DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}) בשעה <strong>{success.time}</strong>
            {totalDuration ? ` • ${totalDuration} דק׳` : ''}
            {totalPrice ? ` • ₪${totalPrice}` : ''}
          </p>
          {success.createdCount > 1 && (
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              חוזר אוטומטית כל {recurEvery} שבועות, סה״כ {success.createdCount} פעמים
              {success.skipped > 0 && ` (${success.skipped} דולגו עקב התנגשות)`}
            </p>
          )}
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

      <LiveStatusBanner barberId={barberId} barberName={barber.businessName} />

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
                  className={`service-card ${active ? 'active' : ''} ${s.isPackage ? 'is-package' : ''}`}
                  onClick={() => setPickedService(s)}
                  type="button"
                >
                  {s.isPackage && <span className="service-pkg-pill">חבילה</span>}
                  <div className="service-card-name">{s.name}</div>
                  <div className="service-card-meta">
                    {s.duration} דק׳{s.price ? ` • ₪${s.price}` : ''}
                  </div>
                  {s.description && (
                    <div className="service-card-desc">{s.description}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {addons.length > 0 && pickedService && !pickedService.isPackage && (
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

        <div className="card-inset" style={{ marginBottom: 12 }}>
          <label className="row" style={{ alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              style={{ width: 22, height: 22, flex: 'none', accentColor: 'var(--accent)', marginLeft: 8 }}
            />
            <span style={{ flex: 1 }}><strong>🔁 תור קבוע</strong> <span className="muted">(אותה שעה, חוזר)</span></span>
          </label>
          {recurring && (
            <div className="row" style={{ marginTop: 10 }}>
              <div>
                <label className="muted" style={{ fontSize: '0.85rem' }}>כל</label>
                <select value={recurEvery} onChange={(e) => setRecurEvery(Number(e.target.value))}>
                  <option value={1}>שבוע</option>
                  <option value={2}>שבועיים</option>
                  <option value={3}>3 שבועות</option>
                  <option value={4}>4 שבועות</option>
                </select>
              </div>
              <div>
                <label className="muted" style={{ fontSize: '0.85rem' }}>סה״כ פעמים</label>
                <select value={recurTimes} onChange={(e) => setRecurTimes(Number(e.target.value))}>
                  <option value={4}>4</option>
                  <option value={6}>6</option>
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={20}>20</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <h3>בחר שעה</h3>
        {slots.length === 0 ? (
          <div className="empty">סגור ביום זה</div>
        ) : slots.every((s) => !s.available) ? (
          <>
            <div className="empty">אין שעות פנויות בתאריך זה</div>
            {client && (
              <button
                className="btn-primary"
                onClick={joinWaitlist}
                style={{ width: '100%', marginTop: 8 }}
              >
                🔔 הצטרף לרשימת המתנה — נודיע אם יתפנה
              </button>
            )}
          </>
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
