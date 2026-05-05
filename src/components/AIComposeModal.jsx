import { useState } from 'react';
import { Sparkles, Send, Edit3, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { whatsappUrl } from '../utils/whatsapp';

// AI WhatsApp message composer — barber/cosmetician picks a scenario,
// AI returns 3 variations, they pick + edit + send.
//
// Props:
//   open, onClose, booking, businessName, profession, googleReviewUrl
//   defaultScenario: optional initial selection

const SCENARIOS = [
  { key: 'reminder',     label: 'תזכורת', desc: 'תור מחר' },
  { key: 'thank-you',    label: 'תודה', desc: 'אחרי תור' },
  { key: 'winback',      label: 'חזרה', desc: 'לקוח שלא חזר' },
  { key: 'reschedule',   label: 'העברה', desc: 'אני לא יכול' },
  { key: 'vip-welcome',  label: 'VIP', desc: 'לקוח קבוע' },
  { key: 'holiday',      label: 'חג', desc: 'ברכת חג' },
];

export default function AIComposeModal({
  open, onClose, booking,
  businessName = '', profession = '', googleReviewUrl = '',
  defaultScenario = 'reminder',
}) {
  const { user } = useAuth();
  const [scenario, setScenario] = useState(defaultScenario);
  const [busy, setBusy] = useState(false);
  const [variations, setVariations] = useState([]);
  const [picked, setPicked] = useState(0);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  async function generate() {
    setBusy(true);
    setError('');
    setVariations([]);
    try {
      const idToken = await user.getIdToken();
      const r = await fetch('/api/ai-compose', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          client: booking ? {
            firstName: (booking.clientName || '').split(/\s+/)[0],
            fullName: booking.clientName || '',
          } : {},
          booking: booking ? {
            date: booking.date,
            time: booking.time,
            service: booking.serviceName || '',
            addons: (booking.addons || []).map((a) => a.name),
          } : {},
          business: {
            name: businessName,
            profession,
            googleReviewUrl,
          },
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.variations?.length) throw new Error(data.error || 'AI לא החזיר תוצאה');
      setVariations(data.variations);
      setPicked(0);
      setEditText(data.variations[0]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function pickVariation(idx) {
    setPicked(idx);
    setEditText(variations[idx]);
  }

  function send() {
    if (!editText.trim() || !booking?.clientPhone) return;
    window.open(whatsappUrl(editText, booking.clientPhone), '_blank');
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <h2><Sparkles size={20} className="icon-inline" />כתוב הודעה ב-AI</h2>

        {booking && (
          <p className="muted" style={{ marginTop: -8, fontSize: '0.88rem' }}>
            ל-<strong>{booking.clientName}</strong>
            {booking.serviceName && <> · {booking.serviceName}</>}
          </p>
        )}

        <div className="field">
          <label className="muted" style={{ fontSize: '0.85rem' }}>תרחיש</label>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {SCENARIOS.map((s) => {
              const on = scenario === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setScenario(s.key)}
                  className={on ? 'btn-primary' : 'btn-secondary'}
                  style={{ flex: '1 0 100px', padding: '10px 6px', fontSize: '0.82rem', flexDirection: 'column', gap: 2 }}
                >
                  <span style={{ fontWeight: 700 }}>{s.label}</span>
                  <span style={{ fontSize: '0.66rem', opacity: 0.7, fontWeight: 400 }}>{s.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {variations.length === 0 && (
          <button
            className="btn-gold"
            onClick={generate}
            disabled={busy}
            style={{ width: '100%', marginTop: 4 }}
          >
            <Sparkles size={16} className="icon-inline" />
            {busy ? 'יוצר…' : 'יצירת 3 הצעות'}
          </button>
        )}

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '0.88rem', margin: '10px 0' }}>{error}</p>
        )}

        {variations.length > 0 && (
          <>
            <div className="field" style={{ marginTop: 8 }}>
              <label className="muted" style={{ fontSize: '0.85rem' }}>3 גרסאות — בחר/י אחת</label>
              {variations.map((v, i) => (
                <div
                  key={i}
                  className={`ai-variation ${picked === i ? 'picked' : ''}`}
                  onClick={() => pickVariation(i)}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{v}</div>
                </div>
              ))}
            </div>

            <div className="field">
              <label className="muted" style={{ fontSize: '0.85rem' }}>
                <Edit3 size={12} className="icon-inline" />עריכה לפני שליחה
              </label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={5}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                  background: 'var(--surface)',
                }}
              />
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn-secondary"
                onClick={generate}
                disabled={busy}
                style={{ flex: 1 }}
              >
                <RefreshCw size={14} className="icon-inline" />יצירה מחדש
              </button>
              <button
                className="btn-primary"
                onClick={send}
                disabled={!editText.trim() || !booking?.clientPhone}
                style={{ flex: 2 }}
              >
                <Send size={16} className="icon-inline" />שלח ב-WhatsApp
              </button>
            </div>
          </>
        )}

        <div className="spacer" />
        <button className="btn-secondary" onClick={onClose} disabled={busy} style={{ width: '100%' }}>
          סגור
        </button>
      </div>
    </div>
  );
}
