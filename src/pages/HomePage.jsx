// Toron — Living Landing (redesigned by Claude Design).
// Single-file React component. Originally 5 sandbox files,
// fused + converted from window.* globals to standard imports.
//
// eslint-disable react-hooks/exhaustive-deps
// eslint-disable react/no-unknown-property

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

// Lucide-style stroke icons inline. Tinted via currentColor.
const LIcon = ({ children, size = 18, stroke = 1.8, fill = 'none', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
    {children}
  </svg>
);

const ISparkles = (p) => (<LIcon {...p}>
  <path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5z" />
  <path d="M19 14l.8 2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-1z" />
  <path d="M5 17l.7 1.6L7 19l-1.3.4L5 21l-.7-1.6L3 19l1.3-.4z" />
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
const IClock = (p) => <LIcon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></LIcon>;
const ISun = (p) => <LIcon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></LIcon>;
const IPhone = (p) => <LIcon {...p}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" /></LIcon>;
const ISend = (p) => <LIcon {...p}><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></LIcon>;
const IWhats = (p) => <LIcon {...p} stroke={0} fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.92.5 3.78 1.44 5.42L2 22l4.86-1.51a9.91 9.91 0 0 0 5.17 1.43h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.83 14.06c-.25.7-1.45 1.34-2.04 1.4-.55.05-1.21.08-1.94-.12-.45-.13-1.03-.32-1.77-.65-3.12-1.35-5.15-4.49-5.31-4.7-.16-.21-1.27-1.69-1.27-3.22 0-1.53.8-2.28 1.09-2.6.29-.32.62-.4.83-.4.21 0 .42 0 .6.01.19.01.45-.07.71.54.27.65.93 2.24 1.01 2.4.08.16.13.34.03.55-.11.21-.16.33-.32.51-.16.18-.34.4-.48.54-.16.16-.33.33-.14.65.19.32.85 1.4 1.83 2.27 1.26 1.12 2.32 1.46 2.64 1.63.32.16.51.13.7-.08.19-.21.81-.94 1.03-1.27.21-.32.43-.27.72-.16.29.11 1.86.88 2.18 1.04.32.16.54.24.62.37.08.13.08.78-.17 1.48z"/></LIcon>;
const ICheckCircle = (p) => <LIcon {...p}><circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" /></LIcon>;
const IStar = (p) => <LIcon {...p} fill="currentColor" stroke={0}><path d="M12 2l3 6.5 7 1-5 4.8 1.2 7-6.2-3.5L5.8 21l1.2-7-5-4.8 7-1z"/></LIcon>;
const IPlus = (p) => <LIcon {...p}><path d="M12 5v14M5 12h14" /></LIcon>;
const ITablet = (p) => <LIcon {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M11 19h2" /></LIcon>;
const IShield = (p) => <LIcon {...p}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /></LIcon>;
const ICrown = (p) => <LIcon {...p}><path d="M2 18h20M3 7l4 4 5-7 5 7 4-4-2 11H5L3 7z" /></LIcon>;
const IGlobe = (p) => <LIcon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></LIcon>;
const ICoffee = (p) => <LIcon {...p}><path d="M4 8h13a3 3 0 013 3v0a3 3 0 01-3 3h-1" /><path d="M4 8v8a4 4 0 004 4h5a4 4 0 004-4V8H4z" /><path d="M8 2v3M12 2v3M16 2v3" /></LIcon>;
const IMessage = (p) => <LIcon {...p}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></LIcon>;
const IFire = (p) => <LIcon {...p}><path d="M8.5 14a3.5 3.5 0 107 0c0-2-2-3.5-2-6 0-2.5-2-5-5-5 0 3-3 4-3 8a6.5 6.5 0 0011 4.5"/></LIcon>;

// Small custom hooks used across the Living Landing.
// Kept tiny and dependency-free; each hook is a one-purpose tool.

// ── useReveal — flips children to .is-in when scrolled into view.
// Uses a scroll listener (some sandbox iframes don't fire IntersectionObserver
// reliably; a plain getBoundingClientRect check is bulletproof).
function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll('.reveal')];
    let pending = els.slice();
    const trigger = () => {
      const vh = window.innerHeight || 800;
      pending = pending.filter((el) => {
        const r = el.getBoundingClientRect();
        // In view when its top is above viewport bottom AND its bottom below 0
        if (r.top < vh * 0.95 && r.bottom > 0) {
          el.classList.add('is-in');
          return false;
        }
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
    trigger(); // initial pass
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}

// ── useLiveClock — re-renders every second with current time ────────────
function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Sync to the top of the next second so the seconds visibly tick.
    const ms = 1000 - (Date.now() % 1000);
    const t = setTimeout(function tick() {
      setNow(new Date());
      setTimeout(tick, 1000);
    }, ms);
    return () => clearTimeout(t);
  }, []);
  return now;
}

// ── useTypewriter — types `text` character-by-character, pauses, restarts
// across an array of phrases. Returns { text, caret }
function useTypewriter(phrases, { typeMs = 38, holdMs = 1600, eraseMs = 16 } = {}) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('typing'); // typing | holding | erasing
  useEffect(() => {
    const cur = phrases[idx];
    if (phase === 'typing') {
      if (text.length < cur.length) {
        const t = setTimeout(() => setText(cur.slice(0, text.length + 1)), typeMs);
        return () => clearTimeout(t);
      }
      setPhase('holding');
    } else if (phase === 'holding') {
      const t = setTimeout(() => setPhase('erasing'), holdMs);
      return () => clearTimeout(t);
    } else if (phase === 'erasing') {
      if (text.length > 0) {
        const t = setTimeout(() => setText(text.slice(0, -1)), eraseMs);
        return () => clearTimeout(t);
      }
      setIdx((idx + 1) % phrases.length);
      setPhase('typing');
    }
  }, [text, phase, idx, phrases, typeMs, holdMs, eraseMs]);
  return text;
}

// ── useCountUp — animates a number from 0 → target over `duration` ──────
// Only starts when the returned ref's element scrolls into view.
function useCountUp(target, { duration = 1400, format = (v) => Math.round(v) } = {}) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const t0 = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - k, 3); // ease-out cubic
        setValue(target * eased);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    let raf = 0;
    const check = () => {
      raf = 0;
      if (!ref.current || startedRef.current) return;
      const r = ref.current.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      if (r.top < vh * 0.95 && r.bottom > 0) {
        start();
        window.removeEventListener('scroll', onScroll);
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    window.addEventListener('scroll', onScroll, { passive: true });
    check(); // initial
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, duration]);
  return [ref, format(value)];
}

// ── useScrollProgress — returns 0..1 for an element relative to a band ──
// Used to drive the sticky "How it works" step progression.
function useScrollProgress(ref) {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    let raf = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // Map: when section top hits viewport top (0%), p = 0.
      // When section bottom hits viewport bottom (100%), p = 1.
      const total = r.height - vh;
      const scrolled = Math.min(Math.max(-r.top, 0), Math.max(total, 1));
      setP(total > 0 ? scrolled / total : 0);
      raf = 0;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    tick();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
  return p;
}

// Toron — Living Landing.
// Long-form, animation-rich landing page for business owners.
// Color: warm cream + espresso ink + honey gold with peach/sage accents.

const PROFESSIONS = [
  { Icon: IScissors, title: 'ספרים', body: 'תספורות · גילוח · זקן' },
  { Icon: IHand,     title: 'מניקור', body: 'לק ג׳ל · פדיקור משולב' },
  { Icon: IFoot,     title: 'פדיקור', body: 'טיפולי כפות רגליים' },
  { Icon: IFlower,   title: 'קוסמטיקה', body: 'פנים · שעווה · ריסים' },
];

const FEATURE_DEMOS = [
  {
    Icon: ICalendar, color: 'var(--gold)',
    title: 'יומן חכם · 20 דק׳ ברירת מחדל',
    body: 'שעות גמישות, חופשות, חסימות, הזמנת לקוח דרך הלינק שלך — מסונכרן בזמן אמת.',
  },
  {
    Icon: ISparkles, color: 'var(--peach)',
    title: 'AI שכותב במקומך',
    body: 'תזכורות, הודעות תודה, הזמנות חזרה — בעברית, ב-3 גרסאות לבחירה.',
  },
  {
    Icon: IWallet, color: 'var(--gold-deep)',
    title: 'הכנסות מול הוצאות',
    body: 'שכירות, חומרים, רכב. רווח נטו ואחוז רווחיות — בלי Excel.',
  },
  {
    Icon: IHeart, color: 'var(--blush)',
    title: 'זיהוי לקוחות שנעלמו',
    body: 'מי לא חזר זמן רב מהקצב — לחיצה אחת מפעילה הודעה אישית.',
  },
  {
    Icon: IChart, color: 'var(--sage)',
    title: 'דוחות וחגים',
    body: 'השוואה יומית, שעות עמוסות, לקוחות מובילים, חגים קרובים.',
  },
  {
    Icon: ILink, color: 'var(--gold)',
    title: 'לינק הזמנה אישי',
    body: 'בלי אפליקציה. בלי הרשמה. בלי הלוגו של Toron — רק את/ה.',
  },
];

