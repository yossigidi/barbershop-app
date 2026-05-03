import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { defaultWorkingHours, generateShortCode } from '../utils/slots';

export default function HomePage() {
  const { user, loading, loginGoogle } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      try {
        const ref = doc(db, 'barbers', user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          // create barber profile + short code
          const code = await pickUniqueShortCode();
          await setDoc(ref, {
            displayName: user.displayName || '',
            email: user.email || '',
            businessName: user.displayName ? `${user.displayName} — ספרות` : 'הספרות שלי',
            shortCode: code,
            workingHours: defaultWorkingHours(),
            fcmTokens: [],
            createdAt: serverTimestamp(),
          });
          await setDoc(doc(db, 'shortCodes', code), { uid: user.uid });
        }
        navigate('/dashboard', { replace: true });
      } catch (e) {
        console.error(e);
        setError(e.message);
      }
    })();
  }, [user, loading, navigate]);

  async function handleLogin() {
    setBusy(true);
    setError('');
    try {
      await loginGoogle();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="loading">טוען…</div>;

  return (
    <div className="app">
      <div className="header">
        <h1>✂️ Barbershop</h1>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>שלום, ספר 👋</h2>
        <p className="muted">מערכת ניהול תורים פשוטה. כניסה עם חשבון Google.</p>
        <div className="spacer" />
        <button className="btn-primary" onClick={handleLogin} disabled={busy} style={{ width: '100%' }}>
          {busy ? 'מתחבר…' : 'התחבר עם Google'}
        </button>
        {error && <p className="text-danger" style={{ marginTop: 12 }}>{error}</p>}
      </div>
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          לקוחות לא מתחברים כאן — הם מקבלים מהספר שלהם לינק קצר ייעודי.
        </p>
      </div>
    </div>
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
