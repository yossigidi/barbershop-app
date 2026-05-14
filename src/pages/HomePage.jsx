// Toron — landing page. Rebuilt 2026-05-14 mobile-first from scratch
// to replace the fragile desktop-first "Living Landing". All layout is
// real CSS classes (one scoped <style> block) — no inline desktop-first
// styles, no brittle [style*=] responsive overrides.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// ── Lucide-style stroke icons, tinted via currentColor ──────────────────
const LIcon = ({ children, size = 18, stroke = 1.8, fill = 'none', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
    {children}
  </svg>
);
const ISparkles = (p) => (<LIcon {...p}>
  <path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5z" />
  <path d="M19 14l.8 1.9L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-1.1z" />
</LIcon>);
const ICheck = (p) => <LIcon {...p}><path d="M5 12l4 4L19 7" /></LIcon>;
const IArrow = (p) => <LIcon {...p}><path d="M5 12h14" /><path d="M13 6l-7 6 7 6" /></LIcon>;
const ICalendar = (p) => <LIcon {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></LIcon>;
const IWallet = (p) => <LIcon {...p}><path d="M3 7h15a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V7z" /><path d="M3 7l3-3h12" /><circle cx="17" cy="14" r="1.4" fill="currentColor" /></LIcon>;
const IBell = (p) => <LIcon {...p}><path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 004 0" /></LIcon>;
const ILink = (p) => <LIcon {...p}><path d="M9 17H7A5 5 0 017 7h2" /><path d="M15 7h2a5 5 0 010 10h-2" /><path d="M8 12h8" /></LIcon>;
const IScissors = (p) => <LIcon {...p}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.12 15.88" /><path d="M14.47 14.48L20 20" /><path d="M8.12 8.12L12 12" /></LIcon>;
const IHand = (p) => <LIcon {...p}><path d="M18 11V6a2 2 0 00-4 0v3" /><path d="M14 11V4a2 2 0 00-4 0v7" /><path d="M10 11V5a2 2 0 00-4 0v9" /><path d="M18 8a2 2 0 014 0v6c0 4-3 8-8 8a8 8 0 01-8-8" /></LIcon>;
const IFlower = (p) => <LIcon {...p}><circle cx="12" cy="12" r="3" /><path d="M12 7V3M12 21v-4M7 12H3M21 12h-4M7.05 7.05L4.22 4.22M19.78 19.78l-2.83-2.83M16.95 7.05l2.83-2.83M4.22 19.78l2.83-2.83" /></LIcon>;
const IFoot = (p) => <LIcon {...p}><path d="M4 16c0-2 1-4 3-4s3 2 3 4-1 4-3 4-3-2-3-4z" /><path d="M14 9c0-2 1-3 2-3s2 1 2 3-1 4-2 4-2-2-2-4z" /><path d="M2 8c0-2 1-3 2-3s2 1 2 3-1 3-2 3-2-1-2-3z" /></LIcon>;
const IHeart = (p) => <LIcon {...p}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></LIcon>;
const IChart = (p) => <LIcon {...p}><path d="M3 20V10M9 20V4M15 20v-7M21 20v-3" /></LIcon>;
const IShield = (p) => <LIcon {...p}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /></LIcon>;
const ICrown = (p) => <LIcon {...p}><path d="M2 18h20M3 7l4 4 5-7 5 7 4-4-2 11H5L3 7z" /></LIcon>;
const IPlus = (p) => <LIcon {...p}><path d="M12 5v14M5 12h14" /></LIcon>;
const IStar = (p) => <LIcon {...p} fill="currentColor" stroke={0}><path d="M12 2l3 6.5 7 1-5 4.8 1.2 7-6.2-3.5L5.8 21l1.2-7-5-4.8 7-1z"/></LIcon>;

// ── Scroll-reveal — adds .is-in to .reveal elements as they enter view ──
function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll('.reveal')];
    let pending = els.slice();
    const trigger = () => {
      const vh = window.innerHeight || 800;
      pending = pending.filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) { el.classList.add('is-in'); return false; }
        return true;
      });
      if (pending.length === 0) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    };
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; trigger(); }); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    trigger();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}

// ── Content ─────────────────────────────────────────────────────────────
const PROFESSIONS = [
  { Icon: IScissors, title: 'ספרים', body: 'תספורות · גילוח · זקן' },
  { Icon: IHand,     title: 'מניקור', body: 'לק ג׳ל · בנייה · שלאק' },
  { Icon: IFoot,     title: 'פדיקור', body: 'טיפולי כפות רגליים' },
  { Icon: IFlower,   title: 'קוסמטיקה', body: 'פנים · שעווה · ריסים' },
];

const FEATURES = [
  { Icon: ICalendar, title: 'יומן חכם', body: 'שעות גמישות, חופשות, חסימות. הזמנות נכנסות דרך הלינק שלך — מסונכרן בזמן אמת.' },
  { Icon: ISparkles, title: 'AI שכותב במקומך', body: 'תזכורות, הודעות תודה, הזמנות חזרה — בעברית, ב-3 גרסאות לבחירה.' },
  { Icon: IWallet,   title: 'הכנסות מול הוצאות', body: 'שכירות, חומרים, רכב. רווח נטו ואחוז רווחיות — בלי Excel.' },
  { Icon: IHeart,    title: 'זיהוי לקוחות שנעלמו', body: 'מי לא חזר זמן רב — לחיצה אחת מפעילה הודעה אישית.' },
  { Icon: IChart,    title: 'דוחות וחגים', body: 'השוואה יומית, שעות עמוסות, לקוחות מובילים, חגים קרובים.' },
  { Icon: ILink,     title: 'לינק הזמנה אישי', body: 'בלי אפליקציה. בלי הרשמה. שם העסק שלך — לא של Toron.' },
];

