import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Mail, Lock, User, Eye, EyeOff, ChevronLeft, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { defaultWorkingHours, generateShortCode } from '../utils/slots';
import { initialSubscription } from '../utils/subscription';

// Dedicated auth page with three modes: signup / login / forgot.
// The mode is driven by the `?mode=` query string so the landing page
// can deep-link buttons to the right tab.
//
// On successful signup or login, we run the same barber-doc bootstrap
// HomePage used to do, then route to /onboarding (new) or /dashboard
// (existing) based on the `onboarded` flag.

const TRANSLATE_AUTH_ERROR = {
  'auth/invalid-email': 'כתובת מייל לא תקינה',
  'auth/user-disabled': 'החשבון מושבת',
  'auth/user-not-found': 'לא נמצא חשבון עם המייל הזה',
  'auth/wrong-password': 'סיסמה שגויה',
  'auth/invalid-credential': 'מייל או סיסמה שגויים',
  'auth/email-already-in-use': 'המייל כבר רשום במערכת — נסה/י להתחבר',
  'auth/weak-password': 'הסיסמה חלשה מדי (לפחות 6 תווים)',
  'auth/too-many-requests': 'יותר מדי ניסיונות. נסה/י שוב בעוד מספר דקות',
  'auth/network-request-failed': 'אין חיבור לאינטרנט',
  'auth/popup-closed-by-user': 'הכניסה בוטלה',
};

function humaniseError(err) {
  return TRANSLATE_AUTH_ERROR[err?.code] || err?.message || 'שגיאה לא ידועה';
}

