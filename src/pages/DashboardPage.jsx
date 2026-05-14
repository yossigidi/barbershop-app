import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon, Home, BarChart3, MoreHorizontal, Palmtree, Send,
  MessageCircle, Scissors, Settings, Bell, QrCode, Copy, Share2, X, Sparkles,
  Wallet, Megaphone, Trash2, ImagePlus, Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSubscription } from '../hooks/useSubscription';
import WakeLockToggle from '../components/WakeLockToggle.jsx';
import PaywallModal from '../components/PaywallModal.jsx';
import { db } from '../firebase';
import {
  collection, doc, onSnapshot, query, updateDoc, where,
  addDoc, deleteDoc, getDoc, getDocs, setDoc, arrayUnion, arrayRemove, serverTimestamp,
} from 'firebase/firestore';
import {
  dateToISO, formatDateHe, DAY_LABELS_HE, dayKeyFromDate, timeToMin,
} from '../utils/slots';
import { RunningStatusBanner, AppointmentDueModal } from '../components/RunningSchedule.jsx';
import { nameToSlug, validateSlug } from '../utils/slugs';
import { registerFcmToken, requestPushPermission } from '../utils/push';
import { whatsappUrl, shareLinkText } from '../utils/whatsapp';
import { upcomingHolidays } from '../utils/holidays';
import MonthCalendar from '../components/MonthCalendar.jsx';
import StatsCard from '../components/StatsCard.jsx';
import SmartTipsCard from '../components/SmartTipsCard.jsx';
import RescheduleModal from '../components/RescheduleModal.jsx';
import VacationModal from '../components/VacationModal.jsx';
import QrModal from '../components/QrModal.jsx';
import DayTimeline from '../components/DayTimeline.jsx';
import ScheduleList from '../components/ScheduleList.jsx';
import BookingActionSheet from '../components/BookingActionSheet.jsx';
import TomorrowReminders from '../components/TomorrowReminders.jsx';
import BroadcastModal from '../components/BroadcastModal.jsx';
import QuickBookModal from '../components/QuickBookModal.jsx';
import TrialExpiryBanner from '../components/TrialExpiryBanner.jsx';
import MorningSummaryCard from '../components/MorningSummaryCard.jsx';
import AIBriefingCard from '../components/AIBriefingCard.jsx';
import BreakSuggestions from '../components/BreakSuggestions.jsx';
import WeeklyReportCard from '../components/WeeklyReportCard.jsx';
import YesterdayFollowUp from '../components/YesterdayFollowUp.jsx';
import ExpensesTab from '../components/ExpensesTab.jsx';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('schedule');
  const [showMonthCal, setShowMonthCal] = useState(false);
  const [barber, setBarber] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [pushStatus, setPushStatus] = useState('idle');
  const [pushDismissed, setPushDismissed] = useState(false);
  const [rescheduling, setRescheduling] = useState(null);
  const [showVacation, setShowVacation] = useState(false);
  const [vacationSaved, setVacationSaved] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [showToday, setShowToday] = useState(false);
  const [showYesterday, setShowYesterday] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [actionFor, setActionFor] = useState(null);

  // Keep the action-sheet's booking in sync with Firestore changes — when
  // the user completes/starts a booking the listener updates `bookings`,
  // and we want the open sheet to re-render against the new status (e.g.
  // "סיים תור" → "✓ Send review" appears) instead of closing or going stale.
  useEffect(() => {
    if (!actionFor) return;
    const fresh = bookings.find((b) => b.id === actionFor.id);
    if (fresh && fresh !== actionFor) setActionFor(fresh);
  }, [bookings, actionFor]);
  const [quickBook, setQuickBook] = useState(null);

  useEffect(() => {
    if (!user) return;
    const unsubBarber = onSnapshot(doc(db, 'barbers', user.uid), (snap) => {
      if (snap.exists()) setBarber({ id: snap.id, ...snap.data() });
    });
    const bq = query(
      collection(db, 'barbers', user.uid, 'bookings'),
      where('status', 'in', ['booked', 'inProgress']),
    );
    const unsubBookings = onSnapshot(bq, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      setBookings(list);
    });
    const unsubBlocks = onSnapshot(collection(db, 'barbers', user.uid, 'blocks'), (snap) => {
      setBlocks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubBarber(); unsubBookings(); unsubBlocks(); };
  }, [user]);

  // One-time backfill: if an existing barber has no customSlug but their
  // displayName/businessName produces a valid slug, claim it for them
  // automatically. Older accounts kept the random shortCode in their
  // public URL even though Settings has long supported a friendly slug —
  // this just gives them the upgrade silently. Only runs once per session.
  const [slugBackfillTried, setSlugBackfillTried] = useState(false);
  useEffect(() => {
    if (!barber || !user || slugBackfillTried) return;
    if (barber.customSlug) { setSlugBackfillTried(true); return; }
    const candidate = nameToSlug(barber.businessName || barber.displayName || '');
    if (!candidate || validateSlug(candidate)) { setSlugBackfillTried(true); return; }
    setSlugBackfillTried(true);
    (async () => {
      try {
        // Try the bare candidate, then -2, -3 … -9 if taken by someone else.
        for (let i = 0; i < 10; i++) {
          const slug = i === 0 ? candidate : `${candidate}-${i + 1}`;
          if (validateSlug(slug)) continue;
          const ref = doc(db, 'shortCodes', slug);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            if (snap.data().uid === user.uid) {
              await updateDoc(doc(db, 'barbers', user.uid), { customSlug: slug });
              return;
            }
            continue; // taken by someone else
          }
          await setDoc(ref, { uid: user.uid });
          await updateDoc(doc(db, 'barbers', user.uid), { customSlug: slug });
          return;
        }
      } catch (e) {
        // Backfill is best-effort — if rules deny or quota hits, silent fail
        // is fine. The user can still set the slug manually in Settings.
        console.warn('customSlug backfill skipped:', e?.message);
      }
    })();
  }, [barber, user, slugBackfillTried]);

  // Notification deep-link handler — when ?booking=<id> is in the URL,
  // open the action sheet for that booking (and clean the URL).
  useEffect(() => {
    const id = searchParams.get('booking');
    if (!id || bookings.length === 0) return;
    const b = bookings.find((x) => x.id === id);
    if (b) {
      setActionFor(b);
      // Jump to the schedule tab so the booking is contextually visible
      setTab('schedule');
      // Remove the param so reload doesn't re-open the sheet
      const next = new URLSearchParams(searchParams);
      next.delete('booking');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, bookings, setSearchParams]);

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);
  const todayISO = dateToISO(today);
  const selectedISO = dateToISO(selectedDate);

  const todayBookings = bookings.filter((b) => b.date === todayISO);
  const todayBlocks = blocks.filter((b) => b.date === todayISO);

  // ── Live running-schedule ──────────────────────────────────────────────
  // barber.dayRunning = { date, offsetMin }. The offset only counts for
  // *today* — a stale date means a new day, so it reads as 0. This is a
  // display-only offset: the client's confirmed booking time never moves.
  const runningOffset = (barber?.dayRunning?.date === todayISO)
    ? Math.max(0, Number(barber.dayRunning.offsetMin) || 0)
    : 0;
  const [dueBookingId, setDueBookingId] = useState(null);
  const snoozedRef = useRef(new Map()); // bookingId → snoozed-until ms
  const dueBooking = dueBookingId
    ? bookings.find((b) => b.id === dueBookingId && b.status === 'booked') || null
    : null;

  // Poll every 30s: which of today's not-yet-started bookings has its
  // offset-adjusted start time arrived? Show the soonest one.
  useEffect(() => {
    function check() {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const due = bookings
        .filter((b) => b.date === todayISO && b.status === 'booked')
        .filter((b) => timeToMin(b.time) + runningOffset <= nowMin)
        .filter((b) => {
          const until = snoozedRef.current.get(b.id);
          return !until || until < Date.now();
        })
        .sort((a, b) => timeToMin(a.time) - timeToMin(b.time))[0];
      setDueBookingId((prev) => (due ? due.id : (prev ? null : prev)));
    }
    check();
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, [bookings, todayISO, runningOffset]);

  async function writeDayRunning(offsetMin) {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'barbers', user.uid), {
        dayRunning: { date: todayISO, offsetMin: Math.max(0, Math.round(offsetMin)) },
      });
    } catch (e) { alert('שגיאה: ' + e.message); }
  }
  function applyDelay(minutes) {
    writeDayRunning(runningOffset + minutes);
    setDueBookingId(null);
  }
  function resetRunning() { writeDayRunning(0); }
  function snoozeDue() {
    if (dueBookingId) snoozedRef.current.set(dueBookingId, Date.now() + 5 * 60_000);
    setDueBookingId(null);
  }
  function startDueBooking() {
    if (dueBooking) startBooking(dueBooking);
    setDueBookingId(null);
  }
  // Tomorrow's bookings (used by the bulk-reminders CTA so the button
  // label can carry the count and decide whether to render at all).
  const tomorrowISO = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return dateToISO(d);
  }, [today]);
  const tomorrowBookingsCount = bookings.filter(
    (b) => b.date === tomorrowISO && b.status === 'booked',
  ).length;
  const dayBookings = bookings.filter((b) => b.date === selectedISO);
  const dayBlocks = blocks.filter((b) => b.date === selectedISO);

  const upcomingTotal = bookings.filter((b) => b.date >= todayISO).length;
  const bookingsByDate = useMemo(() => {
    const map = {};
    for (const b of bookings) map[b.date] = (map[b.date] || 0) + 1;
    return map;
  }, [bookings]);

  const nextHoliday = useMemo(() => {
    const all = upcomingHolidays(todayISO, 5);
    return all.find((h) => {
      const diff = (new Date(h.date) - new Date(todayISO)) / (1000 * 60 * 60 * 24);
      return diff >= 1 && diff <= 14;
    });
  }, [todayISO]);

  // Prefer the custom slug (toron.co.il/ramos) when set, otherwise fall
   // back to the auto-generated 6-char code. Drop the /b/ prefix in both
   // cases — the new top-level /:code route resolves either form.
  const shortCodeOrSlug = (barber?.customSlug || barber?.shortCode || '').trim();
  const shortLink = shortCodeOrSlug
    ? `${window.location.origin}/${shortCodeOrSlug}`
    : '';

  // Subscription gate — when access is denied (trial expired, no payment),
  // the entire dashboard is replaced by the paywall.
  const access = useSubscription(barber);

  // --- Actions ---
  // Robust copy: modern Clipboard API → legacy execCommand (iOS-safe
  // selection) → manual-select fallback UI. The old code fell back to
  // prompt(), which iOS Safari blocks (especially in installed-PWA mode)
  // so a failed copy silently did nothing.
  const [linkCopyState, setLinkCopyState] = useState('idle'); // idle | copied | manual
  async function copyLink() {
    if (!shortLink) return;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shortLink);
        ok = true;
      }
    } catch { /* fall through */ }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = shortLink;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length); // iOS needs the explicit range
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { /* fall through */ }
    }
    if (ok) {
      setLinkCopyState('copied');
      setTimeout(() => setLinkCopyState('idle'), 2000);
    } else {
      // Last resort — reveal the link in a selectable box so the user
      // can long-press → copy manually. Never use prompt() (iOS blocks it).
      setLinkCopyState('manual');
    }
  }
  function shareWhatsApp() {
    if (!shortLink) return;
    const text = shareLinkText(barber.businessName || 'העסק שלי', shortLink);
    window.open(whatsappUrl(text), '_blank');
  }
  function shareHolidayPromo() {
    if (!nextHoliday) return;
    const text =
      `שלום! ${nextHoliday.emoji} ${nextHoliday.name} מתקרב.\n\n` +
      `אם רוצים תור לקראת החג בלי לחץ — היכנס מהר לקבוע:\n${shortLink}\n\n` +
      `${barber.businessName}`;
    window.open(whatsappUrl(text), '_blank');
  }
  async function enablePush() {
    setPushStatus('requesting');
    try {
      const token = await requestPushPermission();
      if (!token) return setPushStatus('denied');
      await registerFcmToken(user.uid, token);
      setPushStatus('enabled');
    } catch (e) { console.error(e); setPushStatus('error'); }
  }
  // After a cancellation we surface the matching waitlist clients in a
  // modal so the barber can hit one WhatsApp button per person — each
  // opens wa.me directly to that client's number with a pre-filled
  // message. Beats the previous flow which only opened a generic
  // (recipient-less) wa.me and asked the barber to forward manually.
  const [waitlistNotify, setWaitlistNotify] = useState(null);
  // shape: { date, time, clients: [{ clientName, clientPhone, ... }] }

  async function cancelBooking(b) {
    if (!confirm(`לבטל את התור של ${b.clientName} ב-${b.time}?`)) return;
    try {
      await updateDoc(doc(db, 'barbers', user.uid, 'bookings', b.id), { status: 'cancelled' });
      const wl = await getDocs(query(
        collection(db, 'barbers', user.uid, 'waitlist'),
        where('fromDate', '<=', b.date),
      ));
      const matches = wl.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((w) => (w.toDate || w.fromDate) >= b.date);
      if (matches.length > 0) {
        setWaitlistNotify({ date: b.date, time: b.time, clients: matches });
      }
    } catch (e) { alert('שגיאה: ' + e.message); }
  }

  function whatsappForWaitlist(client) {
    if (!waitlistNotify) return '';
    const text =
      `שלום ${client.clientName || ''}! 🎉\n` +
      `התפנה תור ב-${barber.businessName} ל-${formatDateHe(new Date(waitlistNotify.date))} בשעה ${waitlistNotify.time}.\n` +
      `אם זה מתאים — הזמן/י מהר בלינק:\n${shortLink}`;
    return whatsappUrl(text, client.clientPhone || '');
  }

  async function removeWaitlistEntry(entry) {
    try {
      await deleteDoc(doc(db, 'barbers', user.uid, 'waitlist', entry.id));
      setWaitlistNotify((cur) =>
        cur ? { ...cur, clients: cur.clients.filter((c) => c.id !== entry.id) } : cur,
      );
    } catch { /* non-fatal — they can re-cancel later */ }
  }
  async function startBooking(b) {
    try { await updateDoc(doc(db, 'barbers', user.uid, 'bookings', b.id), { status: 'inProgress', startedAt: serverTimestamp() }); }
    catch (e) { alert('שגיאה: ' + e.message); }
  }
  async function completeBooking(b) {
    try {
      await updateDoc(doc(db, 'barbers', user.uid, 'bookings', b.id), { status: 'completed', completedAt: serverTimestamp() });
      // Auto-recover the running offset: if the barber finished today's
      // appointment before its offset-adjusted slot would have ended,
      // shrink the day's offset by the time they saved (never below 0).
      if (b.date === todayISO && runningOffset > 0) {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const expectedEnd = timeToMin(b.time) + runningOffset + (b.duration || 20);
        if (nowMin < expectedEnd) {
          const recovered = Math.max(0, runningOffset - (expectedEnd - nowMin));
          if (recovered !== runningOffset) writeDayRunning(recovered);
        }
      }
    } catch (e) { alert('שגיאה: ' + e.message); }
  }
  async function blockSlot(time, dateISO) {
    try {
      await addDoc(collection(db, 'barbers', user.uid, 'blocks'), {
        date: dateISO, time, duration: 20, reason: '', createdAt: serverTimestamp(),
      });
    } catch (e) { alert('שגיאה: ' + e.message); }
  }
  async function quickBookSlot({ date, time, duration, clientName, clientPhone }) {
    await addDoc(collection(db, 'barbers', user.uid, 'bookings'), {
      date,
      time,
      duration,
      clientName,
      clientPhone: clientPhone || '',
      status: 'booked',
      serviceName: '',
      price: barber.defaultPrice || 0,
      createdAt: serverTimestamp(),
    });
    // Upsert a client record only if a phone was provided. Don't let it fail
    // the booking flow if it errors (e.g. permissions or transient issue).
    if (clientPhone) {
      try {
        const parts = clientName.split(/\s+/);
        await setDoc(doc(db, 'barbers', user.uid, 'clients', clientPhone), {
          firstName: parts[0] || clientName,
          lastName: parts.slice(1).join(' ') || '',
          phone: clientPhone,
          createdAt: serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        console.warn('client upsert failed (booking still saved):', e);
      }
    }
  }
  async function unblockSlot(blockId) {
    try { await deleteDoc(doc(db, 'barbers', user.uid, 'blocks', blockId)); }
    catch (e) { alert('שגיאה: ' + e.message); }
  }
  async function handleReschedule(newDate, newTime) {
    if (!rescheduling) return;
    try {
      await updateDoc(doc(db, 'barbers', user.uid, 'bookings', rescheduling.id), { date: newDate, time: newTime });
      setRescheduling(null);
    } catch (e) { alert('שגיאה: ' + e.message); }
  }
  async function handleVacation({ from, to, reason }) {
    try {
      await updateDoc(doc(db, 'barbers', user.uid), {
        vacations: arrayUnion({ from, to, reason, id: Math.random().toString(36).slice(2, 9) }),
      });
      const start = new Date(from); const end = new Date(to);
      const writes = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        writes.push(addDoc(collection(db, 'barbers', user.uid, 'blocks'), {
          date: dateToISO(d), time: '00:00', duration: 24 * 60,
          reason: reason || 'חופש', wholeDay: true, createdAt: serverTimestamp(),
        }));
      }
      await Promise.all(writes);
      setShowVacation(false);
      setVacationSaved({ from, to, reason });
    } catch (e) { alert('שגיאה: ' + e.message); }
  }
  // Vacation-broadcast pre-fill — when the operator saves vacation
  // dates, we hand the BroadcastModal a message body already filled
  // with their dates so they can send to ALL clients in one batch
  // (BroadcastModal loads every barbers/{uid}/clients/{phone} on open
  // and opens one wa.me window per client, batched 5 at a time).
  const [broadcastBody, setBroadcastBody] = useState(null);

  async function shareVacationToClients() {
    if (!vacationSaved) return;
    const fromLabel = formatDateHe(new Date(vacationSaved.from));
    const toLabel = formatDateHe(new Date(vacationSaved.to));
    const body =
      `שלום,\n\n${barber.businessName} ייסגר ` +
      (vacationSaved.from === vacationSaved.to
        ? `ב-${fromLabel}`
        : `מ-${fromLabel} עד ${toLabel}`) +
      `${vacationSaved.reason ? ` (${vacationSaved.reason})` : ''}.\n\n` +
      `אשמח לקבוע תור לפני או אחרי.\nלקביעת תור: ${shortLink}\n\nתודה על ההבנה.`;
    setBroadcastBody(body);
    setShowBroadcast(true);
    setVacationSaved(null);
  }
  async function removeVacation(v) {
    if (!confirm('להסיר חופש? התאריכים ייפתחו מחדש.')) return;
    await updateDoc(doc(db, 'barbers', user.uid), { vacations: arrayRemove(v) });
    const start = new Date(v.from); const end = new Date(v.to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const snap = await getDocs(query(
        collection(db, 'barbers', user.uid, 'blocks'),
        where('date', '==', dateToISO(d)),
        where('wholeDay', '==', true),
      ));
      for (const s of snap.docs) await deleteDoc(s.ref);
    }
  }

  if (!barber) return <div className="loading">טוען…</div>;
  if (!access.granted) return <PaywallModal access={access} />;

  const tokenInstalled = (barber.fcmTokens || []).length > 0;
  const showPushCard = !tokenInstalled && pushStatus !== 'enabled' && !pushDismissed;

  // --- Tab content ---
  // Responsive nav — renders as a side rail on tablet/desktop (≥900px)
  // and a bottom bar on phone. Same `tab` state drives both; "לקוחות"
  // and (none yet) navigate away instead of switching tabs.
  function DashNav() {
    const items = [
      { key: 'schedule', label: 'יומן', Icon: CalendarIcon, badge: todayBookings.length },
      { key: 'clients', label: 'לקוחות', Icon: Users, goto: '/clients' },
      { key: 'messages', label: 'הודעות', Icon: MessageCircle },
      { key: 'reports', label: 'דוחות', Icon: BarChart3 },
      { key: 'expenses', label: 'הוצאות', Icon: Wallet },
      { key: 'more', label: 'עוד', Icon: MoreHorizontal },
    ];
    return (
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <img src="/toron-wordmark.png" alt="Toron" />
        </div>
        {items.map(({ key, label, Icon, badge, goto }) => (
          <button
            key={key}
            type="button"
            className={`dash-nav-item ${!goto && tab === key ? 'active' : ''}`}
            onClick={() => (goto ? navigate(goto) : setTab(key))}
          >
            <span className="dash-nav-icon">
              <Icon size={22} strokeWidth={1.75} />
              {badge > 0 && <span className="dash-nav-badge">{badge}</span>}
            </span>
            <span className="dash-nav-label">{label}</span>
          </button>
        ))}
      </nav>
    );
  }

  // The hero — a clean day view. Day-nav + stats + the timeline, with an
  // optional summary side column on wide screens. Merges the old
  // separate "today" and "calendar" tabs into one navigable day.
  function ScheduleTab() {
    const isToday = selectedISO === todayISO;
    const dayKey = dayKeyFromDate(selectedDate);
    const dayCfg = barber.workingHours?.[dayKey];
    const dayRevenue = dayBookings.reduce((s, b) => s + (Number(b.price) || 0), 0);
    const inProgressCount = dayBookings.filter((b) => b.status === 'inProgress').length;
    const goDay = (delta) => {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + delta);
      setSelectedDate(d);
    };
    return (
      <div className="dash-schedule">
        <div className="dash-schedule-main">
          <div className="sched-topbar">
            <div className="sched-daynav">
              <button type="button" onClick={() => goDay(1)} aria-label="יום הבא">‹</button>
              <button
                type="button"
                className="sched-date"
                onClick={() => setShowMonthCal((v) => !v)}
              >
                <strong>{isToday ? 'היום' : DAY_LABELS_HE[dayKey]}</strong>
                <span>{formatDateHe(selectedDate)}</span>
              </button>
              <button type="button" onClick={() => goDay(-1)} aria-label="יום קודם">›</button>
            </div>
            <div className="sched-stats">
              <div className="sched-stat"><span className="n">{dayBookings.length}</span><span className="l">תורים</span></div>
              <div className="sched-stat"><span className="n rev">₪{dayRevenue.toLocaleString('he-IL')}</span><span className="l">צפוי</span></div>
              {inProgressCount > 0 && (
                <div className="sched-stat"><span className="n">{inProgressCount}</span><span className="l">עכשיו</span></div>
              )}
            </div>
            <div className="sched-actions">
              {!isToday && (
                <button type="button" className="sched-today-btn" onClick={() => setSelectedDate(today)}>
                  חזרה להיום
                </button>
              )}
              <button
                type="button"
                className="sched-new-btn"
                onClick={() => setQuickBook({ date: selectedISO, time: dayCfg?.start || '09:00' })}
              >
                + תור חדש
              </button>
            </div>
          </div>

          {showMonthCal && (
            <div className="card sched-monthcal">
              <div className="muted text-center" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
                {upcomingTotal} תורים מתוכננים מהיום והלאה
              </div>
              <MonthCalendar
                selectedDate={selectedDate}
                onSelect={(d) => { setSelectedDate(d); setShowMonthCal(false); }}
                workingHours={barber.workingHours}
                bookingsByDate={bookingsByDate}
                maxMonthsAhead={12}
                compact
              />
            </div>
          )}

          {isToday && <RunningStatusBanner offsetMin={runningOffset} onReset={resetRunning} />}

          <ScheduleList
            date={selectedDate}
            workingHours={barber.workingHours}
            bookings={dayBookings}
            blocks={dayBlocks}
            chairsCount={barber.chairsCount || 1}
            offsetMin={isToday ? runningOffset : 0}
            onBookingTap={(b) => setActionFor(b)}
            onFreeSlotTap={(time) => setQuickBook({ time, date: selectedISO })}
            onBlockTap={(b) => { if (confirm(`לבטל חסימה ב-${b.time}?`)) unblockSlot(b.id); }}
          />
        </div>

        {/* Summary side column — CSS shows it only on wide screens */}
        <aside className="dash-summary">
          <MorningSummaryCard
            displayName={barber.displayName}
            businessName={barber.businessName}
            todayBookings={todayBookings}
            onTapBooking={setActionFor}
          />
          <WeeklyReportCard uid={user.uid} businessName={barber.businessName || 'העסק שלי'} />
          {tomorrowBookingsCount > 0 && (
            <button className="btn-gold" onClick={() => setShowTomorrow(true)} style={{ width: '100%' }}>
              <Send size={18} className="icon-inline" />
              תזכורת לכל לקוחות מחר ({tomorrowBookingsCount})
            </button>
          )}
          {nextHoliday && (
            <button className="chip" onClick={shareHolidayPromo} style={{ width: '100%' }}>
              {nextHoliday.emoji} {nextHoliday.name} מתקרב — שלח הודעה
            </button>
          )}
        </aside>
      </div>
    );
  }

  // Messages tab — everything client-outreach: the share link, broadcasts,
  // reminders, thank-yous, vacation, holiday promo, WA templates.
  function MessagesTab() {
    return (
      <>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>שיתוף הלינק שלך</h3>
          <div
            className={`copy-link ${linkCopyState === 'copied' ? 'is-copied' : ''}`}
            onClick={copyLink}
          >
            {linkCopyState === 'copied' ? '✓ הלינק הועתק' : (shortLink || '—')}
          </div>
          {linkCopyState === 'manual' && (
            <div className="copy-link-manual">
              <span>סמן/י את הלינק והעתק/י ידנית:</span>
              <input
                type="text"
                readOnly
                value={shortLink}
                dir="ltr"
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.target.select()}
              />
            </div>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={shareWhatsApp} style={{ flex: 1 }}><Share2 size={18} className="icon-inline" />WhatsApp</button>
            <button className="btn-secondary" onClick={() => setShowQr(true)} style={{ flex: 'none' }} aria-label="QR"><QrCode size={18} /></button>
            <button className="btn-secondary" onClick={copyLink} style={{ flex: 'none' }} aria-label="העתק"><Copy size={18} /></button>
          </div>
          {!barber.logoUrl && (
            <div className="logo-nudge" role="status">
              <div className="logo-nudge-icon"><ImagePlus size={20} /></div>
              <div className="logo-nudge-body">
                <strong>הוסף לוגו כדי שהלינק שלך ייראה מקצועי</strong>
                <span>בלי לוגו, התצוגה ב-WhatsApp תציג את המותג של Toron במקום שלך.</span>
              </div>
              <Link to="/settings" className="logo-nudge-cta">העלה לוגו ←</Link>
            </div>
          )}
        </div>

        <button className="btn-gold" onClick={() => setShowBroadcast(true)} style={{ width: '100%', marginBottom: 8 }}>
          <Megaphone size={18} className="icon-inline" />הודעה לכל הלקוחות (חג / חופשה / מחירים)
        </button>
        {todayBookings.length > 0 && (
          <button className="btn-gold" onClick={() => setShowToday(true)} style={{ width: '100%', marginBottom: 8 }}>
            <Send size={18} className="icon-inline" />תזכורת לכל לקוחות היום ({todayBookings.length})
          </button>
        )}
        {tomorrowBookingsCount > 0 ? (
          <button className="btn-gold" onClick={() => setShowTomorrow(true)} style={{ width: '100%', marginBottom: 8 }}>
            <Send size={18} className="icon-inline" />תזכורת לכל לקוחות מחר ({tomorrowBookingsCount})
          </button>
        ) : (
          <button className="btn-secondary" disabled style={{ width: '100%', marginBottom: 8 }} title="אין תורים מחר">
            <Send size={18} className="icon-inline" />תזכורות מחר — אין תורים
          </button>
        )}
        <button className="btn-secondary" onClick={() => setShowYesterday(true)} style={{ width: '100%', marginBottom: 8 }}>
          <MessageCircle size={18} className="icon-inline" />הודעות תודה ללקוחות מאתמול
        </button>
        <button className="btn-secondary" onClick={() => setShowVacation(true)} style={{ width: '100%', marginBottom: 8 }}>
          <Palmtree size={18} className="icon-inline" />הוסף חופש
        </button>
        {nextHoliday && (
          <button className="chip" onClick={shareHolidayPromo} style={{ width: '100%', marginBottom: 8 }}>
            {nextHoliday.emoji} {nextHoliday.name} מתקרב — שלח הודעה ב-WhatsApp
          </button>
        )}
        <Link to="/whatsapp-templates">
          <button className="btn-secondary" style={{ width: '100%' }}><MessageCircle size={18} className="icon-inline" />תגובות מהירות ל-WhatsApp Business</button>
        </Link>

        {(barber.vacations || []).length > 0 && (
          <div className="card" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}><Palmtree size={18} className="icon-inline" />חופשים מתוכננים</h3>
            {barber.vacations.map((v) => (
              <div key={v.id} className="timeline-row">
                <span style={{ flex: 1 }}>
                  {formatDateHe(new Date(v.from))} → {formatDateHe(new Date(v.to))}
                  {v.reason ? ` • ${v.reason}` : ''}
                </span>
                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.85rem' }} onClick={() => removeVacation(v)}>
                  הסר
                </button>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // Reports tab — the analytics + insight cards that used to clutter the
  // main day view. The day screen is now just the timeline.
  function ReportsTab() {
    return (
      <>
        <StatsCard bookings={bookings} />
        <WeeklyReportCard uid={user.uid} businessName={barber.businessName || 'העסק שלי'} />
        <AIBriefingCard businessName={barber.businessName} />
        <MorningSummaryCard
          displayName={barber.displayName}
          businessName={barber.businessName}
          todayBookings={todayBookings}
          onTapBooking={setActionFor}
        />
        <SmartTipsCard workingHours={barber.workingHours} bookings={bookings} blocks={blocks} />
        <BreakSuggestions
          todayBookings={todayBookings}
          todayBlocks={todayBlocks.filter((b) => !b.wholeDay)}
          onBlock={(time, length) => {
            if (confirm(`לחסום ${length} דקות מ-${time} כהפסקה?`)) {
              addDoc(collection(db, 'barbers', user.uid, 'blocks'), {
                date: todayISO, time, duration: length, reason: 'הפסקה', createdAt: serverTimestamp(),
              });
            }
          }}
        />
        <Link to="/reports">
          <button className="btn-primary" style={{ width: '100%' }}><BarChart3 size={18} className="icon-inline" />דוחות מלאים + השוואות + חגים</button>
        </Link>
      </>
    );
  }

  // "More" tab — account + setup links, plus device options.
  function MoreTab() {
    return (
      <>
        <Link to="/onboarding">
          <button className="btn-primary" style={{ width: '100%', marginBottom: 8 }}><Scissors size={18} className="icon-inline" />קטלוג מהיר — שירותים, מחירים, ימים</button>
        </Link>
        <Link to="/settings">
          <button className="btn-secondary" style={{ width: '100%', marginBottom: 8 }}><Settings size={18} className="icon-inline" />הגדרות מתקדמות</button>
        </Link>
        <Link to="/pricing">
          <button className="btn-gold" style={{ width: '100%', marginBottom: 8 }}><Sparkles size={18} className="icon-inline" />
            {access.reason === 'trial' ? `מסלול Pro — נותרו ${access.daysLeft} ימי טריאל` : 'מסלול וחיוב'}
          </button>
        </Link>

        {!tokenInstalled && pushStatus !== 'enabled' && (
          <button className="btn-secondary" onClick={enablePush} disabled={pushStatus === 'requesting'} style={{ width: '100%', marginBottom: 8 }}>
            <Bell size={18} className="icon-inline" />הפעל התראות פוש
          </button>
        )}

        {/* Screen Wake Lock — keeps the device screen on for tablet/phone
            use at the workstation. Renders only if the browser supports
            the Wake Lock API (WakeLockToggle returns null otherwise). */}
        <div className="card wake-lock-card">
          <WakeLockToggle />
          <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.82rem', lineHeight: 1.5 }}>
            כשהאופציה דלוקה — המסך של הטאבלט/טלפון לא יכבה לאורך כל היום. נשמר בין רענונים.
          </p>
        </div>

        <button className="btn-danger" onClick={logout} style={{ width: '100%' }}>יציאה</button>
      </>
    );
  }

  const TAB_TITLES = {
    schedule: '', messages: 'הודעות ושיתוף', reports: 'דוחות ותובנות',
    expenses: 'הוצאות', more: 'עוד',
  };

  return (
    <div
      className="app dashboard dash-shell"
      data-profession={barber?.profession || barber?.professions?.[0] || 'barber'}
    >
      <DashNav />

      <div className="dash-main">
        <div className="dash-topbar">
          {barber.logoUrl && (
            <img src={barber.logoUrl} alt="" className="dash-topbar-logo" />
          )}
          <h1 className="dash-topbar-name">{barber.businessName || 'העסק שלי'}</h1>
          {TAB_TITLES[tab] && <span className="dash-topbar-sub">{TAB_TITLES[tab]}</span>}
        </div>

        <TrialExpiryBanner access={access} />

        <div className="dash-content">
          {tab === 'schedule' && <ScheduleTab />}
          {tab === 'messages' && <MessagesTab />}
          {tab === 'reports' && <ReportsTab />}
          {tab === 'expenses' && <ExpensesTab />}
          {tab === 'more' && <MoreTab />}
        </div>
      </div>

      {/* Modals (live across all tabs) */}
      {dueBooking && (
        <AppointmentDueModal
          booking={dueBooking}
          offsetMin={runningOffset}
          onStart={startDueBooking}
          onDelay={applyDelay}
          onSnooze={snoozeDue}
          onClose={snoozeDue}
        />
      )}
      {rescheduling && (
        <RescheduleModal
          booking={rescheduling}
          barber={barber}
          barberId={user.uid}
          onClose={() => setRescheduling(null)}
          onConfirm={handleReschedule}
        />
      )}
      {showVacation && (
        <VacationModal onClose={() => setShowVacation(false)} onConfirm={handleVacation} />
      )}
      {showQr && (
        <QrModal link={shortLink} businessName={barber.businessName || 'העסק שלי'} onClose={() => setShowQr(false)} />
      )}
      {showTomorrow && (
        <TomorrowReminders bookings={bookings} businessName={barber.businessName || 'העסק שלי'} onClose={() => setShowTomorrow(false)} />
      )}
      {showToday && (
        <TomorrowReminders
          bookings={bookings}
          businessName={barber.businessName || 'העסק שלי'}
          targetDay="today"
          onClose={() => setShowToday(false)}
        />
      )}
      {showBroadcast && (
        <BroadcastModal
          open
          barberId={user.uid}
          businessName={barber.businessName || 'העסק שלי'}
          shortLink={shortLink}
          initialBody={broadcastBody || undefined}
          initialTemplateKey={broadcastBody ? 'custom' : undefined}
          onClose={() => { setShowBroadcast(false); setBroadcastBody(null); }}
        />
      )}
      {showYesterday && (
        <YesterdayFollowUp
          uid={user.uid}
          businessName={barber.businessName || 'העסק שלי'}
          googleReviewUrl={barber.googleReviewUrl || ''}
          onClose={() => setShowYesterday(false)}
        />
      )}
      {waitlistNotify && waitlistNotify.clients.length > 0 && (
        <div
          className="modal-backdrop"
          onClick={() => setWaitlistNotify(null)}
          role="presentation"
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wl-notify-title"
            dir="rtl"
            lang="he"
          >
            <h2 id="wl-notify-title">
              <MessageCircle size={20} className="icon-inline" />
              {waitlistNotify.clients.length} לקוחות ממתינים לתור
            </h2>
            <p className="muted" style={{ marginTop: -6, fontSize: '0.9rem' }}>
              התור של {formatDateHe(new Date(waitlistNotify.date))} בשעה {waitlistNotify.time} התפנה.
              לחץ/י על "WhatsApp" ליד כל לקוח כדי לשלוח הודעה אישית עם הלינק להזמנה.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {waitlistNotify.clients.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block' }}>{c.clientName || 'ללא שם'}</strong>
                    <span className="muted" style={{ fontSize: '0.84rem', direction: 'ltr' }}>
                      {c.clientPhone || ''}
                    </span>
                  </div>
                  <a
                    href={whatsappForWaitlist(c)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ padding: '8px 14px', textDecoration: 'none', fontSize: '0.9rem' }}
                  >
                    <MessageCircle size={14} className="icon-inline" />
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '8px 10px' }}
                    onClick={() => removeWaitlistEntry(c)}
                    aria-label="הסר מרשימת המתנה"
                    title="הסר מרשימת המתנה"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="spacer" />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setWaitlistNotify(null)}
              style={{ width: '100%' }}
            >
              סגור
            </button>
          </div>
        </div>
      )}
      {actionFor && (
        <BookingActionSheet
          booking={actionFor}
          businessName={barber.businessName || 'העסק שלי'}
          googleReviewUrl={barber.googleReviewUrl || ''}
          aiGender={barber.aiGender || 'neutral'}
          allBookings={bookings}
          barberId={user.uid}
          onClose={() => setActionFor(null)}
          onStart={() => startBooking(actionFor)}
          onComplete={() => completeBooking(actionFor)}
          onEdit={() => setRescheduling(actionFor)}
          onCancel={() => cancelBooking(actionFor)}
        />
      )}
      {quickBook && (
        <QuickBookModal
          slot={quickBook}
          onClose={() => setQuickBook(null)}
          onBook={quickBookSlot}
          onBlock={(s) => blockSlot(s.time, s.date)}
        />
      )}
      {vacationSaved && (
        <div className="modal-backdrop" onClick={() => setVacationSaved(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>✅ החופש נשמר</h2>
            <p>התאריכים נחסמו. לחץ כאן להודיע ללקוחות ב-WhatsApp.</p>
            <button className="btn-primary" onClick={shareVacationToClients} style={{ width: '100%', marginBottom: 8 }}>
              💬 שלח הודעה ב-WhatsApp
            </button>
            <button className="btn-secondary" onClick={() => setVacationSaved(null)} style={{ width: '100%' }}>סגור</button>
          </div>
        </div>
      )}
    </div>
  );
}
