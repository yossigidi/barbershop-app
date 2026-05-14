import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, X, Send, Copy, Check, AlertCircle } from 'lucide-react';

// "Message to all clients" — composes a message and hands it off to the
// barber's OWN WhatsApp client group. Nothing is sent through our API
// here: the barber posts it in their group themselves. We just copy the
// text to the clipboard and open the group link, so it's one paste away.

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

export default function WhatsAppBroadcastModal({
  businessName, shortLink, waGroupLink, initialBody = '', onClose,
}) {
  const [body, setBody] = useState(initialBody || '');
  const [copied, setCopied] = useState(false);
  const tpls = templates(businessName, shortLink);

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked — the textarea is still selectable */ }
  }

  async function sendToGroup() {
    if (!body.trim() || !waGroupLink) return;
    await copy();
    window.open(waGroupLink, '_blank', 'noopener');
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

        {!waGroupLink ? (
          <div className="wa-error" role="alert">
            <AlertCircle size={16} className="icon-inline" />
            <span>
              עדיין לא הגדרת קישור לקבוצת הלקוחות.{' '}
              <Link to="/settings" style={{ fontWeight: 700 }}>הגדר עכשיו ←</Link>
            </span>
          </div>
        ) : (
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
        )}
        {copied && (
          <p className="muted" style={{ fontSize: '0.8rem', textAlign: 'center', marginTop: 8 }}>
            ✓ ההודעה הועתקה — הדבק/י אותה בקבוצה
          </p>
        )}
      </div>
    </div>
  );
}
