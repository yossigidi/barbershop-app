import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, ArrowLeft, Sparkles, Tag, XCircle, Gift, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSubscription } from '../hooks/useSubscription';
import { PRICE_NIS, TRIAL_DAYS } from '../utils/subscription';
import AccessibleModal from '../components/AccessibleModal.jsx';
import StudioAgreementModal from '../components/StudioAgreementModal.jsx';

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [barber, setBarber] = useState(null);
  const [promo, setPromo] = useState('');

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'barbers', user.uid), (snap) => {
      if (snap.exists()) setBarber({ id: snap.id, ...snap.data() });
    });
  }, [user]);

  const access = useSubscription(barber);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showCommitmentTerms, setShowCommitmentTerms] = useState(false);
  const [showCancelStudio, setShowCancelStudio] = useState(false);
  const [showCancelMonthly, setShowCancelMonthly] = useState(false);
  const [showStudioAgreement, setShowStudioAgreement] = useState(false);

  // Studio checkout is gated by a signed commitment agreement. If the
  // barber has already signed (studioAgreement on their doc) go straight
  // to Tranzila; otherwise open the signing modal first.
  function beginStudioCheckout() {
    if (barber?.studioAgreement?.signatureDataUrl) {
      startCheckout('studio');
    } else {
      setShowStudioAgreement(true);
    }
  }

  // Live exit-fee calculation for committed (Studio) plans
  const sub = barber?.subscription || {};
  const isStudioActive = sub.plan === 'studio-24' && sub.status === 'active';
  const studioExit = useMemo(() => {
    if (!isStudioActive) return null;
    const commitEnd = sub.commitmentEndsAt?.toDate
      ? sub.commitmentEndsAt.toDate()
      : (sub.commitmentEndsAt ? new Date(sub.commitmentEndsAt) : null);
    if (!commitEnd) return null;
    const monthsLeft = Math.max(0, Math.ceil((commitEnd - new Date()) / (30 * 86_400_000)));
    const perMonth = Number(sub.exitFeePerMonth) || 30;
    return { monthsLeft, perMonth, fee: monthsLeft * perMonth, commitEnd };
  }, [sub, isStudioActive]);

  async function startCheckout(plan = 'monthly') {
    if (!user) return;
    setBusy(true);
    setMsg('');
    try {
      const idToken = await user.getIdToken();
      const isTest = new URLSearchParams(window.location.search).get('test') === '1';
      const params = new URLSearchParams();
      if (isTest) params.set('test', '1');
      if (plan === 'studio') params.set('plan', 'studio');
      const queryString = params.toString();
      const endpoint = '/api/create-payment-link' + (queryString ? `?${queryString}` : '');
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || 'נכשל ליצור קישור תשלום');
      window.location.href = data.url;
    } catch (e) {
      setMsg('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  function cancelSubscription() {
    // Studio plan goes through the dedicated exit-fee modal — see
    // confirmCancelStudio. Flexible monthly opens its own confirmation modal
    // (replacing the old native confirm() which iOS / VoiceOver users couldn't
    // reliably reach).
    if (sub.plan === 'studio-24') {
      setShowCancelStudio(true);
      return;
    }
    setShowCancelMonthly(true);
  }

  async function confirmCancelMonthly() {
    if (!user) return;
    setBusy(true);
    setMsg('');
    try {
      const idToken = await user.getIdToken();
      const r = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'הביטול נכשל');
      const accessUntil = data.accessUntil ? new Date(data.accessUntil).toLocaleDateString('he-IL') : '';
      setMsg(`המנוי בוטל. גישה עד ${accessUntil}.`);
      setShowCancelMonthly(false);
    } catch (e) {
      setMsg('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancelStudio() {
    if (!user || !studioExit) return;
    setBusy(true);
    setMsg('');
    try {
      const idToken = await user.getIdToken();
      const r = await fetch('/api/cancel-studio', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'הביטול נכשל');
      setMsg(`✓ המנוי בוטל. חויבת בסך ₪${data.exitFeePaid} דמי יציאה.`);
      setShowCancelStudio(false);
    } catch (e) {
      setMsg('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyPromo() {
    const code = (promo || '').trim().toUpperCase();
    if (!code || !user) return;
    setBusy(true);
    setMsg('');
    try {
      const idToken = await user.getIdToken();
      const r = await fetch('/api/redeem-promo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'הקוד לא נקלט');
      setMsg(`✓ נוספו ${data.daysAdded} ימי שימוש בחינם!`);
      setPromo('');
    } catch (e) {
      setMsg('שגיאה: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="header">
        <h1><Sparkles size={20} className="icon-inline" />שדרוג למסלול Pro</h1>
        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={14} className="icon-inline" />חזור
        </button>
      </div>

      {barber && access.granted && (
        <div className="card" style={{ background: 'rgba(22, 163, 74, 0.06)', border: '1px solid var(--success)' }}>
          <strong style={{ color: 'var(--success)' }}>
            <Check size={16} className="icon-inline" />יש לך גישה פעילה
          </strong>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            {access.reason === 'grandfathered' && 'את/ה משתמש/ת ותיק/ה — הגישה חינם לתמיד 🎁'}
            {access.reason === 'trial' && `נותרו ${access.daysLeft} ימים בתקופת הניסיון.`}
            {access.reason === 'active' && (() => {
              const sub = barber?.subscription || {};
              const periodEnd = sub.currentPeriodEnd?.toDate
                ? sub.currentPeriodEnd.toDate()
                : (sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null);
              const dateStr = periodEnd?.toLocaleDateString('he-IL') || '';
              return (
                <>
                  המנוי שלך פעיל. החיוב הבא: <strong>{dateStr}</strong>
                  {sub.last4 && <> (כרטיס {sub.last4})</>}
                </>
              );
            })()}
            {access.reason === 'cancelled-pending' && (() => {
              const sub = barber?.subscription || {};
              const periodEnd = sub.currentPeriodEnd?.toDate
                ? sub.currentPeriodEnd.toDate()
                : (sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null);
              return <>המנוי בוטל. גישה עד <strong>{periodEnd?.toLocaleDateString('he-IL')}</strong>.</>;
            })()}
            {access.reason === 'cancelled-grace' && `המנוי בוטל. עוד ${access.daysLeft} ימי גישה ואז ייסגר.`}
          </p>
        </div>
      )}

      {/* Cancel subscription — visible only when actively paying */}
      {access.reason === 'active' && (
        <div className="card" style={{ borderColor: 'rgba(220, 38, 38, 0.20)' }}>
          <h3 style={{ marginTop: 0 }}>ביטול מנוי</h3>
          {sub.plan === 'studio-24' && studioExit ? (
            <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
              המסלול שלך כולל התחייבות לשנתיים. ביטול מוקדם כרוך בדמי יציאה
              של <strong>₪{studioExit.fee}</strong> ({studioExit.monthsLeft} חודשים נותרו × ₪{studioExit.perMonth}).
            </p>
          ) : (
            <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
              תשמור על גישה עד סוף תקופת התשלום הנוכחית. אחרי כן האפליקציה תינעל ולא תחויב יותר.
            </p>
          )}
          <button
            className="btn-danger"
            style={{ width: '100%' }}
            onClick={cancelSubscription}
            disabled={busy}
          >
            <XCircle size={16} className="icon-inline" />{busy ? 'מבטל…' : 'ביטול מנוי'}
          </button>
        </div>
      )}

      <div className="pricing-grid">

        {/* Pro Monthly — flexible */}
        <div className="card pricing-plan-card">
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700 }}>Pro חודשי</h2>
          <p className="muted" style={{ margin: '4px 0 16px', fontSize: '0.9rem' }}>גמיש. בלי התחייבות.</p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 18 }}>
            <span style={{ fontSize: '2.6rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--gold)', lineHeight: 1 }}>
              ₪{PRICE_NIS}
            </span>
            <span className="muted" style={{ fontSize: '1rem' }}>/חודש</span>
          </div>

          <ul className="pricing-features">
            <li><Check size={16} />יומן בלתי מוגבל</li>
            <li><Check size={16} />הזמנות אונליין מלקוחות</li>
            <li><Check size={16} />תזכורות וואטסאפ</li>
            <li><Check size={16} />סוכן חכם</li>
            <li><Check size={16} />דוחות מלאים</li>
            <li><Check size={16} />ביטול בכל זמן</li>
          </ul>

          <button
            className="btn-secondary"
            style={{ width: '100%', fontSize: '0.98rem', padding: '13px' }}
            onClick={() => startCheckout('monthly')}
            disabled={busy || (access.granted && access.reason !== 'trial' && access.reason !== 'no-sub' && access.reason !== 'expired')}
          >
            {busy ? 'פותח…' :
              (access.reason === 'active'
                ? 'מנוי פעיל'
                : `התחל — ₪${PRICE_NIS}/חודש`)}
          </button>
          <p className="muted text-center" style={{ fontSize: '0.74rem', marginTop: 8, marginBottom: 0 }}>
            ביטול חופשי. בלי טאבלט.
          </p>
        </div>

        {/* Studio — committed + tablet */}
        <div className="card pricing-plan-card pricing-plan-card--featured">
          <div className="pricing-badge">🎁 הכי שווה</div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700 }}>Studio</h2>
          <p className="muted" style={{ margin: '4px 0 16px', fontSize: '0.9rem' }}>התחייבות לשנתיים</p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: '2.6rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--gold)', lineHeight: 1 }}>
              ₪{PRICE_NIS}
            </span>
            <span className="muted" style={{ fontSize: '1rem' }}>/חודש</span>
          </div>
          <p className="muted" style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--gold-deep)' }}>
            <Gift size={14} className="icon-inline" />כולל טאבלט מקצועי במתנה
          </p>

          <ul className="pricing-features">
            <li><Check size={16} />כל מה שיש ב-Pro</li>
            <li><Gift size={16} style={{ color: 'var(--gold)' }} />טאבלט 10/11 אינץ׳ + סטנד</li>
            <li><Gift size={16} style={{ color: 'var(--gold)' }} />משלוח חינם</li>
            <li><Gift size={16} style={{ color: 'var(--gold)' }} />הגדרה מראש</li>
            <li><Calendar size={16} />התחייבות לשנתיים</li>
          </ul>

          <button
            className="btn-gold"
            style={{ width: '100%', fontSize: '1.02rem', padding: '14px' }}
            onClick={beginStudioCheckout}
            disabled={busy || (access.granted && access.reason === 'active')}
          >
            <Sparkles size={18} className="icon-inline" />
            {busy ? 'פותח…' :
              (access.reason === 'active' && access.status === 'studio-24'
                ? 'מנוי פעיל'
                : 'הזמן את החבילה')}
          </button>
          <p className="muted text-center" style={{ fontSize: '0.74rem', marginTop: 8, marginBottom: 0 }}>
            <button
              type="button"
              className="link-button"
              onClick={() => setShowCommitmentTerms(true)}
            >
              פרטי התחייבות »
            </button>
          </p>
        </div>

      </div>

      {sub.plan !== 'studio-24' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}><Tag size={18} className="icon-inline" />יש לך קוד הנחה?</h3>
          <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
            קוד מקנה תקופת חינם נוספת על המסלול החודשי. לא תקף על מסלול Studio (כולל טאבלט).
          </p>
          <div className="row" style={{ gap: 8 }}>
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value.toUpperCase())}
              placeholder="FREE2026"
              style={{ flex: 1, fontFamily: 'ui-monospace, monospace', textAlign: 'center', letterSpacing: '0.1em' }}
            />
            <button
              className="btn-secondary"
              style={{ flex: 'none', padding: '12px 20px' }}
              onClick={applyPromo}
              disabled={!promo.trim() || busy}
            >
              {busy ? '…' : 'הפעל'}
            </button>
          </div>
          {msg && (
            <p style={{
              marginTop: 10,
              fontSize: '0.88rem',
              color: msg.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
              fontWeight: 600,
            }}>{msg}</p>
          )}
        </div>
      )}

      <div className="card" style={{ background: 'var(--surface-2)' }}>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6 }}>
          <strong>טריאל ראשון:</strong> כל בעל/ת מקצוע חדש/ה מקבל/ת {TRIAL_DAYS} ימי שימוש מלאים בחינם, ללא צורך בכרטיס אשראי. אחרי תקופת הניסיון, חיוב חודשי דרך Tranzila עם חשבונית-מס אוטומטית.
        </p>
      </div>

      <div className="legal-footer">
        <Link to="/terms">תקנון השירות</Link>
        <span aria-hidden="true">·</span>
        <Link to="/refund">תקנון ביטולים והחזרים</Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy">מדיניות פרטיות</Link>
        <span aria-hidden="true">·</span>
        <Link to="/accessibility">נגישות</Link>
      </div>

      <StudioAgreementModal
        open={showStudioAgreement}
        onClose={() => setShowStudioAgreement(false)}
        user={user}
        onSigned={() => { setShowStudioAgreement(false); startCheckout('studio'); }}
      />

      <AccessibleModal
        open={showCancelStudio && !!studioExit}
        onClose={() => !busy && setShowCancelStudio(false)}
        titleId="cancel-studio-title"
        maxWidth={460}
        showCloseButton={false}
      >
        <h2 id="cancel-studio-title">
          <XCircle size={20} className="icon-inline" style={{ color: 'var(--danger)' }} aria-hidden="true" />
          ביטול מנוי Studio
        </h2>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.92rem' }}>
          המסלול שלך הוא בהתחייבות לשנתיים. כדי לבטל לפני תום ההתחייבות, עליך
          לשלם דמי יציאה.
        </p>

        {studioExit && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, margin: '14px 0' }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="muted">חודשים שנותרו עד תום ההתחייבות:</span>
              <strong style={{ flex: 'none', textAlign: 'end' }}>{studioExit.monthsLeft}</strong>
            </div>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="muted">דמי יציאה לחודש:</span>
              <strong style={{ flex: 'none', textAlign: 'end' }}>₪{studioExit.perMonth}</strong>
            </div>
            <div className="row" style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <strong>סה"כ לתשלום:</strong>
              <strong style={{ flex: 'none', textAlign: 'end', fontSize: '1.4rem', color: 'var(--danger)', fontFamily: 'var(--font-display)' }}>
                ₪{studioExit.fee}
              </strong>
            </div>
          </div>
        )}

        <p className="muted" style={{ fontSize: '0.82rem', lineHeight: 1.5, margin: '12px 0' }}>
          בלחיצה על "אישור" — נחייב את הכרטיס השמור שלך ב-₪{studioExit?.fee}, נסיים את החיובים החודשיים, וזה ייכנס לתוקף מיידית. הטאבלט נשאר אצלך.
        </p>

        {msg && (
          <p role="status" aria-live="polite" style={{ fontSize: '0.88rem', color: msg.startsWith('המנוי') ? 'var(--success)' : 'var(--danger)', fontWeight: 600, margin: '8px 0' }}>{msg}</p>
        )}

        <div className="spacer" />
        <button
          className="btn-danger"
          onClick={confirmCancelStudio}
          disabled={busy}
          style={{ width: '100%', marginBottom: 8 }}
        >
          {busy ? 'מחייב…' : `אישור — חייב כרטיס ב-₪${studioExit?.fee} ובטל`}
        </button>
        <button
          className="btn-secondary"
          onClick={() => setShowCancelStudio(false)}
          disabled={busy}
          style={{ width: '100%' }}
        >
          חזור
        </button>
      </AccessibleModal>

      <AccessibleModal
        open={showCancelMonthly}
        onClose={() => !busy && setShowCancelMonthly(false)}
        titleId="cancel-monthly-title"
        maxWidth={460}
        showCloseButton={false}
      >
        <h2 id="cancel-monthly-title">
          <XCircle size={20} className="icon-inline" style={{ color: 'var(--danger)' }} aria-hidden="true" />
          ביטול מנוי
        </h2>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
          לבטל את המנוי? תשמור על גישה עד סוף תקופת התשלום הנוכחית, ולא תחויב יותר.
        </p>
        {msg && (
          <p role="status" aria-live="polite" style={{ fontSize: '0.88rem', color: msg.startsWith('המנוי') ? 'var(--success)' : 'var(--danger)', fontWeight: 600, margin: '8px 0' }}>{msg}</p>
        )}
        <div className="spacer" />
        <button
          className="btn-danger"
          onClick={confirmCancelMonthly}
          disabled={busy}
          style={{ width: '100%', marginBottom: 8 }}
        >
          {busy ? 'מבטל…' : 'אישור — בטל מנוי'}
        </button>
        <button
          className="btn-secondary"
          onClick={() => setShowCancelMonthly(false)}
          disabled={busy}
          style={{ width: '100%' }}
        >
          חזור
        </button>
      </AccessibleModal>

      <AccessibleModal
        open={showCommitmentTerms}
        onClose={() => setShowCommitmentTerms(false)}
        titleId="commitment-title"
        maxWidth={460}
        showCloseButton={false}
      >
        <h2 id="commitment-title">
          <Calendar size={20} className="icon-inline" aria-hidden="true" />
          פרטי התחייבות לשנתיים
        </h2>
        <div style={{ fontSize: '0.92rem', lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 12px' }}>
            המסלול כולל טאבלט מקצועי במתנה (10/11 אינץ׳, סטנד והגדרה ראשונית).
            התחייבות לתשלום של ₪50/חודש למשך 24 חודשים.
          </p>
          <p style={{ margin: '0 0 12px' }}>
            <strong>סך התחייבות:</strong> ₪1,200 (פטור ממע"מ).
          </p>
          <p style={{ margin: '0 0 12px' }}>
            <strong>ביטול:</strong> ניתן בכל זמן בתשלום דמי יציאה — ₪30 לכל
            חודש שנותר עד תום ההתחייבות. הטאבלט נשאר אצלך.
          </p>
          <p style={{ margin: '0 0 12px' }}>
            <strong>תקופת צינון:</strong> 14 יום ממועד הקבלה (החזר מלא בכפוף
            להחזרת הטאבלט באריזה מקורית, ללא שימוש).
          </p>
          <p style={{ margin: '0 0 12px' }}>
            <strong>אחרי 24 חודשים:</strong> ממשיך ב-₪50/חודש ללא התחייבות,
            ניתן לבטל בכל זמן ללא קנס.
          </p>
          <p className="muted" style={{ fontSize: '0.82rem', margin: '14px 0 0' }}>
            התקנון המלא ב-
            <button
              type="button"
              className="link-button"
              onClick={() => navigate('/terms')}
            >
              עמוד התקנון
            </button>
            .
          </p>
        </div>
        <div className="spacer" />
        <button className="btn-secondary" onClick={() => setShowCommitmentTerms(false)} style={{ width: '100%' }}>
          הבנתי
        </button>
      </AccessibleModal>
    </div>
  );
}