const TESTIMONIALS = [
  { name: 'אבי מ.',       role: 'ספר · רמת השרון',   text: 'הפסקתי לרשום תורים על דף. הלקוחות מזמינים את עצמם, וה-AI שולח להם תזכורת. חצי שעה ביום חזרה אליי.' },
  { name: 'נטלי ר.',      role: 'מניקוריסטית · חיפה', text: 'הפיצ׳ר של "מי נעלם" החזיר לי 11 לקוחות בחודש הראשון. שווה את המחיר פי עשר.' },
  { name: 'דנה ל.',       role: 'קוסמטיקאית · תל אביב', text: 'סוף סוף משהו בעברית שלא מרגיש כמו תרגום. אפילו אמא שלי הבינה איך לקבוע תור.' },
  { name: 'יוסי ב.',       role: 'ספר · ירושלים',     text: 'הסטטיסטיקות זה החלק שהכי הפתיע אותי. גיליתי שיום שני אחה"צ אני מבזבז.' },
  { name: 'רינת כ.',      role: 'פדיקוריסטית · אשדוד', text: 'הטאבלט באולפן שינה לי את החיים. הכל בעין, הכל ביד.' },
  { name: 'אסף ג.',       role: 'ספר · באר שבע',     text: 'לקוחות חוזרים מקבלים תזכורת חמה ולא נשמעת רובוטית. הסכנו לחיוב שווה כל אגורה.' },
];

const FAQ = [
  ['איך מתחילים? צריך התקנה?',
   'לא. נרשמים, ובתוך 3 דקות מגדירים שעות, שירותים ומחירים. רץ בדפדפן — אפשר להוסיף ל-Home Screen כאפליקציה בלחיצה אחת.'],
  ['איך הלקוחות מזמינים?',
   'אתה מקבל לינק קצר אישי (toron.co.il/ramos). שולח אותו בוואטסאפ או שם בביו. הלקוח רואה רק את הזמנים הפנויים — בלי הרשמה. הוא לא רואה את הלוגו של Toron, אלא רק את שם העסק שלך.'],
  ['מה קורה אחרי 30 הימים החינם?',
   'אם בחרת מסלול, החיוב מתחיל. אם לא — החשבון נסגר אוטומטית. שלושה ימים לפני סיום הניסיון נשלח אליך תזכורת.'],
  ['אפשר לבטל בכל זמן?',
   'במסלול Pro חודשי — כן, בלחיצה. הביטול תקף לסוף החודש המשולם. במסלול Studio (עם טאבלט) — דמי יציאה של ₪30 לכל חודש שנותר, כי הטאבלט מסובסד.'],
  ['הנתונים שלי בטוחים?',
   'הצפנה בתעבורה ובמנוחה. לא מוכרים נתונים. סליקה מאובטחת PCI-DSS Level 1 ע״י Tranzila.'],
  ['יש תמיכה בעברית?',
   'הכל בעברית, RTL מלא. תמיכה באימייל support@toron.co.il, מענה תוך 24 שעות.'],
];

// ─────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────
function LivingLanding() {
  useReveal();
  // Wrap in a scoped class so the new Living-Landing CSS variables
  // (--paper, --peach, --sage, --ink, etc.) don't leak into the
  // dashboard / booking / settings pages which run on their own palettes.
  return (
    <div className="living-landing" lang="he" dir="rtl">
      <NavBar />
      <Hero />
      <ProofStrip />
      <HowItWorks />
      <Numbers />
      <FeatureShowcase />
      <BeforeAfter />
      <PricingSection />
      <TestimonialMarquee />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Nav bar — sticky, blurs on scroll, gold mark
// ─────────────────────────────────────────────────────────────────────────
function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      padding: '14px 40px',
      background: scrolled ? 'rgba(248, 244, 255, 0.85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px) saturate(160%)' : 'none',
      borderBottom: scrolled ? '1px solid var(--rule)' : '1px solid transparent',
      transition: 'background 0.3s var(--ease), backdrop-filter 0.3s, border-color 0.3s',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <a style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        <BrandMark />
        <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>Toron</span>
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 26, fontSize: 14, fontWeight: 500, color: 'var(--ink-soft)' }}>
        <a href="#how">איך זה עובד</a>
        <a href="#features">תכונות</a>
        <a href="#pricing">מסלולים</a>
        <a href="#faq">שאלות</a>
        <span style={{ width: 1, height: 20, background: 'var(--rule-2)' }} />
        <a style={{ color: 'var(--ink)' }}>כניסה</a>
        <a className="gold-cta">
          התחל חינם <IArrow size={14} stroke={2.4} />
        </a>
      </nav>
      <style>{`.gold-cta {
        background: linear-gradient(180deg, var(--gold-2), var(--gold));
        color: var(--ink); padding: 10px 18px; border-radius: 999px;
        font-weight: 700; font-size: 13px;
        display: inline-flex; align-items: center; gap: 8px;
        box-shadow: 0 4px 14px rgba(109, 68, 232, 0.30);
        transition: transform 0.2s var(--ease-back), box-shadow 0.3s;
      }
      .gold-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(109, 68, 232, 0.45); }`}</style>
    </header>
  );
}

function BrandMark({ size = 34 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 12,
      background: 'linear-gradient(135deg, var(--gold-2) 0%, var(--gold) 55%, var(--gold-deep) 100%)',
      color: 'var(--bg-deep)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: size * 0.5, letterSpacing: '-0.04em',
      boxShadow: '0 4px 14px rgba(109, 68, 232, 0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
    }}>T</span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HERO — Headline + animated live phone
// ─────────────────────────────────────────────────────────────────────────
function Hero() {
  const phrases = useMemo(() => [
    'היי דני, תזכורת — תור מחר ב-10:30. נתראה!',
    'שלום נטלי, נשמח לראותך מחר ב-12:00 ❤️',
    'אסף, התור שלך מחר ב-15:30. אם משהו זז — לחץ כאן.',
    'יוסי — מתגעגעים. נראה אותך?',
  ], []);
  return (
    <section style={{
      position: 'relative', padding: '36px 40px 80px',
      overflow: 'hidden', isolation: 'isolate',
    }}>
      {/* Ambient gold/peach drifting blobs */}
      <div data-anim aria-hidden="true" style={{
        position: 'absolute', top: '-10%', right: '-10%', width: 720, height: 720,
        background: 'radial-gradient(circle, var(--peach) 0%, transparent 65%)',
        opacity: 0.55, filter: 'blur(60px)', borderRadius: '50%',
        animation: 'drift1 16s var(--ease) infinite', zIndex: -1,
      }} />
      <div data-anim aria-hidden="true" style={{
        position: 'absolute', bottom: '-20%', left: '-10%', width: 800, height: 800,
        background: 'radial-gradient(circle, var(--sand) 0%, transparent 65%)',
        opacity: 0.50, filter: 'blur(60px)', borderRadius: '50%',
        animation: 'drift2 22s var(--ease) infinite', zIndex: -1,
      }} />
      {/* Soft sun glyph in the corner */}
      <div data-anim aria-hidden="true" style={{
        position: 'absolute', top: 80, right: 120, width: 120, height: 120,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--gold-2) 0%, var(--peach) 50%, transparent 75%)',
        animation: 'sun-pulse 6s var(--ease) infinite', zIndex: -1, opacity: 0.6,
      }} />

      <div style={{
        maxWidth: 1320, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 56, alignItems: 'center',
        paddingTop: 24,
      }}>
        <HeroCopy />
        <LivePhone phrases={phrases} />
      </div>
    </section>
  );
}

