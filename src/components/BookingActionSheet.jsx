import { useState, useEffect, useMemo } from 'react';
import { Phone, Play, Check, Edit3, Star, Sparkles, Crown, AlertTriangle, MessageCircle, BellRing, Heart, Repeat } from 'lucide-react';
import { addMinToTime, dateToISO } from '../utils/slots';
import { whatsappUrl } from '../utils/whatsapp';
import { computeClientMemory } from '../utils/clientMemory';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import AIComposeModal from './AIComposeModal.jsx';

export default function BookingActionSheet({
  booking, businessName, googleReviewUrl, aiGender, allBookings, barberId,
  onClose, onStart, onComplete, onEdit, onCancel,
}) {
  const inProgress = booking.status === 'inProgress';
  const completed = booking.status === 'completed';
  const [aiOpen, setAiOpen] = useState(false);
  const [aiScenario, setAiScenario] = useState('reminder');
  const [notes, setNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Compute client memory from the barber's full booking history
  const memory = useMemo(() => {
    if (!Array.isArray(allBookings) || !booking?.clientPhone) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return computeClientMemory(allBookings, booking.clientPhone, dateToISO(today));
  }, [allBookings, booking?.clientPhone]);

  // Load private notes from clients/{phone} when sheet opens for a known phone
  useEffect(() => {
    if (!barberId || !booking?.clientPhone) return;
    let stale = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'barbers', barberId, 'clients', booking.clientPhone));
        if (stale) return;
        if (snap.exists()) {
          setNotes(snap.data().notes || '');
        }
        setNotesLoaded(true);
      } catch (e) {
        console.warn('notes load failed', e?.message);
        setNotesLoaded(true);
      }
    })();
    return () => { stale = true; };
  }, [barberId, booking?.clientPhone]);

  async function saveNotes() {
    if (!barberId || !booking?.clientPhone || !notesDirty) return;
    setSavingNotes(true);
    try {
      await updateDoc(doc(db, 'barbers', barberId, 'clients', booking.clientPhone), {
        notes: notes.trim(),
      });
      setNotesDirty(false);
    } catch (e) {
      console.warn('notes save failed', e?.message);
    } finally {
      setSavingNotes(false);
    }
  }

  function openAi(scenario) {
    setAiScenario(scenario);
    setAiOpen(true);
  }

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

  // Quick WhatsApp templates — one-tap messages with the actual client's
  // name, time, service auto-filled. No manual substitution needed by
  // the barber. Opens wa.me with the recipient set to this booking's
  // phone number so the message lands in the right chat immediately.
  function sendTemplate(kind) {
    if (!booking.clientPhone) return;
    const firstName = (booking.clientName || '').split(/\s+/)[0] || booking.clientName || '';
    const biz = businessName || 'אצלי';
    const service = booking.serviceName || 'תור';
    const time = booking.time;
    const dateLabel = booking.date
      ? new Date(`${booking.date}T00:00:00`).toLocaleDateString('he-IL', {
          weekday: 'long', day: '2-digit', month: '2-digit',
        })
      : '';
    let msg = '';
    switch (kind) {
      case 'confirm':
        msg =
          `שלום ${firstName}! 👋\n` +
          `התור שלך אצלנו אושר ל-${dateLabel || 'תאריך התור'} בשעה ${time}.\n` +
          `שירות: ${service}.\n` +
          `אם משהו השתנה — תכתוב/י לי כאן.\nנתראה!`;
        break;
      case 'reminder':
        msg =
          `היי ${firstName} 👋\n` +
          `רק תזכורת קצרה — יש לך תור אצלנו ב-${biz} בשעה ${time}${dateLabel ? ` (${dateLabel})` : ''}.\n` +
          `נחכה לך!`;
        break;
      case 'onway':
        msg =
          `היי ${firstName}, יש לך תור עכשיו ב-${time} אצלנו ב-${biz}.\n` +
          `הכל בסדר? מחכה לך 😊`;
        break;
      case 'thanks':
        msg =
          `היי ${firstName}, תודה שבחרת בנו! 🙏\n` +
          `מקווים שנהנית. נשמח לראות אותך שוב אצלנו ב-${biz}.`;
        break;
      case 'rebook':
        msg =
          `היי ${firstName}, מזמן לא ראינו אותך 🤍\n` +
          `יש לי כמה שעות פנויות השבוע — אם בא לך לקבוע תור.\n` +
          `מחכה לך!`;
        break;
      default:
        return;
    }
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

        {/* Client memory card — only when we have any history */}
        {memory && (memory.visits > 0 || memory.cancellations > 0 || memory.isFirstTime) && (
          <div className="cm-card">
            <div className="cm-header">
              <span className="cm-name">{booking.clientName}</span>
              {memory.isFirstTime && (
                <span className="cm-badge cm-firsttime">✨ ביקור ראשון</span>
              )}
              {memory.isVIP && (
                <span className="cm-badge cm-vip"><Crown size={11} className="icon-inline" />VIP</span>
              )}
              {memory.isRisky && (
                <span className="cm-badge cm-risky"><AlertTriangle size={11} className="icon-inline" />סיכון</span>
              )}
            </div>

            {!memory.isFirstTime && (
              <div className="cm-stats">
                <div className="cm-stat">
                  <div className="cm-stat-num">{memory.visits}</div>
                  <div className="cm-stat-label">ביקורים</div>
                </div>
                {memory.revenue > 0 && (
                  <div className="cm-stat is-revenue">
                    <div className="cm-stat-num">₪{memory.revenue}</div>
                    <div className="cm-stat-label">ערך לעסק</div>
                  </div>
                )}
                {memory.avgCycleWeeks > 0 && (
                  <div className="cm-stat">
                    <div className="cm-stat-num">{memory.avgCycleWeeks}</div>
                    <div className="cm-stat-label">שב׳ בממוצע</div>
                  </div>
                )}
                {memory.weeksSinceLastVisit != null && (
                  <div className="cm-stat">
                    <div className="cm-stat-num">{memory.weeksSinceLastVisit}</div>
                    <div className="cm-stat-label">שב׳ מאז</div>
                  </div>
                )}
              </div>
            )}

            {memory.preferredService && !memory.isFirstTime && (
              <div className="cm-row">
                <span className="cm-row-label">בדרך כלל:</span>
                <strong>{memory.preferredService}</strong>
              </div>
            )}

            {memory.cancellations > 0 && (
              <div className="cm-row cm-row-warn">
                <AlertTriangle size={12} className="icon-inline" />
                <span>{memory.cancellations} ביטולים בעבר ({Math.round(memory.cancellationRate * 100)}% מההזמנות)</span>
              </div>
            )}

            {/* Private notes — only the barber sees */}
            {notesLoaded && (
              <div className="cm-notes-wrap">
                <label className="cm-notes-label">
                  📝 הערות פרטיות (רק את/ה רואה)
                  {savingNotes && <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', marginInlineStart: 6 }}>שומר…</span>}
                  {!savingNotes && notesDirty && <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', marginInlineStart: 6 }}>(לא נשמר)</span>}
                </label>
                <textarea
                  className="cm-notes"
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
                  onBlur={saveNotes}
                  rows={2}
                  placeholder="לדוגמה: מעדיף קצוץ קצר מאחור, אלרגי לאלכוהול…"
                />
              </div>
            )}
          </div>
        )}

        {!completed && !inProgress && (
          <button className="btn-primary" onClick={() => { onStart(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}><Play size={18} className="icon-inline" />התחל תור</button>
        )}
        {inProgress && (
          <button className="btn-primary" onClick={onComplete} style={{ width: '100%', marginBottom: 8 }}><Check size={18} className="icon-inline" />סיים תור</button>
        )}
        {!completed && (
          <button className="btn-secondary" onClick={() => { onEdit(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}><Edit3 size={18} className="icon-inline" />העבר לזמן/יום אחר</button>
        )}
        {completed && googleReviewUrl && (
          <button className="btn-gold" onClick={() => { sendReviewRequest(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}><Star size={18} className="icon-inline" />שלח בקשת ביקורת בגוגל</button>
        )}

        {/* Quick WhatsApp templates — one-tap chip buttons that open
            wa.me to this client with the message pre-filled (name, time,
            service automatic). Different chips show by booking status. */}
        {booking.clientPhone && (
          <div className="quick-templates">
            <div className="quick-templates-label">
              <MessageCircle size={13} className="icon-inline" />
              תבניות מהירות ל-WhatsApp
            </div>
            <div className="quick-templates-chips">
              {!completed && (
                <>
                  <button type="button" className="quick-chip" onClick={() => sendTemplate('confirm')}>
                    <Check size={13} aria-hidden="true" />
                    אישור תור
                  </button>
                  <button type="button" className="quick-chip" onClick={() => sendTemplate('reminder')}>
                    <BellRing size={13} aria-hidden="true" />
                    תזכורת
                  </button>
                  <button type="button" className="quick-chip" onClick={() => sendTemplate('onway')}>
                    <Phone size={13} aria-hidden="true" />
                    בדרך?
                  </button>
                </>
              )}
              {completed && (
                <>
                  <button type="button" className="quick-chip" onClick={() => sendTemplate('thanks')}>
                    <Heart size={13} aria-hidden="true" />
                    תודה
                  </button>
                  <button type="button" className="quick-chip" onClick={() => sendTemplate('rebook')}>
                    <Repeat size={13} aria-hidden="true" />
                    הזמן בחזרה
                  </button>
                </>
              )}
            </div>
            <p className="quick-templates-hint">
              <span>השם, השעה והשירות של {(booking.clientName || '').split(/\s+/)[0] || 'הלקוח'} כבר נכנסים אוטומטית — רק לוחצים שלח ב-WhatsApp.</span>
            </p>
          </div>
        )}

        {/* AI message composer — relevant for any booking status */}
        <button
          className="btn-secondary"
          onClick={() => openAi(completed ? 'thank-you' : 'reminder')}
          style={{ width: '100%', marginBottom: 8 }}
        >
          <Sparkles size={18} className="icon-inline" />כתב הודעה חכמה ב-AI
        </button>

        <AIComposeModal
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          booking={booking}
          defaultScenario={aiScenario}
          businessName={businessName}
          aiGender={aiGender}
        />
        {!completed && (
          <button className="btn-danger" onClick={() => { onCancel(); onClose(); }} style={{ width: '100%', marginBottom: 8 }}>בטל תור</button>
        )}
        <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>סגור</button>
      </div>
    </div>
  );
}