const STEPS = [
  { n: '01', title: 'שתף את הלינק שלך', body: 'אחרי 3 דקות של הגדרה יש לך לינק קצר ואישי. שלח בוואטסאפ, שים בביו, הדבק בכרטיס ביקור. בלי אפליקציה.', tag: 'toron.co.il/[העסק שלך]' },
  { n: '02', title: 'הלקוחות מזמינים את עצמם', body: 'הם רואים רק את הזמנים הפנויים, בוחרים שירות, ממלאים שם וטלפון — וזהו. אישור מיידי. בלי שיחות, בלי תיאומים.', tag: 'יומן מסונכרן · בזמן אמת' },
  { n: '03', title: 'AI מטפל בכל היתר', body: 'תזכורות, הודעות תודה, "מתגעגעים" ללקוחות שנעלמו — בעברית, מותאם לכל לקוח. אתה רק לוחץ.', tag: 'תזכורת אוטומטית' },
];

const TESTIMONIALS = [
  { name: 'אבי מ.',  role: 'ספר · רמת השרון',      text: 'הפסקתי לרשום תורים על דף. הלקוחות מזמינים את עצמם וה-AI שולח תזכורת. חצי שעה ביום חזרה אליי.' },
  { name: 'נטלי ר.', role: 'מניקוריסטית · חיפה',    text: 'הפיצ׳ר של "מי נעלם" החזיר לי 11 לקוחות בחודש הראשון. שווה את המחיר פי עשר.' },
  { name: 'דנה ל.',  role: 'קוסמטיקאית · תל אביב',  text: 'סוף סוף משהו בעברית שלא מרגיש כמו תרגום. אפילו אמא שלי הבינה איך לקבוע תור.' },
  { name: 'יוסי ב.', role: 'ספר · ירושלים',         text: 'הסטטיסטיקות הכי הפתיעו אותי. גיליתי שיום שני אחה"צ אני פשוט מבזבז.' },
  { name: 'רינת כ.', role: 'פדיקוריסטית · אשדוד',   text: 'הטאבלט בעסק שינה לי את החיים. הכל בעין, הכל ביד.' },
  { name: 'אסף ג.',  role: 'ספר · באר שבע',         text: 'לקוחות חוזרים מקבלים תזכורת חמה שלא נשמעת רובוטית. שווה כל אגורה.' },
];

const FAQ = [
  ['איך מתחילים? צריך התקנה?',
   'לא. נרשמים, ובתוך 3 דקות מגדירים שעות, שירותים ומחירים. רץ בדפדפן — אפשר להוסיף ל-Home Screen כאפליקציה בלחיצה אחת.'],
  ['איך הלקוחות מזמינים?',
   'אתה מקבל לינק קצר אישי (toron.co.il/[שם העסק]). שולח בוואטסאפ או שם בביו. הלקוח רואה רק את הזמנים הפנויים — בלי הרשמה. רק שם העסק שלך, לא הלוגו של Toron.'],
  ['מה קורה אחרי 30 הימים החינם?',
   'אם בחרת מסלול — החיוב מתחיל. אם לא — החשבון נסגר אוטומטית. שלושה ימים לפני סיום הניסיון נשלחת תזכורת.'],
  ['אפשר לבטל בכל זמן?',
   'במסלול Pro חודשי — כן, בלחיצה. הביטול תקף לסוף החודש המשולם. במסלול Studio (עם טאבלט) — דמי יציאה של ₪30 לכל חודש שנותר, כי הטאבלט מסובסד.'],
  ['הנתונים שלי בטוחים?',
   'הצפנה בתעבורה ובמנוחה. לא מוכרים נתונים. סליקה מאובטחת PCI-DSS Level 1 ע״י Tranzila.'],
  ['יש תמיכה בעברית?',
   'הכל בעברית, RTL מלא. תמיכה באימייל support@toron.co.il, מענה תוך 24 שעות.'],
];

const PLANS = [
  {
    id: 'pro',
    tag: 'גמיש · ללא התחייבות', title: 'Pro חודשי', price: '50',
    line: 'ביטול בלחיצה. אין הפתעות.',
    items: ['כל הפיצ׳רים', '30 ימי ניסיון', 'ללא הגבלת לקוחות', 'AI כלול', 'תמיכה בעברית'],
    cta: 'התחל ניסיון 30 יום',
  },
  {
    id: 'studio',
    featured: true, tag: 'הכי משתלם · 24 חודשים', title: 'Studio + טאבלט', price: '69',
    extra: '+ טאבלט 10″ במתנה', line: 'טאבלט מסובסד דרך התשלום החודשי.',
    items: ['כל הפיצ׳רים של Pro', 'טאבלט 10″ איכותי', 'התקנה והגדרה אישית — חינם', 'סטטיסטיקות בזמן אמת', 'עדיפות בתמיכה'],
    cta: 'ראה פרטים מלאים',
  },
];

// Full Studio plan terms — shown in the details modal so a prospect sees
// the commitment + exit fee BEFORE they sign up, not buried in checkout.
const STUDIO_DETAILS = {
  whatYouGet: [
    ['טאבלט 10″ איכותי', 'מגיע אליך הביתה. מסך גדול קבוע בעסק — היומן תמיד בעין.'],
    ['התקנה והגדרה אישית — חינם', 'אנחנו מקימים לך את החשבון: שירותים, מחירים, שעות. מגיע מוכן לעבודה.'],
    ['כל הפיצ׳רים של Pro', 'יומן חכם, AI בעברית, מעקב הכנסות, זיהוי לקוחות שנעלמו — הכל כלול.'],
    ['סטטיסטיקות בזמן אמת', 'על המסך הגדול: מי הגיע, מה ההכנסה היום, מי התור הבא.'],
    ['עדיפות בתמיכה', 'פנייה שלך עולה לראש התור. מענה מהיר יותר.'],
  ],
  commitment: [
    'המסלול הוא בהתחייבות ל-24 חודשים — ₪69 לחודש, סה״כ 24 תשלומים דרך Tranzila.',
    'הטאבלט מסובסד דרך התשלום החודשי — לכן יש התחייבות.',
    'יציאה מוקדמת: דמי יציאה של ₪30 לכל חודש שנותר עד תום ההתחייבות.',
    'אחרי 24 חודשים — המנוי ממשיך חודשי רגיל, ואפשר לבטל בלחיצה בלי דמי יציאה.',
  ],
};