function HeroCopy() {
  return (
    <div className="reveal is-in" style={{ position: 'relative' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(155, 122, 255, 0.18)', border: '1px solid rgba(109, 68, 232, 0.30)',
        color: 'var(--gold-deep)', fontSize: 12.5, fontWeight: 700,
        padding: '7px 14px', borderRadius: 999, marginBottom: 22,
        letterSpacing: '0.02em',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: 'var(--sage)',
          animation: 'pulse-dot 1.8s var(--ease) infinite',
        }} />
        1,247 בעלי עסק כבר עם Toron · מעודכן עכשיו
      </span>
      <h1 style={{
        fontFamily: 'var(--font-serif)', fontWeight: 700,
        fontSize: 'clamp(24px, 5.6vw, 86px)', lineHeight: 0.96,
        letterSpacing: '-0.025em', margin: '0 0 26px', color: 'var(--ink)',
      }}>
        לוח התורים שלך,<br />
        <span style={{
          background: 'linear-gradient(120deg, var(--gold-deep) 0%, var(--gold) 50%, var(--peach) 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          fontStyle: 'italic',
        }}>חי, מעצמו.</span>
      </h1>
      <p style={{
        fontSize: 19, lineHeight: 1.65, color: 'var(--ink-soft)',
        maxWidth: 560, margin: '0 0 34px', fontWeight: 400,
      }}>
        לינק אישי ללקוחות, AI שכותב הודעות בעברית, מעקב הכנסות והוצאות,
        זיהוי לקוחות שנעלמו. הכל במקום אחד — בעברית, מ-50 ש״ח לחודש.
      </p>
      <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        <a className="cta-primary">
          <ISparkles size={17} />
          התחל 30 יום חינם
          <span className="cta-shimmer" />
        </a>
        <a className="cta-secondary">
          ראה הדגמה חיה <IArrow size={15} stroke={2.4} />
        </a>
      </div>
      <ul style={{ display: 'flex', gap: 22, color: 'var(--ink-mute)', fontSize: 14, flexWrap: 'wrap' }}>
        {['ללא כרטיס אשראי', 'ללא התקנה', 'ביטול בכל רגע', 'תמיכה בעברית'].map((t, i) => (
          <li key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ICheck size={15} stroke={2.6} style={{ color: 'var(--sage)' }} />
            {t}
          </li>
        ))}
      </ul>
      <style>{`
        .cta-primary {
          position: relative; overflow: hidden;
          background: linear-gradient(180deg, var(--gold-2) 0%, var(--gold) 55%, var(--gold-deep) 100%);
          color: var(--bg-deep); padding: 18px 28px; border-radius: 14px;
          font-weight: 800; font-size: 16px;
          display: inline-flex; align-items: center; gap: 10px;
          box-shadow: var(--shadow-gold), inset 0 1px 0 rgba(255,255,255,0.35);
          transition: transform 0.25s var(--ease-back), box-shadow 0.3s;
          animation: glow-cycle 3.5s var(--ease) infinite;
        }
        .cta-primary:hover { transform: translateY(-2px); }
        .cta-primary .cta-shimmer {
          position: absolute; top: 0; bottom: 0; width: 30%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.55), transparent);
          animation: shimmer 4.2s var(--ease) infinite;
          pointer-events: none;
        }
        .cta-secondary {
          background: var(--paper); color: var(--ink); border: 1px solid var(--rule-2);
          padding: 18px 26px; border-radius: 14px;
          font-weight: 700; font-size: 15px;
          display: inline-flex; align-items: center; gap: 10px;
          box-shadow: var(--shadow-1);
          transition: transform 0.25s var(--ease-back), border-color 0.25s, box-shadow 0.25s;
        }
        .cta-secondary:hover { transform: translateY(-2px); border-color: var(--gold); box-shadow: var(--shadow-2); }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LivePhone — the centerpiece. Continuously animates:
// - Live clock
// - Bookings stream in one by one
// - Revenue counter ticks up to match
// - AI typewriter cycling through messages
// - Random "new booking" toast pops in
// ─────────────────────────────────────────────────────────────────────────
const PHONE_BOOKINGS = [
  { time: '09:00', name: 'דני כהן',    service: 'תספורת + זקן', price: 120, tag: 'VIP',  status: 'done' },
  { time: '10:30', name: 'נטלי לוי',   service: 'תספורת',        price: 90,  tag: 'חדש',  status: 'live' },
  { time: '12:00', name: 'פנוי',       service: '',              price: 0,   tag: null,   status: 'empty' },
  { time: '14:00', name: 'יוסי אברהם', service: 'תספורת + שמפו', price: 110, tag: null,   status: 'next' },
  { time: '15:30', name: 'אמיר ברק',   service: 'תספורת',        price: 90,  tag: null,   status: 'soon' },
  { time: '17:00', name: 'רן כץ',      service: 'תספורת + זקן', price: 120, tag: null,   status: 'soon' },
];

function LivePhone({ phrases }) {
  const now = useLiveClock();
  const aiText = useTypewriter(phrases, { typeMs: 30, holdMs: 1800 });

  // Reveal bookings one by one over time
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= PHONE_BOOKINGS.length) return;
    const t = setTimeout(() => setShown(shown + 1), shown === 0 ? 700 : 900);
    return () => clearTimeout(t);
  }, [shown]);

  // Revenue counter — sums revealed bookings' prices
  const revealed = PHONE_BOOKINGS.slice(0, shown);
  const revenueTarget = revealed.reduce((s, b) => s + (b.price || 0), 0);
  const revenue = useSmoothCounter(revenueTarget, 700);

  // Toast: shows briefly each time a new booking is revealed (after first 2)
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (shown < 3 || shown > PHONE_BOOKINGS.length) return;
    const b = PHONE_BOOKINGS[shown - 1];
    if (!b || b.status === 'empty') return;
    setToast({ id: shown, name: b.name, time: b.time });
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [shown]);

  const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="reveal is-in" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'min(60vh, 720px)' }}>
      {/* glow halo behind phone */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, margin: 'auto', width: 380, height: 600,
        background: 'radial-gradient(ellipse, var(--gold-glow) 0%, transparent 70%)',
        filter: 'blur(40px)', zIndex: 0,
      }} />
      <div data-anim style={{
        position: 'relative', zIndex: 1, animation: 'float-y 6s var(--ease) infinite',
        width: 360, height: 720, borderRadius: 52,
        background: 'linear-gradient(180deg, #241158, #16093B)',
        padding: 12, boxShadow: '0 50px 100px rgba(20, 9, 58, 0.40), 0 0 0 2px rgba(109, 68, 232, 0.30)',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 42,
          background: 'linear-gradient(180deg, #FBF7FF 0%, #ECE5FF 100%)',
          padding: '46px 16px 20px', position: 'relative', overflow: 'hidden',
        }}>
          {/* notch */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
            width: 110, height: 30, background: '#16093B', borderRadius: 18,
          }} />
          {/* status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 6px' }}>
            <span className="num" style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)', letterSpacing: '0.02em' }}>{timeStr}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-soft)' }}>
              ●●●●●
              <span style={{ width: 18, height: 9, border: '1px solid var(--ink)', borderRadius: 2, position: 'relative', marginInlineStart: 4 }}>
                <span style={{ position: 'absolute', inset: 1, background: 'var(--sage)', width: '80%', borderRadius: 1 }} />
              </span>
            </span>
          </div>

          {/* header */}
          <div style={{
            background: 'linear-gradient(180deg, #16093B, #241158)', color: 'var(--bg)',
            borderRadius: 14, padding: '10px 14px', marginBottom: 10,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--gold-2)', fontWeight: 700, fontSize: 13 }}>
              <BrandMark size={22} /> Toron
            </span>
            <span style={{ fontSize: 11.5, color: 'rgba(248, 244, 255,0.7)' }}>יום ג׳ · 12.5</span>
          </div>

          {/* live spotlight */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 201, 167, 0.18), transparent), white',
            border: '1px solid rgba(0, 201, 167, 0.40)', borderRadius: 12,
            padding: '11px 12px', marginBottom: 10, position: 'relative',
          }}>
            <span style={{
              position: 'absolute', top: 12, left: 12,
              width: 8, height: 8, borderRadius: '50%', background: 'var(--sage)',
              animation: 'pulse-dot 1.6s var(--ease) infinite',
            }} />
            <div style={{ marginInlineStart: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sage)', letterSpacing: '0.15em' }}>NOW · בכיסא</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>נטלי לוי</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1 }}>10:30 · תספורת · ₪90</div>
            </div>
          </div>

          {/* day list */}
          <div style={{
            background: 'white', borderRadius: 12, padding: '4px 12px', marginBottom: 10,
            border: '1px solid var(--rule)',
          }}>
            {PHONE_BOOKINGS.map((b, i) => (
              <PhoneRow key={i} b={b} visible={i < shown} />
            ))}
          </div>

          {/* revenue card */}
          <div style={{
            background: 'linear-gradient(135deg, var(--gold-2), var(--gold-deep))', color: 'var(--bg)',
            borderRadius: 12, padding: '12px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 8px 18px rgba(109, 68, 232, 0.30)',
            marginBottom: 10,
          }}>
            <div>
              <div style={{ fontSize: 10, opacity: 0.85, letterSpacing: '0.08em', fontWeight: 600 }}>הכנסה היום</div>
              <div className="num" style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, marginTop: 2 }}>₪ {revenue}</div>
            </div>
            <IWallet size={22} stroke={1.6} />
          </div>

          {/* AI typewriter card */}
          <div style={{
            background: 'white', border: '1px dashed var(--gold)', borderRadius: 12,
            padding: '11px 13px', position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--gold-deep)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
              <ISparkles size={11} />AI · כותב תזכורת
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink)', lineHeight: 1.45, minHeight: 36 }}>
              "{aiText}<span style={{ animation: 'blink 1s step-end infinite', color: 'var(--gold-deep)' }}>▎</span>"
            </div>
          </div>

          {/* Toast — new booking received */}
          {toast && (
            <div key={toast.id} style={{
              position: 'absolute', top: 56, right: 16, left: 16,
              background: 'white', border: '1px solid var(--gold)', borderRadius: 12,
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 10px 28px rgba(20, 9, 58, 0.18)',
              animation: 'toast-pop 3.2s var(--ease) forwards',
              zIndex: 5,
            }}>
              <span style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold-2), var(--gold-deep))', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
              }}>
                <IBell size={15} stroke={2} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold-deep)', letterSpacing: '0.06em' }}>תור חדש!</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 1 }}>{toast.name} · {toast.time}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating callout cards around the phone */}
      <FloatingCallout style={{ top: 80, right: -10 }} icon={IWhats} label="שיתוף בקליק" sub="WhatsApp · Instagram" color="var(--sage)" />
      <FloatingCallout style={{ bottom: 120, left: -20 }} icon={IHeart} label="לקוחות חוזרים" sub="+43% החזרות" color="var(--blush)" />
      <FloatingCallout style={{ top: 320, left: -30 }} icon={IChart} label="הכנסות בזמן אמת" sub="₪14,800 / חודש" color="var(--gold)" />
    </div>
  );
}

function PhoneRow({ b, visible }) {
  if (!visible) return <div style={{ height: 38 }} />;
  const isEmpty = b.status === 'empty';
  const isDone  = b.status === 'done';
  const isLive  = b.status === 'live';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      borderBottom: '1px dashed var(--rule)',
      animation: 'booking-pop 0.45s var(--ease-back) both',
      opacity: isDone ? 0.55 : 1,
    }}>
      <span className="num" style={{ fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 700, color: isLive ? 'var(--sage)' : 'var(--gold-deep)', width: 42 }}>
        {b.time}
      </span>
      <span style={{ flex: 1, fontSize: 12.5, color: isEmpty ? 'var(--ink-mute)' : 'var(--ink)', fontStyle: isEmpty ? 'italic' : 'normal', fontWeight: isEmpty ? 400 : 600, textDecoration: isDone ? 'line-through' : 'none' }}>
        {isEmpty ? 'פנוי · 30 דק׳' : b.name}
      </span>
      {b.tag && !isEmpty && (
        <span style={{
          fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, letterSpacing: '0.08em',
          background: b.tag === 'VIP' ? 'linear-gradient(180deg, var(--gold-2), var(--gold-deep))' : 'rgba(255, 119, 87, 0.18)',
          color: b.tag === 'VIP' ? 'white' : '#9E2A4A',
        }}>{b.tag}</span>
      )}
      {isDone && <ICheckCircle size={13} stroke={2.2} style={{ color: 'var(--sage)' }} />}
    </div>
  );
}

function FloatingCallout({ style, icon: Icon, label, sub, color }) {
  return (
    <div style={{
      position: 'absolute', ...style, zIndex: 2,
      background: 'white', borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12, minWidth: 180,
      boxShadow: '0 18px 36px rgba(20, 9, 58, 0.14), 0 2px 6px rgba(20, 9, 58, 0.06)',
      border: '1px solid var(--rule)',
      animation: 'float-y 5s var(--ease) infinite',
    }}>
      <span style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} stroke={2} />
      </span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

// Smooth counter that follows a moving target (target may change as bookings reveal)
function useSmoothCounter(target, ms = 800) {
  const [v, setV] = useState(0);
  const fromRef = useRef(0);
  const startedRef = useRef(0);
  useEffect(() => {
    fromRef.current = v;
    startedRef.current = performance.now();
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - startedRef.current) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => raf && cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ms]);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────
// Proof strip — small horizontal band of trust signals
// ─────────────────────────────────────────────────────────────────────────
function ProofStrip() {
  return (
    <section className="reveal" style={{
      padding: '24px 40px 36px', maxWidth: 1320, margin: '0 auto',
    }}>
      <div style={{
        background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 22,
        padding: '20px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 32,
        alignItems: 'center', boxShadow: 'var(--shadow-1)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IStar size={14} style={{ color: 'var(--gold)' }} />
          <IStar size={14} style={{ color: 'var(--gold)' }} />
          <IStar size={14} style={{ color: 'var(--gold)' }} />
          <IStar size={14} style={{ color: 'var(--gold)' }} />
          <IStar size={14} style={{ color: 'var(--gold)' }} />
          <span style={{ marginInlineStart: 6 }}>4.9 / 5 · 612 ביקורות</span>
        </div>
        {[
          ['1,247', 'בעלי עסק פעילים'],
          ['38,200', 'הודעות AI נשלחו'],
          ['98%', 'שביעות רצון'],
          ['30 ימים', 'ניסיון חינם'],
        ].map(([n, l], i) => (
          <div key={i}>
            <div className="num" style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: 'var(--gold-deep)' }}>{n}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', fontWeight: 600, letterSpacing: '0.02em', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Living Landing — remaining sections.

// ─────────────────────────────────────────────────────────────────────────
// HOW IT WORKS — 3 sticky steps, narrative scrolls left while right side
// swaps illustration. Uses useScrollProgress to drive the active step.
// ─────────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    n: '01', title: 'שתף את הלינק שלך',
    body: 'אחרי 3 דקות של הגדרה, יש לך לינק קצר ואישי. סנן אותו בוואטסאפ, שים בביו, הדבק בכרטיס ביקור. בלי אפליקציה.',
    cta: 'toron.co.il/ramos',
  },
  {
    n: '02', title: 'הלקוחות מזמינים את עצמם',
    body: 'הם רואים רק את הזמנים הפנויים שלך, בוחרים שירות, ממלאים שם וטלפון — וזהו. אישור מיידי במייל. בלי שיחות, בלי תיאומים.',
    cta: 'יומן מסונכרן · בזמן אמת',
  },
  {
    n: '03', title: 'AI מטפל בכל היתר',
    body: 'תזכורות, הודעות תודה, "מתגעגעים" ללקוחות שנעלמו. בעברית, ב-3 גרסאות לבחירה, מותאם לכל לקוח. אתה רק לוחץ.',
    cta: 'שלח תזכורת אוטומטית',
  },
];

function HowItWorks() {
  return (
    <section id="how" style={{
      position: 'relative', padding: '110px 40px 60px',
      background: 'linear-gradient(180deg, transparent, var(--bg-warm) 10%, var(--bg-warm) 90%, transparent)',
    }}>
      <div className="reveal" style={{ maxWidth: 1320, margin: '0 auto', textAlign: 'center', marginBottom: 64 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--gold-soft)', color: 'var(--gold-deep)',
          fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
          letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18,
        }}>
          איך זה עובד
        </div>
        <h2 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 4.6vw, 64px)',
          fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.02em', margin: '0 0 14px',
        }}>
          שלושה שלבים. <em style={{ color: 'var(--gold-deep)' }}>חצי שעה.</em>
        </h2>
        <p style={{ fontSize: 17, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0, maxWidth: 600, marginInline: 'auto' }}>
          מהרגע שאתה נרשם ועד שהיומן עובד לבד.
        </p>
      </div>
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 80 }}>
        {STEPS.map((s, i) => (
          <StepRow key={i} step={s} index={i} flip={i % 2 === 1} />
        ))}
      </div>
    </section>
  );
}

function StepRow({ step, index, flip }) {
  const Visual = [StepVisual01, StepVisual02, StepVisual03][index];
  return (
    <div className="reveal" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 80, alignItems: 'center',
      direction: flip ? 'ltr' : 'rtl',
    }}>
      <div style={{ direction: 'rtl' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
          color: 'var(--gold-deep)', letterSpacing: '0.18em', marginBottom: 14,
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold-2), var(--gold))', color: 'white',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13,
          }}>{step.n}</span>
          STEP / {step.n}
        </div>
        <h3 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 3.4vw, 44px)',
          fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 14px',
        }}>{step.title}</h3>
        <p style={{ fontSize: 17, color: 'var(--ink-soft)', lineHeight: 1.65, margin: '0 0 18px', maxWidth: 480 }}>
          {step.body}
        </p>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--paper)', border: '1px solid var(--gold)',
          color: 'var(--gold-deep)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
          padding: '8px 14px', borderRadius: 999,
        }}>
          <ICheck size={13} stroke={2.5} />{step.cta}
        </span>
      </div>
      <div style={{ direction: 'rtl', display: 'flex', justifyContent: 'center' }}>
        <Visual />
      </div>
    </div>
  );
}

// Step 1 visual — link card with share chips animating outward
function StepVisual01() {
  return (
    <div style={{ position: 'relative', width: 420, height: 420 }}>
      <div style={{
        position: 'absolute', inset: 0, margin: 'auto', width: 380, height: 160,
        background: 'linear-gradient(135deg, white, #F1ECFF)',
        border: '1px solid var(--gold)', borderRadius: 20,
        boxShadow: 'var(--shadow-2)', padding: '24px 26px',
        top: '50%', transform: 'translateY(-50%)',
      }}>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
          הלינק שלך
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600,
          color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          toron.co.il/<span style={{ color: 'var(--gold-deep)' }}>ramos</span>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <span style={{ background: 'var(--bg-warm)', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)' }}>העתק</span>
          <span style={{ background: 'var(--bg-warm)', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)' }}>QR</span>
        </div>
      </div>
      {/* Share chips floating */}
      {[
        { Icon: IWhats, top: 30, right: 10, bg: '#25D366', color: 'white', delay: '0s' },
        { Icon: ISend, top: 90, left: 30, bg: 'var(--peach)', color: '#5a2c0d', delay: '0.4s' },
        { Icon: IMessage, bottom: 80, right: 0, bg: 'var(--sage)', color: 'white', delay: '0.8s' },
      ].map((s, i) => (
        <div key={i} data-anim style={{
          position: 'absolute', ...s, width: 56, height: 56, borderRadius: '50%',
          background: s.bg, color: s.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-2)',
          animation: 'float-y 4s var(--ease) infinite',
          animationDelay: s.delay,
        }}>
          <s.Icon size={24} stroke={2} />
        </div>
      ))}
    </div>
  );
}

// Step 2 visual — calendar grid filling with bookings
function StepVisual02() {
  const slots = [
    { t: '09:00', b: true,  v: '✓' },
    { t: '09:30', b: false },
    { t: '10:00', b: true,  v: '✓', tag: 'חדש' },
    { t: '10:30', b: false },
    { t: '11:00', b: true,  v: '✓' },
    { t: '11:30', b: false },
    { t: '12:00', b: true,  v: '✓' },
    { t: '12:30', b: true,  v: '✓' },
    { t: '13:00', b: false },
  ];
  return (
    <div style={{
      width: 420, background: 'white', borderRadius: 22, padding: 24,
      border: '1px solid var(--rule)', boxShadow: 'var(--shadow-2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.1em' }}>יום שלישי · 12.5</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, marginTop: 2 }}>היומן שלך</div>
        </div>
        <span style={{
          background: 'var(--sage)', color: 'white', borderRadius: 999,
          padding: '4px 10px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
        }}>5 הזמנות חדשות</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {slots.map((s, i) => (
          <div key={i} style={{
            padding: '12px 8px', borderRadius: 10, textAlign: 'center',
            background: s.b ? 'linear-gradient(180deg, var(--gold-2), var(--gold))' : 'var(--bg-warm)',
            color: s.b ? 'white' : 'var(--ink)',
            fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13,
            position: 'relative',
            boxShadow: s.b ? '0 4px 10px rgba(109, 68, 232, 0.25)' : 'none',
            animation: s.b ? `booking-pop 0.5s var(--ease-back) ${i * 80}ms both` : 'none',
          }}>
            {s.t}
            {s.tag && <span style={{
              position: 'absolute', top: -6, right: -4, background: 'var(--blush)', color: 'white',
              fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 999, letterSpacing: '0.05em',
            }}>{s.tag}</span>}
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 16, padding: '12px 14px', background: 'var(--bg-warm)', borderRadius: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>הכנסה צפויה</span>
        <span className="num" style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 22, color: 'var(--gold-deep)' }}>₪ 530</span>
      </div>
    </div>
  );
}

// Step 3 visual — AI message bubbles
function StepVisual03() {
  const msgs = [
    { from: 'bot', text: 'היי דני, תזכורת — תור מחר ב-10:30 ✨', time: '08:00' },
    { from: 'me',  text: 'מעולה, אגיע!', time: '08:02' },
    { from: 'bot', text: 'מחכים לך. נשמח לראותך 🙏', time: '08:02', delivered: true },
  ];
  return (
    <div style={{
      width: 420, background: 'white', borderRadius: 22, padding: 24,
      border: '1px solid var(--rule)', boxShadow: 'var(--shadow-2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--rule)' }}>
        <span style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--gold-2), var(--gold-deep))', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ISparkles size={18} />
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Toron AI</div>
          <div style={{ fontSize: 11, color: 'var(--sage)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage)' }} />פעיל
          </div>
        </div>
        <span style={{ marginInlineStart: 'auto', fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>3 / 3 נשלחו</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: m.from === 'me' ? 'flex-start' : 'flex-end',
            animation: `booking-pop 0.4s var(--ease-back) ${i * 220}ms both`,
          }}>
            <div style={{
              maxWidth: '76%', padding: '10px 14px', borderRadius: 16,
              background: m.from === 'me' ? 'var(--sage)' : 'var(--bg-warm)',
              color: m.from === 'me' ? 'white' : 'var(--ink)',
              fontSize: 13.5, lineHeight: 1.5, fontWeight: 500,
              borderBottomRightRadius: m.from === 'me' ? 16 : 4,
              borderBottomLeftRadius: m.from === 'me' ? 4 : 16,
            }}>
              {m.text}
              <div style={{ fontSize: 9.5, opacity: 0.65, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                {m.time}
                {m.delivered && <ICheckCircle size={11} stroke={2.5} />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// NUMBERS — Big counter band on dark espresso background
// ─────────────────────────────────────────────────────────────────────────
function Numbers() {
  return (
    <section style={{
      position: 'relative', padding: '90px 40px', overflow: 'hidden',
      background: 'linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-deep-2) 100%)',
      color: 'var(--bg)',
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', top: -100, right: -100, width: 500, height: 500,
        background: 'radial-gradient(circle, var(--gold-glow), transparent 70%)',
        filter: 'blur(50px)', pointerEvents: 'none',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', bottom: -200, left: -100, width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(255, 143, 177, 0.25), transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', maxWidth: 1320, margin: '0 auto' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(155, 122, 255, 0.18)', color: 'var(--gold-2)',
            fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
            letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18,
          }}>
            במספרים
          </div>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 4.4vw, 60px)',
            fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0, color: 'var(--bg)',
          }}>
            השנה הראשונה <em style={{ color: 'var(--gold-2)' }}>בעברית.</em>
          </h2>
        </div>
        <div className="reveal" data-d="1" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24,
        }}>
          <BigNumber value={1247}   suffix="" label="בעלי עסק פעילים" delta="+82 השבוע" />
          <BigNumber value={38200}  suffix="" label="הודעות AI נשלחו" delta="ביום ממוצע 1,250" mono />
          <BigNumber value={14800}  prefix="₪ " label="הכנסה חודשית ממוצעת" delta="לבעל עסק" />
          <BigNumber value={43}     suffix="%" label="פחות ביטולים חוזרים" delta="ממוצע ענפי" highlight />
        </div>
      </div>
    </section>
  );
}

function BigNumber({ value, prefix = '', suffix = '', label, delta, mono, highlight }) {
  const [ref, n] = useCountUp(value, { duration: 1800 });
  // Format with thousands separator
  const formatted = Math.round(n).toLocaleString('he-IL');
  return (
    <div ref={ref} style={{
      padding: '28px 24px', borderRadius: 20,
      background: highlight ? 'linear-gradient(135deg, var(--gold-deep), var(--gold))' : 'rgba(248, 244, 255, 0.04)',
      border: highlight ? 'none' : '1px solid rgba(155, 122, 255, 0.20)',
      color: highlight ? 'var(--bg-deep)' : 'var(--bg)',
    }}>
      <div className="num" style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-serif)',
        fontSize: 'clamp(40px, 4.5vw, 64px)', fontWeight: 700, lineHeight: 1, marginBottom: 12,
        color: highlight ? 'var(--bg-deep)' : 'var(--gold-2)', letterSpacing: '-0.02em',
      }}>
        {prefix}{formatted}{suffix}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: highlight ? 'var(--bg-deep)' : 'var(--bg)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 11.5, color: highlight ? 'rgba(20, 9, 58, 0.7)' : 'rgba(248, 244, 255, 0.55)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
        ↗ {delta}
      </div>
    </div>
  );
}

// Living Landing — sections part 2: features, before/after, pricing, testimonials, FAQ, CTA, footer.

// ─────────────────────────────────────────────────────────────────────────
// FEATURE SHOWCASE — Auto-rotating tabs with big illustration per feature
// ─────────────────────────────────────────────────────────────────────────
function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const features = FEATURE_DEMOS;
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % features.length), 4200);
    return () => clearInterval(t);
  }, [features.length]);
  return (
    <section id="features" style={{ padding: '110px 40px 90px', maxWidth: 1320, margin: '0 auto' }}>
      <div className="reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(109, 68, 232, 0.14)', color: 'var(--gold-deep)',
          fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
          letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18,
        }}>
          מה במוצר
        </div>
        <h2 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 4.6vw, 64px)',
          fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0,
        }}>
          שש יכולות. <em style={{ color: 'var(--gold-deep)' }}>ערימה אחת.</em>
        </h2>
      </div>
      <div className="reveal" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 48,
        background: 'var(--paper)', borderRadius: 28, padding: 32,
        boxShadow: 'var(--shadow-2)', border: '1px solid var(--rule)',
        alignItems: 'stretch',
      }}>
        {/* Left tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {features.map((f, i) => {
            const isActive = i === active;
            return (
              <button key={i} onClick={() => setActive(i)} style={{
                background: isActive ? 'linear-gradient(180deg, var(--gold-soft), transparent)' : 'transparent',
                border: 'none', borderInlineStart: `3px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
                padding: '14px 16px 14px 22px', borderRadius: 10, textAlign: 'right',
                display: 'flex', alignItems: 'center', gap: 14,
                transition: 'all 0.35s var(--ease)',
                cursor: 'pointer',
              }}>
                <span style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: isActive ? f.color : 'var(--bg-warm)',
                  color: isActive ? 'white' : 'var(--ink-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                  transition: 'all 0.35s var(--ease)',
                }}>
                  <f.Icon size={18} stroke={2} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 15.5, color: isActive ? 'var(--ink)' : 'var(--ink-soft)',
                    letterSpacing: '-0.005em',
                  }}>
                    {f.title}
                  </div>
                  {isActive && (
                    <div style={{ height: 2, marginTop: 8, background: 'var(--rule)', borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', background: 'var(--gold)', width: '100%',
                        transformOrigin: 'right center',
                        animation: 'feat-bar 4.2s linear forwards',
                      }} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right — illustration */}
        <div style={{ position: 'relative', minHeight: 440, background: 'linear-gradient(135deg, var(--bg-warm), white)', borderRadius: 20, overflow: 'hidden' }}>
          {features.map((f, i) => (
            <div key={i} style={{
              position: 'absolute', inset: 0, padding: 36,
              opacity: i === active ? 1 : 0,
              transform: i === active ? 'translateX(0)' : 'translateX(-20px)',
              transition: 'opacity 0.5s var(--ease), transform 0.5s var(--ease)',
              pointerEvents: i === active ? 'auto' : 'none',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div>
                <span style={{
                  display: 'inline-flex', width: 56, height: 56, borderRadius: 16,
                  background: f.color, color: 'white',
                  alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 28px rgba(0,0,0,0.10)',
                }}>
                  <f.Icon size={28} stroke={1.6} />
                </span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 700, margin: '20px 0 14px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.7, margin: 0, maxWidth: 480 }}>{f.body}</p>
              </div>
              <FeatureMiniDemo idx={i} />
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes feat-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
    </section>
  );
}

// Tiny per-feature visual hook to give each tab its own flavor
function FeatureMiniDemo({ idx }) {
  if (idx === 0) {
    // Calendar week strip
    const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {days.map((d, i) => (
          <div key={i} style={{
            background: i === 2 ? 'linear-gradient(180deg, var(--gold-2), var(--gold-deep))' : 'white',
            color: i === 2 ? 'white' : 'var(--ink)',
            borderRadius: 10, padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: 12,
            border: '1px solid var(--rule)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.7 }}>{d}</div>
            <div className="num" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginTop: 2 }}>{10 + i}</div>
            <div style={{ fontSize: 9, marginTop: 3, opacity: 0.7 }}>{[2, 5, 6, 4, 7, 3, 0][i]} תורים</div>
          </div>
        ))}
      </div>
    );
  }
  if (idx === 1) {
    // 3 AI variants
    const v = [
      ['חביב',  '"היי דני, נשמח לראותך מחר ב-10:30 ❤️"', 'var(--peach)'],
      ['רשמי', '"שלום דני, תזכורת לתור 13.5 ב-10:30."',  'var(--gold)'],
      ['קצר',  '"דני — תור מחר 10:30 👍"',                'var(--sage)'],
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {v.map(([k, t, c], i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'white', borderRadius: 10, padding: '10px 14px',
            border: '1px solid var(--rule)',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, letterSpacing: '0.06em',
              background: c, color: 'white',
            }}>{k}</span>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>{t}</span>
          </div>
        ))}
      </div>
    );
  }
  if (idx === 2) {
    // Mini P&L bars
    const months = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני'];
    const inc = [62, 74, 68, 88, 95, 110];
    const exp = [40, 42, 38, 45, 44, 46];
    return (
      <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', letterSpacing: '0.08em' }}>הכנסות מול הוצאות</span>
          <span className="num" style={{ fontSize: 14, color: 'var(--sage)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>+18%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110 }}>
          {months.map((m, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: '100%', height: 100, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                <div style={{ flex: 1, background: 'linear-gradient(180deg, var(--gold-2), var(--gold))', height: `${inc[i]}%`, borderRadius: 3 }} />
                <div style={{ flex: 1, background: 'var(--ink-mute)', height: `${exp[i]}%`, borderRadius: 3, opacity: 0.4 }} />
              </div>
              <span style={{ fontSize: 9, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>{m}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (idx === 3) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { name: 'אמיר ש.', days: '47 יום', state: 'lost' },
          { name: 'רננה ק.', days: '32 יום', state: 'lost' },
          { name: 'עומר ב.', days: '60 יום', state: 'back' },
        ].map((c, i) => (
          <div key={i} style={{
            background: 'white', borderRadius: 12, padding: 14, border: '1px solid var(--rule)',
            display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start',
          }}>
            <span style={{
              width: 32, height: 32, borderRadius: '50%', background: c.state === 'back' ? 'var(--sage)' : 'var(--blush)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><IHeart size={14} stroke={2} /></span>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>לא חזר {c.days}</div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
              background: c.state === 'back' ? 'rgba(0, 201, 167, 0.18)' : 'rgba(255, 119, 87, 0.18)',
              color: c.state === 'back' ? 'var(--sage)' : '#9E2A4A',
            }}>{c.state === 'back' ? '✓ חזר!' : 'שלח הודעה'}</span>
          </div>
        ))}
      </div>
    );
  }
  if (idx === 4) {
    return (
      <div style={{
        background: 'white', borderRadius: 14, padding: 16, border: '1px solid var(--rule)',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12,
      }}>
        {[
          ['השעה הכי עמוסה', '17:00', '23% מהתורים'],
          ['היום הכי טוב', 'חמישי', '₪ 1,240 ממוצע'],
          ['לקוח השנה', 'דני כהן', '28 ביקורים'],
          ['חג קרוב', 'שבועות', 'בעוד 14 ימים'],
        ].map(([l, v, s], i) => (
          <div key={i}>
            <div style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{l}</div>
            <div className="num" style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: 'var(--gold-deep)', marginTop: 4 }}>{v}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{s}</div>
          </div>
        ))}
      </div>
    );
  }
  // idx 5 — link
  return (
    <div style={{
      background: 'var(--bg-deep)', color: 'var(--bg)', borderRadius: 14, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 10, color: 'var(--gold-2)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>הלינק שלך</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600 }}>
        toron.co.il/<span style={{ color: 'var(--gold-2)' }}>ramos</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <span style={{ background: 'rgba(155, 122, 255, 0.18)', color: 'var(--gold-2)', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>העתק</span>
        <span style={{ background: 'rgba(155, 122, 255, 0.18)', color: 'var(--gold-2)', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>קוד QR</span>
        <span style={{ marginInlineStart: 'auto', background: '#25D366', color: 'white', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IWhats size={12} stroke={0} /> שתף
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BEFORE/AFTER — split: paper chaos vs Toron screen
// ─────────────────────────────────────────────────────────────────────────
function BeforeAfter() {
  return (
    <section className="reveal" style={{
      padding: '90px 40px',
      background: 'linear-gradient(180deg, var(--bg-warm), var(--bg))',
    }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 4.4vw, 56px)',
            fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0,
          }}>
            לפני, ואחרי <em style={{ color: 'var(--gold-deep)' }}>Toron.</em>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 40 }}>
          <BAColumn before />
          <BAColumn />
        </div>
      </div>
    </section>
  );
}

function BAColumn({ before }) {
  if (before) {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{
          background: '#F0EAFF', borderRadius: 22, padding: 30,
          border: '1px solid #CCC2F0', transform: 'rotate(-1deg)',
          boxShadow: '0 14px 30px rgba(20, 9, 58, 0.08)',
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(20, 9, 58, 0.08) 31px, rgba(20, 9, 58, 0.08) 32px)',
          minHeight: 380,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: -16, left: 30, background: 'var(--blush)', color: 'white',
            padding: '6px 16px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
            transform: 'rotate(-3deg)', boxShadow: '0 4px 10px rgba(0,0,0,0.10)',
          }}>לפני</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, marginBottom: 18, textDecoration: 'underline', textDecorationColor: 'var(--blush)', textUnderlineOffset: 6 }}>
            יום שלישי
          </div>
          {[
            ['9:00', 'דני - תספ׳'],
            ['9:30', 'יוסי? - או 10?'],
            ['10:30', 'נטלי - חדשה'],
            ['12 ?', '----'],
            ['14:00', 'משה - לזכור לזרוק לו טלפון!!!'],
            ['16:30', 'אמיר - תספורת + זקן'],
            ['?', 'מי שאל אותי על מחר?'],
          ].map(([t, n], i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, fontFamily: '"Comic Sans MS", "Marker Felt", cursive',
              color: '#3A2A6E', fontSize: 16, padding: '6px 0', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 700, color: '#9E2A4A', minWidth: 60 }}>{t}</span>
              <span style={{ textDecoration: i === 1 ? 'line-through' : 'none' }}>{n}</span>
            </div>
          ))}
          <div style={{ marginTop: 18, fontSize: 12, color: '#9E2A4A', fontStyle: 'italic' }}>
            ⚠ צריך לזכור לחפש את הלקוחה ממאי
          </div>
        </div>
        {/* fallen post-it */}
        <div style={{
          position: 'absolute', top: 80, right: -30, transform: 'rotate(8deg)',
          background: '#C4B5FD', padding: '14px 16px', width: 130,
          fontFamily: '"Comic Sans MS", cursive', fontSize: 13, color: '#3A2A6E',
          boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
        }}>
          להתקשר לדנה<br/><strong>חזר את הצ׳ק!</strong>
        </div>
      </div>
    );
  }
  // AFTER
  return (
    <div style={{
      background: 'white', borderRadius: 22, padding: 28,
      border: '1px solid var(--gold)', position: 'relative', minHeight: 380,
      boxShadow: 'var(--shadow-gold)',
    }}>
      <div style={{
        position: 'absolute', top: -16, right: 30, background: 'linear-gradient(180deg, var(--gold-2), var(--gold-deep))', color: 'white',
        padding: '6px 16px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
        boxShadow: '0 4px 10px rgba(0,0,0,0.10)',
      }}>אחרי · Toron</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700 }}>יום שלישי</div>
        <span style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage)' }} />
          מסונכרן
        </span>
      </div>
      {[
        { time: '09:00', name: 'דני כהן',    s: '✓', svc: 'תספורת + זקן · ₪120', sage: true },
        { time: '10:30', name: 'נטלי לוי',   s: 'live', svc: 'תספורת · ₪90', tag: 'חדש' },
        { time: '12:00', name: 'פנוי',       s: 'empty' },
        { time: '14:00', name: 'יוסי אברהם', svc: 'תספורת + שמפו · ₪110' },
        { time: '15:30', name: 'אמיר ברק',   svc: 'תספורת · ₪90' },
        { time: '17:00', name: 'רן כץ',      svc: 'תספורת + זקן · ₪120', tag: 'VIP' },
      ].map((b, i) => (
        <div key={i} style={{
          display: 'flex', gap: 12, alignItems: 'center',
          padding: '11px 0', borderBottom: '1px dashed var(--rule)',
          opacity: b.s === 'empty' ? 0.55 : 1,
        }}>
          <span className="num" style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, color: 'var(--gold-deep)', minWidth: 56 }}>{b.time}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, fontStyle: b.s === 'empty' ? 'italic' : 'normal', color: b.s === 'empty' ? 'var(--ink-mute)' : 'var(--ink)', textDecoration: b.sage ? 'line-through' : 'none' }}>{b.name}</div>
            {b.svc && <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 2 }}>{b.svc}</div>}
          </div>
          {b.tag && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999, letterSpacing: '0.06em',
              background: b.tag === 'VIP' ? 'linear-gradient(180deg, var(--gold-2), var(--gold-deep))' : 'rgba(255, 119, 87, 0.18)',
              color: b.tag === 'VIP' ? 'white' : '#9E2A4A',
            }}>{b.tag}</span>
          )}
          {b.sage && <ICheckCircle size={15} stroke={2.2} style={{ color: 'var(--sage)' }} />}
          {b.s === 'live' && <span style={{ fontSize: 9, fontWeight: 800, background: 'var(--sage)', color: 'white', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.1em' }}>LIVE</span>}
        </div>
      ))}
      <div style={{
        marginTop: 16, padding: '12px 14px',
        background: 'linear-gradient(135deg, var(--gold-2), var(--gold-deep))', color: 'white',
        borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 8px 18px rgba(109, 68, 232, 0.30)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>הכנסה היום</span>
        <span className="num" style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700 }}>₪ 530</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────────────────────────────────────
