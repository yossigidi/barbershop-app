import { Phone, Play, Check, Edit3, Star } from 'lucide-react';
import { addMinToTime } from '../utils/slots';
import { whatsappUrl } from '../utils/whatsapp';

export default function BookingActionSheet({ booking, businessName, googleReviewUrl, onClose, onStart, onComplete, onEdit, onCancel }) {
  const inProgress = booking.status === 'inProgress';
  const completed = booking.status === 'completed';

  function sendReviewRequest() {
    if (!googleReviewUrl || !booking.clientPhone) return;
    const firstName = (booking.clientName || '').split(/\s+/)[0] || booking.clientName || '';
    const msg =
      `שלום ${firstName}! 🙏\n\n` +
      `תודה שהגעת ל-${businessName || 'אצלי'}!\n\n` +
      `⭐ אם נהנית, נשמח מאוד אם תוכל/י לכתוב ביקורת קצרה ב-Google. זה לוקח דקה ועוזר לי המון:\n` +
      `${googleReviewUrl}\n\n` +
      `מחכים לראות אותך שוב 🙏`;
    window.open(whatsappUrl(msg, booking.clientPhone), '_blank');
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{booking.clientName}</h2>
        <p className="muted" style={{ marginTop: -8 }}>
          {booking.time}–{addMinToTime(booking.time, booking.duration || 20)}
          {booking.duration ? ` • ${booking.duration} דק׳` : ''}
          {booking.price ? ` • ₪${booking.price}` : ''}
        </p>
        {booking.serviceName && (
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            {booking.serviceName}
            {booking.addons?.length > 0 && ` + ${booking.addons.map((a) => a.name).join(', ')}`}
          </p>
        )}
        <a href={`tel:${booking.clientPhone}`} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', textDecoration: 'none', padding: 12, marginBottom: 8 }}>
          <Phone size={16} />{booking.clientPhone}
        </a>

        {!completed && !inProgress && (
          <button className="btn-primary" onClick={() => { onStart(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}><Play size={18} className="icon-inline" />התחל תור</button>
        )}
        {inProgress && (
          <button className="btn-primary" onClick={() => { onComplete(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}><Check size={18} className="icon-inline" />סיים תור</button>
        )}
        {!completed && (
          <button className="btn-secondary" onClick={() => { onEdit(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}><Edit3 size={18} className="icon-inline" />העבר לזמן/יום אחר</button>
        )}
        {completed && googleReviewUrl && (
          <button className="btn-gold" onClick={() => { sendReviewRequest(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}><Star size={18} className="icon-inline" />שלח בקשת ביקורת בגוגל</button>
        )}
        {!completed && (
          <button className="btn-danger" onClick={() => { onCancel(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}>בטל תור</button>
        )}
        <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>סגור</button>
      </div>
    </div>
  );
}