// ── Nav — responsive: full links ≥820px, hamburger below ────────────────
function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);
  const close = () => setMenuOpen(false);
  return (
    <header className={scrolled ? 'lp-nav is-scrolled' : 'lp-nav'}>
      <div className="lp-nav-inner">
        <Link to="/" aria-label="Toron" className="lp-nav-brand" onClick={close}>
          <img src="/toron-wordmark.png" alt="Toron" />
        </Link>
        <nav className="lp-nav-links">
          <a href="#how">איך זה עובד</a>
          <a href="#features">תכונות</a>
          <a href="#pricing">מסלולים</a>
          <a href="#faq">שאלות</a>
          <span className="lp-nav-sep" />
          <Link to="/auth?mode=login" className="lp-nav-login">כניסה</Link>
          <Link to="/auth?mode=signup" className="lp-nav-cta">התחל חינם <IArrow size={14} stroke={2.4} /></Link>
        </nav>
        <div className="lp-nav-mobile">
          <Link to="/auth?mode=login" className="lp-nav-login" onClick={close}>כניסה</Link>
          <button
            type="button"
            className="lp-nav-burger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'סגור תפריט' : 'פתח תפריט'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <div className={menuOpen ? 'lp-nav-panel is-open' : 'lp-nav-panel'}>
        <a href="#how" onClick={close}>איך זה עובד</a>
        <a href="#features" onClick={close}>תכונות</a>
        <a href="#pricing" onClick={close}>מסלולים</a>
        <a href="#faq" onClick={close}>שאלות</a>
        <Link to="/auth?mode=signup" className="lp-nav-cta lp-nav-cta-full" onClick={close}>
          התחל 30 יום חינם <IArrow size={15} stroke={2.4} />
        </Link>
      </div>
    </header>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-hero-inner reveal is-in">
        <span className="lp-pill">
          <span className="lp-pill-dot" />
          1,247 בעלי עסק כבר עם Toron
        </span>
        <h1 className="lp-hero-title">
          תפסיק לרשום תורים בנייר.<br />
          <span className="lp-grad">תתחיל לנהל.</span>
        </h1>
        <p className="lp-hero-lede">
          לינק אישי ללקוחות, AI שכותב הודעות בעברית, מעקב הכנסות והוצאות,
          זיהוי לקוחות שנעלמו. הכל במקום אחד — בעברית, מ-50 ש״ח לחודש.
        </p>
        <div className="lp-hero-ctas">
          <Link to="/auth?mode=signup" className="lp-btn lp-btn-primary">
            <ISparkles size={17} /> התחל 30 יום חינם
          </Link>
          <a href="#how" className="lp-btn lp-btn-ghost">
            ראה איך זה עובד <IArrow size={15} stroke={2.4} />
          </a>
        </div>
        <ul className="lp-trust">
          {['ללא כרטיס אשראי', 'ללא התקנה', 'ביטול בכל רגע', 'תמיכה בעברית'].map((t) => (
            <li key={t}><ICheck size={15} stroke={2.6} /> {t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Profession strip ────────────────────────────────────────────────────
function Professions() {
  return (
    <section className="lp-section lp-prof-section">
      <div className="lp-prof-grid reveal">
        {PROFESSIONS.map(({ Icon, title, body }) => (
          <div className="lp-prof" key={title}>
            <span className="lp-prof-icon"><Icon size={22} /></span>
            <div>
              <strong>{title}</strong>
              <span>{body}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── How it works ────────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="how" className="lp-section lp-how">
      <div className="lp-head reveal">
        <span className="lp-eyebrow">איך זה עובד</span>
        <h2 className="lp-h2">שלושה שלבים. <span className="lp-grad">חצי שעה.</span></h2>
        <p className="lp-sub">מהרגע שאתה נרשם ועד שהיומן עובד לבד.</p>
      </div>
      <div className="lp-steps">
        {STEPS.map((s) => (
          <div className="lp-step reveal" key={s.n}>
            <span className="lp-step-num">{s.n}</span>
            <h3 className="lp-step-title">{s.title}</h3>
            <p className="lp-step-body">{s.body}</p>
            <span className="lp-step-tag"><ICheck size={13} stroke={2.6} /> {s.tag}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Features ────────────────────────────────────────────────────────────
function Features() {
  return (
    <section id="features" className="lp-section lp-features">
      <div className="lp-head reveal">
        <span className="lp-eyebrow">למה Toron</span>
        <h2 className="lp-h2">הכל במקום אחד. <span className="lp-grad">פשוט.</span></h2>
      </div>
      <div className="lp-feat-grid">
        {FEATURES.map(({ Icon, title, body }) => (
          <div className="lp-feat reveal" key={title}>
            <span className="lp-feat-icon"><Icon size={22} /></span>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Pricing ─────────────────────────────────────────────────────────────
function Pricing() {
  const [studioOpen, setStudioOpen] = useState(false);
  return (
    <section id="pricing" className="lp-section lp-pricing">
      <div className="lp-head reveal">
        <span className="lp-eyebrow">מסלולים</span>
        <h2 className="lp-h2">פשוט. <span className="lp-grad">שקוף.</span></h2>
      </div>
      <div className="lp-price-grid">
        {PLANS.map((p) => (
          <div className={p.featured ? 'lp-price is-featured reveal' : 'lp-price reveal'} key={p.title}>
            <span className="lp-price-tag">{p.featured && <ICrown size={12} />} {p.tag}</span>
            <h3 className="lp-price-title">{p.title}</h3>
            <div className="lp-price-amount">
              <span className="lp-price-num">{p.price}</span>
              <span className="lp-price-cur">₪</span>
              <span className="lp-price-per">/ חודש</span>
            </div>
            {p.extra && <div className="lp-price-extra">{p.extra}</div>}
            <p className="lp-price-line">{p.line}</p>
            <ul className="lp-price-feats">
              {p.items.map((it) => <li key={it}><ICheck size={12} stroke={3} /> {it}</li>)}
            </ul>
            {p.id === 'studio' ? (
              <button type="button" className="lp-price-cta" onClick={() => setStudioOpen(true)}>
                {p.cta} <IArrow size={15} stroke={2.4} />
              </button>
            ) : (
              <Link to="/auth?mode=signup" className="lp-price-cta">
                {p.cta} <IArrow size={15} stroke={2.4} />
              </Link>
            )}
          </div>
        ))}
      </div>
      <p className="lp-price-note">
        <IShield size={14} /> סליקה מאובטחת PCI-DSS Level 1 ע״י Tranzila · קבלות אוטומטיות · אין מע״מ (עוסק פטור)
      </p>
      {studioOpen && <StudioDetailsModal onClose={() => setStudioOpen(false)} />}
    </section>
  );
}

// ── Studio plan — full details modal ────────────────────────────────────
function StudioDetailsModal({ onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div className="lp-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="lp-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-modal-title"
      >
        <button type="button" className="lp-modal-close" onClick={onClose} aria-label="סגור">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="lp-modal-head">
          <span className="lp-price-tag"><ICrown size={12} /> הכי משתלם · 24 חודשים</span>
          <h2 id="studio-modal-title" className="lp-modal-title">Studio + טאבלט</h2>
          <div className="lp-modal-price">
            <span className="lp-price-num">69</span>
            <span className="lp-price-cur">₪</span>
            <span className="lp-price-per">/ חודש · + טאבלט 10″ במתנה</span>
          </div>
        </div>

        <div className="lp-modal-section">
          <h3 className="lp-modal-h3">מה מקבלים</h3>
          <ul className="lp-modal-list">
            {STUDIO_DETAILS.whatYouGet.map(([t, d]) => (
              <li key={t}>
                <span className="lp-modal-check"><ICheck size={12} stroke={3} /></span>
                <div><strong>{t}</strong><span>{d}</span></div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-modal-section lp-modal-commit">
          <h3 className="lp-modal-h3"><IShield size={15} /> ההתחייבות — חשוב לדעת</h3>
          <ul className="lp-modal-commit-list">
            {STUDIO_DETAILS.commitment.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
          <p className="lp-modal-fineprint">
            התנאים המלאים מופיעים ב<Link to="/terms" onClick={onClose}>תקנון השירות</Link> ו<Link to="/refund" onClick={onClose}>מדיניות הביטולים</Link>.
            בהמשך תתבקש/י לחתום על הסכם ההתחייבות.
          </p>
        </div>

        <Link to="/auth?mode=signup&plan=studio" className="lp-btn lp-btn-primary lp-modal-cta" onClick={onClose}>
          <ISparkles size={18} /> התחל הרשמה למסלול Studio
        </Link>
        <button type="button" className="lp-modal-back" onClick={onClose}>חזרה למסלולים</button>
      </div>
    </div>
  );
}

// ── Testimonials ────────────────────────────────────────────────────────
function Testimonials() {
  return (
    <section className="lp-section lp-testi">
      <div className="lp-head reveal">
        <span className="lp-eyebrow">לקוחות</span>
        <h2 className="lp-h2">מה אומרים <span className="lp-grad">בעלי העסק.</span></h2>
      </div>
      <div className="lp-testi-grid">
        {TESTIMONIALS.map((t) => (
          <div className="lp-quote reveal" key={t.name}>
            <div className="lp-quote-stars">
              {[0, 1, 2, 3, 4].map((i) => <IStar key={i} size={14} />)}
            </div>
            <p>{t.text}</p>
            <div className="lp-quote-who">
              <span className="lp-quote-avatar">{t.name.charAt(0)}</span>
              <div>
                <strong>{t.name}</strong>
                <span>{t.role}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── FAQ ─────────────────────────────────────────────────────────────────
function FAQSection() {
  return (
    <section id="faq" className="lp-section lp-faq">
      <div className="lp-head reveal">
        <span className="lp-eyebrow">שאלות</span>
        <h2 className="lp-h2">שאלות נפוצות.</h2>
      </div>
      <div className="lp-faq-list reveal">
        {FAQ.map(([q, a], i) => (
          <details className="lp-faq-item" key={i}>
            <summary>
              <span>{q}</span>
              <span className="lp-faq-plus"><IPlus size={16} stroke={2.4} /></span>
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ── Final CTA ───────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="lp-final">
      <div className="lp-final-inner reveal">
        <span className="lp-pill lp-pill-on-grad">
          <ISparkles size={13} /> עכשיו · גם בעברית
        </span>
        <h2 className="lp-final-title">
          תפסיק לרשום תורים בנייר.<br /><span className="lp-grad">תתחיל לנהל.</span>
        </h2>
        <p className="lp-final-sub">
          30 ימים חינם. ללא כרטיס אשראי. הרשמה ב-2 דקות.
        </p>
        <Link to="/auth?mode=signup" className="lp-btn lp-btn-primary lp-btn-mega">
          <ISparkles size={20} /> התחל 30 יום חינם <IArrow size={20} stroke={2.4} />
        </Link>
        <ul className="lp-trust lp-trust-center">
          {['ללא התקנה', 'ביטול בלחיצה', 'תמיכה בעברית', 'Made in Israel'].map((t) => (
            <li key={t}><ICheck size={14} stroke={2.6} /> {t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    ['מוצר', [
      ['הרשמה', '/auth?mode=signup', 'link'],
      ['כניסה', '/auth?mode=login', 'link'],
      ['מסלולים', '#pricing', 'anchor'],
      ['איך זה עובד', '#how', 'anchor'],
    ]],
    ['חוקי', [
      ['תקנון', '/terms', 'link'],
      ['פרטיות', '/privacy', 'link'],
      ['ביטולים', '/refund', 'link'],
      ['נגישות', '/accessibility', 'link'],
    ]],
    ['תמיכה', [
      ['support@toron.co.il', 'mailto:support@toron.co.il', 'anchor'],
      ['privacy@toron.co.il', 'mailto:privacy@toron.co.il', 'anchor'],
    ]],
  ];
  return (
    <footer className="lp-footer">
      <div className="lp-footer-grid">
        <div className="lp-footer-brand">
          <img src="/toron-wordmark.png" alt="Toron" />
          <p>ניהול תורים חכם לבעלי מקצועות שירות בישראל. בעברית, מהיום הראשון.</p>
        </div>
        {cols.map(([h, items]) => (
          <div className="lp-footer-col" key={h}>
            <h4>{h}</h4>
            {items.map(([label, href, kind]) => (
              kind === 'link'
                ? <Link key={label} to={href}>{label}</Link>
                : <a key={label} href={href}>{label}</a>
            ))}
          </div>
        ))}
      </div>
      <div className="lp-footer-bottom">
        <span>© 2026 TORON · ALL RIGHTS RESERVED</span>
        <span>Made with ♥ in Israel</span>
      </div>
    </footer>
  );
}

// ── Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  useReveal();
  return (
    <div className="lp" lang="he" dir="rtl">
      <NavBar />
      <Hero />
      <Professions />
      <HowItWorks />
      <Features />
      <Pricing />
      <Testimonials />
      <FAQSection />
      <FinalCTA />
      <Footer />
      <LandingStyles />
    </div>
  );
}

// ── All landing CSS — one scoped block, mobile-first ────────────────────
function LandingStyles() {
  return (
    <style>{`
.lp {
  --mag: #D43396; --pur: #6541C1; --cyan: #14B8FE;
  --mag-deep: #9D2570;
  --ink: #0E1F3D; --ink-soft: #2E4263; --ink-mute: #6B7A95;
  --rule: rgba(14,31,61,0.08); --rule-2: rgba(14,31,61,0.14);
  --rainbow: linear-gradient(135deg, #D43396 0%, #6541C1 50%, #14B8FE 100%);
  --rainbow-soft: linear-gradient(135deg, rgba(212,51,150,0.10), rgba(101,65,193,0.10), rgba(20,184,254,0.10));
  --ease: cubic-bezier(0.4,0,0.2,1);
  --ease-back: cubic-bezier(0.34,1.56,0.64,1);
  max-width: none; margin: 0; padding: 0;
  color: var(--ink);
  font-family: 'Noto Sans Hebrew','Heebo',-apple-system,system-ui,sans-serif;
  background:
    radial-gradient(60% 50% at 88% 0%, rgba(20,184,254,0.13), transparent 60%),
    radial-gradient(50% 40% at 4% 100%, rgba(212,51,150,0.10), transparent 60%),
    linear-gradient(180deg, #f8fcfe 0%, #f2f9fc 100%);
  min-height: 100vh;
  overflow-x: hidden;
}
.lp * { box-sizing: border-box; }
.lp .reveal { opacity: 0; transform: translateY(22px); transition: opacity .7s var(--ease), transform .7s var(--ease); }
.lp .reveal.is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .lp .reveal { opacity: 1; transform: none; transition: none; }
}

.lp-grad {
  background: var(--rainbow);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* ─── Nav ─── */
.lp-nav { position: sticky; top: 0; z-index: 50; background: transparent; border-bottom: 1px solid transparent; transition: background .3s var(--ease), border-color .3s; }
.lp-nav.is-scrolled { background: rgba(248,252,254,0.82); backdrop-filter: blur(18px) saturate(170%); -webkit-backdrop-filter: blur(18px) saturate(170%); border-bottom-color: var(--rule); }
.lp-nav-inner { max-width: 1200px; margin: 0 auto; padding: 11px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.lp-nav-brand { display: inline-flex; align-items: center; }
.lp-nav-brand img { height: 30px; width: auto; display: block; }
.lp-nav-links { display: none; align-items: center; gap: 24px; font-size: 14px; font-weight: 500; color: var(--ink-soft); }
.lp-nav-links a { color: inherit; text-decoration: none; transition: color .15s; }
.lp-nav-links a:hover { color: var(--mag); }
.lp-nav-sep { width: 1px; height: 20px; background: var(--rule-2); }
.lp-nav-login { color: var(--ink); text-decoration: none; font-weight: 600; }
.lp-nav-login:hover { color: var(--mag); }
.lp-nav-cta {
  background: var(--rainbow); color: #fff; padding: 10px 18px; border-radius: 999px;
  font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 7px;
  text-decoration: none; box-shadow: 0 4px 14px rgba(212,51,150,0.30);
  transition: transform .2s var(--ease-back), box-shadow .3s;
}
.lp-nav-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(212,51,150,0.42); }
.lp-nav-mobile { display: flex; align-items: center; gap: 14px; }
.lp-nav-burger {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; padding: 0; border-radius: 10px;
  border: 1px solid var(--rule-2); background: rgba(255,255,255,0.6);
  color: var(--ink); cursor: pointer;
}
.lp-nav-burger:active { transform: scale(.94); }
.lp-nav-panel {
  display: flex; flex-direction: column; gap: 2px;
  max-height: 0; overflow: hidden;
  background: rgba(248,252,254,0.98); backdrop-filter: blur(18px) saturate(170%); -webkit-backdrop-filter: blur(18px) saturate(170%);
  transition: max-height .32s var(--ease), padding .32s var(--ease), border-color .32s;
  border-bottom: 1px solid transparent;
}
.lp-nav-panel.is-open { max-height: 380px; padding: 8px 18px 18px; border-bottom-color: var(--rule); }
.lp-nav-panel a { color: var(--ink); text-decoration: none; font-size: 16px; font-weight: 600; padding: 13px 10px; border-radius: 10px; }
.lp-nav-panel a:active { background: rgba(212,51,150,0.08); }
.lp-nav-cta-full { justify-content: center; margin-top: 8px; padding: 15px; font-size: 15px; }
@media (min-width: 820px) {
  .lp-nav-inner { padding: 14px 32px; }
  .lp-nav-brand img { height: 34px; }
  .lp-nav-links { display: flex; }
  .lp-nav-mobile { display: none; }
}

/* ─── Shared ─── */
.lp-section { max-width: 1120px; margin: 0 auto; padding: 56px 18px; }
@media (min-width: 768px) { .lp-section { padding: 88px 32px; } }
.lp-head { text-align: center; margin-bottom: 36px; }
@media (min-width: 768px) { .lp-head { margin-bottom: 52px; } }
.lp-eyebrow {
  display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.18em;
  text-transform: uppercase; margin-bottom: 12px;
  background: var(--rainbow); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.lp-h2 { font-size: clamp(28px, 6vw, 50px); font-weight: 800; letter-spacing: -0.035em; line-height: 1.06; margin: 0; }
.lp-sub { font-size: 16px; color: var(--ink-soft); line-height: 1.6; margin: 12px 0 0; }
.lp-pill {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--rainbow-soft); border: 1px solid rgba(101,65,193,0.18);
  color: var(--pur); font-size: 12px; font-weight: 700;
  padding: 7px 15px; border-radius: 999px; letter-spacing: 0.01em;
}
.lp-pill-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--mag); box-shadow: 0 0 0 3px rgba(212,51,150,0.18); }
.lp-pill-on-grad { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.22); color: #fff; }

/* ─── Buttons ─── */
.lp-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-weight: 800; font-size: 15px; text-decoration: none;
  padding: 15px 26px; border-radius: 13px; transition: transform .25s var(--ease-back), box-shadow .3s;
}
.lp-btn-primary {
  background: var(--rainbow); color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,0.18);
  box-shadow: 0 10px 28px rgba(212,51,150,0.32), inset 0 1px 0 rgba(255,255,255,0.25);
}
.lp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 16px 38px rgba(212,51,150,0.42); }
.lp-btn-ghost {
  background: rgba(255,255,255,0.85); color: var(--ink); border: 1px solid var(--rule-2);
  backdrop-filter: blur(10px); font-weight: 700;
}
.lp-btn-ghost:hover { transform: translateY(-2px); border-color: var(--pur); background: #fff; }
.lp-btn-mega { padding: 19px 36px; font-size: 17px; border-radius: 16px; }

/* ─── Hero ─── */
.lp-hero { max-width: 820px; margin: 0 auto; padding: 56px 18px 40px; text-align: center; }
@media (min-width: 768px) { .lp-hero { padding: 96px 32px 60px; } }
.lp-hero-inner { display: flex; flex-direction: column; align-items: center; }
.lp-hero-title {
  font-size: clamp(34px, 8vw, 78px); font-weight: 900; letter-spacing: -0.045em;
  line-height: 1.0; margin: 22px 0 18px; color: var(--ink);
}
.lp-hero-lede { font-size: clamp(15px, 2.4vw, 19px); line-height: 1.6; color: var(--ink-soft); max-width: 580px; margin: 0 0 28px; }
.lp-hero-ctas { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
.lp-hero-ctas .lp-btn { flex: 1 1 auto; min-width: 0; }
@media (min-width: 480px) { .lp-hero-ctas .lp-btn { flex: 0 0 auto; } }
.lp-trust {
  display: flex; flex-wrap: wrap; gap: 14px 22px; justify-content: center;
  list-style: none; padding: 0; margin: 28px 0 0; font-size: 13px; color: var(--ink-mute);
}
.lp-trust li { display: inline-flex; align-items: center; gap: 6px; }
.lp-trust li svg { color: var(--cyan); }
.lp-trust-center { margin-top: 30px; }

/* ─── Professions strip ─── */
.lp-prof-section { padding-top: 8px; padding-bottom: 8px; }
.lp-prof-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (min-width: 768px) { .lp-prof-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; } }
.lp-prof {
  display: flex; align-items: center; gap: 12px;
  background: rgba(255,255,255,0.72); border: 1px solid var(--rule); border-radius: 16px;
  padding: 16px; backdrop-filter: blur(8px);
}
.lp-prof-icon {
  width: 42px; height: 42px; flex: none; border-radius: 11px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--rainbow-soft); border: 1px solid rgba(101,65,193,0.14); color: var(--pur);
}
.lp-prof div { display: flex; flex-direction: column; min-width: 0; }
.lp-prof strong { font-size: 15px; font-weight: 800; letter-spacing: -0.02em; }
.lp-prof span { font-size: 11.5px; color: var(--ink-mute); }

/* ─── How it works ─── */
.lp-steps { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 768px) { .lp-steps { grid-template-columns: repeat(3, 1fr); gap: 22px; } }
.lp-step {
  position: relative; background: rgba(255,255,255,0.78); border: 1px solid var(--rule);
  border-radius: 20px; padding: 26px 24px; backdrop-filter: blur(10px);
  transition: transform .3s, box-shadow .3s, border-color .3s;
}
.lp-step:hover { transform: translateY(-4px); box-shadow: 0 20px 44px rgba(14,31,61,0.08); border-color: rgba(212,51,150,0.18); }
.lp-step-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 46px; height: 46px; border-radius: 13px; margin-bottom: 16px;
  background: var(--rainbow); color: #fff; font-weight: 900; font-size: 17px;
  box-shadow: 0 6px 16px rgba(212,51,150,0.30);
}
.lp-step-title { font-size: 20px; font-weight: 800; letter-spacing: -0.025em; margin: 0 0 8px; }
.lp-step-body { font-size: 14.5px; line-height: 1.6; color: var(--ink-soft); margin: 0 0 16px; }
.lp-step-tag {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--rainbow-soft); border: 1px solid rgba(101,65,193,0.16);
  color: var(--pur); font-size: 12px; font-weight: 700; padding: 7px 12px; border-radius: 999px;
}

/* ─── Features ─── */
.lp-feat-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
@media (min-width: 560px) { .lp-feat-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 900px) { .lp-feat-grid { grid-template-columns: repeat(3, 1fr); gap: 18px; } }
.lp-feat {
  background: rgba(255,255,255,0.78); border: 1px solid var(--rule); border-radius: 18px;
  padding: 26px 22px; backdrop-filter: blur(10px);
  transition: transform .3s, box-shadow .3s, border-color .3s;
}
.lp-feat:hover { transform: translateY(-4px); box-shadow: 0 20px 44px rgba(14,31,61,0.08); border-color: rgba(212,51,150,0.18); }
.lp-feat-icon {
  width: 46px; height: 46px; border-radius: 12px; margin-bottom: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--rainbow-soft); border: 1px solid rgba(101,65,193,0.14); color: var(--pur);
}
.lp-feat h3 { font-size: 18px; font-weight: 800; letter-spacing: -0.025em; margin: 0 0 6px; }
.lp-feat p { font-size: 14px; line-height: 1.6; color: var(--ink-soft); margin: 0; }

/* ─── Pricing ─── */
.lp-price-grid { display: grid; grid-template-columns: 1fr; gap: 18px; max-width: 860px; margin: 0 auto; }
@media (min-width: 720px) { .lp-price-grid { grid-template-columns: 1fr 1fr; gap: 22px; } }
.lp-price {
  position: relative; background: rgba(255,255,255,0.86); border: 1px solid var(--rule);
  border-radius: 22px; padding: 32px 28px; backdrop-filter: blur(12px);
}
.lp-price.is-featured {
  background: #fff; border-color: transparent;
  box-shadow: 0 30px 60px rgba(101,65,193,0.16);
}
.lp-price.is-featured::before {
  content: ''; position: absolute; inset: 0; padding: 1.6px; border-radius: inherit;
  background: var(--rainbow); pointer-events: none;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
.lp-price-tag {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(101,65,193,0.10); color: var(--pur);
  font-size: 11px; font-weight: 800; letter-spacing: 0.04em;
  padding: 6px 13px; border-radius: 999px; margin-bottom: 16px;
}
.lp-price.is-featured .lp-price-tag { background: var(--rainbow); color: #fff; }
.lp-price-title { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 12px; }
.lp-price-amount { display: flex; align-items: baseline; gap: 5px; margin-bottom: 4px; }
.lp-price-num { font-size: 58px; font-weight: 900; letter-spacing: -0.05em; line-height: 1; }
.lp-price.is-featured .lp-price-num { background: var(--rainbow); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.lp-price-cur { font-size: 24px; font-weight: 800; color: var(--ink-mute); }
.lp-price-per { font-size: 13px; color: var(--ink-mute); margin-inline-start: 4px; }
.lp-price-extra { font-size: 13px; font-weight: 700; color: var(--mag); margin-bottom: 14px; }
.lp-price-line { font-size: 13px; color: var(--ink-mute); margin: 6px 0 18px; }
.lp-price-feats { list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-direction: column; gap: 10px; }
.lp-price-feats li { display: flex; align-items: center; gap: 9px; font-size: 14px; color: var(--ink-soft); }
.lp-price-feats li svg {
  flex: none; width: 18px; height: 18px; padding: 3px; border-radius: 50%;
  background: var(--rainbow-soft); color: var(--pur);
}
.lp-price.is-featured .lp-price-feats li svg { background: var(--rainbow); color: #fff; }
.lp-price-cta {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px; border-radius: 12px; font-weight: 800; font-size: 14.5px; text-decoration: none;
  background: #fff; color: var(--ink); border: 1.5px solid var(--ink);
  transition: transform .2s, background .2s, color .2s, box-shadow .2s;
}
.lp-price-cta:hover { transform: translateY(-2px); background: var(--ink); color: #fff; }
.lp-price.is-featured .lp-price-cta {
  background: var(--rainbow); color: #fff; border-color: transparent;
  box-shadow: 0 10px 24px rgba(212,51,150,0.32);
}
.lp-price.is-featured .lp-price-cta:hover { box-shadow: 0 14px 32px rgba(212,51,150,0.42); }
.lp-price-note { text-align: center; font-size: 12px; color: var(--ink-mute); margin: 24px 0 0; display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; }
.lp-price-note svg { color: var(--mag); }

/* ─── Testimonials ─── */
.lp-testi-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
@media (min-width: 600px) { .lp-testi-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 920px) { .lp-testi-grid { grid-template-columns: repeat(3, 1fr); gap: 18px; } }
.lp-quote {
  background: #fff; border: 1px solid var(--rule); border-radius: 18px; padding: 24px;
  box-shadow: 0 2px 10px rgba(14,31,61,0.04);
}
.lp-quote-stars { display: flex; gap: 2px; color: #F5B100; margin-bottom: 12px; }
.lp-quote p { font-size: 14.5px; line-height: 1.6; color: var(--ink); margin: 0 0 16px; }
.lp-quote-who { display: flex; align-items: center; gap: 11px; }
.lp-quote-avatar {
  width: 40px; height: 40px; border-radius: 50%; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--rainbow); color: #fff; font-weight: 800; font-size: 15px;
}
.lp-quote-who strong { display: block; font-size: 13.5px; font-weight: 700; }
.lp-quote-who span { font-size: 12px; color: var(--ink-mute); }

/* ─── FAQ ─── */
.lp-faq-list { display: flex; flex-direction: column; gap: 10px; max-width: 820px; margin: 0 auto; }
.lp-faq-item { background: #fff; border: 1px solid var(--rule); border-radius: 14px; overflow: hidden; }
.lp-faq-item[open] { border-color: var(--mag); }
.lp-faq-item summary {
  cursor: pointer; list-style: none; padding: 18px 20px;
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  font-size: 15.5px; font-weight: 700; color: var(--ink);
}
.lp-faq-item summary::-webkit-details-marker { display: none; }
.lp-faq-plus {
  width: 28px; height: 28px; flex: none; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--rainbow-soft); color: var(--pur);
  transition: transform .25s var(--ease), background .25s, color .25s;
}
.lp-faq-item[open] .lp-faq-plus { transform: rotate(45deg); background: var(--rainbow); color: #fff; }
.lp-faq-item p { padding: 0 20px 20px; margin: 0; font-size: 14px; line-height: 1.7; color: var(--ink-soft); }

/* ─── Studio details modal ─── */
.lp-modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(11, 21, 48, 0.62);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: flex-end; justify-content: center;
  padding: 0;
  animation: lp-fade .2s var(--ease);
}
@media (min-width: 640px) { .lp-modal-overlay { align-items: center; padding: 24px; } }
@keyframes lp-fade { from { opacity: 0; } to { opacity: 1; } }
.lp-modal {
  position: relative;
  width: 100%; max-width: 540px;
  max-height: 92vh; overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #fff;
  border-radius: 24px 24px 0 0;
  padding: 28px 22px calc(env(safe-area-inset-bottom, 0px) + 22px);
  box-shadow: 0 -10px 50px rgba(11, 21, 48, 0.35);
  animation: lp-slide .28s var(--ease-back);
}
@media (min-width: 640px) {
  .lp-modal { border-radius: 24px; padding: 32px 30px; box-shadow: 0 30px 80px rgba(11, 21, 48, 0.4); }
}
@keyframes lp-slide { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
.lp-modal-close {
  position: absolute; top: 14px; inset-inline-start: 14px;
  width: 36px; height: 36px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--rule-2); background: #fff; color: var(--ink-soft);
  cursor: pointer;
}
.lp-modal-close:active { transform: scale(.92); }
.lp-modal-head { text-align: center; margin-bottom: 24px; }
.lp-modal-title { font-size: 28px; font-weight: 900; letter-spacing: -0.035em; margin: 12px 0 8px; }
.lp-modal-price { display: flex; align-items: baseline; justify-content: center; gap: 5px; flex-wrap: wrap; }
.lp-modal-price .lp-price-num {
  font-size: 46px;
  background: var(--rainbow); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.lp-modal-section { margin-bottom: 22px; }
.lp-modal-h3 {
  font-size: 16px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 12px;
  display: flex; align-items: center; gap: 7px;
}
.lp-modal-h3 svg { color: var(--mag); }
.lp-modal-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.lp-modal-list li { display: flex; align-items: flex-start; gap: 11px; }
.lp-modal-check {
  flex: none; width: 22px; height: 22px; border-radius: 50%; margin-top: 1px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--rainbow); color: #fff;
}
.lp-modal-list li div { display: flex; flex-direction: column; gap: 2px; }
.lp-modal-list li strong { font-size: 14.5px; font-weight: 800; letter-spacing: -0.02em; }
.lp-modal-list li span { font-size: 13px; color: var(--ink-soft); line-height: 1.5; }
.lp-modal-commit {
  background: linear-gradient(135deg, rgba(212,51,150,0.06), rgba(20,184,254,0.06));
  border: 1px solid rgba(212,51,150,0.18);
  border-radius: 16px; padding: 18px;
}
.lp-modal-commit-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 9px; }
.lp-modal-commit-list li {
  font-size: 13px; line-height: 1.55; color: var(--ink); padding-inline-start: 18px; position: relative;
}
.lp-modal-commit-list li::before {
  content: '•'; position: absolute; inset-inline-start: 4px; color: var(--mag); font-weight: 900;
}
.lp-modal-fineprint { font-size: 11.5px; color: var(--ink-mute); line-height: 1.6; margin: 14px 0 0; }
.lp-modal-fineprint a { color: var(--mag); font-weight: 700; text-decoration: none; }
.lp-modal-cta { width: 100%; margin-top: 8px; }
.lp-modal-back {
  display: block; width: 100%; margin-top: 10px; padding: 12px;
  background: none; border: none; color: var(--ink-mute);
  font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
}

/* ─── Final CTA ─── */
.lp-final {
  position: relative; overflow: hidden; isolation: isolate;
  padding: 72px 18px 80px; margin-top: 24px;
  background: linear-gradient(160deg, #1A0E3D 0%, #0E1F3D 60%, #0B1530 100%);
  color: #fff; text-align: center;
}
@media (min-width: 768px) { .lp-final { padding: 110px 32px 120px; } }
.lp-final::before {
  content: ''; position: absolute; inset: 0; z-index: -1;
  background:
    radial-gradient(45% 50% at 80% 10%, rgba(20,184,254,0.30), transparent 60%),
    radial-gradient(50% 55% at 10% 95%, rgba(212,51,150,0.32), transparent 60%);
}
.lp-final-inner { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; }
.lp-final-title {
  font-size: clamp(32px, 7vw, 64px); font-weight: 900; letter-spacing: -0.045em;
  line-height: 1.02; margin: 22px 0 14px; color: #fff;
}
.lp-final-sub { font-size: clamp(15px, 2.2vw, 18px); color: rgba(255,255,255,0.7); margin: 0 0 32px; line-height: 1.6; }
.lp-final .lp-trust { color: rgba(255,255,255,0.6); }
.lp-final .lp-trust li svg { color: var(--cyan); }

/* ─── Footer ─── */
.lp-footer { background: #0B1530; color: rgba(255,255,255,0.62); padding: 48px 18px 28px; }
@media (min-width: 768px) { .lp-footer { padding: 56px 32px 32px; } }
.lp-footer-grid {
  max-width: 1120px; margin: 0 auto 32px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 32px 24px;
}
@media (min-width: 768px) { .lp-footer-grid { grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; } }
.lp-footer-brand { grid-column: 1 / -1; }
@media (min-width: 768px) { .lp-footer-brand { grid-column: auto; } }
.lp-footer-brand img { height: 30px; width: auto; display: block; margin-bottom: 12px; }
.lp-footer-brand p { font-size: 13.5px; line-height: 1.6; margin: 0; max-width: 300px; }
.lp-footer-col h4 {
  font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase;
  margin: 0 0 12px;
  background: var(--rainbow); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.lp-footer-col a { display: block; color: rgba(255,255,255,0.62); text-decoration: none; padding: 4px 0; font-size: 13.5px; }
.lp-footer-col a:hover { color: var(--mag); }
.lp-footer-bottom {
  max-width: 1120px; margin: 0 auto; padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.10);
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px;
  font-size: 11.5px; color: rgba(255,255,255,0.4);
}
`}</style>
  );
}