function PricingSection() {
  return (
    <section id="pricing" style={{ padding: '110px 40px 90px', maxWidth: 1100, margin: '0 auto' }}>
      <div className="reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(109, 68, 232, 0.14)', color: 'var(--gold-deep)',
          fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
          letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18,
        }}>
          מסלולים
        </div>
        <h2 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(40px, 4.6vw, 60px)',
          fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0,
        }}>
          פשוט. <em style={{ color: 'var(--gold-deep)' }}>שקוף.</em>
        </h2>
      </div>
      <div className="reveal" data-d="1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        <PriceCard
          tag="גמיש · ללא התחייבות"
          title="Pro חודשי"
          price="50"
          line="ביטול בלחיצה. אין הפתעות."
          items={['כל הפיצ׳רים', '30 ימי ניסיון', 'ללא הגבלת לקוחות', 'AI כלול', 'תמיכה בעברית']}
          cta="התחל ניסיון 30 יום"
        />
        <PriceCard
          featured
          tag="הכי משתלם · 24 חודשים"
          title="Studio + טאבלט"
          price="50"
          extra="+ טאבלט 10″ במתנה"
          line="טאבלט מסובסד דרך התשלום החודשי."
          items={['כל הפיצ׳רים של Pro', 'טאבלט 10″ איכותי', 'מסך גדול קבוע בעסק', 'סטטיסטיקות בזמן אמת', 'עדיפות בתמיכה']}
          cta="ראה פרטים"
        />
      </div>
      <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-mute)', marginTop: 24 }}>
        <IShield size={14} style={{ verticalAlign: 'middle', color: 'var(--gold)' }} /> סליקה מאובטחת PCI-DSS Level 1 ע״י Tranzila · קבלות אוטומטיות · אין מע״מ (עוסק פטור)
      </p>
    </section>
  );
}

