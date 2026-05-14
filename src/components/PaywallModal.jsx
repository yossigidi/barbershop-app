import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PRICE_NIS } from '../utils/subscription';

// Full-screen blocker shown when access is denied (trial expired,
// payment failed, etc). The user can either subscribe or log out.
export default function PaywallModal({ access }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const headline = access.reason === 'no-sub'
    ? 'הגיע הזמן לבחור מסלול'
    : access.reason === 'cancelled'
      ? 'המנוי בוטל'
      : access.reason === 'needs-payment'
        ? 'נשאר רק להשלים את ההרשמה'
        : 'תקופת הניסיון הסתיימה';
  const sub = access.reason === 'needs-payment'
    ? 'בחרת במסלול Studio עם טאבלט. כדי להפעיל את החשבון — חתום/י על ההסכם והשלם/י את התשלום הראשון.'
    : access.reason === 'no-sub'
      ? 'התחבר/י למסלול חודשי כדי להמשיך לנהל את היומן ולקבל תורים מלקוחות.'
      : 'כדי להמשיך לנהל את היומן, להוסיף תורים ולשלוח תזכורות — צריך להירשם למסלול חודשי.';

  return (
    <div className="paywall-fullscreen">
      <div className="paywall-card">
        <div className="paywall-icon">
          <Lock size={36} strokeWidth={1.75} />
        </div>
        <h1 className="paywall-headline">{headline}</h1>
        <p className="paywall-sub">{sub}</p>

        <div className="paywall-plan">
          <div className="paywall-plan-name">
            <Sparkles size={18} className="icon-inline" />Pro
          </div>
          <div className="paywall-plan-price">
            <span className="paywall-price-amount">₪{PRICE_NIS}</span>
            <span className="paywall-price-cycle">/חודש</span>
          </div>
          <ul className="paywall-features">
            <li>יומן בלתי מוגבל</li>
            <li>הזמנות אונליין מלקוחות</li>
            <li>תזכורות וואטסאפ אוטומטיות</li>
            <li>סוכן חכם לסידור היום</li>
            <li>דוחות + סטטיסטיקות</li>
            <li>גלריה ועמוד עסק ציבורי</li>
          </ul>
        </div>

        <button
          className="btn-primary"
          style={{ width: '100%', marginBottom: 8 }}
          onClick={() => navigate('/pricing')}
        >
          המשך לתשלום
        </button>
        <button
          className="btn-secondary"
          style={{ width: '100%' }}
          onClick={async () => { await logout(); navigate('/', { replace: true }); }}
        >
          <ArrowLeft size={16} className="icon-inline" />יציאה
        </button>
      </div>
    </div>
  );
}