export default function AuthPage() {
  const { user, loading, loginGoogle, loginEmail, signupEmail, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialMode = params.get('mode') || 'login';
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Bootstrap the barber doc + route to onboarding/dashboard once auth
  // resolves and we have a user. Runs whenever Firebase reports a user
  // (after popup, after email login, after page reload while signed in).
  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      try {
        const ref = doc(db, 'barbers', user.uid);
        const snap = await getDoc(ref);
        let onboarded = true;
        if (!snap.exists()) {
          const code = await pickUniqueShortCode();
          await setDoc(ref, {
            displayName: user.displayName || '',
            email: user.email || '',
            businessName: user.displayName ? user.displayName : 'העסק שלי',
            profession: null,
            shortCode: code,
            workingHours: defaultWorkingHours(),
            fcmTokens: [],
            services: [],
            addons: [],
            defaultDuration: 20,
            defaultPrice: 0,
            onboarded: false,
            subscription: initialSubscription(),
            createdAt: serverTimestamp(),
          });
          await setDoc(doc(db, 'shortCodes', code), { uid: user.uid });
          onboarded = false;
        } else {
          onboarded = snap.data().onboarded !== false;
        }
        navigate(onboarded ? '/dashboard' : '/onboarding', { replace: true });
      } catch (e) {
        console.error(e);
        setError(humaniseError(e));
      }
    })();
  }, [user, loading, navigate]);

  function switchMode(next) {
    setMode(next);
    setError('');
    setInfo('');
    setParams({ mode: next }, { replace: true });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (busy) return;

    if (mode === 'forgot') {
      if (!email) { setError('הזן/י את המייל שלך'); return; }
      setBusy(true);
      try {
        await resetPassword(email);
        setInfo('שלחנו לך מייל לאיפוס הסיסמה — בדוק/י את התיבה (גם בספאם).');
      } catch (err) {
        setError(humaniseError(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email || !password) { setError('יש להזין מייל וסיסמה'); return; }
    if (mode === 'signup' && password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        await signupEmail(email.trim(), password, name.trim() || null);
      } else {
        await loginEmail(email.trim(), password);
      }
    } catch (err) {
      setError(humaniseError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await loginGoogle();
    } catch (err) {
      setError(humaniseError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || user) return <div className="loading">טוען…</div>;

  const heading = {
    signup: 'הצטרפות חינם',
    login: 'כניסה לחשבון',
    forgot: 'איפוס סיסמה',
  }[mode];
  const subline = {
    signup: '30 ימי ניסיון. ללא התחייבות. אפשר לבטל בכל רגע.',
    login: 'ברוכ/ה השב/ה ל-Toron',
    forgot: 'נשלח לך קישור איפוס במייל',
  }[mode];

  return (
    <div className="auth-page">
      <Link to="/" className="auth-back" aria-label="חזרה לדף הבית">
        <ChevronLeft size={16} />חזרה
      </Link>

      <div className="auth-card">
        <div className="auth-brand">
          <img src="/logo-mark.png" alt="" aria-hidden="true" className="brand-mark-img brand-mark-lg" />
          <span className="brand-name">Toron</span>
        </div>

        <h1 className="auth-title">{heading}</h1>
        <p className="auth-sub">{subline}</p>

        {mode !== 'forgot' && (
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'auth-tab is-on' : 'auth-tab'}
              onClick={() => switchMode('login')}
            >
              כניסה
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'auth-tab is-on' : 'auth-tab'}
              onClick={() => switchMode('signup')}
            >
              הרשמה חדשה
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} noValidate>
          {mode === 'signup' && (
            <label className="auth-field">
              <span className="auth-label">שם העסק או שמך</span>
              <span className="auth-input-wrap">
                <User size={16} className="auth-input-icon" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="לדוגמה: ספרת ישראל / נטלי קוסמטיקה"
                  autoComplete="organization"
                  maxLength={80}
                />
              </span>
            </label>
          )}

          <label className="auth-field">
            <span className="auth-label">מייל</span>
            <span className="auth-input-wrap">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete={mode === 'signup' ? 'email' : 'username'}
                required
                dir="ltr"
              />
            </span>
          </label>

          {mode !== 'forgot' && (
            <label className="auth-field">
              <span className="auth-label">
                סיסמה
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="auth-link-inline"
                  >
                    שכחתי סיסמה
                  </button>
                )}
              </span>
              <span className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'לפחות 6 תווים' : '••••••'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  dir="ltr"
                />
                <button
                  type="button"
                  className="auth-eye"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
          )}

          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              <AlertCircle size={16} />{error}
            </div>
          )}
          {info && (
            <div className="auth-alert auth-alert-info" role="status">
              <CheckCircle2 size={16} />{info}
            </div>
          )}

          <button
            type="submit"
            className="btn-gold auth-submit"
            disabled={busy}
          >
            {busy ? 'רגע…' : (
              mode === 'signup' ? 'התחל ניסיון של 30 יום' :
              mode === 'login' ? 'כניסה' :
              'שלח קישור לאיפוס'
            )}
          </button>

          {mode === 'forgot' && (
            <button
              type="button"
              className="auth-link-back"
              onClick={() => switchMode('login')}
            >
              <ChevronLeft size={14} />חזרה לכניסה
            </button>
          )}
        </form>

        {mode !== 'forgot' && (
          <>
            <div className="auth-divider"><span>או</span></div>
            <button
              type="button"
              className="btn-secondary auth-google"
              onClick={handleGoogle}
              disabled={busy}
            >
              <GoogleG />המשך עם Google
            </button>
          </>
        )}

        {mode === 'signup' && (
          <p className="auth-fineprint">
            בלחיצה על "התחל ניסיון" מאשר/ת קריאה והסכמה ל
            {' '}<Link to="/terms">תקנון השירות</Link>
            {' '}ול<Link to="/privacy">מדיניות הפרטיות</Link>.
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M16.51 8.18c0-.61-.05-1.17-.16-1.71H9v3.4h4.2c-.18 1-.74 1.86-1.58 2.43v2h2.55c1.5-1.38 2.34-3.42 2.34-5.78z" fill="#4285F4"/>
      <path d="M9 17c2.16 0 3.97-.72 5.29-1.94l-2.55-2c-.72.49-1.65.78-2.74.78-2.1 0-3.88-1.42-4.51-3.32H1.86v2.06A8 8 0 0 0 9 17z" fill="#34A853"/>
      <path d="M4.49 10.52a4.78 4.78 0 0 1 0-3.04V5.42H1.86a8 8 0 0 0 0 7.16l2.63-2.06z" fill="#FBBC04"/>
      <path d="M9 4.36c1.18 0 2.24.4 3.07 1.2l2.27-2.27A8 8 0 0 0 1.86 5.42L4.49 7.48C5.13 5.58 6.9 4.36 9 4.36z" fill="#EA4335"/>
    </svg>
  );
}

async function pickUniqueShortCode() {
  for (let i = 0; i < 5; i++) {
    const code = generateShortCode();
    const snap = await getDoc(doc(db, 'shortCodes', code));
    if (!snap.exists()) return code;
  }
  return generateShortCode() + Date.now().toString(36).slice(-2);
}