function PriceCard({ tag, title, price, extra, line, items, cta, featured }) {
  return (
    <div style={{
      background: featured ? 'linear-gradient(180deg, var(--bg-deep), var(--bg-deep-2))' : 'var(--paper)',
      color: featured ? 'var(--bg)' : 'var(--ink)',
      border: featured ? '1px solid var(--gold)' : '1px solid var(--rule)',
      borderRadius: 24, padding: 36, position: 'relative', overflow: 'hidden',
      boxShadow: featured ? '0 30px 60px rgba(20, 9, 58, 0.35)' : 'var(--shadow-1)',
      transition: 'transform 0.3s var(--ease)',
    }}>
      {featured && (
        <div aria-hidden="true" style={{
          position: 'absolute', top: -100, left: -100, width: 320, height: 320,
          background: 'radial-gradient(circle, var(--gold-glow), transparent 65%)',
          filter: 'blur(50px)', pointerEvents: 'none',
        }} />
      )}
      <div style={{ position: 'relative' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: featured ? 'rgba(155, 122, 255, 0.18)' : 'var(--bg-warm)',
          color: featured ? 'var(--gold-2)' : 'var(--gold-deep)',
          fontSize: 11.5, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
          letterSpacing: '0.04em', marginBottom: 18,
        }}>
          {featured && <ICrown size={12} />} {tag}
        </span>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 700, margin: '0 0 22px', letterSpacing: '-0.015em' }}>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
          <span className="num" style={{
            fontFamily: 'var(--font-serif)', fontSize: 76, fontWeight: 700,
            color: featured ? 'var(--gold-2)' : 'var(--gold-deep)', letterSpacing: '-0.03em', lineHeight: 1,
          }}>{price}</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: featured ? 'var(--gold-2)' : 'var(--gold-deep)', fontWeight: 600 }}>₪</span>
          <span style={{ fontSize: 14, color: featured ? 'rgba(248, 244, 255, 0.55)' : 'var(--ink-mute)', marginInlineStart: 6 }}>/ חודש</span>
        </div>
        {extra && <div style={{ fontSize: 13, color: featured ? 'var(--gold-2)' : 'var(--gold-deep)', fontWeight: 600, marginBottom: 6 }}>{extra}</div>}
        <p style={{ fontSize: 13.5, color: featured ? 'rgba(248, 244, 255, 0.60)' : 'var(--ink-mute)', margin: '0 0 26px' }}>{line}</p>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 30 }}>
          {items.map((it, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, color: featured ? 'rgba(248, 244, 255, 0.88)' : 'var(--ink)' }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: featured ? 'var(--gold)' : 'var(--bg-warm)',
                color: featured ? 'var(--bg-deep)' : 'var(--gold-deep)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
              }}>
                <ICheck size={12} stroke={3} />
              </span>
              {it}
            </li>
          ))}
        </ul>
        <a style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: featured ? 'linear-gradient(180deg, var(--gold-2), var(--gold))' : 'var(--ink)',
          color: featured ? 'var(--bg-deep)' : 'var(--bg)',
          padding: '16px 0', borderRadius: 12, fontWeight: 800, fontSize: 15,
          boxShadow: featured ? '0 14px 28px rgba(109, 68, 232, 0.35)' : 'var(--shadow-1)',
          transition: 'transform 0.25s var(--ease-back)',
          cursor: 'pointer',
        }}>{cta} <IArrow size={15} stroke={2.4} /></a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TESTIMONIAL MARQUEE — two infinite-scroll rows in opposite directions
