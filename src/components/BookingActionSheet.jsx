import { addMinToTime } from '../utils/slots';

export default function BookingActionSheet({ booking, onClose, onStart, onComplete, onEdit, onCancel }) {
  const inProgress = booking.status === 'inProgress';
  const completed = booking.status === 'completed';

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
        <a href={`tel:${booking.clientPhone}`} className="btn-secondary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: 12, marginBottom: 8 }}>
          📞 {booking.clientPhone}
        </a>

        {!completed && !inProgress && (
          <button className="btn-primary" onClick={() => { onStart(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}>▶ התחל תור</button>
        )}
        {inProgress && (
          <button className="btn-primary" onClick={() => { onComplete(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}>✓ סיים תור</button>
        )}
        {!completed && (
          <button className="btn-secondary" onClick={() => { onEdit(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}>✏️ העבר לזמן/יום אחר</button>
        )}
        {!completed && (
          <button className="btn-danger" onClick={() => { onCancel(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}>בטל תור</button>
        )}
        <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>סגור</button>
      </div>
    </div>
  );
}
