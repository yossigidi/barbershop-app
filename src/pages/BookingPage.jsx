import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isReservedSlug } from '../utils/slugs';
import {
  CheckCircle2, CalendarPlus, CreditCard, Repeat, Bell, Check,
  Calendar as CalendarIcon, Clock, Hourglass, Scissors as ScissorsIcon,
  Sparkles, CircleDollarSign, User,
} from 'lucide-react';
import { db } from '../firebase';
import {
  doc, getDoc, setDoc, addDoc, collection, query, where, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  computeSlotsForDate, dateToISO, formatDateHe, nextNDays,
  DAY_LABELS_HE, dayKeyFromDate, addMinToTime, timeToMin,
} from '../utils/slots';
import { getRecommendedSlots, SLOT_REASONS } from '../utils/slotScoring';
import Calendar from '../components/Calendar.jsx';
import MonthCalendar from '../components/MonthCalendar.jsx';
import LiveStatusBanner from '../components/LiveStatusBanner.jsx';
import { buildIcs, downloadIcs } from '../utils/ics';

const PHONE_KEY = 'bs_phone';

// 20-char URL-safe random token — uses crypto.getRandomValues for true
// randomness, base36-style alphabet (lowercase + digits)
function generateManageToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function normalizePhone(raw) {
  return (raw || '').replace(/[^\d]/g, '');
}