// ─────────────────────────────────────────────────────────────────────────
function TestimonialMarquee() {
  const items = TESTIMONIALS;
  const half = Math.ceil(items.length / 2);
  const row1 = [...items.slice(0, half), ...items.slice(0, half)];
  const row2 = [...items.slice(half), ...items.slice(half)];
  return (
    <section style={{ padding: '90px 0', overflow: 'hidden', background: 'var(--bg-warm)' }}>
      <div className="reveal" style={{ textAlign: 'center', marginBottom: 48, padding: '0 40px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(109, 68, 232, 0.14)', color: 'var(--gold-deep)',
          fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
          letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18,
        }}>
          ❤ מה אומרים
        </div>
        <h2 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 4.4vw, 56px)',
          fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0,
        }}>
          612 בעלי עסק. <em style={{ color: 'var(--gold-deep)' }}>1 דירוג ממוצע — 4.9.</em>
        </h2>
      </div>
      <MarqueeRow items={row1} direction={1} />
      <div style={{ height: 16 }} />
      <MarqueeRow items={row2} direction={-1} />
    </section>
  );
}

function MarqueeRow({ items, direction }) {
  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      <div data-anim style={{
        display: 'flex', gap: 16, width: 'max-content',
        animation: `marquee ${52}s linear infinite`,
        animationDirection: direction > 0 ? 'normal' : 'reverse',
      }}>
        {items.map((t, i) => (
          <div key={i} style={{
            flex: 'none', width: 360, background: 'white', borderRadius: 18,
            padding: 22, border: '1px solid var(--rule)', boxShadow: 'var(--shadow-1)',
          }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10, color: 'var(--gold)' }}>
              {[0,1,2,3,4].map(s => <IStar key={s} size={14} />)}
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)', margin: '0 0 14px' }}>"{t.text}"</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold-2), var(--gold-deep))', color: 'white',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
              }}>{t.name[0]}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────────────
