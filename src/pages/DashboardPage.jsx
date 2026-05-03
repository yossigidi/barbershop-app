import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [barber, setBarber] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [pushStatus, setPushStatus] = useState('idle');
  const [rescheduling, setRescheduling] = useState(null); // booking obj
  const [showVacation, setShowVacation] = useState(false);
  const [vacationSaved, setVacationSaved] = useState(null); // {from,to,reason}
  const [showQr, setShowQr] = useState(false);
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [actionFor, setActionFor] = useState(null);

  // Upcoming holiday in next 14 days → trigger reminder banner
  const nextHoliday = useMemo(() => {
    const todayISO = dateToISO(new Date());
    const all = upcomingHolidays(todayISO, 5);
    return all.find((h) => {
      const diff = (new Date(h.date) - new Date(todayISO)) / (1000 * 60 * 60 * 24);
      return diff >= 1 && diff <= 14;
    });
  }, []);

  function shareHolidayPromo() {
    if (!nextHoliday) return;
    const text =
      `שלום! ${nextHoliday.emoji} ${nextHoliday.name} מתקרב.\n\n` +
      `אם רוצים תור לקראת החג בלי לחץ — היכנס מהר לקבוע:\n${shortLink}\n\n` +
      `${barber.businessName}`;
    window.open(whatsappUrl(text), '_blank');
  }

  useEffect(() => {
    if (!user) return;
    const unsubBarber = onSnapshot(doc(db, 'barbers', user.uid), (snap) => {
      if (snap.exists()) setBarber({ id: snap.id, ...snap.data() });
    });
    const bq = query(
      collection(db, 'barbers', user.uid, 'bookings'),
      where('status', '==', 'booked'),
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

  const days = useMemo(() => nextNDays(14), []);
  const selectedISO = dateToISO(selectedDate);
  const todayISO = dateToISO(new Date());
  const dayBookings = bookings.filter((b) => b.date === selectedISO);
  const dayBlocks = blocks.filter((b) => b.date === selectedISO);
  const upcomingCount = bookings.filter((b) => b.date >= todayISO).length;
  const bookingsByDate = useMemo(() => {
    const map = {};
    for (const b of bookings) map[b.date] = (map[b.date] || 0) + 1;
    return map;
  }, [bookings]);


  const shortLink = barber?.shortCode
    ? `${window.location.origin}/b/${barber.shortCode}`
    : '';

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

  async function enablePush() {
    setPushStatus('requesting');
    try {
      const token = await requestPushPermission();
      if (!token) return setPushStatus('denied');
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
      // After cancel: if there's a waitlist, suggest WhatsApp blast
      const wl = await getDocs(query(
        collection(db, 'barbers', user.uid, 'waitlist'),
        where('fromDate', '<=', b.date),
      ));
      const matches = wl.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((w) => (w.toDate || w.fromDate) >= b.date);
      if (matches.length > 0) {
        if (confirm(`📢 ${matches.length} לקוחות ממתינים לחלון בתאריך הזה. לפתוח WhatsApp עם הודעה לכולם?`)) {
          const text =
            `שלום! 🎉 התפנה תור ב-${barber.businessName} ל-${formatDateHe(new Date(b.date))} בשעה ${b.time}.\n\n` +
            `אם רלוונטי, היכנס מהר ללינק: ${shortLink}`;
          window.open(whatsappUrl(text), '_blank');
        }
      }
    } catch (e) { alert('שגיאה: ' + e.message); }
  }

  async function startBooking(b) {
    try {
      await updateDoc(doc(db, 'barbers', user.uid, 'bookings', b.id), {
        status: 'inProgress',
        startedAt: serverTimestamp(),
      });
    } catch (e) { alert('שגיאה: ' + e.message); }
  }
  async function completeBooking(b) {
    try {
      await updateDoc(doc(db, 'barbers', user.uid, 'bookings', b.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
      });
    } catch (e) { alert('שגיאה: ' + e.message); }
  }

  async function blockSlot(time) {
    try {
      await addDoc(collection(db, 'barbers', user.uid, 'blocks'), {
        date: selectedISO,
        time,
        duration: 20,
        reason: '',
        createdAt: serverTimestamp(),
      });
    } catch (e) { alert('שגיאה: ' + e.message); }
  }

  async function unblockSlot(blockId) {
    try {
      await deleteDoc(doc(db, 'barbers', user.uid, 'blocks', blockId));
    } catch (e) { alert('שגיאה: ' + e.message); }
  }

  async function handleReschedule(newDate, newTime) {
    if (!rescheduling) return;
    try {
      await updateDoc(doc(db, 'barbers', user.uid, 'bookings', rescheduling.id), {
        date: newDate,
        time: newTime,
      });
      setRescheduling(null);
    } catch (e) { alert('שגיאה: ' + e.message); }
  }

  async function handleVacation({ from, to, reason }) {
    try {
      // Save vacation entry
      await updateDoc(doc(db, 'barbers', user.uid), {
        vacations: arrayUnion({ from, to, reason, id: Math.random().toString(36).slice(2, 9) }),
      });
      // Block every working day in range with a full-day block (one block per day at first slot, marked wholeDay)
      const start = new Date(from);
      const end = new Date(to);
      const writes = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = dateToISO(d);
        // Use a single 24-hour block to cover the whole day in slot computations
        writes.push(addDoc(collection(db, 'barbers', user.uid, 'blocks'), {
          date: iso,
          time: '00:00',
          duration: 24 * 60,
          reason: reason || 'חופש',
          wholeDay: true,
          createdAt: serverTimestamp(),
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
      (vacationSaved.from === vacationSaved.to
        ? `ב-${fromLabel}`
        : `מ-${fromLabel} עד ${toLabel}`) +
      `${vacationSaved.reason ? ` (${vacationSaved.reason})` : ''}.\n\n` +
      `כשנחזור אפשר לקבוע תור חדש בלינק:\n${shortLink}\n\nתודה על ההבנה! 🙏`;
    // Open WhatsApp share — barber selects broadcast list / contacts inside WhatsApp
    window.open(whatsappUrl(body), '_blank');
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
          <button className="btn-primary" onClick={shareWhatsApp} style={{ flex: 1 }}>
            📤 WhatsApp
          </button>
          <button className="btn-secondary" onClick={() => setShowQr(true)} style={{ flex: 'none' }}>
            🔳 QR
          </button>
          <button className="btn-secondary" onClick={copyLink} style={{ flex: 'none' }}>
            📋
          </button>
        </div>
      </div>

      {nextHoliday && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <strong>{nextHoliday.emoji} {nextHoliday.name} מתקרב</strong>
          <p className="muted" style={{ marginTop: 6, marginBottom: 12 }}>
            עוד {Math.ceil((new Date(nextHoliday.date) - new Date()) / (1000 * 60 * 60 * 24))} ימים — מומלץ לעדכן את הלקוחות שלא קבעו עדיין.
          </p>
          <button className="btn-primary" onClick={shareHolidayPromo} style={{ width: '100%' }}>
            💬 שלח הודעה ב-WhatsApp
          </button>
        </div>
      )}

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

      <StatsCard bookings={bookings} />

      <SmartTipsCard
        workingHours={barber.workingHours}
        bookings={bookings}
        blocks={blocks}
      />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>📅 תורים — {upcomingCount} צפויים</h3>
        <Calendar
          days={days}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          bookingsByDate={bookingsByDate}
        />
        <div className="muted text-center" style={{ marginBottom: 12 }}>
          {DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}, {formatDateHe(selectedDate)}
        </div>

        <DayTimeline
          date={selectedDate}
          workingHours={barber.workingHours}
          bookings={dayBookings}
          blocks={dayBlocks}
          onBookingTap={(b) => setActionFor(b)}
          onFreeSlotTap={(time) => {
            if (confirm(`לחסום את השעה ${time}?`)) blockSlot(time);
          }}
          onBlockTap={(b) => {
            if (confirm(`לבטל חסימה ב-${b.time}?`)) unblockSlot(b.id);
          }}
        />
      </div>

      <button
        className="btn-secondary"
        onClick={() => setShowTomorrow(true)}
        style={{ width: '100%', marginBottom: 12 }}
      >
        📋 תזכורות WhatsApp ללקוחות מחר
      </button>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>🌴 חופשים</h3>
        <button className="btn-secondary" onClick={() => setShowVacation(true)} style={{ width: '100%' }}>
          + הוסף חופש (חוסם תאריכים + הודעת WhatsApp ללקוחות)
        </button>
        {(barber.vacations || []).length > 0 && (
          <div style={{ marginTop: 12 }}>
            {barber.vacations.map((v) => (
              <div key={v.id} className="timeline-row">
                <span className="timeline-time">🌴</span>
                <span style={{ flex: 1 }}>
                  {formatDateHe(new Date(v.from))} → {formatDateHe(new Date(v.to))}
                  {v.reason ? ` • ${v.reason}` : ''}
                </span>
                <button
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.85rem' }}
                  onClick={async () => {
                    if (!confirm('להסיר חופש? התאריכים ייפתחו מחדש להזמנה.')) return;
                    // Remove vacation entry
                    await updateDoc(doc(db, 'barbers', user.uid), {
                      vacations: arrayRemove(v),
                    });
                    // Remove the wholeDay blocks created for this vacation range
                    const start = new Date(v.from);
                    const end = new Date(v.to);
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                      const iso = dateToISO(d);
                      const snap = await getDocs(query(
                        collection(db, 'barbers', user.uid, 'blocks'),
                        where('date', '==', iso),
                        where('wholeDay', '==', true),
                      ));
                      for (const s of snap.docs) await deleteDoc(s.ref);
                    }
                  }}
                >
                  הסר
                </button>
              </div>
            ))}
          </div>
        )}
        <Link to="/settings" style={{ display: 'block', marginTop: 12 }}>
          <button className="btn-secondary" style={{ width: '100%' }}>⚙️ הגדרות שעות / שירותים</button>
        </Link>
        <Link to="/reports" style={{ display: 'block', marginTop: 8 }}>
          <button className="btn-secondary" style={{ width: '100%' }}>📊 דוחות + השוואות + חגים</button>
        </Link>
      </div>

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
        <VacationModal
          onClose={() => setShowVacation(false)}
          onConfirm={handleVacation}
        />
      )}

      {showQr && (
        <QrModal
          link={shortLink}
          businessName={barber.businessName || 'הספרות שלי'}
          onClose={() => setShowQr(false)}
        />
      )}

      {showTomorrow && (
        <TomorrowReminders
          bookings={bookings}
          businessName={barber.businessName || 'הספרות שלי'}
          onClose={() => setShowTomorrow(false)}
        />
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
            <p>התאריכים נחסמו ביומן. עכשיו אפשר להודיע ללקוחות ב-WhatsApp בלחיצה אחת.</p>
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              💡 טיפ: ב-WhatsApp צור פעם אחת <strong>רשימת תפוצה</strong> (Broadcast List) עם כל הלקוחות,
              ואז בלחיצה הזאת תוכל לבחור את הרשימה ולשלוח לכולם בבת אחת.
            </p>
            <button className="btn-primary" onClick={shareVacationToClients} style={{ width: '100%', marginBottom: 8 }}>
              💬 שלח הודעה ב-WhatsApp
            </button>
            <button className="btn-secondary" onClick={() => setVacationSaved(null)} style={{ width: '100%' }}>
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
