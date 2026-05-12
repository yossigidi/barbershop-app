import { useMemo, useState, useEffect } from 'react';
import { ClipboardList, MessageCircle, Send, Check } from 'lucide-react';
import { dateToISO, formatDateHe } from '../utils/slots';
import { whatsappUrl } from '../utils/whatsapp';

// Reminders modal — used both for tomorrow's appointments (default) and
// today's (passed as targetDay='today'). Tracks which clients were
// messaged today via localStorage so the operator can hit "send all"
// once and then walk through any new ones later in the day.
//
// Props:
//   bookings: array of all bookings
//   businessName: shown in the WhatsApp message
//   targetDay: 'today' | 'tomorrow' (default 'tomorrow')
//   onClose: () => void

const SENT_KEY_PREFIX = 'bs_reminderSent_';

export default function TomorrowReminders({
  bookings,
  businessName,
  onClose,
  targetDay = 'tomorrow',
}) {
  const list = useMemo(() => {
    const target = new Date();
    target.setHours(0, 0, 0, 0);
    if (targetDay === 'tomorrow') target.setDate(target.getDate() + 1);
    const iso = dateToISO(target);
    return bookings
      .filter((b) => b.date === iso && b.status === 'booked')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [bookings, targetDay]);

  const sentKey = useMemo(() => {
    const target = new Date();
    if (targetDay === 'tomorrow') target.setDate(target.getDate() + 1);
    return SENT_KEY_PREFIX + dateToISO(target);
  }, [targetDay]);

  // Persist which booking ids the barber already messaged today so the
  // "send next" button can pick up where they left off after switching tabs.
  const [sent, setSent] = useState(() => {
    try {
      const raw = localStorage.getItem(sentKey);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    try { localStorage.setItem(sentKey, JSON.stringify([...sent])); } catch {}
  }, [sent, sentKey]);

  function buildMsg(b, isToday) {
    // Neutral, ungendered Hebrew — same wording works for any client
    // regardless of name / gender. The barber sends the same template
    // to everyone in the day so we keep it factual + polite, no
    // "לך/לך/ה" wording that would feel oddly informal across the
    // whole client list. Also drops profession-specific emojis (was
    // "💈" — wrong for manicurist / cosmetician).
    const dateLabel = formatDateHe(new Date(b.date));
    const firstName = (b.clientName || '').split(/\s+/)[0] || '';
    const intro = isToday
      ? `שלום ${firstName},\nתזכורת לתור היום ב-${businessName}:`
      : `שלום ${firstName},\nתזכורת לתור מחר ב-${businessName}:`;
    const lines = [intro, '', `תאריך: ${dateLabel}`, `שעה: ${b.time}`];
    if (b.serviceName) {
      let svcLine = `שירות: ${b.serviceName}`;
      if (b.addons?.length) svcLine += ` (+ ${b.addons.map((a) => a.name).join(', ')})`;
      lines.push(svcLine);
    }
    lines.push('', 'נתראה.');
    return lines.join('\n');
  }

  function sendOne(b) {
    const msg = buildMsg(b, targetDay === 'today');
    window.open(whatsappUrl(msg, b.clientPhone), '_blank');
    setSent((s) => new Set([...s, b.id]));
  }

  // Send the next pending one (lets the barber walk through them
  // sequentially without losing track after switching tabs).
  function sendNext() {
    const next = list.find((b) => !sent.has(b.id));
    if (next) sendOne(next);
  }

  // Open WhatsApp tabs for ALL pending clients in one click. Browsers
  // permit multiple window.open() calls from a single user gesture.
  function sendAll() {
    const pending = list.filter((b) => !sent.has(b.id));
    if (pending.length === 0) return;
    if (pending.length > 5) {
      const ok = window.confirm(
        `נפתחו ${pending.length} חלוניות וואטסאפ ברצף. ייתכן שהדפדפן יחסום חלקן — אם כן, אפשר ללחוץ "השלם" בכל לקוח בנפרד.`,
      );
      if (!ok) return;
    }
    const ids = [];
    for (const b of pending) {
      const msg = buildMsg(b, targetDay === 'today');
      window.open(whatsappUrl(msg, b.clientPhone), '_blank');
      ids.push(b.id);
    }
    setSent((s) => new Set([...s, ...ids]));
  }

  function reset() {
    if (confirm('לאפס את סימוני "נשלח" ולהתחיל מחדש?')) {
      setSent(new Set());
    }
  }

  const sentCount = list.filter((b) => sent.has(b.id)).length;
  const allSent = list.length > 0 && sentCount === list.length;
  const headlineLabel = targetDay === 'today' ? 'תזכורת ללקוחות היום' : 'תזכורת ללקוחות מחר';
  const emptyLabel = targetDay === 'today' ? 'אין תורים היום' : 'אין תורים מחר';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2><ClipboardList size={20} className="icon-inline" />{headlineLabel}</h2>

        {list.length === 0 ? (
          <div className="empty">{emptyLabel}</div>
        ) : (
          <>
            <div className="reminder-progress">
              <div className="reminder-progress-bar">
                <div
                  className="reminder-progress-fill"
                  style={{ width: `${(sentCount / list.length) * 100}%` }}
                />
              </div>
              <div className="reminder-progress-text">
                {sentCount} מתוך {list.length} נשלחו
              </div>
            </div>

            {!allSent && (
              <div className="reminder-bulk-actions">
                <button
                  type="button"
                  className="btn-gold"
                  onClick={sendAll}
                  style={{ flex: 1 }}
                >
                  <Send size={16} className="icon-inline" />
                  שלח לכולם בלחיצה אחת ({list.length - sentCount})
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={sendNext}
                  style={{ flex: 'none', padding: '12px 16px' }}
                  title="פותח רק את הבא בתור — שימושי אם הדפדפן חוסם הרבה חלוניות"
                >
                  <MessageCircle size={16} className="icon-inline" />
                  הבא
                </button>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              {list.map((b) => {
                const isSent = sent.has(b.id);
                return (
                  <div
                    key={b.id}
                    className={`timeline-row reminder-row ${isSent ? 'is-sent' : ''}`}
                  >
                    <span className="timeline-time">{b.time}</span>
                    <span style={{ flex: 1 }}>
                      <strong>{b.clientName}</strong>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {b.serviceName} {b.addons?.length > 0 && `+ ${b.addons.length}`}
                      </div>
                    </span>
                    {isSent ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => sendOne(b)}
                        style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                        title="שלח שוב"
                      >
                        <Check size={14} className="icon-inline" />נשלח
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => sendOne(b)}
                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                        aria-label="שלח WhatsApp"
                      >
                        <MessageCircle size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {sentCount > 0 && (
              <button
                type="button"
                className="reminder-reset"
                onClick={reset}
              >
                איפוס סימוני "נשלח"
              </button>
            )}
          </>
        )}

        <div className="spacer" />
        <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>סגור</button>
      </div>
    </div>
  );
}
