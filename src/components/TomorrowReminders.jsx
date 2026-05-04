import { useMemo } from 'react';
import { ClipboardList, MessageCircle } from 'lucide-react';
import { dateToISO, formatDateHe } from '../utils/slots';
import { whatsappUrl } from '../utils/whatsapp';

export default function TomorrowReminders({ bookings, businessName, onClose }) {
  const tomorrowList = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = dateToISO(tomorrow);
    return bookings
      .filter((b) => b.date === iso && b.status === 'booked')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [bookings]);

  function send(b) {
    const dateLabel = formatDateHe(new Date(b.date));
    const msg =
      `שלום ${b.clientName}! 👋\n\n` +
      `תזכורת לתור מחר ב-${businessName}:\n` +
      `📅 ${dateLabel} בשעה ${b.time}` +
      (b.serviceName ? `\n💈 ${b.serviceName}` : '') +
      (b.addons?.length ? ` + ${b.addons.map((a) => a.name).join(', ')}` : '') +
      `\n\nנתראה!`;
    window.open(whatsappUrl(msg, b.clientPhone), '_blank');
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2><ClipboardList size={20} className="icon-inline" />תזכורת ללקוחות מחר</h2>
        <p className="muted">לחץ על הכפתור ליד כל לקוח כדי לפתוח WhatsApp עם הודעת תזכורת מוכנה.</p>
        {tomorrowList.length === 0 ? (
          <div className="empty">אין תורים למחר</div>
        ) : (
          <div>
            {tomorrowList.map((b) => (
              <div key={b.id} className="timeline-row">
                <span className="timeline-time">{b.time}</span>
                <span style={{ flex: 1 }}>
                  <strong>{b.clientName}</strong>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    {b.serviceName} {b.addons?.length > 0 && `+ ${b.addons.length}`}
                  </div>
                </span>
                <button className="btn-primary" onClick={() => send(b)} style={{ padding: '6px 10px', fontSize: '0.85rem' }} aria-label="שלח WhatsApp">
                  <MessageCircle size={16} />
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
