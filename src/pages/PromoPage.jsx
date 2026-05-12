import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Calendar, Wallet, HeartCrack, BarChart3, Link2, Bot,
  Repeat, Users, MessageCircle, Bell, Sun, ShieldCheck, Scissors,
  Hand, Footprints, Flower2, Check, Gift, Crown, Share2, Copy,
  Star, Zap,
} from 'lucide-react';

// Lucide doesn't ship a Facebook icon — use an inline brand SVG so the
// share button still has its native logo without pulling another dep.
function FacebookIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

// /promo — public marketing landing page designed to be shared on
// Facebook / WhatsApp by the operator. Hero up top, every feature
// catalogued in cards below, pricing block, social-share row.
//
// Wording emphasises the 30-day free trial because that's the headline
// the operator wants to lead with on social. The page is intentionally
// dense (single scroll fits ~5 phone screens) so a viewer doesn't
// bounce before the offer.

const FEATURES = [
  {
    icon: Calendar,
    title: 'יומן חכם',
    body: 'משבצות 20 דק\' כברירת מחדל, שעות עבודה גמישות, חופשות, חסימות, סינכרון בזמן אמת מכל מכשיר.',
  },
  {
    icon: Bot,
    title: 'AI שכותב הודעות בעברית',
    body: 'תזכורות, הודעות תודה, הזמנות חזרה ללקוחות שנעלמו — 3 גרסאות לבחירה, מותאם ללשון זכר/נקבה.',
  },
  {
    icon: Link2,
    title: 'הזמנה אונליין דרך לינק אישי',
    body: 'toron.co.il/השם-שלך — לקוח לוחץ, רואה זמנים פנויים, ממלא שם וטלפון, מקבל אישור במייל.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Business — תגובות מהירות',
    body: 'ספריית תבניות בעברית מוכנות להעתקה ל-WA Business: אישור, תזכורת, תודה, ביקורת, לקוח שנעלם.',
  },
  {
    icon: Wallet,
    title: 'הכנסות מול הוצאות',
    body: 'מעקב שכירות, חומרים, חשבונות, דלק. רווח נטו, אחוז רווחיות, השוואה חודשית — בלי Excel.',
  },
  {
    icon: HeartCrack,
    title: 'זיהוי לקוחות שנעלמו',
    body: 'המערכת מזהה אוטומטית מי לא חזר זמן רב מהקצב הרגיל — ולחיצה אחת שולחת הודעת חזרה אישית.',
  },
  {
    icon: BarChart3,
    title: 'דוחות וחגים',
    body: 'השוואה יומית/שבועית/חודשית, ניתוח שעות עמוסות, לקוחות מובילים, הודעות לפני חגים — תכנון העסק פשוט.',
  },
  {
    icon: Repeat,
    title: 'תור קבוע ללקוחות (אופציונלי)',
    body: 'אפשר/י ללקוחות לקבוע סדרת תורים בתדירות קבועה (כל שבוע / שבועיים / חודש) במכה אחת.',
  },
  {
    icon: Users,
    title: 'תור קבוצתי',
    body: 'לקוח קובע לעצמו + 1-2 בני משפחה (ילדים, בן/בת זוג) ברצף אחד באותה הזמנה.',
  },
  {
    icon: Bell,
    title: 'התראות פוש',
    body: 'מקבל התראה ברגע שלקוח מזמין, מבטל או משנה תור — גם כשהאפליקציה סגורה.',
  },
  {
    icon: Sun,
    title: 'מסך תמיד דלוק (Wake Lock)',
    body: 'בטאבלט בעסק — המסך לא נכבה לאורך כל היום. מתאים גם לטלפון.',
  },
  {
    icon: ShieldCheck,
    title: 'נגישות מלאה (ת"י 5568)',
    body: 'תאימות לקוראי מסך, ניווט במקלדת, ניגודיות גבוהה, גודל גופן מתכוונן — בהתאם לחוק שוויון זכויות.',
  },
];

