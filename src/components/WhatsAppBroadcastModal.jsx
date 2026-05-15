import { useState } from 'react';
import {
  Megaphone, X, Send, Copy, Check, AlertCircle, Pencil, Loader2,
} from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

// "Message to all clients" — composes a message and hands it off to the
// barber's OWN WhatsApp client group. Nothing is sent through our API
// here: the barber posts in their group themselves. We just copy the
// text to the clipboard and open the group link, so it's one paste away.
//
// If the barber hasn't set the group link yet (or wants to change it),
// they can enter / edit it right inside this modal — no need to leave to
// Settings for a one-line config. The link is persisted to
// barbers/<uid>.waGroupLink so future opens have it ready.

function templates(businessName, link) {
  const L = link || '[הקישור שלך]';
  return [
    {
      key: 'invite',
      label: 'הזמנה לקבוע תור',
      body: `שלום! 👋\nמזמינים אתכם לקבוע תור ב${businessName} דרך הקישור:\n${L}\nנתראה!`,
    },
    {
      key: 'holiday',
      label: 'ברכת חג',
      body: `חג שמח! 🎉\nמאחלים לכם חג נעים ושמח.\nלקביעת תור: ${L}`,
    },
    {
      key: 'promo',
      label: 'מבצע',
      body: `מבצע מיוחד! 🎁\n[פרטי המבצע]\nלקביעת תור: ${L}`,
    },
    {
      key: 'price',
      label: 'עדכון מחירים',
      body: `שלום,\nרצינו לעדכן שמתאריך [תאריך] המחירים מתעדכנים מעט.\nתודה על האמון 🙏`,
    },
    {
      key: 'vacation',
      label: 'חופשה',
      body: `שלום,\n${businessName} ייסגר מ-[תאריך] עד [תאריך].\nאפשר לקבוע תור לפני או אחרי: ${L}\nתודה על ההבנה.`,
    },
  ];
}

function isWaGroupLink(s) {
  return /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,}/.test((s || '').trim());
}

export default function WhatsAppBroadcastModal({
  barberId, businessName, shortLink, waGroupLink, initialBody = '', onClose,
}) {
  const [body, setBody] = useState(initialBody || '');
  const [copied, setCopied] = useState(false);
  // localLink mirrors barber.waGroupLink but lets us flip the modal
  // straight from "enter link" to "send" without waiting for the parent
  // snapshot to refresh.
  const [localLink, setLocalLink] = useState(waGroupLink || '');
  const [editing, setEditing] = useState(!waGroupLink);
  const [linkDraft, setLinkDraft] = useState(waGroupLink || '');
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState('');
  const tpls = templates(businessName, shortLink);

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked — textarea is still selectable */ }
  }

  function sendToGroup() {
    if (!body.trim() || !localLink) return;
    // Open the window FIRST within the user gesture — iOS Safari blocks
    // window.open after a clipboard await otherwise.
    window.open(localLink, '_blank', 'noopener');
    // Then run the clipboard copy (no need to await).
    copy();
  }

  async function saveLink() {
    const trimmed = (linkDraft || '').trim();
    if (!trimmed) { setLinkError('הדבק/י קישור לקבוצה'); return; }
    if (!isWaGroupLink(trimmed)) {
      setLinkError('הקישור לא נראה כמו קישור הזמנה לקבוצת וואטסאפ (https://chat.whatsapp.com/...)');
      return;
    }
    if (!barberId) {
      setLinkError('לא ניתן לשמור כרגע — חזרו לדף ההגדרות.');
      return;
    }
    setLinkError(''); setSavingLink(true);
    try {
      await updateDoc(doc(db, 'barbers', barberId), { waGroupLink: trimmed });
      setLocalLink(trimmed);
      setEditing(false);
    } catch (e) {
      setLinkError('שמירה נכשלה: ' + (e?.message || 'שגיאה'));
    } finally {
      setSavingLink(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} dir="rtl" role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="סגור"><X size={20} /></button>
        <h2><Megaphone size={20} className="icon-inline" /> הודעה לכל הלקוחות</h2>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.86rem' }}>
          בחר/י תבנית, ערוך/י, ושלח/י — ההודעה תועתק ותיפתח קבוצת הלקוחות שלך בוואטסאפ כדי להדביק.
        </p>

        <div className="wa-quick">
          {tpls.map((t) => (
            <button key={t.key} type="button" className="chip" onClick={() => setBody(t.body)}>
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          className="wa-compose"
          dir="rtl"
          rows={6}
          placeholder="כתוב/י את ההודעה, או בחר/י תבנית למעלה…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
        />

        {editing ? (
          <div className="wa-link-setup">
            <label htmlFor="wa-group-link-input" className="wa-link-label">
              <AlertCircle size={14} className="icon-inline" />
              קישור לקבוצת הלקוחות בוואטסאפ
            </label>
            <input
              id="wa-group-link-input"
              type="url"
              dir="ltr"
              placeholder="https://chat.whatsapp.com/…"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              className="wa-link-input"
              autoFocus
            />
            <p className="muted" style={{ fontSize: '0.76rem', margin: '4px 0 0' }}>
              בוואטסאפ: פתח את הקבוצה → הקש על שם הקבוצה → "קישור הזמנה לקבוצה" → העתק והדבק כאן.
            </p>
            {linkError && (
              <div className="wa-error" role="alert" style={{ marginTop: 8 }}>
                <AlertCircle size={14} className="icon-inline" />
                <span>{linkError}</span>
              </div>
            )}
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <button
                type="button"
                className="btn-gold"
                onClick={saveLink}
                disabled={savingLink || !linkDraft.trim()}
                style={{ flex: 1 }}
              >
                {savingLink
                  ? <><Loader2 size={16} className="icon-inline" /> שומר…</>
                  : 'שמור והמשך'}
              </button>
              {localLink && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setEditing(false); setLinkDraft(localLink); setLinkError(''); }}
                  disabled={savingLink}
                  style={{ flex: 'none' }}
                >
                  ביטול
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <button
                type="button"
                className="btn-gold"
                onClick={sendToGroup}
                disabled={!body.trim()}
                style={{ flex: 1 }}
              >
                <Send size={18} className="icon-inline" />
                העתק ופתח את הקבוצה
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={copy}
                disabled={!body.trim()}
                style={{ flex: 'none' }}
                aria-label="העתק"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <button
              type="button"
              className="wa-link-edit"
              onClick={() => { setLinkDraft(localLink); setEditing(true); setLinkError(''); }}
            >
              <Pencil size={12} className="icon-inline" />
              ערוך את קישור הקבוצה
            </button>
          </>
        )}

        {copied && !editing && (
          <p className="muted" style={{ fontSize: '0.8rem', textAlign: 'center', marginTop: 8 }}>
            ✓ ההודעה הועתקה — הדבק/י אותה בקבוצה
          </p>
        )}
      </div>
    </div>
  );
}
