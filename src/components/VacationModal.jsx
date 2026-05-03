import { useState } from 'react';
import { dateToISO } from '../utils/slots';

export default function VacationModal({ onClose, onConfirm }) {
  const todayISO = dateToISO(new Date());
  const [from, setFrom] = useState(todayISO);
  const [to, setTo] = useState(todayISO);
  const [reason, setReason] = useState('');

  function submit() {
    if (!from || !to) return alert('בחר תאריכים');
    if (from > to) return alert('תאריך התחלה אחרי תאריך סיום');
    onConfirm({ from, to, reason: reason.trim() });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>🌴 הוסף חופש</h2>
        <p className="muted">היומן ייחסם בתאריכים אלה ולא ניתן יהיה לקבוע תור.</p>
        <div className="row">
          <div>
            <label className="muted">מ-</label>
            <input type="date" min={todayISO} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="muted">עד</label>
            <input type="date" min={todayISO} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>סיבה (אופציונלי, יוצג בהודעת ה-WhatsApp ללקוחות)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="חופש משפחתי, חופשה בחו״ל…" />
        </div>
        <button className="btn-primary" onClick={submit} style={{ width: '100%' }}>שמור</button>
      </div>
    </div>
  );
}