const WHO = [
  { icon: Scissors, title: 'ספרים', desc: 'תספורות, גילוח, פרצופים' },
  { icon: Hand, title: 'מניקור', desc: 'לק ג\'ל, פדיקור משולב, חיזוקים' },
  { icon: Footprints, title: 'פדיקור', desc: 'טיפולי כפות רגליים, פדיקור רפואי' },
  { icon: Flower2, title: 'קוסמטיקה', desc: 'פנים, שעווה, ריסים, גבות' },
];

const SHARE_TEXT =
  'גיליתי את Toron — מערכת ניהול תורים חכמה לבעלי מקצוע, עם AI בעברית, ' +
  'יומן אוטומטי, וקישור אישי ללקוחות. נרשמים ומקבלים 30 יום חינם, ללא כרטיס אשראי. ' +
  'מי שעובד עם תורים — חייב/ת לבדוק.';

export default function PromoPage() {
  const [copied, setCopied] = useState(false);
  const promoUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/promo`
    : 'https://toron.co.il/promo';

  function copyLink() {
    try {
      navigator.clipboard.writeText(`${SHARE_TEXT}\n\n${promoUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* noop */ }
  }
  const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(promoUrl)}`;
  const waShareUrl = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT}\n\n${promoUrl}`)}`;

  return (
    <div className="promo-page" lang="he" dir="rtl">
      <a href="#main" className="skip-link">דלג לתוכן הראשי</a>

      <header className="promo-bar">
        <Link to="/" className="brand-link" aria-label="Toron — חזרה לדף הבית">
          <img src="/logo-mark.png" alt="" aria-hidden="true" className="brand-mark-img" />
          <span className="brand-name">Toron</span>
        </Link>
        <Link to="/auth?mode=signup" className="btn-gold promo-bar-cta">
          <Sparkles size={14} className="icon-inline" />התחל חינם
        </Link>
      </header>

      <main id="main">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="promo-hero">
          <div
            className="promo-hero-photo"
            aria-hidden="true"
            style={{
              backgroundImage:
                'url(https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1600&q=75&auto=format&fit=crop)',
            }}
          />
          <div className="promo-hero-bg" aria-hidden="true" />

          <div className="promo-hero-inner">
            <div className="promo-badge">
              <Gift size={16} aria-hidden="true" />
              <span><strong>30 יום חינם</strong> · ללא כרטיס אשראי · ביטול בכל רגע</span>
            </div>

            <h1 className="promo-hero-title">
              ניהול תורים חכם
              <br />
              <span className="promo-hero-accent">לבעלי מקצוע בישראל.</span>
            </h1>

            <p className="promo-hero-sub">
              יומן אוטומטי · AI בעברית · WhatsApp Business · לינק אישי ללקוחות.
              הכל במקום אחד — מ-50&nbsp;ש"ח לחודש.
            </p>

            <div className="promo-hero-cta">
              <Link to="/auth?mode=signup" className="btn-gold btn-xl">
                <Sparkles size={18} className="icon-inline" />התחל 30 יום חינם
              </Link>
              <Link to="/" className="btn-secondary btn-xl">פרטים מלאים</Link>
            </div>

            <ul className="promo-trust">
              <li><Check size={14} aria-hidden="true" />ללא כרטיס אשראי</li>
              <li><Check size={14} aria-hidden="true" />הרשמה ב-2 דקות</li>
              <li><Check size={14} aria-hidden="true" />עברית מלאה · RTL</li>
            </ul>
          </div>
        </section>

        {/* ── Big "חודש חינם" call-out ──────────────────────────────── */}
        <section className="promo-callout-row">
          <div className="promo-callout">
            <div className="promo-callout-icon"><Crown size={28} /></div>
            <div className="promo-callout-text">
              <strong>חודש שלם של גישה מלאה — חינם</strong>
              <span>כל הפיצ'רים, ללא הגבלה, בלי לחייב כרטיס אשראי. אם זה לא בשבילך — פשוט עוזב/ת.</span>
            </div>
            <Link to="/auth?mode=signup" className="btn-gold promo-callout-cta">
              נרשמ/ת
            </Link>
          </div>
        </section>

        {/* ── Who's it for ─────────────────────────────────────────── */}
        <section className="promo-section promo-who">
          <h2 className="promo-section-title">מי משתמש ב-Toron</h2>
          <div className="promo-who-grid">
            {WHO.map((w) => (
              <article key={w.title} className="promo-who-card">
                <w.icon size={26} className="promo-who-icon" />
                <h3>{w.title}</h3>
                <p>{w.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── All features ─────────────────────────────────────────── */}
        <section className="promo-section promo-features">
          <h2 className="promo-section-title">12 פיצ'רים שעושים את העבודה במקומך</h2>
          <p className="promo-section-sub">
            הכל מובנה. אין הרחבות בתשלום. אין הפתעות.
          </p>
          <div className="promo-feature-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="promo-feature-card">
                <div className="promo-feature-ico"><f.icon size={22} /></div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────────── */}
        <section className="promo-section promo-pricing">
          <h2 className="promo-section-title">מחיר אחד פשוט</h2>
          <div className="promo-price-card">
            <div className="promo-price-tag">
              <Zap size={14} aria-hidden="true" />חודש שלם חינם
            </div>
            <div className="promo-price-row">
              <span className="promo-price-num">50</span>
              <span className="promo-price-currency">₪</span>
              <span className="promo-price-period">/חודש</span>
            </div>
            <p className="promo-price-sub">
              חיוב חודשי, פטור ממע"מ. ביטול בלחיצה אחת.
              <br />
              <strong>30 יום ראשונים — חינם, ללא כרטיס אשראי.</strong>
            </p>
            <ul className="promo-price-features">
              <li><Check size={16} aria-hidden="true" />כל ה-12 פיצ'רים — ללא הגבלה</li>
              <li><Check size={16} aria-hidden="true" />ללא הגבלת לקוחות</li>
              <li><Check size={16} aria-hidden="true" />AI כלול</li>
              <li><Check size={16} aria-hidden="true" />WhatsApp Business תבניות</li>
              <li><Check size={16} aria-hidden="true" />עדכונים שוטפים</li>
            </ul>
            <Link to="/auth?mode=signup" className="btn-gold btn-xl promo-price-cta">
              <Sparkles size={18} className="icon-inline" />התחל את ה-30 יום שלי עכשיו
            </Link>
          </div>
        </section>

        {/* ── Share row ────────────────────────────────────────────── */}
        <section className="promo-section promo-share">
          <h2 className="promo-section-title">מכיר/ה בעל מקצוע שצריך את זה?</h2>
          <p className="promo-section-sub">לחץ/י לשתף — בקליק אחד.</p>
          <div className="promo-share-buttons">
            <a
              href={fbShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="promo-share-btn promo-share-fb"
            >
              <FacebookIcon size={20} />שתף בפייסבוק
            </a>
            <a
              href={waShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="promo-share-btn promo-share-wa"
            >
              <MessageCircle size={20} aria-hidden="true" />שלח בוואטסאפ
            </a>
            <button
              type="button"
              onClick={copyLink}
              className={`promo-share-btn promo-share-copy ${copied ? 'is-copied' : ''}`}
            >
              {copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}
              {copied ? 'הועתק!' : 'העתק לינק + טקסט'}
            </button>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────── */}
        <section className="promo-final">
          <div className="promo-final-inner">
            <Star size={28} className="promo-final-star" aria-hidden="true" />
            <h2>מוכנ/ה להפסיק לרשום תורים בנייר?</h2>
            <p>הצטרפ/י עכשיו וקבל/י <strong>30 יום של גישה מלאה — חינם.</strong></p>
            <Link to="/auth?mode=signup" className="btn-gold btn-xl">
              <Sparkles size={20} className="icon-inline" />התחל את ה-30 יום שלי
            </Link>
            <p className="promo-final-fineprint">
              <ShieldCheck size={12} className="icon-inline" aria-hidden="true" />
              סליקה מאובטחת PCI-DSS Level 1 ע"י Tranzila · עוסק פטור (פטור ממע"מ)
            </p>
          </div>
        </section>
      </main>

      <footer className="promo-footer">
        <span>© 2026 Toron · ניהול תורים חכם בישראל</span>
        <span>
          <Link to="/terms">תקנון</Link>
          {' · '}
          <Link to="/privacy">פרטיות</Link>
          {' · '}
          <Link to="/accessibility">נגישות</Link>
        </span>
      </footer>
    </div>
  );
}