function FAQSection() {
  return (
    <section id="faq" style={{ padding: '90px 40px', maxWidth: 980, margin: '0 auto' }}>
      <div className="reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
        <h2 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 4.4vw, 56px)',
          fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0,
        }}>
          שאלות נפוצות.
        </h2>
      </div>
      <div className="reveal" data-d="1" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FAQ.map(([q, a], i) => (
          <details key={i} className="faq" style={{
            background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 14,
            padding: '0', overflow: 'hidden',
          }}>
            <summary style={{
              cursor: 'pointer', listStyle: 'none', padding: '20px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14,
              fontSize: 17, fontWeight: 700, color: 'var(--ink)',
            }}>
              <span>{q}</span>
              <span className="faq-plus" style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-warm)',
                color: 'var(--gold-deep)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.25s var(--ease), background 0.25s',
                flex: 'none',
              }}><IPlus size={16} stroke={2.4} /></span>
            </summary>
            <p style={{ padding: '0 24px 22px', color: 'var(--ink-soft)', fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>{a}</p>
          </details>
        ))}
      </div>
      <style>{`
        details.faq[open] { border-color: var(--gold) !important; }
        details.faq[open] .faq-plus { transform: rotate(45deg); background: var(--gold); color: white; }
        details.faq summary::-webkit-details-marker { display: none; }
      `}</style>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FINAL CTA — dark wrap with massive serif headline + gold mega button
