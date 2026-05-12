import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isReservedSlug } from '../utils/slugs';
import { getThemeKey } from '../utils/themes';
import {
  CheckCircle2, CalendarPlus, CreditCard, Repeat, Bell, Check,
  Calendar as CalendarIcon, Clock, Hourglass, Scissors as ScissorsIcon,
  Sparkles, CircleDollarSign, User, Phone, Star, ChevronDown, X,
  Users, Send, Wallet, ExternalLink,
} from 'lucide-react';
import AccessibleModal from '../components/AccessibleModal.jsx';
import { db } from '../firebase';
import {
  doc, getDoc, setDoc, addDoc, collection, query, where, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  computeSlotsForDate, dateToISO, formatDateHe, nextNDays,
  DAY_LABELS_HE, dayKeyFromDate, addMinToTime, timeToMin, minToTime,
} from '../utils/slots';
import { getRecommendedSlots, SLOT_REASONS } from '../utils/slotScoring';
import Calendar from '../components/Calendar.jsx';
import MonthCalendar from '../components/MonthCalendar.jsx';
import LiveStatusBanner from '../components/LiveStatusBanner.jsx';
import { buildIcs, downloadIcs } from '../utils/ics';

const PHONE_KEY = 'bs_phone';

// One curated cinematic hero image per profession. Same image for everyone
// in that field — keeps quality consistent. A barber can override with their
// own `heroImageUrl` for personalisation in the future.
//
// Photo IDs were verified live against images.unsplash.com — replace only
// with verified IDs to avoid 404s in production.
const PROFESSION_HERO_BG = {
  barber: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&q=70&auto=format&fit=crop',
  manicurist: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&q=70&auto=format&fit=crop',
  pedicurist: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=1200&q=70&auto=format&fit=crop',
  // Real facial-treatment shot (mask + brush) reads as actual cosmetician
  // work, not "makeup artist". Verified live on images.unsplash.com.
  cosmetician: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1200&q=70&auto=format&fit=crop',
};
// Short business-type label for the hero eyebrow. Kept neutral and factual —
// the actual service names appear in the sub-headline (`servicesPreview`).
const PROFESSION_TAGLINE = {
  barber: 'מספרה',
  manicurist: 'סטודיו לציפורניים',
  pedicurist: 'סטודיו לפדיקור',
  cosmetician: 'סטודיו קוסמטיקה',
};

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
  // Picked employee — only relevant when barber.employees has any
  // active entries. Stays null when the barber works alone.
  const [pickedEmployeeId, setPickedEmployeeId] = useState(null);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState('date'); // 'date' | 'time' | 'summary'
  // Group booking — extra people booked back-to-back after the main client.
  // Cap of 2 extras (3 total) keeps the slot pressure reasonable and the UI simple.
  const [extraPeople, setExtraPeople] = useState([]); // [{ id, name, serviceId }]
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

  // Hero data — picks the profession-appropriate background image and tagline.
  // Same curated image for every barber in the same field. A barber can
  // override with `heroImageUrl` on their doc (future settings UI).
  const heroProfession = barber?.profession || barber?.professions?.[0] || 'barber';
  const heroBg = barber?.heroImageUrl || PROFESSION_HERO_BG[heroProfession] || PROFESSION_HERO_BG.barber;
  const heroTagline = PROFESSION_TAGLINE[heroProfession] || PROFESSION_TAGLINE.barber;
  // Compact service preview line — shows up to the first 3 service names so the
  // hero communicates concretely what this business does.
  const servicesPreview = useMemo(() => {
    const list = (barber?.services || []).filter((s) => s.name).slice(0, 3).map((s) => s.name);
    return list.length > 0 ? list.join(' · ') : heroTagline;
  }, [barber, heroTagline]);

  function scrollToServices() {
    const el = document.getElementById('booking-services-anchor');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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
    // Block submit if any extra person is missing required fields
    if (extraPeople.some((p) => !p.name?.trim() || !p.serviceId)) {
      alert('נא למלא שם ושירות לכל אדם נוסף');
      return;
    }
    if (client) {
      confirmBooking(pickedTime, client);
    } else {
      setShowLogin(true);
    }
  }

  // Group-booking helpers — compute consecutive start times for extras
  // based on pickedTime, the main booking's duration, and each extra's
  // selected service duration.
  function addExtraPerson() {
    if (extraPeople.length >= 2) return;
    const id = `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    setExtraPeople((list) => [
      ...list,
      { id, name: '', serviceId: pickedService?.id || (barber?.services?.[0]?.id) || '' },
    ]);
  }
  function updateExtraPerson(id, patch) {
    setExtraPeople((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function removeExtraPerson(id) {
    setExtraPeople((list) => list.filter((p) => p.id !== id));
  }
  // Resolve each extra person's service from the catalog; return scheduled
  // start/end + price metadata for rendering and writing booking docs.
  const extraSchedule = useMemo(() => {
    if (!pickedTime || !pickedService) return [];
    const services = barber?.services || [];
    let cursor = timeToMin(pickedTime) + totalDuration;
    const out = [];
    for (const p of extraPeople) {
      const svc = services.find((s) => s.id === p.serviceId) || services[0];
      const dur = (svc?.duration || 20);
      out.push({
        ...p,
        serviceName: svc?.name || '',
        duration: dur,
        price: svc?.price || 0,
        startTime: minToTime(cursor),
        endTime: minToTime(cursor + dur),
      });
      cursor += dur;
    }
    return out;
  }, [extraPeople, barber, pickedTime, pickedService, totalDuration]);

  const groupTotalDuration = totalDuration + extraSchedule.reduce((s, p) => s + p.duration, 0);
  const groupTotalPrice = totalPrice + extraSchedule.reduce((s, p) => s + p.price, 0);
  const groupTotalCount = 1 + extraSchedule.length;

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

      // If the barber has staff, the client must pick one before reaching
      // step 3, so pickedEmployeeId should be set. Capture name + id so
      // the dashboard can display "with [employee]" without an extra
      // lookup, and the worker can filter bookings by employee later.
      const pickedEmployee = activeEmployees.find((e) => e.id === pickedEmployeeId) || null;

      // Round-robin chair assignment when the barber has > 1 chair.
      // Sum the chair occupancy on the target date and pick the chair
      // with the fewest minutes booked, so load stays balanced. Falls
      // back to chair 1 for legacy single-chair shops.
      const chairsCount = Math.max(1, Math.min(10, Number(barber?.chairsCount) || 1));
      let pickedChair = 1;
      if (chairsCount > 1) {
        const byChair = Array.from({ length: chairsCount }, () => 0);
        const iso = dateToISO(selectedDate);
        const dayQ = query(
          collection(db, 'barbers', barberId, 'bookings'),
          where('date', '==', iso),
          where('status', '==', 'booked'),
        );
        const daySnap = await getDocs(dayQ);
        for (const d of daySnap.docs) {
          const data = d.data();
          const ch = Math.max(1, Math.min(chairsCount, Number(data.chairNumber) || 1));
          byChair[ch - 1] += Number(data.duration) || 20;
        }
        // Pick the chair with the lowest minutes booked today
        let min = Infinity;
        for (let i = 0; i < chairsCount; i++) {
          if (byChair[i] < min) { min = byChair[i]; pickedChair = i + 1; }
        }
      }

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
        employeeId: pickedEmployee?.id || '',
        employeeName: pickedEmployee?.name || '',
        chairNumber: pickedChair,
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
        // Conflict check — covers the WHOLE consecutive group (self + extras),
        // not just the first slot, so we never half-create a group.
        const groupSegments = [
          { startMin: timeToMin(time), endMin: timeToMin(time) + totalDuration },
          ...extraSchedule.map((p) => ({
            startMin: timeToMin(p.startTime),
            endMin: timeToMin(p.startTime) + p.duration,
          })),
        ];
        const conflict = occ.some((o) => {
          const oS = timeToMin(o.time), oE = oS + o.duration;
          return groupSegments.some((seg) => seg.startMin < oE && seg.endMin > oS);
        });
        if (conflict) { skipped.push(d); continue; }

        // Group ID — links self + extras for the same client visit so the
        // dashboard can show them as a related batch later if we want.
        const groupId = extraSchedule.length > 0
          ? `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`
          : null;

        // ── Main booking (self) ────────────────────────────────────────
        const manageToken = generateManageToken();
        const ref = await addDoc(collection(db, 'barbers', barberId, 'bookings'), {
          ...baseDoc,
          date: d,
          recurringId: recurringId || null,
          manageToken,
          groupId,
          createdAt: serverTimestamp(),
        });
        created.push({ id: ref.id, date: d, manageToken });
        try {
          await setDoc(doc(db, 'manageTokens', manageToken), {
            uid: barberId,
            bookingId: ref.id,
            createdAt: serverTimestamp(),
          });
        } catch (e) { console.warn('manageTokens write failed', e?.message); }

        // ── Extra people (consecutive slots, same date, same phone) ────
        for (const p of extraSchedule) {
          const exManage = generateManageToken();
          const exRef = await addDoc(collection(db, 'barbers', barberId, 'bookings'), {
            time: p.startTime,
            duration: p.duration,
            price: p.price,
            serviceId: p.serviceId,
            serviceName: p.serviceName,
            addons: [],
            clientName: p.name.trim(),
            clientPhone: c.phone,
            clientEmail: c.email || '',
            status: 'booked',
            date: d,
            recurringId: null,
            manageToken: exManage,
            groupId,
            isExtraPerson: true,
            createdAt: serverTimestamp(),
          });
          created.push({ id: exRef.id, date: d, manageToken: exManage });
          try {
            await setDoc(doc(db, 'manageTokens', exManage), {
              uid: barberId,
              bookingId: exRef.id,
              createdAt: serverTimestamp(),
            });
          } catch (e) { console.warn('manageTokens write failed', e?.message); }
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
      setExtraPeople([]);
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
      <div className="app" data-theme={getThemeKey(barber)}>
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
              <button
                type="button"
                className="copy-link"
                onClick={copyManageLink}
                aria-label="העתק את הקישור לניהול התור"
              >
                {manageUrl()}
              </button>
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
                  <Send size={14} className="icon-inline" aria-hidden="true" />
                  שלח לי את הלינק בוואטסאפ
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

        {totalPrice > 0 && (barber.bitLink || barber.payboxLink || barber.bitPhone || barber.payboxPhone) && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}><CreditCard size={18} className="icon-inline" />שלם ₪{totalPrice}</h3>
            <p className="muted" style={{ marginTop: -6 }}>
              לחץ → המספר יועתק ויפתח את האפליקציה.
            </p>

            {/* Order matters: PayBox first (one-tap URL with amount),
                Bit last (always manual copy-paste — Bit dropped business
                accounts mid-2026 so no URL flow exists for it anymore).
                PayPal removed: Israelis don't use it for P2P. */}

            {barber.payboxLink && (
              <a href={barber.payboxLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                <button className="btn-primary pay-btn pay-paybox" style={{ width: '100%', marginBottom: 8 }} type="button">
                  <Wallet size={16} className="icon-inline" aria-hidden="true" />
                  שלם ב-PayBox
                  <ExternalLink size={13} className="icon-inline" aria-hidden="true" style={{ opacity: 0.7 }} />
                </button>
              </a>
            )}

            {!barber.payboxLink && barber.payboxPhone && (
              <button
                className="btn-primary pay-btn pay-paybox"
                style={{ width: '100%', marginBottom: 8 }}
                onClick={() => openPay('paybox', barber.payboxPhone, totalPrice)}
                type="button"
              >
                <Wallet size={16} className="icon-inline" aria-hidden="true" />
                העתק מספר PayBox
              </button>
            )}

            {/* Bit — legacy URL kept working for users who saved one
                before the business-accounts shutdown, but the primary
                path is the phone copy-paste flow. */}
            {barber.bitLink && (
              <a href={barber.bitLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                <button className="btn-primary pay-btn pay-bit" style={{ width: '100%', marginBottom: 8 }} type="button">
                  <Wallet size={16} className="icon-inline" aria-hidden="true" />
                  שלם ב-Bit
                  <ExternalLink size={13} className="icon-inline" aria-hidden="true" style={{ opacity: 0.7 }} />
                </button>
              </a>
            )}

            {!barber.bitLink && barber.bitPhone && (
              <button
                className="btn-primary pay-btn pay-bit"
                style={{ width: '100%' }}
                onClick={() => openPay('bit', barber.bitPhone, totalPrice)}
                type="button"
              >
                <Wallet size={16} className="icon-inline" aria-hidden="true" />
                העתק מספר Bit
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const services = barber.services || [];
  const addons = barber.addons || [];
  const activeEmployees = (barber.employees || []).filter((e) => e.active !== false);

  return (
    <div className="app booking-app" data-theme={getThemeKey(barber)}>
      <header
        className="booking-hero"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="booking-hero-overlay" aria-hidden="true" />

        <div className="booking-hero-top">
          <button
            type="button"
            className="booking-hero-pill"
            onClick={scrollToServices}
          >
            קבע תור
          </button>
          <div className="booking-hero-brand">
            <span className="booking-hero-brand-name">{barber.businessName}</span>
            {barber.logoUrl ? (
              <img
                src={barber.logoUrl}
                alt=""
                aria-hidden="true"
                className="booking-hero-brand-logo"
              />
            ) : (
              <ScissorsIcon size={18} aria-hidden="true" className="booking-hero-brand-icon" />
            )}
          </div>
        </div>

        <div className="booking-hero-content">
          <div className="booking-hero-eyebrow">
            <Sparkles size={14} aria-hidden="true" className="icon-inline" />
            <span>{heroTagline}</span>
          </div>
          <h1 className="booking-hero-title">{barber.businessName}</h1>
          <p className="booking-hero-sub">{servicesPreview}</p>

          <div className="booking-hero-actions">
            {barber.phoneContact && (
              <a
                href={`tel:${barber.phoneContact}`}
                className="booking-hero-btn booking-hero-btn-secondary"
              >
                <Phone size={16} aria-hidden="true" />
                <span>התקשר</span>
              </a>
            )}
            <button
              type="button"
              className="booking-hero-btn booking-hero-btn-primary"
              onClick={scrollToServices}
            >
              <CalendarPlus size={16} aria-hidden="true" />
              <span>קבע תור עכשיו</span>
            </button>
          </div>

          {todayStatus && (
            <div className={`booking-hero-status ${todayStatus.open ? 'open' : 'closed'}`}>
              <span className="booking-hero-status-dot" aria-hidden="true" />
              {todayStatus.text}
            </div>
          )}
        </div>
      </header>

      <div id="booking-services-anchor" />

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

      {/* Employee picker — only shown when the barber has added staff
          in Settings. The client picks who they want to book with;
          the choice is stored as employeeId on the booking doc and
          shown alongside the client name on the operator dashboard. */}
      {activeEmployees.length > 0 && pickedService && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>בחר/י עם מי לקבוע</h3>
          <p className="muted" style={{ marginTop: -6, fontSize: '0.86rem' }}>
            {activeEmployees.length} עובדים זמינים
          </p>
          <div className="service-list">
            {activeEmployees.map((emp) => {
              const active = pickedEmployeeId === emp.id;
              return (
                <button
                  key={emp.id}
                  type="button"
                  className={`service-card ${active ? 'active' : ''}`}
                  onClick={() => setPickedEmployeeId(emp.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  {emp.photoUrl ? (
                    <img
                      src={emp.photoUrl}
                      alt=""
                      aria-hidden="true"
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flex: 'none', border: '2px solid var(--border)' }}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 44, height: 44, borderRadius: '50%', flex: 'none',
                        background: 'linear-gradient(180deg, var(--gold-2), var(--gold-deep))',
                        color: '#ffffff',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem',
                      }}
                    >
                      {(emp.name || '?').trim()[0] || '?'}
                    </div>
                  )}
                  <div className="service-card-name" style={{ textAlign: 'start' }}>
                    {emp.name}
                  </div>
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
              <Sparkles size={16} className="icon-inline" aria-hidden="true" />
              תוספות
              {pickedAddonIds.length > 0
                ? <span className="addons-count">{pickedAddonIds.length} נבחרו</span>
                : <span className="addons-hint">(אופציונלי)</span>}
            </span>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`addons-chevron ${addonsOpen ? 'is-open' : ''}`}
            />
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

      {pickedService && (activeEmployees.length === 0 || pickedEmployeeId) && (
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
      {pickedService && (activeEmployees.length === 0 || pickedEmployeeId) && wizardStep === 'date' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>בחר/י תאריך</h3>
          <p className="muted" style={{ marginTop: -6, fontSize: '0.86rem' }}>
            ניתן לקבוע עד 12 חודשים קדימה. ימים סגורים מסומנים באפור.
          </p>
          <MonthCalendar
            selectedDate={selectedDate}
            onSelect={(d) => {
              setSelectedDate(d);
              // Auto-advance to time picker the moment a date is tapped —
              // the "הבא" button at the bottom of this card was hidden below
              // the fold for many users on small phones, who didn't realise
              // they had to scroll. If the barber enables `allowRecurring`,
              // we keep the manual flow so the user can see the recurring
              // toggle on this step.
              if (!barber.allowRecurring) {
                setWizardStep('time');
              }
            }}
            workingHours={barber.workingHours}
            allowPast={false}
          />
          <div className="text-center" style={{ marginTop: 12, fontSize: '0.95rem' }}>
            <strong>{DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}, {formatDateHe(selectedDate)}</strong>
            {totalDuration > 0 && (
              <span className="muted" style={{ marginInlineStart: 8 }}>
                · {totalDuration} דק׳{totalPrice ? ` · ₪${totalPrice}` : ''}
              </span>
            )}
          </div>

          {/* Recurring is gated behind barber.allowRecurring (Settings → אפשרויות
              הזמנה). Most barbers prefer to manage recurring series manually
              rather than letting one client lock 12 future slots. */}
          {barber.allowRecurring && (
            <div className="card-inset" style={{ marginTop: 14 }}>
              <label className="row" style={{ alignItems: 'center', cursor: 'pointer' }} htmlFor="recurring-checkbox">
                <input
                  id="recurring-checkbox"
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
                    <label htmlFor="recur-every" className="muted" style={{ fontSize: '0.85rem' }}>כל</label>
                    <select id="recur-every" value={recurEvery} onChange={(e) => setRecurEvery(Number(e.target.value))}>
                      <option value={1}>שבוע</option>
                      <option value={2}>שבועיים</option>
                      <option value={3}>3 שבועות</option>
                      <option value={4}>4 שבועות</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="recur-times" className="muted" style={{ fontSize: '0.85rem' }}>סה״כ פעמים</label>
                    <select id="recur-times" value={recurTimes} onChange={(e) => setRecurTimes(Number(e.target.value))}>
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
          )}

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
      {pickedService && (activeEmployees.length === 0 || pickedEmployeeId) && wizardStep === 'time' && (
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
              {/* AI-recommended slots removed per UX feedback — clients prefer
                  to scan all available times themselves rather than be funneled
                  to a suggestion. The recommended/usualHour computations are
                  kept as dead code for now in case we expose them differently
                  (e.g. inside the dashboard for the barber, not the client). */}
              {slotGroups.map((g) => (
                <div key={g.key} className="slots-section">
                  <div className="slot-group-label">{g.label}</div>
                  <div className="slots">
                    {g.items.map((s) => (
                      <button
                        type="button"
                        key={s.time}
                        className={`slot ${pickedTime === s.time ? 'selected' : ''}`}
                        onClick={() => pickSlot(s.time)}
                        aria-pressed={pickedTime === s.time}
                        aria-label={`שעה ${s.time}`}
                      >
                        <div>{s.time}</div>
                        {pickedService?.duration > 20 && (
                          <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>עד {addMinToTime(s.time, totalDuration)}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

        </div>
      )}

      {/* ─── Step 3 — Summary + confirm ───────────────────────────────── */}
      {pickedService && (activeEmployees.length === 0 || pickedEmployeeId) && wizardStep === 'summary' && pickedTime && (
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
          {pickedEmployeeId && (() => {
            const emp = activeEmployees.find((e) => e.id === pickedEmployeeId);
            if (!emp) return null;
            return (
              <div className="confirm-row">
                <span className="confirm-label"><User size={14} className="icon-inline" />עם</span>
                <strong>{emp.name}</strong>
              </div>
            );
          })()}
          {recurring && (
            <div className="confirm-row" style={{ borderTop: '1px dashed var(--gold)', paddingTop: 8, marginTop: 8 }}>
              <span className="confirm-label"><Repeat size={14} className="icon-inline" />חוזר</span>
              <strong>כל {recurEvery} שבועות, {recurTimes} פעמים</strong>
            </div>
          )}

          {/* ── Group booking — extra people (kids / partner / etc.) ── */}
          {!recurring && (services.length > 0) && (
            <div className="extra-people">
              <div className="extra-people-head">
                <Users size={16} className="icon-inline" aria-hidden="true" />
                קובעים תור גם לעוד מישהו? (לילדים, לבן/בת זוג…)
              </div>

              {extraSchedule.map((p) => (
                <div key={p.id} className="extra-person-card">
                  <div className="extra-person-time">
                    {p.startTime}–{p.endTime}
                    <span className="muted" style={{ fontSize: '0.74rem', marginInlineStart: 6 }}>
                      ({p.duration} דק׳)
                    </span>
                  </div>
                  <div className="extra-person-fields">
                    <input
                      type="text"
                      placeholder="שם (לדוגמה: תום)"
                      value={p.name}
                      onChange={(e) => updateExtraPerson(p.id, { name: e.target.value })}
                      maxLength={40}
                      style={{ flex: 2, minWidth: 0 }}
                    />
                    <select
                      value={p.serviceId}
                      onChange={(e) => updateExtraPerson(p.id, { serviceId: e.target.value })}
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="extra-person-remove"
                      onClick={() => removeExtraPerson(p.id)}
                      aria-label="הסר"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}

              {extraPeople.length < 2 && (
                <button
                  type="button"
                  className="extra-person-add"
                  onClick={addExtraPerson}
                >
                  + הוסף תור עוקב לעוד אדם
                </button>
              )}

              {extraSchedule.length > 0 && (
                <div className="extra-people-total">
                  סה״כ קבוצה: <strong>{groupTotalCount} תורים</strong>
                  {' · '}{groupTotalDuration} דק׳
                  {groupTotalPrice > 0 ? <> · ₪{groupTotalPrice}</> : null}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ─── Sticky bottom CTA bar — visible whenever the wizard is past
              the date step. The "הבא" button used to live at the bottom of
              the time-pick card, below the fold for many users; promoting
              it to a fixed bottom bar means it's always in sight. */}
      {pickedService && wizardStep !== 'date' && (
        <div className="booking-bottom-cta" role="region" aria-label="פעולות המשך">
          {wizardStep === 'time' && (
            <>
              <button
                type="button"
                className="btn-secondary booking-cta-back"
                onClick={() => setWizardStep('date')}
                disabled={busy}
              >
                ›
              </button>
              <button
                type="button"
                className="btn-gold booking-cta-primary"
                onClick={() => setWizardStep('summary')}
                disabled={!pickedTime}
              >
                {pickedTime ? `הבא: סיכום (${pickedTime})` : 'בחר/י שעה כדי להמשיך'}
                <span aria-hidden="true">←</span>
              </button>
            </>
          )}
          {wizardStep === 'summary' && (
            <>
              <button
                type="button"
                className="btn-secondary booking-cta-back"
                onClick={() => setWizardStep('time')}
                disabled={busy}
              >
                ›
              </button>
              <button
                type="button"
                className="btn-gold booking-cta-primary"
                onClick={confirmFromSummary}
                disabled={busy}
              >
                <Check size={18} className="icon-inline" aria-hidden="true" />
                {busy
                  ? 'קובע…'
                  : groupTotalCount > 1
                    ? `אשר וקבע ${groupTotalCount} תורים`
                    : 'אשר וקבע תור'}
              </button>
            </>
          )}
        </div>
      )}

      <AccessibleModal
        open={showLogin}
        onClose={() => !busy && setShowLogin(false)}
        titleId="booking-login-title"
      >
        <h2 id="booking-login-title">הזן טלפון</h2>
        <p className="muted">אם הזמנת אצלנו בעבר, נזהה אותך אוטומטית.</p>
        <div className="field">
          <label htmlFor="booking-login-phone" className="muted" style={{ fontSize: '0.85rem' }}>
            מספר טלפון
          </label>
          <input
            id="booking-login-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            pattern="^0?5\d{8}$"
            maxLength={11}
            placeholder="050-1234567"
            value={pendingPhone}
            onChange={(e) => setPendingPhone(e.target.value)}
            data-autofocus
          />
        </div>
        <button
          className="btn-primary"
          onClick={loginByPhone}
          disabled={busy}
          style={{ width: '100%' }}
        >
          {busy ? 'בודק…' : 'המשך'}
        </button>
      </AccessibleModal>

      <AccessibleModal
        open={showSignup}
        onClose={() => !busy && setShowSignup(false)}
        titleId="booking-signup-title"
      >
        <h2 id="booking-signup-title">פעם ראשונה? נכיר!</h2>
        <div className="field">
          <label htmlFor="booking-signup-first">שם פרטי</label>
          <input
            id="booking-signup-first"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            data-autofocus
          />
        </div>
        <div className="field">
          <label htmlFor="booking-signup-last">שם משפחה</label>
          <input
            id="booking-signup-last"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="booking-signup-phone">טלפון</label>
          <input
            id="booking-signup-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            pattern="^0?5\d{8}$"
            maxLength={11}
            value={pendingPhone}
            onChange={(e) => setPendingPhone(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="booking-signup-email">אימייל (לקבלת אישור התור) — אופציונלי</label>
          <input
            id="booking-signup-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@gmail.com"
            className="input-ltr"
          />
        </div>
        <button
          className="btn-primary"
          onClick={signup}
          disabled={busy}
          style={{ width: '100%' }}
        >
          {busy ? 'שומר…' : 'אשר וקבע תור'}
        </button>
      </AccessibleModal>
    </div>
  );
}
