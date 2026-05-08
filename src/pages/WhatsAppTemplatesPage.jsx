import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Copy, Check, Info, Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

// WhatsApp Business "Quick Replies" template library.
//
// WA Business has a built-in "Quick Replies" feature: you save up to 50
// prewritten messages, each tied to a /shortcut keyword. In a chat the
// barber types `/אישור` and the message expands automatically. This is
// totally free, no API needed, no business verification — it lives inside
// the barber's own WA Business app.
//
// Toron's job here is to provide *good* Hebrew templates with the right
// placeholders (name, date, time, link) so the barber doesn't have to
// write them from scratch. The barber long-presses each template, taps
// "העתק", then pastes it into WA Business → Settings → Business tools →
// Quick replies. Done once, used forever.
//
// Each template carries a `shortcut` (the slash command the barber will
// invoke in WA) and a `body` with `{name}` etc. — kept as literal braces
// because WA Business's Quick Replies don't substitute, the barber edits
// the message after expansion. The placeholders are a hint to humans.

const TEMPLATES = [
  {
    id: 'confirm',
    shortcut: '/אישור',
    title: 'אישור תור',
    body:
`היי {שם}! 👋
התור שלך אצלנו אושר ל-{תאריך} בשעה {שעה}.
לשינוי או ביטול: {לינק}
נתראה!`,
  },
  {
    id: 'reminder',
    shortcut: '/תזכורת',
    title: 'תזכורת יום לפני',
    body:
`היי {שם}!
רק תזכורת קצרה — מחר ב-{שעה} יש לך תור אצלנו ב{עסק}.
אם משהו השתנה תכתוב/י לי כאן.
נחכה לך!`,
  },
  {
    id: 'thanks',
    shortcut: '/תודה',
    title: 'תודה אחרי תור',
    body:
`היי {שם}, תודה שבחרת בנו! 🙏
מקווים שנהנית — נשמח לראות אותך שוב.
לקביעת התור הבא: {לינק}`,
  },
  {
    id: 'review',
    shortcut: '/ביקורת',
    title: 'בקשת ביקורת ב-Google',
    body:
`היי {שם}! 🙏
שמחנו שהיית אצלנו. אם נהנית — נשמח אם תכתוב/י לנו ביקורת קצרה ב-Google:
{לינק_ביקורת}
תודה רבה!`,
  },
  {
    id: 'winback',
    shortcut: '/חזרה',
    title: 'לקוח שנעלם — חזרה',
    body:
`היי {שם}, מזמן לא ראינו אותך... 🤍
יש לי כמה שעות פנויות השבוע — אם בא לך לקבוע תור, הנה הלינק שלי:
{לינק}
מחכה לך!`,
  },
  {
    id: 'cancel',
    shortcut: '/ביטול',
    title: 'ביטול / שינוי מצדנו',
    body:
`היי {שם}, נאלצתי לבטל את התור שלך ב-{תאריך}. סליחה על אי הנעימות.
אפשר לקבוע מחדש בלינק שלי:
{לינק}
תודה על ההבנה!`,
  },
  {
    id: 'late',
    shortcut: '/איחור',
    title: 'לקוח מאחר',
    body:
`היי {שם}, יש לך תור עכשיו אצלנו.
האם הכל בסדר? אני ממתין/ה.`,
  },
  {
    id: 'directions',
    shortcut: '/הגעה',
    title: 'הוראות הגעה',
    body:
`כתובת: {כתובת}
חניה: {הוראות_חניה}
מבוא: {הוראות_כניסה}
נתראה! 🙌`,
  },
];