export default function BookingPage() {
  const { code } = useParams();
  const navigate = useNavigate();
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
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState('date'); // 'date' | 'time' | 'summary'
  const [client, setClient] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [recurEvery, setRecurEvery] = useState(3); // weeks
  const [recurTimes, setRecurTimes] = useState(8);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [usualHour, setUsualHour] = useState(null);

  // Resolve short code → barber. The same component handles both
  // /b/:code (legacy 6-char auto-codes) and /:code (custom slugs like
  // /ramos). When the code looks like an internal route name or doesn't
  // resolve to a barber, redirect home so a typo doesn't show an error.
  useEffect(() => {
    if (!code) return;
    if (isReservedSlug(code)) {
      navigate('/', { replace: true });
      return;
    }
    (async () => {
      try {
        const codeSnap = await getDoc(doc(db, 'shortCodes', code.toLowerCase()));
        if (!codeSnap.exists()) {
          navigate('/', { replace: true });
          return;
        }
        const uid = codeSnap.data().uid;
        const barberSnap = await getDoc(doc(db, 'barbers', uid));
        if (!barberSnap.exists()) {
          navigate('/', { replace: true });
          return;
        }
        setBarberId(uid);
        setBarber(barberSnap.data());
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [code, navigate]);

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

  // Phase 3 — when a returning client is identified, look at their last few
  // bookings and find their most-used hour-of-day. Used as a high-priority
  // "your usual time" recommendation.
  useEffect(() => {
    if (!client || !barberId) { setUsualHour(null); return; }
    (async () => {
      try {
        const q = query(
          collection(db, 'barbers', barberId, 'bookings'),
          where('clientPhone', '==', client.phone),
        );
        const snap = await getDocs(q);
        const hourCounts = {};
        snap.docs.forEach((d) => {
          const t = d.data().time || '';
          const h = t.slice(0, 2);
          if (h) hourCounts[h] = (hourCounts[h] || 0) + 1;
        });
        const top = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] >= 2) setUsualHour(top[0]);
        else setUsualHour(null);
      } catch (e) {
        console.warn('usual-hour lookup failed:', e);
      }
    })();
  }, [client, barberId]);

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

  // Smart Slot Engine — pick 1-3 "best" slots based on the day's shape.
  const recommended = useMemo(() => {
    return getRecommendedSlots(slots, occupied, selectedDate, new Date(), totalDuration);
  }, [slots, occupied, selectedDate, totalDuration]);

  // Inject "usual time" as the highest-priority recommendation for returning
  // clients (Phase 3) — only if the slot is actually available today.
  const recommendedWithUsual = useMemo(() => {
    if (!usualHour) return recommended;
    const usualSlot = (slots || []).find(
      (s) => s.available && s.time.startsWith(usualHour),
    );
    if (!usualSlot) return recommended;
    if (recommended.some((r) => r.time === usualSlot.time)) return recommended;
    const enriched = [{ time: usualSlot.time, reason: 'usual', score: 100 }, ...recommended];
    return enriched.slice(0, 3).sort((a, b) => a.time.localeCompare(b.time));
  }, [recommended, usualHour, slots]);

  // Group AVAILABLE slots by period of day: morning < 12:00, afternoon < 17:00, evening ≥ 17:00.
  // Booked/blocked slots are hidden — clients only see what they can actually book.
  const slotGroups = useMemo(() => {
    const groups = [
      { key: 'morning', label: 'בוקר', items: [] },
      { key: 'afternoon', label: 'צהריים', items: [] },
      { key: 'evening', label: 'ערב', items: [] },
    ];
    for (const s of slots) {
      if (!s.available) continue;
      const h = parseInt(s.time.slice(0, 2), 10);
      if (h < 12) groups[0].items.push(s);
      else if (h < 17) groups[1].items.push(s);
      else groups[2].items.push(s);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [slots]);


  // Today's open status — for the brand-header tagline
  const todayStatus = useMemo(() => {
    if (!barber?.workingHours) return null;
    const today = new Date();
    const dayKey = dayKeyFromDate(today);
    const cfg = barber.workingHours[dayKey];
    if (!cfg?.active) return { open: false, text: 'סגור היום' };
    const nowMin = today.getHours() * 60 + today.getMinutes();
    const startMin = timeToMin(cfg.start);
    const endMin = timeToMin(cfg.end);
    if (nowMin < startMin) return { open: false, text: `פותח ב-${cfg.start}` };
    if (nowMin >= endMin) return { open: false, text: 'סגור עכשיו' };
    return { open: true, text: `פתוח עד ${cfg.end}` };
  }, [barber]);

  // Initials for wordmark fallback when no logo
  const initials = useMemo(() => {
    const name = (barber?.businessName || '').trim();
    if (!name) return '';
    const parts = name.split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  }, [barber]);

  function pickSlot(time) {
    setPickedTime(time);
  }
  // When the user changes service, addons or date, reset to step 1 so the
  // upstream choices are re-confirmed (slot availability depends on duration).
  useEffect(() => { setWizardStep('date'); setPickedTime(null); }, [pickedService?.id]);
  useEffect(() => { if (wizardStep === 'summary') setPickedTime(null); /* eslint-disable-next-line */ }, [pickedAddonIds.length]);
  useEffect(() => {
    // Date change while in time/summary step → bounce back to time
    if (wizardStep === 'summary') { setWizardStep('time'); setPickedTime(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate?.getTime?.()]);

  // When user clicks "אשר וקבע" in step 3 — gate through login/signup if needed
  function confirmFromSummary() {
    if (!pickedTime || !pickedService) return;
    if (client) {
      confirmBooking(pickedTime, client);
    } else {
      setShowLogin(true);
    }
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
        // Wizard summary step is already open with all details visible —
        // login was the last gate, so finalize the booking immediately.
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
      const cleanEmail = (email || '').trim();
      if (cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        data.email = cleanEmail;
      }
      await setDoc(doc(db, 'barbers', barberId, 'clients', phone), data);
      setClient(data);
      localStorage.setItem(`${PHONE_KEY}_${barberId}`, phone);
      setShowSignup(false);
      // First-time signup — fall straight through to creating the booking
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
        clientEmail: c.email || '',
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

        // 20-char token unique per booking — used by the client to view,
        // cancel, or reschedule via /manage/<token> without logging in
        const manageToken = generateManageToken();

        const ref = await addDoc(collection(db, 'barbers', barberId, 'bookings'), {
          ...baseDoc,
          date: d,
          recurringId: recurringId || null,
          manageToken,
          createdAt: serverTimestamp(),
        });
        created.push({ id: ref.id, date: d, manageToken });

        // Cross-reference: token → {uid, bookingId} so /manage/<token> can
        // resolve the booking path without authentication.
        try {
          await setDoc(doc(db, 'manageTokens', manageToken), {
            uid: barberId,
            bookingId: ref.id,
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          // Non-fatal — booking was still created. Log for visibility.
          console.warn('manageTokens write failed', e?.message);
        }
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

      // If the client provided an email, fire off a confirmation email for
      // the FIRST booking only (recurring → still one summary email).
      // Non-blocking; failure is logged but doesn't break the success flow.
      if (c.email && created[0]?.manageToken) {
        const origin = window.location.origin;
        fetch('/api/send-confirmation-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manageToken: created[0].manageToken,
            email: c.email,
            manageUrl: `${origin}/manage/${created[0].manageToken}`,
          }),
        }).catch((e) => console.warn('email send failed', e?.message));
      }

      setSuccess({
        id: created[0]?.id,
        manageToken: created[0]?.manageToken,
        time,
        date: iso,
        addons: selectedAddons,
        createdCount: created.length,
        skipped: skipped.length,
        emailSentTo: c.email || '',
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
      alert('נרשמת לרשימת ההמתנה. ניצור איתך קשר אם יתפנה משהו.');
    } catch (e) {
      alert('שגיאה: ' + e.message);
    }
  }

  function openPay(kind, phone, amount) {
    const cleanPhone = (phone || '').replace(/[^\d]/g, '');
    if (!cleanPhone) return;
    try { navigator.clipboard.writeText(cleanPhone); } catch {}
    const appName = kind === 'bit' ? 'Bit' : 'PayBox';
    alert(`📋 המספר הועתק: ${cleanPhone}\n💰 סכום: ₪${amount}\n\nפתח את ${appName} ידנית והדבק את המספר.`);
  }

  function manageUrl() {
    if (!success?.manageToken) return '';
    return `${window.location.origin}/manage/${success.manageToken}`;
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
    const link = manageUrl();
    if (link) lines.push('', `לעריכה / ביטול: ${link}`);
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

  function copyManageLink() {
    const link = manageUrl();
    if (!link) return;
    try {
      navigator.clipboard.writeText(link);
      alert('הלינק הועתק! 📋');
    } catch {
      prompt('העתק את הלינק:', link);
    }
  }

  // "Send link to my own WhatsApp" — opens wa.me with the client's own
  // phone, prefilled with the manage link. The client gets a chat with
  // themselves containing the link; works as a backup if email isn't used.
  function shareLinkToSelfWhatsApp() {
    const link = manageUrl();
    if (!link || !client?.phone) return;
    const text = `התור שלי ב-${barber?.businessName || 'העסק'} 📅\n${formatDateHe(selectedDate)} ב-${success?.time}\n\nלעריכה / ביטול:\n${link}`;
    const phone = (client.phone || '').replace(/[^\d]/g, '');
    const intl = phone.startsWith('0') && (phone.length === 9 || phone.length === 10)
      ? '972' + phone.substring(1)
      : phone;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(text)}`, '_blank');
  }

  if (error) return <div className="app"><div className="card text-center text-danger">{error}</div></div>;
  if (!barber) return <div className="loading">טוען…</div>;

  if (success) {
    return (
      <div className="app">
        <div className="brand-header brand-header-row">
          {barber.logoUrl ? (
            <img src={barber.logoUrl} alt={barber.businessName} className="brand-logo" />
          ) : (
            <div className="brand-wordmark" aria-hidden="true">{initials}</div>
          )}
          <div className="brand-text">
            <h1 className="brand-title">{barber.businessName}</h1>
          </div>
        </div>
        <div className="card success-card">
          <div className="success-check">
            <CheckCircle2 size={56} color="var(--success)" strokeWidth={1.75} />
          </div>
          <h2 className="success-headline">{success.createdCount > 1 ? `${success.createdCount} תורים נקבעו!` : 'התור נקבע!'}</h2>
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

          {success.manageToken && (
            <div className="manage-link-box">
              <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 4 }}>לניהול התור (שינוי / ביטול):</div>
              <div className="copy-link" onClick={copyManageLink} title="לחץ להעתקה">
                {manageUrl()}
              </div>
              <div className="muted text-center" style={{ fontSize: '0.74rem', marginTop: 6 }}>
                שמור את הלינק. דרכו תוכל לשנות או לבטל את התור בכל עת.
              </div>
              {success.emailSentTo && (
                <div className="text-center" style={{ fontSize: '0.78rem', marginTop: 8, color: 'var(--success)' }}>
                  ✓ אישור נשלח גם ל-{success.emailSentTo}
                </div>
              )}
              {client?.phone && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={shareLinkToSelfWhatsApp}
                  style={{ width: '100%', marginTop: 10, fontSize: '0.88rem', padding: '10px' }}
                >
                  📲 שלח לי את הלינק בוואטסאפ
                </button>
              )}
            </div>
          )}

          <button className="btn-primary" onClick={downloadCalendarInvite} style={{ width: '100%', marginBottom: 8 }}>
            <CalendarPlus size={18} className="icon-inline" />הוסף ליומן (תזכורת אוטומטית)
          </button>
          <button className="btn-secondary" onClick={() => { setSuccess(null); }} style={{ width: '100%' }}>
            הזמנת תור נוסף
          </button>
        </div>

        {totalPrice > 0 && (barber.paypalUsername || barber.bitLink || barber.payboxLink || barber.bitPhone || barber.payboxPhone) && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}><CreditCard size={18} className="icon-inline" />שלם ₪{totalPrice}</h3>
            <p className="muted" style={{ marginTop: -6 }}>
              {barber.paypalUsername ? 'PayPal פותח עם הסכום מוכן.' : 'לחץ → המספר יועתק ויפתח את האפליקציה.'}
            </p>

            {barber.paypalUsername && (
              <a
                href={`https://www.paypal.com/paypalme/${barber.paypalUsername.replace(/^.*paypal\.me\//i, '')}/${totalPrice}/ILS`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <button className="btn-primary" style={{ width: '100%', background: '#003087', color: 'white', marginBottom: 8 }} type="button">
                  🅿️ שלם ב-PayPal — תשלום מיידי
                </button>
              </a>
            )}

            {barber.bitLink && (
              <a href={barber.bitLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                <button className="btn-primary" style={{ width: '100%', background: '#0066ff', color: 'white', marginBottom: 8 }} type="button">
                  🔵 שלם ב-Bit
                </button>
              </a>
            )}

            {barber.payboxLink && (
              <a href={barber.payboxLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                <button className="btn-primary" style={{ width: '100%', background: '#7C3AED', color: 'white', marginBottom: 8 }} type="button">
                  🟣 שלם ב-PayBox
                </button>
              </a>
            )}

            {!barber.bitLink && barber.bitPhone && (
              <button
                className="btn-primary"
                style={{ width: '100%', background: '#0066ff', color: 'white', marginBottom: 8 }}
                onClick={() => openPay('bit', barber.bitPhone, totalPrice)}
                type="button"
              >
                🔵 העתק מספר Bit
              </button>
            )}

            {!barber.payboxLink && barber.payboxPhone && (
              <button
                className="btn-primary"
                style={{ width: '100%', background: '#7C3AED', color: 'white' }}
                onClick={() => openPay('paybox', barber.payboxPhone, totalPrice)}
                type="button"
              >
                🟣 העתק מספר PayBox
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const services = barber.services || [];
  const addons = barber.addons || [];

  return (
    <div className="app">
      <div className="brand-header brand-header-row">
        {barber.logoUrl ? (
          <img src={barber.logoUrl} alt={barber.businessName} className="brand-logo" />
        ) : (
          <div className="brand-wordmark" aria-hidden="true">{initials}</div>
        )}
        <div className="brand-text">
          <h1 className="brand-title">{barber.businessName}</h1>
          {todayStatus && (
            <div className={`brand-tagline ${todayStatus.open ? '' : 'closed'}`}>
              <span className="dot" />
              {todayStatus.text}
            </div>
          )}
        </div>
      </div>

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
        <div className="card addons-card">
          <button
            type="button"
            className="addons-toggle"
            aria-expanded={addonsOpen}
            aria-controls="addons-list"
            onClick={() => setAddonsOpen((o) => !o)}
          >
            <span className="addons-toggle-label">
              ✨ תוספות
              {pickedAddonIds.length > 0
                ? <span className="addons-count">{pickedAddonIds.length} נבחרו</span>
                : <span className="addons-hint">(אופציונלי)</span>}
            </span>
            <span className={`addons-chevron ${addonsOpen ? 'is-open' : ''}`} aria-hidden="true">▾</span>
          </button>
          {addonsOpen && (
            <div id="addons-list" className="addon-list" style={{ marginTop: 10 }}>
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
          )}
        </div>
      )}

      {pickedService && (
        <div className="wizard-progress" aria-label="התקדמות בתהליך">
          <div className={`wizard-step ${wizardStep === 'date' ? 'is-current' : 'is-done'}`}>
            <span className="wizard-step-num">1</span>
            <span className="wizard-step-label">תאריך</span>
          </div>
          <div className="wizard-line" />
          <div className={`wizard-step ${wizardStep === 'time' ? 'is-current' : wizardStep === 'summary' ? 'is-done' : ''}`}>
            <span className="wizard-step-num">2</span>
            <span className="wizard-step-label">שעה</span>
          </div>
          <div className="wizard-line" />
          <div className={`wizard-step ${wizardStep === 'summary' ? 'is-current' : ''}`}>
            <span className="wizard-step-num">3</span>
            <span className="wizard-step-label">אישור</span>
          </div>
        </div>
      )}

      {/* ─── Step 1 — Pick date ───────────────────────────────────────── */}
      {pickedService && wizardStep === 'date' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>בחר/י תאריך</h3>
          <p className="muted" style={{ marginTop: -6, fontSize: '0.86rem' }}>
            ניתן לקבוע עד 12 חודשים קדימה. ימים סגורים מסומנים באפור.
          </p>
          <MonthCalendar
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            workingHours={barber.workingHours}
          />
          <div className="text-center" style={{ marginTop: 12, fontSize: '0.95rem' }}>
            <strong>{DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}, {formatDateHe(selectedDate)}</strong>
            {totalDuration > 0 && (
              <span className="muted" style={{ marginInlineStart: 8 }}>
                · {totalDuration} דק׳{totalPrice ? ` · ₪${totalPrice}` : ''}
              </span>
            )}
          </div>

          <div className="card-inset" style={{ marginTop: 14 }}>
            <label className="row" style={{ alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                style={{ width: 22, height: 22, flex: 'none', accentColor: 'var(--accent)', marginLeft: 8 }}
              />
              <span style={{ flex: 1 }}><strong><Repeat size={14} className="icon-inline" />תור קבוע</strong> <span className="muted">(אותה שעה, חוזר)</span></span>
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

          <button
            type="button"
            className="btn-gold wizard-next"
            onClick={() => setWizardStep('time')}
          >
            הבא: בחירת שעה ←
          </button>
        </div>
      )}

      {/* ─── Step 2 — Pick time ───────────────────────────────────────── */}
      {pickedService && wizardStep === 'time' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>בחר/י שעה</h3>
          <button
            type="button"
            className="wizard-summary-link"
            onClick={() => setWizardStep('date')}
            aria-label="חזור לבחירת תאריך"
          >
            <CalendarIcon size={14} className="icon-inline" />
            {DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}, {formatDateHe(selectedDate)}
            <span className="wizard-summary-edit">שנה ›</span>
          </button>

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
                  <Bell size={18} className="icon-inline" />הצטרף לרשימת המתנה — נודיע אם יתפנה
                </button>
              )}
            </>
          ) : (
            <>
              {recommendedWithUsual.length > 0 && (
                <div className="recommended-section">
                  <div className="recommended-label">המלצות AI לשעות הטובות</div>
                  <div className="slots-recommended">
                    {recommendedWithUsual.map((s) => {
                      const r = SLOT_REASONS[s.reason] || SLOT_REASONS.earliest;
                      return (
                        <div
                          key={s.time}
                          className={`slot slot-recommended ${pickedTime === s.time ? 'selected' : ''}`}
                          onClick={() => pickSlot(s.time)}
                        >
                          <div className="slot-time-big">{s.time}</div>
                          <div className={`slot-badge tone-${r.tone}`}>{r.badge}</div>
                        </div>
                      );
                    })}
                  </div>
                  {!showAllSlots && slotGroups.length > 0 && (
                    <button
                      type="button"
                      className="show-all-toggle"
                      onClick={() => setShowAllSlots(true)}
                    >
                      הצג את כל השעות הזמינות
                    </button>
                  )}
                </div>
              )}

              {(showAllSlots || recommendedWithUsual.length === 0) && slotGroups.map((g) => (
                <div key={g.key} className="slots-section">
                  <div className="slot-group-label">{g.label}</div>
                  <div className="slots">
                    {g.items.map((s) => (
                      <div
                        key={s.time}
                        className={`slot ${pickedTime === s.time ? 'selected' : ''}`}
                        onClick={() => pickSlot(s.time)}
                      >
                        <div>{s.time}</div>
                        {pickedService?.duration > 20 && (
                          <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>עד {addMinToTime(s.time, totalDuration)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="wizard-actions">
            <button
              type="button"
              className="btn-secondary wizard-back"
              onClick={() => setWizardStep('date')}
            >
              › חזור
            </button>
            <button
              type="button"
              className="btn-gold wizard-next"
              onClick={() => setWizardStep('summary')}
              disabled={!pickedTime}
            >
              הבא: סיכום ←
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3 — Summary + confirm ───────────────────────────────── */}
      {pickedService && wizardStep === 'summary' && pickedTime && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>סיכום ואישור</h3>
          <p className="muted" style={{ marginTop: -6, fontSize: '0.86rem' }}>
            בדוק/י שכל הפרטים נכונים לפני שתאשר/י.
          </p>

          <div className="confirm-row">
            <span className="confirm-label"><CalendarIcon size={14} className="icon-inline" />תאריך</span>
            <strong>{DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}, {formatDateHe(selectedDate)}</strong>
          </div>
          <div className="confirm-row">
            <span className="confirm-label"><Clock size={14} className="icon-inline" />שעה</span>
            <strong>{pickedTime}–{addMinToTime(pickedTime, totalDuration)}</strong>
          </div>
          <div className="confirm-row">
            <span className="confirm-label"><Hourglass size={14} className="icon-inline" />אורך</span>
            <strong>{totalDuration} דקות</strong>
          </div>
          <div className="confirm-row">
            <span className="confirm-label"><ScissorsIcon size={14} className="icon-inline" />שירות</span>
            <strong>{pickedService?.name}</strong>
          </div>
          {pickedAddonIds.length > 0 && (
            <div className="confirm-row">
              <span className="confirm-label"><Sparkles size={14} className="icon-inline" />תוספות</span>
              <strong>
                {(barber.addons || [])
                  .filter((a) => pickedAddonIds.includes(a.id))
                  .map((a) => a.name)
                  .join(', ')}
              </strong>
            </div>
          )}
          {totalPrice > 0 && (
            <div className="confirm-row">
              <span className="confirm-label"><CircleDollarSign size={14} className="icon-inline" />מחיר</span>
              <strong>₪{totalPrice}</strong>
            </div>
          )}
          {client && (
            <div className="confirm-row">
              <span className="confirm-label"><User size={14} className="icon-inline" />על שם</span>
              <strong>{client.firstName} {client.lastName}</strong>
            </div>
          )}
          {recurring && (
            <div className="confirm-row" style={{ borderTop: '1px dashed var(--gold)', paddingTop: 8, marginTop: 8 }}>
              <span className="confirm-label"><Repeat size={14} className="icon-inline" />חוזר</span>
              <strong>כל {recurEvery} שבועות, {recurTimes} פעמים</strong>
            </div>
          )}

          <div className="wizard-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn-secondary wizard-back"
              onClick={() => setWizardStep('time')}
              disabled={busy}
            >
              › חזור לשעה
            </button>
            <button
              type="button"
              className="btn-gold wizard-confirm"
              onClick={confirmFromSummary}
              disabled={busy}
            >
              <Check size={16} className="icon-inline" />
              {busy ? 'קובע…' : 'אשר וקבע תור'}
            </button>
          </div>
        </div>
      )}

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
            <div className="field">
              <label>אימייל (לקבלת אישור התור) — אופציונלי</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                dir="ltr"
                style={{ direction: 'ltr', textAlign: 'left' }}
              />
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
