import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import {
  collection, doc, onSnapshot, query, updateDoc, where,
  addDoc, deleteDoc, getDocs, arrayUnion, arrayRemove, serverTimestamp,
} from 'firebase/firestore';
import {
  dateToISO, formatDateHe, nextNDays, DAY_LABELS_HE, dayKeyFromDate,
} from '../utils/slots';
import { registerFcmToken, requestPushPermission } from '../utils/push';
import { whatsappUrl, shareLinkText } from '../utils/whatsapp';
import { upcomingHolidays } from '../utils/holidays';
import Calendar from '../components/Calendar.jsx';
import StatsCard from '../components/StatsCard.jsx';
import SmartTipsCard from '../components/SmartTipsCard.jsx';
import RescheduleModal from '../components/RescheduleModal.jsx';
import VacationModal from '../components/VacationModal.jsx';
import QrModal from '../components/QrModal.jsx';
import DayTimeline from '../components/DayTimeline.jsx';
import BookingActionSheet from '../components/BookingActionSheet.jsx';
import TomorrowReminders from '../components/TomorrowReminders.jsx';
import MorningSummaryCard from '../components/MorningSummaryCard.jsx';
import BreakSuggestions from '../components/BreakSuggestions.jsx';
import WeeklyReportCard from '../components/WeeklyReportCard.jsx';
import YesterdayFollowUp from '../components/YesterdayFollowUp.jsx';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('calendar');
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
  const [showYesterday, setShowYesterday] = useState(false);
  const [actionFor, setActionFor] = useState(null);

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

  // Notification deep-link handler — when ?booking=<id> is in the URL,
  // open the action sheet for that booking (and clean the URL).
  useEffect(() => {
    const id = searchParams.get('booking');
    if (!id || bookings.length === 0) return;
    const b = bookings.find((x) => x.id === id);
    if (b) {
      setActionFor(b);
      // Jump to today tab so the booking is contextually visible
      const todayISO = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); })();
      if (b.date === todayISO) setTab('today');
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
  const days = useMemo(() => nextNDays(14), []);
  const selectedISO = dateToISO(selectedDate);

  const todayBookings = bookings.filter((b) => b.date === todayISO);
  const todayBlocks = blocks.filter((b) => b.date === todayISO);
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

  const shortLink = barber?.shortCode
    ? `${window.location.origin}/b/${barber.shortCode}`
    : '';

  // --- Actions ---
  async function copyLink() {
    if (!shortLink) return;
    try {
      await navigator.clipboard.writeText(shortLink);
      alert('הלינק הועתק!');
    } catch {
      prompt('העתק את הלינק:', shortLink);
    }
  }
  function shareWhatsApp() {
    if (!shortLink) return;
    const text = shareLinkText(barber.businessName || 'הספרות שלי', shortLink);
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
  async function cancelBooking(b) {
    if (!confirm(`לבטל את התור של ${b.clientName} ב-${b.time}?`)) return;
    try {
      await updateDoc(doc(db, 'barbers', user.uid, 'bookings', b.id), { status: 'cancelled' });
      const wl = await getDocs(query(
        collection(db, 'barbers', user.uid, 'waitlist'),
        where('fromDate', '<=', b.date),
      ));
      const matches = wl.docs.map((d) => ({ id: d.id, ...d.data() })).filter((w) => (w.toDate || w.fromDate) >= b.date);
      if (matches.length > 0 && confirm(`📢 ${matches.length} לקוחות ממתינים. לפתוח WhatsApp עם הודעה?`)) {
        const text = `שלום! 🎉 התפנה תור ב-${barber.businessName} ל-${formatDateHe(new Date(b.date))} בשעה ${b.time}.\nהיכנס מהר ללינק: ${shortLink}`;
        window.open(whatsappUrl(text), '_blank');
      }
    } catch (e) { alert('שגיאה: ' + e.message); }
  }
  async function startBooking(b) {
    try { await updateDoc(doc(db, 'barbers', user.uid, 'bookings', b.id), { status: 'inProgress', startedAt: serverTimestamp() }); }
    catch (e) { alert('שגיאה: ' + e.message); }
  }
  async function completeBooking(b) {
    try { await updateDoc(doc(db, 'barbers', user.uid, 'bookings', b.id), { status: 'completed', completedAt: serverTimestamp() }); }
    catch (e) { alert('שגיאה: ' + e.message); }
  }
  async function blockSlot(time, dateISO) {
    try {
      await addDoc(collection(db, 'barbers', user.uid, 'blocks'), {
        date: dateISO, time, duration: 20, reason: '', createdAt: serverTimestamp(),
      });
    } catch (e) { alert('שגיאה: ' + e.message); }
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
  async function shareVacationToClients() {
    if (!vacationSaved) return;
    const fromLabel = formatDateHe(new Date(vacationSaved.from));
    const toLabel = formatDateHe(new Date(vacationSaved.to));
    const body =
      `שלום! 🪒\n\n${barber.businessName} ייסגר ` +
      (vacationSaved.from === vacationSaved.to ? `ב-${fromLabel}` : `מ-${fromLabel} עד ${toLabel}`) +
      `${vacationSaved.reason ? ` (${vacationSaved.reason})` : ''}.\n\n` +
      `כשנחזור אפשר לקבוע תור חדש בלינק:\n${shortLink}\n\nתודה על ההבנה! 🙏`;
    window.open(whatsappUrl(body), '_blank');
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

  const tokenInstalled = (barber.fcmTokens || []).length > 0;
  const showPushCard = !tokenInstalled && pushStatus !== 'enabled' && !pushDismissed;

  // --- Tab content ---
  const todayHeading = `${DAY_LABELS_HE[dayKeyFromDate(today)]}, ${formatDateHe(today)}`;

  function TodayTab() {
    return (
      <>
        <WeeklyReportCard uid={user.uid} businessName={barber.businessName || 'הספרות שלי'} />

        <MorningSummaryCard
          displayName={barber.displayName}
          businessName={barber.businessName}
          todayBookings={todayBookings}
          onTapBooking={setActionFor}
        />

        <BreakSuggestions
          todayBookings={todayBookings}
          todayBlocks={todayBlocks.filter((b) => !b.wholeDay)}
          onBlock={(time, length) => {
            if (confirm(`לחסום ${length} דקות מ-${time} כהפסקה?`)) {
              addDoc(collection(db, 'barbers', user.uid, 'blocks'), {
                date: todayISO,
                time,
                duration: length,
                reason: 'הפסקה',
                createdAt: serverTimestamp(),
              });
            }
          }}
        />

        {nextHoliday && (
          <button className="chip" onClick={shareHolidayPromo} style={{ width: '100%', marginBottom: 12 }}>
            {nextHoliday.emoji} {nextHoliday.name} מתקרב — שלח הודעה ב-WhatsApp
          </button>
        )}

        {showPushCard && (
          <div className="card push-card">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <strong>🔔 הפעל התראות</strong>
                <p className="muted" style={{ marginTop: 4, marginBottom: 8, fontSize: '0.85rem' }}>
                  באייפון: הוסף קודם ל-Home Screen.
                </p>
                <button className="btn-primary" onClick={enablePush} disabled={pushStatus === 'requesting'} style={{ width: '100%' }}>
                  {pushStatus === 'requesting' ? 'מבקש…' : 'הפעל'}
                </button>
                {pushStatus === 'denied' && <p className="text-danger" style={{ fontSize: '0.8rem', marginTop: 6 }}>הרשאה נדחתה.</p>}
                {pushStatus === 'error' && <p className="text-danger" style={{ fontSize: '0.8rem', marginTop: 6 }}>הוסף ל-Home Screen קודם.</p>}
              </div>
              <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setPushDismissed(true)}>
                ✕
              </button>
            </div>
          </div>
        )}

        <DayTimeline
          date={today}
          workingHours={barber.workingHours}
          bookings={todayBookings}
          blocks={todayBlocks}
          onBookingTap={(b) => setActionFor(b)}
          onFreeSlotTap={(time) => { if (confirm(`לחסום את השעה ${time}?`)) blockSlot(time, todayISO); }}
          onBlockTap={(b) => { if (confirm(`לבטל חסימה ב-${b.time}?`)) unblockSlot(b.id); }}
        />
      </>
    );
  }

  function CalendarTab() {
    return (
      <>
        <div className="card">
          <div className="muted text-center" style={{ marginBottom: 8, fontSize: '0.85rem' }}>{upcomingTotal} תורים צפויים בשבועיים הקרובים</div>
          <Calendar
            days={days}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            bookingsByDate={bookingsByDate}
          />
          <div className="muted text-center" style={{ marginBottom: 8 }}>
            <strong>{DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}, {formatDateHe(selectedDate)}</strong>
            {' • '}{dayBookings.length} תורים
          </div>
          <DayTimeline
            date={selectedDate}
            workingHours={barber.workingHours}
            bookings={dayBookings}
            blocks={dayBlocks}
            onBookingTap={(b) => setActionFor(b)}
            onFreeSlotTap={(time) => { if (confirm(`לחסום את השעה ${time}?`)) blockSlot(time, selectedISO); }}
            onBlockTap={(b) => { if (confirm(`לבטל חסימה ב-${b.time}?`)) unblockSlot(b.id); }}
          />
        </div>

        <button className="btn-secondary" onClick={() => setShowVacation(true)} style={{ width: '100%', marginBottom: 8 }}>
          🌴 הוסף חופש
        </button>
        {(barber.vacations || []).length > 0 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>🌴 חופשים מתוכננים</h3>
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

  function ReportsTab() {
    return (
      <>
        <StatsCard bookings={bookings} />
        <SmartTipsCard workingHours={barber.workingHours} bookings={bookings} blocks={blocks} />
        <button className="btn-secondary" onClick={() => setShowTomorrow(true)} style={{ width: '100%', marginBottom: 8 }}>
          📋 תזכורות WhatsApp ללקוחות מחר
        </button>
        <button className="btn-secondary" onClick={() => setShowYesterday(true)} style={{ width: '100%', marginBottom: 8 }}>
          💬 הודעות תודה ללקוחות מאתמול
        </button>
        <Link to="/reports">
          <button className="btn-primary" style={{ width: '100%' }}>📊 דוחות מלאים + השוואות + חגים</button>
        </Link>
      </>
    );
  }

  function MoreTab() {
    return (
      <>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>שיתוף הלינק שלך</h3>
          <div className="copy-link" onClick={copyLink}>{shortLink || '—'}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={shareWhatsApp} style={{ flex: 1 }}>📤 WhatsApp</button>
            <button className="btn-secondary" onClick={() => setShowQr(true)} style={{ flex: 'none' }}>🔳 QR</button>
            <button className="btn-secondary" onClick={copyLink} style={{ flex: 'none' }}>📋</button>
          </div>
        </div>

        <Link to="/onboarding">
          <button className="btn-primary" style={{ width: '100%', marginBottom: 8 }}>🪒 קטלוג מהיר — שירותים, מחירים, ימים</button>
        </Link>
        <Link to="/settings">
          <button className="btn-secondary" style={{ width: '100%', marginBottom: 8 }}>⚙️ הגדרות מתקדמות</button>
        </Link>
        <Link to="/reports">
          <button className="btn-secondary" style={{ width: '100%', marginBottom: 8 }}>📊 דוחות מלאים</button>
        </Link>
        <button className="btn-secondary" onClick={() => setShowVacation(true)} style={{ width: '100%', marginBottom: 8 }}>
          🌴 הוסף חופש
        </button>

        {!tokenInstalled && pushStatus !== 'enabled' && (
          <button className="btn-secondary" onClick={enablePush} disabled={pushStatus === 'requesting'} style={{ width: '100%', marginBottom: 8 }}>
            🔔 הפעל התראות פוש
          </button>
        )}

        <button className="btn-danger" onClick={logout} style={{ width: '100%' }}>יציאה</button>
      </>
    );
  }

  return (
    <div className="app dashboard">
      <div className="header dashboard-header">
        {barber.logoUrl && (
          <img src={barber.logoUrl} alt="logo" className="dashboard-logo" />
        )}
        <h1>{barber.businessName || 'הספרות שלי'}</h1>
      </div>

      <div className="tab-content">
        {tab === 'today' && <TodayTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'more' && <MoreTab />}
      </div>

      <nav className="bottom-nav">
        <button className={`nav-tab ${tab === 'calendar' ? 'active' : ''}`} onClick={() => setTab('calendar')}>
          <span className="nav-icon">📅</span>
          <span className="nav-label">יומן</span>
        </button>
        <button className={`nav-tab ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>
          <span className="nav-icon">🏠</span>
          <span className="nav-label">היום</span>
          {todayBookings.length > 0 && <span className="nav-badge">{todayBookings.length}</span>}
        </button>
        <button className={`nav-tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
          <span className="nav-icon">📊</span>
          <span className="nav-label">דוחות</span>
        </button>
        <button className={`nav-tab ${tab === 'more' ? 'active' : ''}`} onClick={() => setTab('more')}>
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">עוד</span>
        </button>
      </nav>

      {/* Modals (live across all tabs) */}
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
        <QrModal link={shortLink} businessName={barber.businessName || 'הספרות שלי'} onClose={() => setShowQr(false)} />
      )}
      {showTomorrow && (
        <TomorrowReminders bookings={bookings} businessName={barber.businessName || 'הספרות שלי'} onClose={() => setShowTomorrow(false)} />
      )}
      {showYesterday && (
        <YesterdayFollowUp uid={user.uid} businessName={barber.businessName || 'הספרות שלי'} onClose={() => setShowYesterday(false)} />
      )}
      {actionFor && (
        <BookingActionSheet
          booking={actionFor}
          onClose={() => setActionFor(null)}
          onStart={() => startBooking(actionFor)}
          onComplete={() => completeBooking(actionFor)}
          onEdit={() => setRescheduling(actionFor)}
          onCancel={() => cancelBooking(actionFor)}
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
