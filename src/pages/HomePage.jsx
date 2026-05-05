import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar, Sparkles, Wallet, HeartCrack, BarChart3, Link2,
  Scissors, Hand, Footprints, Flower2,
  Check, ChevronDown, ShieldCheck, Clock, Crown, X, Tablet, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

// Toron landing page — public-facing marketing surface.
// Sections (top-to-bottom):
//   1. Skip-to-content link (IS 5568 mandatory for keyboard / screen reader)
//   2. Brand bar with sign-in / sign-up CTAs
//   3. Hero with primary CTA and trust line
//   4. "For who" — the four professions we support
//   5. Features grid — what the app does
//   6. Pricing teaser — Pro Monthly + Studio
//   7. FAQ (collapsible <details>)
//   8. Final CTA
//   9. Footer with all legal links
//
// Logged-in users are redirected to /dashboard (or /onboarding if their
// barber doc has onboarded:false). New / signed-out visitors stay here.

export default function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [studioOpen, setStudioOpen] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  if (loading) return <div className="loading">טוען…</div>;
  if (user) return null; // about to redirect

  return (
    <div className="landing" lang="he" dir="rtl">
      <a href="#main" className="skip-link">דלג לתוכן הראשי</a>

      <header className="landing-bar" role="banner">
        <Link to="/" className="brand-link" aria-label="Toron — דף הבית">
          <img src="/logo-mark.png" alt="" aria-hidden="true" className="brand-mark-img" />
          <span className="brand-name">Toron</span>
        </Link>
        <nav className="landing-nav" role="navigation" aria-label="ניווט ראשי">
          <Link to="/auth?mode=login" className="nav-link">כניסה</Link>
          <Link to="/auth?mode=signup" className="btn-gold nav-cta">התחל חינם</Link>
        </nav>
      </header>

      <main id="main" role="main">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-inner">
            <div className="hero-eyebrow">
              <Sparkles size={14} className="icon-inline" />
              <span>ניהול תורים חכם · מבוסס AI</span>
            </div>
            <h1 id="hero-title" className="hero-title">
              לוח התורים שלך, <span className="hero-accent">מנוהל אוטומטית.</span>
            </h1>
            <p className="hero-sub">
              לינק אישי ללקוחות, AI שכותב הודעות בעברית, מעקב הוצאות והכנסות,
              והודעות חזרה ללקוחות שנעלמו. הכל במקום אחד — בעברית, מ-50 ש"ח לחודש.
            </p>
            <div className="hero-cta">
              <Link to="/auth?mode=signup" className="btn-gold btn-xl">
                <Sparkles size={18} className="icon-inline" />התחל 30 יום חינם
              </Link>
              <Link to="/auth?mode=login" className="btn-secondary btn-xl">
                כבר יש לי חשבון
              </Link>
            </div>
            <ul className="hero-trust" aria-label="התחייבויות">
              <li><Check size={14} aria-hidden="true" />ללא כרטיס אשראי</li>
              <li><Check size={14} aria-hidden="true" />ללא התקנה</li>
              <li><Check size={14} aria-hidden="true" />ביטול בכל רגע</li>
            </ul>
          </div>
          <div className="hero-mockup" aria-hidden="true">
            <div className="mock-card mock-day">
              <div className="mock-row">
                <span className="mock-time">09:00</span>
                <span className="mock-name">דני כהן</span>
                <span className="mock-tag">VIP</span>
              </div>
              <div className="mock-row">
                <span className="mock-time">10:30</span>
                <span className="mock-name">נטלי לוי</span>
                <span className="mock-tag mock-tag-new">חדש</span>
              </div>
              <div className="mock-row mock-empty">
                <span className="mock-time">12:00</span>
                <span className="mock-name muted">פנוי · מומלץ ללקוחה הבאה</span>
              </div>
              <div className="mock-row">
                <span className="mock-time">14:00</span>
                <span className="mock-name">יוסי אברהם</span>
              </div>
              <div className="mock-row mock-row-revenue">
                <span>הכנסה צפויה היום</span>
                <strong>₪780</strong>
              </div>
            </div>
            <div className="mock-card mock-ai">
              <div className="mock-ai-head">
                <Sparkles size={14} className="icon-inline" />
                <span>AI כתב הודעת תזכורת</span>
              </div>
              <div className="mock-ai-body">
                "היי דני, מזכירה שיש לך תור מחר ב-10:30 לתספורת. נתראה! ✂️"
              </div>
            </div>
          </div>
        </section>

        {/* ── Who's it for ───────────────────────────────────────────── */}
        <section className="who" aria-labelledby="who-title">
          <h2 id="who-title" className="section-title">מי שמשתמש ב-Toron</h2>
          <p className="section-sub">
            תוכננה במיוחד לבעלי מקצועות שירות שכל היום שלהם הוא יומן ובאתחיים פגישות.
          </p>
          <div className="who-grid">
            <article className="who-card">
              <Scissors size={28} className="who-icon" />
              <h3>ספרים</h3>
              <p>תספורות, גילוח, פרצופים — לוח של 20-דקה כברירת מחדל</p>
            </article>
            <article className="who-card">
              <Hand size={28} className="who-icon" />
              <h3>מניקור</h3>
              <p>לק ג'ל, פדיקור משולב, חיזוקים — תוספות ומחירונים מובנים</p>
            </article>
            <article className="who-card">
              <Footprints size={28} className="who-icon" />
              <h3>פדיקור</h3>
              <p>טיפולי כפות רגליים, פטרת, פדיקור רפואי — תיעוד פרטיות</p>
            </article>
            <article className="who-card">
              <Flower2 size={28} className="who-icon" />
              <h3>קוסמטיקה</h3>
              <p>פנים, שעווה, ריסים, גבות — ניהול לקוחות חוזרות</p>
            </article>
          </div>
        </section>

        {/* ── Features grid ──────────────────────────────────────────── */}
        <section className="features" aria-labelledby="features-title">
          <h2 id="features-title" className="section-title">כל מה שצריך כדי לנהל יום עבודה מלא</h2>
          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-ico"><Calendar size={22} /></div>
              <h3>יומן חכם</h3>
              <p>לוח 20-דקה ברירת מחדל, שעות עבודה גמישות, חופשות, חסימות, הזמנת לקוח דרך הלינק שלך — מסונכרן בזמן אמת.</p>
            </article>
            <article className="feature-card">
              <div className="feature-ico"><Sparkles size={22} /></div>
              <h3>AI שכותב במקומך</h3>
              <p>תזכורות, הודעות תודה, הזמנות חזרה — ב-3 גרסאות לבחירה. מותאם ללשון זכר/נקבה, מבוסס היסטוריית הלקוח.</p>
            </article>
            <article className="feature-card">
              <div className="feature-ico"><Wallet size={22} /></div>
              <h3>הכנסות מול הוצאות</h3>
              <p>עוקב אחרי שכירות, חומרים, חשבונות, רכב. מציג רווח נטו, אחוז רווחיות, השוואה חודשית — בלי Excel.</p>
            </article>
            <article className="feature-card">
              <div className="feature-ico"><HeartCrack size={22} /></div>
              <h3>זיהוי לקוחות שנעלמו</h3>
              <p>המערכת מזהה אוטומטית מי לא חזר זמן רב מהקצב הרגיל — ולחיצה אחת מפעילה הודעת חזרה אישית.</p>
            </article>
            <article className="feature-card">
              <div className="feature-ico"><BarChart3 size={22} /></div>
              <h3>דוחות וחגים</h3>
              <p>השוואה יומית/שבועית/חודשית, ניתוח שעות עמוסות, לקוחות מובילים, חגים קרובים — תכנון העסק הופך פשוט.</p>
            </article>
            <article className="feature-card">
              <div className="feature-ico"><Link2 size={22} /></div>
              <h3>לינק הזמנה אישי</h3>
              <p>כל לקוח מקבל לינק קצר ומותאם — בלי אפליקציה, בלי הרשמה, בלי לוגו של Toron. רק את/ה.</p>
            </article>
          </div>
        </section>

        {/* ── Pricing teaser ─────────────────────────────────────────── */}
        <section className="pricing-teaser" aria-labelledby="pricing-title">
          <h2 id="pricing-title" className="section-title">מסלולים פשוטים, ללא הפתעות</h2>
          <div className="price-grid">
            <article className="price-card">
              <div className="price-tag">
                <Clock size={16} className="icon-inline" />
                <span>גמיש</span>
              </div>
              <h3>Pro חודשי</h3>
              <div className="price-amount">
                <span className="price-num">50</span>
                <span className="price-currency">₪</span>
                <span className="price-period">/חודש</span>
              </div>
              <p className="price-line">ללא התחייבות · ביטול בכל רגע</p>
              <ul className="price-features">
                <li><Check size={14} className="icon-inline" />כל הפיצ'רים</li>
                <li><Check size={14} className="icon-inline" />30 ימי ניסיון חינם</li>
                <li><Check size={14} className="icon-inline" />ללא הגבלת לקוחות</li>
                <li><Check size={14} className="icon-inline" />AI כלול</li>
              </ul>
              <Link to="/auth?mode=signup" className="btn-primary price-cta">
                התחל ניסיון
              </Link>
            </article>
            <article className="price-card price-card-featured">
              <div className="price-tag price-tag-gold">
                <Crown size={16} className="icon-inline" />
                <span>הכי משתלם</span>
              </div>
              <h3>Studio + טאבלט</h3>
              <div className="price-amount">
                <span className="price-num">50</span>
                <span className="price-currency">₪</span>
                <span className="price-period">/חודש</span>
                <span className="price-extra">+ טאבלט מתנה</span>
              </div>
              <p className="price-line">התחייבות 24 חודשים · טאבלט 10" איכותי</p>
              <ul className="price-features">
                <li><Check size={14} className="icon-inline" />כל הפיצ'רים</li>
                <li><Check size={14} className="icon-inline" />טאבלט בעסק שלך</li>
                <li><Check size={14} className="icon-inline" />לקוחות מקבלים תור באוויר</li>
                <li><Check size={14} className="icon-inline" />עדיפות תמיכה</li>
              </ul>
              <button
                type="button"
                className="btn-gold price-cta"
                onClick={() => setStudioOpen(true)}
              >
                <Crown size={14} className="icon-inline" />עוד פרטים
              </button>
            </article>
          </div>
          <p className="price-note">
            <ShieldCheck size={14} className="icon-inline" />
            כל המחירים כוללים מע"מ. קבלות אוטומטיות. סליקה מאובטחת ע"י <strong>Tranzila</strong> (PCI-DSS Level 1).
          </p>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────── */}
        <section className="faq" aria-labelledby="faq-title">
          <h2 id="faq-title" className="section-title">שאלות נפוצות</h2>
          <div className="faq-list">
            <details className="faq-item">
              <summary>איך מתחילים? צריך התקנה?</summary>
              <p>לא. נרשמים בכניסה, ובתוך 3 דקות מגדירים שעות, שירותים ומחירים — וזהו.
                האפליקציה רצה בדפדפן, אפשר להתקין PWA למסך הבית של הטלפון בלחיצה אחת.</p>
            </details>
            <details className="faq-item">
              <summary>איך הלקוחות שלי קובעים תור?</summary>
              <p>אתה מקבל לינק קצר אישי (toron.co.il/b/XXXX). שולח אותו בוואטסאפ או שם בביו.
                הלקוח לוחץ → רואה רק את הזמנים הפנויים שלך → ממלא שם וטלפון → מקבל אישור במייל.
                <strong>הוא לא רואה את הלוגו של Toron אלא רק את שם העסק שלך.</strong></p>
            </details>
            <details className="faq-item">
              <summary>מה קורה אחרי ה-30 ימים החינם?</summary>
              <p>אם בחרת מסלול, החיוב מתחיל. אם לא בחרת — החשבון נסגר אוטומטית, לא ייגבה ממך כלום.
                שלושה ימים לפני סיום הניסיון נשלח אליך תזכורת.</p>
            </details>
            <details className="faq-item">
              <summary>אני יכול/ה לבטל בכל זמן?</summary>
              <p>במסלול Pro חודשי — כן, בלחיצה אחת מההגדרות. הביטול תקף לסוף החודש המשולם.
                במסלול Studio (כולל טאבלט) — יש דמי יציאה של 30 ש"ח לכל חודש שנותר עד תום ההתחייבות,
                כי הטאבלט מסובסד דרך פריסת התשלומים. הכל שקוף ומוצג מראש.
                <Link to="/refund">פרטים מלאים במדיניות ביטולים →</Link></p>
            </details>
            <details className="faq-item">
              <summary>הנתונים שלי בטוחים?</summary>
              <p>כן. כל המידע מוצפן בתעבורה (HTTPS) ובמנוחה. אנחנו לא מוכרים נתונים. נעבד רק
                את מה שצריך כדי להפעיל את השירות. סליקה מאובטחת PCI-DSS Level 1 ע"י Tranzila.
                <Link to="/privacy">מדיניות פרטיות מלאה →</Link></p>
            </details>
            <details className="faq-item">
              <summary>אני לא בעולם של ספרים — זה גם בשבילי?</summary>
              <p>בהחלט. Toron תוכננה לבעלי מקצועות שירות באופן רחב: מניקוריסטיות, פדיקוריסטיות,
                קוסמטיקאיות, ספרים — וכל מי שעובד עם תורים. הקטלוג מותאם לכל תחום.</p>
            </details>
            <details className="faq-item">
              <summary>יש תמיכה בעברית?</summary>
              <p>הכל בעברית, RTL מלא, פונטים מותאמים. תמיכת לקוחות בעברית באימייל
                <a href="mailto:support@toron.co.il">support@toron.co.il</a>.</p>
            </details>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────────────── */}
        <section className="final-cta" aria-labelledby="final-title">
          <h2 id="final-title">מוכנ/ה להפסיק לרשום תורים בנייר?</h2>
          <p>30 ימים חינם. ללא כרטיס אשראי. הרשמה ב-2 דקות.</p>
          <div className="hero-cta" style={{ justifyContent: 'center' }}>
            <Link to="/auth?mode=signup" className="btn-gold btn-xl">
              <Sparkles size={18} className="icon-inline" />התחל עכשיו
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer" role="contentinfo">
        <div className="footer-cols">
          <div className="footer-col">
            <div className="brand-link" style={{ marginBottom: 12 }}>
              <img src="/logo-mark.png" alt="" aria-hidden="true" className="brand-mark-img" />
              <span className="brand-name">Toron</span>
            </div>
            <p className="footer-tag">ניהול תורים חכם לבעלי מקצוע בישראל.</p>
          </div>
          <div className="footer-col">
            <h4>מוצר</h4>
            <Link to="/auth?mode=signup">הרשמה</Link>
            <Link to="/auth?mode=login">כניסה</Link>
            <Link to="/pricing">מסלולים</Link>
          </div>
          <div className="footer-col">
            <h4>חוקי</h4>
            <Link to="/terms">תקנון השירות</Link>
            <Link to="/privacy">מדיניות פרטיות</Link>
            <Link to="/refund">ביטולים והחזרים</Link>
            <Link to="/accessibility">הצהרת נגישות</Link>
          </div>
          <div className="footer-col">
            <h4>תמיכה</h4>
            <a href="mailto:support@toron.co.il">support@toron.co.il</a>
            <a href="mailto:privacy@toron.co.il">privacy@toron.co.il</a>
            <a href="mailto:accessibility@toron.co.il">accessibility@toron.co.il</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Toron · כל הזכויות שמורות</span>
          <span>Made with ♥ in Israel</span>
        </div>
      </footer>

      {studioOpen && (
        <div className="modal-backdrop" onClick={() => setStudioOpen(false)} role="presentation">
          <div className="modal studio-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="studio-title" aria-modal="true">
            <div className="studio-head">
              <div className="studio-icon"><Tablet size={26} aria-hidden="true" /></div>
              <div style={{ flex: 1 }}>
                <h2 id="studio-title" style={{ margin: 0, fontFamily: 'var(--font-display)' }}>מסלול Studio + טאבלט</h2>
                <div className="muted" style={{ fontSize: '0.86rem' }}>50 ש"ח לחודש · 24 חודשי התחייבות</div>
              </div>
              <button type="button" className="auth-close" onClick={() => setStudioOpen(false)} aria-label="סגור">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <h3 style={{ marginTop: 18, marginBottom: 8 }}>מה כלול</h3>
            <ul className="studio-list">
              <li><Check size={14} className="icon-inline" />טאבלט 10" איכותי לעסק (במתנה)</li>
              <li><Check size={14} className="icon-inline" />כל הפיצ'רים של Pro — בלי הגבלה</li>
              <li><Check size={14} className="icon-inline" />לקוחות מקבלים תור באוויר באולם</li>
              <li><Check size={14} className="icon-inline" />עדיפות בתמיכה</li>
              <li><Check size={14} className="icon-inline" />30 ימי ניסיון חינם לפני שמתחיל החיוב</li>
            </ul>

            <h3 style={{ marginTop: 16, marginBottom: 8 }}>איך זה עובד</h3>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              עלות הטאבלט מתפרסת על פני 24 התשלומים החודשיים. במשך התקופה תקבל את כל
              הפיצ'רים והטאבלט נשאר אצלך לקבל. לאחר 24 חודשים — תשלום חודשי רגיל.
            </p>

            <div className="studio-warn">
              <AlertTriangle size={16} aria-hidden="true" style={{ color: '#b91c1c', flex: 'none', marginInlineEnd: 8 }} />
              <div>
                <strong>ביטול לפני תום ההתחייבות:</strong> דמי יציאה של ₪30 לכל חודש שנותר.
                <br />
                <span className="muted" style={{ fontSize: '0.82rem' }}>
                  זכות ביטול 14 יום (cooling-off) — קיימת. בעת ביטול במסגרת זו, הטאבלט יוחזר במצב מקורי
                  ללא תוספת חיוב; אם לא יוחזר או נגרם נזק — ייגבה מחירו המלא.
                  פגם בציוד או חוסר התאמה לתיאור — ביטול מלא ללא עלות.
                  <Link to="/refund" style={{ color: 'var(--gold-deep)', fontWeight: 600, display: 'block', marginTop: 4 }}>
                    פרטי המדיניות המלאים →
                  </Link>
                </span>
              </div>
            </div>

            <p className="muted" style={{ fontSize: '0.78rem', margin: '14px 0 0' }}>
              קודי הנחה אינם תקפים על מסלול Studio (כולל טאבלט).
            </p>

            <div className="studio-actions">
              <Link
                to="/auth?mode=signup"
                className="btn-gold"
                onClick={() => setStudioOpen(false)}
                style={{ width: '100%', textAlign: 'center', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Sparkles size={16} className="icon-inline" />התחל ניסיון 30 יום חינם
              </Link>
              <button type="button" className="btn-secondary" onClick={() => setStudioOpen(false)} style={{ width: '100%', marginTop: 8 }}>
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
