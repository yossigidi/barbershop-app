import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, Sparkles, Tag } from 'lucide-react';
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

  function startCheckout() {
    // Stage 2 — wire to Cloudflare Worker /api/create-payment-link
    // which creates a Tranzila iframe URL and redirects.
    alert('התשלום ייפתח בקרוב — מתחברים ל-Tranzila.');
  }

  function applyPromo() {
    // Stage 2 — Worker validates code + extends trial via Admin SDK
    alert('קודי הנחה ייתאפשרו בקרוב.');
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
            {access.reason === 'active' && `המנוי שלך פעיל. החיוב הבא בעוד ${access.daysLeft} ימים.`}
            {access.reason === 'cancelled-grace' && `המנוי בוטל. עוד ${access.daysLeft} ימי גישה ואז ייסגר.`}
          </p>
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
          disabled={access.granted && access.reason !== 'trial' && access.reason !== 'no-sub'}
        >
          <Sparkles size={18} className="icon-inline" />
          {access.reason === 'trial' || access.reason === 'no-sub'
            ? `התחל חיוב — ₪${PRICE_NIS}/חודש`
            : access.reason === 'active'
              ? 'מנוי פעיל'
              : `שדרג ל-Pro — ₪${PRICE_NIS}/חודש`}
        </button>
        <p className="muted text-center" style={{ fontSize: '0.78rem', marginTop: 10, marginBottom: 0 }}>
          חיוב חודשי. ביטול בכל זמן בהגדרות. בלי התחייבות.
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
            disabled={!promo.trim()}
          >
            הפעל
          </button>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--surface-2)' }}>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6 }}>
          <strong>טריאל ראשון:</strong> כל ספר/ית חדש/ה מקבל/ת {TRIAL_DAYS} ימי שימוש מלאים בחינם, ללא צורך בכרטיס אשראי. אחרי תקופת הניסיון, חיוב חודשי דרך Tranzila עם חשבונית-מס אוטומטית.
        </p>
      </div>
    </div>
  );
}
