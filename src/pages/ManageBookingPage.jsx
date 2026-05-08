import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CalendarDays, Clock, Scissors as ScissorsIcon, CircleDollarSign,
  Phone, XCircle, Edit3, ArrowLeft, CheckCircle2,
} from 'lucide-react';
import AccessibleModal from '../components/AccessibleModal.jsx';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import {
  computeSlotsForDate, dateToISO, formatDateHe, nextNDays,
  DAY_LABELS_HE, dayKeyFromDate, addMinToTime, timeToMin,
} from '../utils/slots';
import Calendar from '../components/Calendar.jsx';
import { whatsappUrl } from '../utils/whatsapp';
import { getThemeKey } from '../utils/themes';

// /manage/:token — public page where a client can view, cancel, or
// reschedule their appointment using the unique token from the link they
// got at booking time. No login required: the token IS the credential.

export default function ManageBookingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolved, setResolved] = useState(null); // { uid, bookingId }
  const [booking, setBooking] = useState(null);
  const [barber, setBarber] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reschedulingMode, setReschedulingMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [pickedTime, setPickedTime] = useState(null);
  const [occupied, setOccupied] = useState([]);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmRescheduleOpen, setConfirmRescheduleOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  // Resolve token → barber + booking
  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const tokenSnap = await getDoc(doc(db, 'manageTokens', token));
        if (stale) return;
        if (!tokenSnap.exists()) {
          setError('הלינק לא תקף או פג תוקפו.');
          setLoading(false);
          return;
        }
        const { uid, bookingId } = tokenSnap.data();
        if (!uid || !bookingId) {
          setError('מבנה הלינק לא תקין.');
          setLoading(false);
          return;
        }
        setResolved({ uid, bookingId });
        const [bSnap, brSnap] = await Promise.all([
          getDoc(doc(db, 'barbers', uid, 'bookings', bookingId)),
          getDoc(doc(db, 'barbers', uid)),
        ]);
        if (stale) return;
        if (!bSnap.exists()) {
          setError('התור כבר לא קיים — ייתכן שנמחק.');
          setLoading(false);
          return;
        }
        setBooking({ id: bSnap.id, ...bSnap.data() });
        if (brSnap.exists()) setBarber(brSnap.data());
      } catch (e) {
        if (stale) return;
        setError('שגיאה בטעינת התור: ' + e.message);
      } finally {
        if (!stale) setLoading(false);
      }
    })();
    return () => { stale = true; };
  }, [token]);

  // Initialize reschedule date to current booking date once available
  useEffect(() => {
    if (!booking?.date) return;
    const [y, m, d] = booking.date.split('-').map(Number);
    setSelectedDate(new Date(y, m - 1, d));
  }, [booking]);

  // Load occupied slots for selected date in reschedule mode
  useEffect(() => {
    if (!reschedulingMode || !resolved) return;
    (async () => {
      const iso = dateToISO(selectedDate);
      const bq = query(
        collection(db, 'barbers', resolved.uid, 'bookings'),
        where('date', '==', iso),
        where('status', '==', 'booked'),
      );
      const blq = query(
        collection(db, 'barbers', resolved.uid, 'blocks'),
        where('date', '==', iso),
      );
      const [bs, bls] = await Promise.all([getDocs(bq), getDocs(blq)]);
      const list = [
        ...bs.docs
          .filter((d) => d.id !== resolved.bookingId)
          .map((d) => ({ time: d.data().time, duration: d.data().duration || 20 })),
        ...bls.docs.map((d) => ({ time: d.data().time, duration: d.data().duration || 20 })),
      ];
      setOccupied(list);
    })();
  }, [reschedulingMode, selectedDate, resolved]);

  const days = useMemo(() => nextNDays(14), []);
  const slots = useMemo(() => {
    if (!barber?.workingHours) return [];
    return computeSlotsForDate(
      selectedDate,
      barber.workingHours,
      occupied,
      booking?.duration || 20,
    );
  }, [selectedDate, barber, occupied, booking]);

  const dateObj = (() => {
    if (!booking?.date) return null;
    const [y, m, d] = booking.date.split('-').map(Number);
    return new Date(y, m - 1, d);
  })();

  async function cancelBooking() {
    setActionError('');
    setBusy(true);
    try {
      await updateDoc(doc(db, 'barbers', resolved.uid, 'bookings', resolved.bookingId), {
        clientPhone: booking.clientPhone, // preserve — Firestore rule requires it unchanged
        status: 'cancelled',
      });
      setBooking({ ...booking, status: 'cancelled' });
      setConfirmCancelOpen(false);
    } catch (e) {
      setActionError('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReschedule() {
    if (!pickedTime) return;
    const newISO = dateToISO(selectedDate);
    if (newISO === booking.date && pickedTime === booking.time) {
      setReschedulingMode(false);
      return;
    }
    setConfirmRescheduleOpen(true);
  }

  async function applyReschedule() {
    setActionError('');
    setBusy(true);
    try {
      const newISO = dateToISO(selectedDate);
      await updateDoc(doc(db, 'barbers', resolved.uid, 'bookings', resolved.bookingId), {
        clientPhone: booking.clientPhone,
        status: 'booked',
        date: newISO,
        time: pickedTime,
      });
      setBooking({ ...booking, date: newISO, time: pickedTime });
      setReschedulingMode(false);
      setPickedTime(null);
      setConfirmRescheduleOpen(false);
    } catch (e) {
      setActionError('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="loading">טוען…</div>;
  if (error) {
    return (
      <div className="app">
        <div className="card text-center" style={{ marginTop: 40 }}>
          <h2 style={{ color: 'var(--danger)' }}>{error}</h2>
          <p className="muted">אם זה לא צפוי, פנה אל בעל העסק לקבלת הבהרה.</p>
        </div>
      </div>
    );
  }

  const isCancelled = booking.status === 'cancelled';
  const isCompleted = booking.status === 'completed';
  const isPast = dateObj && dateObj < new Date(new Date().setHours(0, 0, 0, 0));
  const editable = !isCancelled && !isCompleted && !isPast;
  const initials = (() => {
    const name = (barber?.businessName || '').trim();
    if (!name) return '';
    const parts = name.split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  })();

  return (
    <div className="app" data-theme={getThemeKey(barber)}>
      <div className="brand-header brand-header-row">
        {barber?.logoUrl
          ? <img src={barber.logoUrl} alt={barber.businessName} className="brand-logo" />
          : <div className="brand-wordmark" aria-hidden="true">{initials}</div>}
        <div className="brand-text">
          <h1 className="brand-title">{barber?.businessName || 'העסק'}</h1>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--font-display)' }}>
          {isCancelled ? '❌ התור בוטל' : isCompleted ? '✓ התור הסתיים' : isPast ? '⏰ התור עבר' : '✓ התור שלך'}
        </h2>

        <div className="confirm-row">
          <span className="confirm-label"><CalendarDays size={14} className="icon-inline" />תאריך</span>
          <strong>
            {dateObj && <>{DAY_LABELS_HE[dayKeyFromDate(dateObj)]}, {formatDateHe(dateObj)}</>}
          </strong>
        </div>
        <div className="confirm-row">
          <span className="confirm-label"><Clock size={14} className="icon-inline" />שעה</span>
          <strong>{booking.time}–{addMinToTime(booking.time, booking.duration || 20)}</strong>
        </div>
        {booking.serviceName && (
          <div className="confirm-row">
            <span className="confirm-label"><ScissorsIcon size={14} className="icon-inline" />שירות</span>
            <strong>{booking.serviceName}</strong>
          </div>
        )}
        {booking.price > 0 && (
          <div className="confirm-row">
            <span className="confirm-label"><CircleDollarSign size={14} className="icon-inline" />מחיר</span>
            <strong>₪{booking.price}</strong>
          </div>
        )}
        <div className="confirm-row">
          <span className="confirm-label">על שם</span>
          <strong>{booking.clientName}</strong>
        </div>
      </div>

      {editable && !reschedulingMode && (
        <>
          <button
            className="btn-primary"
            onClick={() => setReschedulingMode(true)}
            style={{ width: '100%', marginBottom: 8 }}
            disabled={busy}
          >
            <Edit3 size={18} className="icon-inline" />שינוי תאריך / שעה
          </button>
          <button
            className="btn-danger"
            onClick={() => setConfirmCancelOpen(true)}
            style={{ width: '100%', marginBottom: 8 }}
            disabled={busy}
          >
            <XCircle size={18} className="icon-inline" />ביטול תור
          </button>
        </>
      )}

      {editable && reschedulingMode && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>בחר תאריך חדש</h3>
          <Calendar
            days={days}
            selectedDate={selectedDate}
            onSelect={(d) => { setSelectedDate(d); setPickedTime(null); }}
            workingHours={barber?.workingHours}
          />
          <div className="muted text-center" style={{ marginBottom: 12 }}>
            {DAY_LABELS_HE[dayKeyFromDate(selectedDate)]}, {formatDateHe(selectedDate)}
          </div>
          <h3>בחר שעה חדשה</h3>
          {slots.length === 0 ? (
            <div className="empty">סגור ביום זה</div>
          ) : slots.every((s) => !s.available) ? (
            <div className="empty">אין שעות פנויות בתאריך זה</div>
          ) : (
            <div className="slots">
              {slots.filter((s) => s.available).map((s) => (
                <button
                  type="button"
                  key={s.time}
                  className={`slot ${pickedTime === s.time ? 'selected' : ''}`}
                  onClick={() => setPickedTime(s.time)}
                  aria-pressed={pickedTime === s.time}
                  aria-label={`שעה ${s.time}`}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
          <div className="spacer" />
          <button
            className="btn-primary"
            onClick={confirmReschedule}
            disabled={!pickedTime || busy}
            style={{ width: '100%', marginBottom: 8 }}
          >
            <CheckCircle2 size={18} className="icon-inline" />{busy ? 'מעדכן…' : 'אישור שינוי'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => { setReschedulingMode(false); setPickedTime(null); }}
            disabled={busy}
            style={{ width: '100%' }}
          >
            <ArrowLeft size={14} className="icon-inline" />חזור
          </button>
        </div>
      )}

      {!editable && barber?.shortCode && (
        <button
          className="btn-secondary"
          onClick={() => navigate(`/b/${barber.shortCode}`)}
          style={{ width: '100%', marginBottom: 8 }}
        >
          קבע תור חדש
        </button>
      )}

      {/* Contact button — wa.me to the business owner */}
      {barber && (
        <a
          href={whatsappUrl(`היי! אני ${booking.clientName}, יש לי שאלה על התור.`, '')}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', textDecoration: 'none', padding: 12 }}
        >
          <Phone size={16} />יצירת קשר ב-WhatsApp
        </a>
      )}

      <AccessibleModal
        open={confirmCancelOpen}
        onClose={() => !busy && (setConfirmCancelOpen(false), setActionError(''))}
        titleId="manage-cancel-title"
        maxWidth={420}
        showCloseButton={false}
      >
        <h2 id="manage-cancel-title">
          <XCircle size={20} className="icon-inline" style={{ color: 'var(--danger)' }} aria-hidden="true" />
          ביטול תור
        </h2>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
          לבטל את התור הזה? הפעולה לא הפיכה — תצטרך/י לקבוע תור חדש בנפרד.
        </p>
        {actionError && (
          <p role="alert" style={{ color: 'var(--danger)', fontSize: '0.88rem' }}>{actionError}</p>
        )}
        <div className="spacer" />
        <button
          className="btn-danger"
          onClick={cancelBooking}
          disabled={busy}
          style={{ width: '100%', marginBottom: 8 }}
        >
          {busy ? 'מבטל…' : 'אישור — בטל תור'}
        </button>
        <button
          className="btn-secondary"
          onClick={() => { setConfirmCancelOpen(false); setActionError(''); }}
          disabled={busy}
          style={{ width: '100%' }}
        >
          חזור
        </button>
      </AccessibleModal>

      <AccessibleModal
        open={confirmRescheduleOpen}
        onClose={() => !busy && (setConfirmRescheduleOpen(false), setActionError(''))}
        titleId="manage-resched-title"
        maxWidth={420}
        showCloseButton={false}
      >
        <h2 id="manage-resched-title">
          <Edit3 size={20} className="icon-inline" aria-hidden="true" />
          אישור שינוי תור
        </h2>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
          לעדכן את התור ל־<strong>{formatDateHe(selectedDate)}</strong> בשעה <strong>{pickedTime}</strong>?
        </p>
        {actionError && (
          <p role="alert" style={{ color: 'var(--danger)', fontSize: '0.88rem' }}>{actionError}</p>
        )}
        <div className="spacer" />
        <button
          className="btn-primary"
          onClick={applyReschedule}
          disabled={busy}
          style={{ width: '100%', marginBottom: 8 }}
        >
          {busy ? 'מעדכן…' : 'אישור שינוי'}
        </button>
        <button
          className="btn-secondary"
          onClick={() => { setConfirmRescheduleOpen(false); setActionError(''); }}
          disabled={busy}
          style={{ width: '100%' }}
        >
          חזור
        </button>
      </AccessibleModal>
    </div>
  );
}