export default function WhatsAppTemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [barber, setBarber] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'barbers', user.uid), (snap) => {
      if (snap.exists()) setBarber(snap.data());
    });
  }, [user]);

  // Builds a personalised version of the template by substituting whatever
  // we know about the barber. Anything we don't have stays as a `{...}`
  // placeholder so the barber sees what to fill in himself in the chat.
  function personalize(body) {
    let out = body;
    if (barber?.businessName) out = out.replace(/\{עסק\}/g, barber.businessName);
    const code = barber?.customSlug || barber?.shortCode;
    if (code) {
      const link = `https://toron.co.il/${code}`;
      out = out.replace(/\{לינק\}/g, link);
    }
    if (barber?.googleReviewUrl) {
      out = out.replace(/\{לינק_ביקורת\}/g, barber.googleReviewUrl);
    }
    return out;
  }

  async function copyTemplate(t) {
    try {
      await navigator.clipboard.writeText(personalize(t.body));
      setCopiedId(t.id);
      setTimeout(() => setCopiedId((id) => (id === t.id ? null : id)), 2000);
    } catch {
      // Fallback for browsers without clipboard API permissions
      const ta = document.createElement('textarea');
      ta.value = personalize(t.body);
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopiedId(t.id); } catch {}
      document.body.removeChild(ta);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  return (
    <div className="app">
      <div className="header">
        <h1>
          <MessageCircle size={20} className="icon-inline" />
          תגובות מהירות
        </h1>
        <button
          className="btn-secondary"
          style={{ padding: '6px 12px' }}
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={14} className="icon-inline" />חזור
        </button>
      </div>

      <div className="card" style={{ background: 'rgba(37, 211, 102, 0.06)', borderColor: 'rgba(37, 211, 102, 0.30)' }}>
        <h3 style={{ marginTop: 0 }}>
          <Sparkles size={18} className="icon-inline" style={{ color: '#25d366' }} />
          איך משתמשים בזה
        </h3>
        <ol style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8, fontSize: '0.92rem' }}>
          <li>פתח/י את <strong>WhatsApp Business</strong> שלך</li>
          <li>לחץ/י <strong>הגדרות → כלים עסקיים → תגובות מהירות</strong></li>
          <li>חזור/י לכאן, לחץ/י "<strong>העתק</strong>" על התבנית</li>
          <li>חזור/י ל-WA Business, לחץ/י <strong>+ הוסף תגובה מהירה</strong>, הדבק/י, ושמור עם הקיצור (למשל <code>/אישור</code>)</li>
          <li>בצ'אט עם לקוח — תקליד/י <code>/אישור</code> והטקסט יופיע אוטומטית. תוכל/י לערוך לפני השליחה.</li>
        </ol>
        <p className="muted" style={{ fontSize: '0.84rem', margin: '12px 0 0', lineHeight: 1.6 }}>
          <Info size={14} className="icon-inline" />
          סוגריים מסולסלים <code dir="ltr">{'{ }'}</code> הם תזכורות —
          אחרי שתבחר/י "תגובה מהירה" בצ'אט, החלף אותם בערכים של אותו לקוח לפני השליחה.
          ב-WA Business אין החלפה אוטומטית — אבל השם והשעה כבר ידועים לך.
        </p>
      </div>

      {!barber?.shortCode && !barber?.customSlug && (
        <div className="card" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.30)' }}>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.6 }}>
            <Info size={14} className="icon-inline" />
            עדיין לא הגדרת שם משתמש לעסק — הלינקים בתבניות יישארו כ-<code dir="ltr">{'{לינק}'}</code>.
            אפשר להגדיר ב<button type="button" className="link-button" onClick={() => navigate('/settings')}>הגדרות</button>.
          </p>
        </div>
      )}

      <div className="wa-templates-grid">
        {TEMPLATES.map((t) => {
          const personalized = personalize(t.body);
          const isCopied = copiedId === t.id;
          return (
            <article key={t.id} className="card wa-template-card">
              <div className="wa-template-head">
                <div>
                  <h3 style={{ margin: 0 }}>{t.title}</h3>
                  <code className="wa-template-shortcut" dir="ltr">{t.shortcut}</code>
                </div>
                <button
                  type="button"
                  className={`btn-secondary wa-template-copy ${isCopied ? 'is-copied' : ''}`}
                  onClick={() => copyTemplate(t)}
                  aria-label={`העתק תבנית: ${t.title}`}
                >
                  {isCopied ? (
                    <>
                      <Check size={14} className="icon-inline" />
                      הועתק
                    </>
                  ) : (
                    <>
                      <Copy size={14} className="icon-inline" />
                      העתק
                    </>
                  )}
                </button>
              </div>
              <pre className="wa-template-body">{personalized}</pre>
            </article>
          );
        })}
      </div>

      <div className="card" style={{ background: 'var(--surface-2)' }}>
        <h3 style={{ marginTop: 0 }}>
          <Info size={18} className="icon-inline" />
          טיפים נוספים ל-WhatsApp Business
        </h3>
        <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.8, fontSize: '0.9rem' }}>
          <li><strong>קטלוג</strong>: הוסף/י את השירותים שלך בקטלוג של WA Business — מחיר ותמונה לכל שירות. לקוחות רואים את הקטלוג בלי לצאת מהצ'אט.</li>
          <li><strong>תוויות (Labels)</strong>: סמן/י לקוחות בצבעים — VIP, חדש, חוזר. עוזר לארגן את רשימת הצ'אטים.</li>
          <li><strong>הודעת ברכה אוטומטית</strong>: תגדיר/י הודעה שנשלחת ללקוח חדש שכותב לראשונה — "היי! קיבלתי את ההודעה. אקבע לך תור בלינק: {'{לינק}'}".</li>
          <li><strong>סטטוס יומי</strong>: פרסם/י סטטוס בוקר עם השעות הפנויות + לינק. הלקוחות רואים בלי לפנות אליך.</li>
        </ul>
      </div>
    </div>
  );
}
