import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, Sparkles, Tag, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSubscription } from '../hooks/useSubscription';
import { PRICE_NIS, TRIAL_DAYS } from '../utils/subscription';

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

  async function startCheckout() {
    if (!user) return;
    setBusy(true);
    setMsg('');
    try {
      const idToken = await user.getIdToken();
      // Forward ?test=1 from the page URL to the worker → ₪1 instead of ₪50
      const isTest = new URLSearchParams(window.location.search).get('test') === '1';
      const endpoint = isTest ? '/api/create-payment-link?test=1' : '/api/create-payment-link';
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

  async function cancelSubscription() {
    if (!confirm('לבטל את המנוי? תשמור על גישה עד סוף תקופת התשלום הנוכחית, ולא תחויב יותר.')) return;
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
      setMsg(`✓ המנוי בוטל. גישה עד ${accessUntil}.`);
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
          <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
            תשמור על גישה עד סוף תקופת התשלום הנוכחית. אחרי כן האפליקציה תינעל ולא תחויב יותר.
          </p>
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

      <div className="card card-feature">
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700 }}>Pro</h2>
        <p className="muted" style={{ margin: '4px 0 16px', fontSize: '0.9rem' }}>הכל פתוח. בלי מגבלות.</p>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 18 }}>
          <span style={{ fontSize: '3rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--gold)', lineHeight: 1 }}>
            ₪{PRICE_NIS}
          </span>
          <span className="muted" style={{ fontSize: '1rem' }}>/חודש</span>
        </div>

        <ul className="pricing-features">
          <li><Check size={16} />יומן בלתי מוגבל</li>
          <li><Check size={16} />הזמנות אונליין מלקוחות (לינק ציבורי)</li>
          <li><Check size={16} />תזכורות וואטסאפ אוטומטיות</li>
          <li><Check size={16} />סוכן חכם לסידור היום</li>
          <li><Check size={16} />ביקורות בגוגל אוטומטיות</li>
          <li><Check size={16} />דוחות + סטטיסטיקות</li>
          <li><Check size={16} />Push notifications לטלפון</li>
          <li><Check size={16} />ביטול בכל זמן</li>
        </ul>

        <button
          className="btn-gold"
          style={{ width: '100%', fontSize: '1.05rem', padding: '15px' }}
          onClick={startCheckout}
          disabled={busy || (access.granted && access.reason !== 'trial' && access.reason !== 'no-sub' && access.reason !== 'expired')}
        >
          <Sparkles size={18} className="icon-inline" />
          {busy ? 'פותח תשלום…' :
            (access.reason === 'trial' || access.reason === 'no-sub' || access.reason === 'expired'
              ? `התחל חיוב — ₪${PRICE_NIS}/חודש`
              : access.reason === 'active'
                ? 'מנוי פעיל'
                : `שדרג ל-Pro — ₪${PRICE_NIS}/חודש`)}
        </button>
        <p className="muted text-center" style={{ fontSize: '0.78rem', marginTop: 10, marginBottom: 0 }}>
          חיוב חודשי. ביטול בכל זמן מהדף הזה. בלי התחייבות.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Tag size={18} className="icon-inline" />יש לך קוד הנחה?</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
          קוד מקנה תקופת חינם נוספת על המסלול שלך.
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

      <div className="card" style={{ background: 'var(--surface-2)' }}>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6 }}>
          <strong>טריאל ראשון:</strong> כל ספר/ית חדש/ה מקבל/ת {TRIAL_DAYS} ימי שימוש מלאים בחינם, ללא צורך בכרטיס אשראי. אחרי תקופת הניסיון, חיוב חודשי דרך Tranzila עם חשבונית-מס אוטומטית.
        </p>
      </div>
    </div>
  );
}
