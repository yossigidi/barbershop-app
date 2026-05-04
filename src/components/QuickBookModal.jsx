import { useState } from 'react';
import { Check, Ban, CalendarPlus } from 'lucide-react';
import { formatDateHe, DAY_LABELS_HE, dayKeyFromDate } from '../utils/slots';

// Opens when the barber taps an empty 20-min cell in the day timeline.
// Lets them add a quick booking with required name + optional phone, or
// fall back to blocking the slot.
export default function QuickBookModal({ slot, onClose, onBook, onBlock }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [duration, setDuration] = useState(20);
  const [busy, setBusy] = useState(false);

  if (!slot) return null;

  const dateObj = (() => {
    const [y, m, d] = slot.date.split('-').map(Number);
    return new Date(y, m - 1, d);
  })();

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) return alert('הזן שם לקוח');
    setBusy(true);
    try {
      await onBook({
        date: slot.date,
        time: slot.time,
        duration,
        clientName: trimmedName,
        clientPhone: phone.trim().replace(/[^\d]/g, ''),
      });
      onClose();
    } catch (e) {
      alert('שגיאה: ' + (e?.message || ''));
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    setBusy(true);
    try {
      await onBlock(slot);
      onClose();
    } catch (e) {
      alert('שגיאה: ' + (e?.message || ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2><CalendarPlus size={20} className="icon-inline" />תור חדש</h2>
        <p className="muted" style={{ marginTop: -8 }}>
          {DAY_LABELS_HE[dayKeyFromDate(dateObj)]}, {formatDateHe(dateObj)} בשעה <strong>{slot.time}</strong>
        </p>

        <div className="field">
          <label>שם הלקוח *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="דני כהן"
            autoFocus
          />
        </div>

        <div className="field">
          <label>טלפון (אופציונלי)</label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="050-1234567"
          />
        </div>

        <div className="field">
          <label className="muted" style={{ fontSize: '0.85rem' }}>אורך התור</label>
          <div className="row" style={{ gap: 6 }}>
            {[20, 40, 60].map((m) => (
              <button
                key={m}
                type="button"
                className={duration === m ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '10px 0', fontSize: '0.9rem' }}
                onClick={() => setDuration(m)}
              >
                {m} דק׳
              </button>
            ))}
          </div>
        </div>

        <div className="spacer" />
        <button className="btn-primary" onClick={save} disabled={busy} style={{ width: '100%', marginBottom: 8 }}>
          <Check size={18} className="icon-inline" />{busy ? 'שומר…' : 'קבע תור'}
        </button>
        <button className="btn-secondary" onClick={block} disabled={busy} style={{ width: '100%', marginBottom: 8 }}>
          <Ban size={18} className="icon-inline" />חסום את הסלוט
        </button>
        <button className="btn-secondary" onClick={onClose} disabled={busy} style={{ width: '100%' }}>ביטול</button>
      </div>
    </div>
  );
}