// ─────────────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section style={{
      position: 'relative', padding: '110px 40px 130px',
      background: 'linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-deep-2) 100%)',
      color: 'var(--bg)', overflow: 'hidden', isolation: 'isolate',
    }}>
      <div aria-hidden="true" data-anim style={{
        position: 'absolute', top: '-20%', right: '20%', width: 500, height: 500,
        background: 'radial-gradient(circle, var(--gold-glow), transparent 65%)',
        filter: 'blur(60px)', animation: 'drift1 20s var(--ease) infinite',
      }} />
      <div aria-hidden="true" data-anim style={{
        position: 'absolute', bottom: '-30%', left: '15%', width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(255, 143, 177, 0.20), transparent 65%)',
        filter: 'blur(70px)', animation: 'drift2 26s var(--ease) infinite',
      }} />
      <div className="reveal" style={{ position: 'relative', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(155, 122, 255, 0.18)', color: 'var(--gold-2)',
          fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 999,
          letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 28,
        }}>
          <IFire size={13} />עכשיו · גם בעברית
        </div>
        <h2 style={{
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(48px, 7vw, 96px)',
          fontWeight: 700, lineHeight: 0.96, letterSpacing: '-0.025em', margin: '0 0 22px',
          color: 'var(--bg)',
        }}>
          תפסיק לרשום תורים בנייר.<br />
          <em style={{ color: 'var(--gold-2)' }}>תתחיל לנהל.</em>
        </h2>
        <p style={{ fontSize: 19, color: 'rgba(248, 244, 255, 0.65)', maxWidth: 620, margin: '0 auto 40px', lineHeight: 1.6 }}>
          30 ימים חינם. ללא כרטיס אשראי. הרשמה ב-2 דקות.
          <br />הצטרף ל-1,247 בעלי עסק שכבר עברו ל-Toron.
        </p>
        <a className="cta-mega">
          <ISparkles size={20} />
          התחל 30 יום חינם
          <IArrow size={20} stroke={2.4} />
        </a>
        <ul style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 32, color: 'rgba(248, 244, 255, 0.55)', fontSize: 13, flexWrap: 'wrap' }}>
          <li style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ICheck size={14} stroke={2.5} style={{ color: 'var(--gold-2)' }} />ללא התקנה</li>
          <li style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ICheck size={14} stroke={2.5} style={{ color: 'var(--gold-2)' }} />ביטול בלחיצה</li>
          <li style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ICheck size={14} stroke={2.5} style={{ color: 'var(--gold-2)' }} />תמיכה בעברית</li>
          <li style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ICheck size={14} stroke={2.5} style={{ color: 'var(--gold-2)' }} />Made in Israel</li>
        </ul>
        <style>{`
          .cta-mega {
            position: relative; overflow: hidden;
            display: inline-flex; align-items: center; gap: 14px;
            background: linear-gradient(180deg, var(--gold-2) 0%, var(--gold) 50%, var(--gold-deep) 100%);
            color: var(--bg-deep); padding: 24px 42px; border-radius: 18px;
            font-weight: 800; font-size: 19px;
            box-shadow: 0 24px 60px rgba(109, 68, 232, 0.45), inset 0 1px 0 rgba(255,255,255,0.35);
            animation: glow-cycle 3.5s var(--ease) infinite;
            transition: transform 0.25s var(--ease-back);
          }
          .cta-mega::before {
            content: ''; position: absolute; top: 0; bottom: 0; width: 26%;
            background: linear-gradient(120deg, transparent, rgba(255,255,255,0.55), transparent);
            animation: shimmer 3.6s var(--ease) infinite;
            pointer-events: none;
          }
          .cta-mega:hover { transform: translateY(-3px) scale(1.02); }
        `}</style>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#16093B', color: 'rgba(248, 244, 255, 0.65)', padding: '48px 40px 32px' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 36 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <BrandMarkFooter />
            <span style={{ fontWeight: 800, fontSize: 22, color: 'var(--bg)' }}>Toron</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, maxWidth: 320 }}>
            ניהול תורים חכם לבעלי מקצועות שירות בישראל. בעברית, מהיום הראשון.
          </p>
        </div>
        {[
          ['מוצר', ['הרשמה', 'כניסה', 'מסלולים', 'הדגמה']],
          ['חוקי', ['תקנון', 'פרטיות', 'ביטולים', 'נגישות']],
          ['תמיכה', ['support@toron.co.il', 'privacy@toron.co.il', 'accessibility@toron.co.il']],
        ].map(([h, items], i) => (
          <div key={i}>
            <h4 style={{
              fontSize: 11.5, fontWeight: 800, color: 'var(--gold-2)', letterSpacing: '0.18em',
              textTransform: 'uppercase', margin: '0 0 14px',
            }}>{h}</h4>
            {items.map((x, j) => (
              <div key={j} style={{ padding: '4px 0', fontSize: 13.5, color: 'rgba(248, 244, 255, 0.75)' }}>{x}</div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid rgba(248, 244, 255, 0.10)', paddingTop: 18, maxWidth: 1320, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'rgba(248, 244, 255, 0.45)' }}>
        <span>© 2026 TORON · ALL RIGHTS RESERVED</span>
        <span>Made with ♥ in Israel · v2.4.1</span>
      </div>
    </footer>
  );
}

function BrandMarkFooter() {
  return (
    <span style={{
      width: 34, height: 34, borderRadius: 12,
      background: 'linear-gradient(135deg, var(--gold-2) 0%, var(--gold) 55%, var(--gold-deep) 100%)',
      color: '#16093B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: 17,
    }}>T</span>
  );
}


export default function HomePage() {
  return <LivingLanding />;
}
