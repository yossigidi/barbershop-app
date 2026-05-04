import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Check } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { dateToISO, formatDateHe } from '../utils/slots';
import { whatsappUrl } from '../utils/whatsapp';

// One-tap follow-up messages for clients who came yesterday.
// Queries completed bookings (and unmarked booked from yesterday) once when opened.
export default function YesterdayFollowUp({ uid, businessName, onClose }) {
  const [bookings, setBookings] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sentSet, setSentSet] = useState(() => new Set());

  const yesterdayISO = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 1);
    return dateToISO(d);
  }, []);

  useEffect(() => {
    (async () => {
      const q = query(
        collection(db, 'barbers', uid, 'bookings'),
        where('date', '==', yesterdayISO),
      );
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => b.status !== 'cancelled')
        .sort((a, b) => a.time.localeCompare(b.time));
      setBookings(list);
      setLoaded(true);
    })();
  }, [uid, yesterdayISO]);

  function firstName(full) {
    return (full || '').split(' ')[0] || full;
  }

  function send(b) {
    const msg =
      `שלום ${firstName(b.clientName)}! 🙏\n\n` +
      `תודה שהגעת אתמול ל-${businessName}.\n` +
      `איך יצא? נשמח לדעת.\n\n` +
      `מחכים לראות אותך שוב — אני כאן.`;
    window.open(whatsappUrl(msg, b.clientPhone), '_blank');
    setSentSet((s) => new Set(s).add(b.id));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2><MessageCircle size={20} className="icon-inline" />תודה ללקוחות מאתמול</h2>
        <p className="muted">
          הודעות נשלחות מ-WhatsApp שלך, בשמך — לא כ"מערכת". טקסט מוכן, שולחים לפי הצורך.
        </p>

        {!loaded ? (
          <div className="loading">טוען…</div>
        ) : bookings.length === 0 ? (
          <div className="empty">אין תורים מאתמול ({formatDateHe(new Date(yesterdayISO))})</div>
        ) : (
          <div>
            {bookings.map((b) => (
              <div key={b.id} className={`timeline-row ${sentSet.has(b.id) ? 'completed' : ''}`}>
                <span className="timeline-time">{b.time}</span>
                <span style={{ flex: 1 }}>
                  <strong>{b.clientName}</strong>
                  {b.serviceName && (
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {b.serviceName}{b.price ? ` • ₪${b.price}` : ''}
                    </div>
                  )}
                </span>
                <button
                  className={sentSet.has(b.id) ? 'btn-secondary' : 'btn-primary'}
                  style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                  onClick={() => send(b)}
                  aria-label={sentSet.has(b.id) ? 'נשלח' : 'שלח WhatsApp'}
                >
                  {sentSet.has(b.id) ? <><Check size={14} className="icon-inline" />נשלח</> : <MessageCircle size={16} />}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="spacer" />
        <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>סגור</button>
      </div>
    </div>
  );
}
