import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [haircutPrice, setHaircutPrice] = useState('');
  const [addons, setAddons] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const snap = await getDoc(doc(db, 'barbers', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.onboarded === true) {
          navigate('/dashboard', { replace: true });
          return;
        }
        setBusinessName(data.businessName || '');
        setHaircutPrice(String(data.defaultPrice || ''));
        setAddons(Array.isArray(data.addons) ? data.addons : []);
      }
      setLoaded(true);
    })();
  }, [user, navigate]);

  function setAddonPrice(id, price) {
    setAddons((list) => list.map((a) => (a.id === id ? { ...a, price: Number(price) || 0 } : a)));
  }

  async function finish() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'barbers', user.uid), {
        businessName: businessName.trim() || 'הספרות שלי',
        defaultPrice: Number(haircutPrice) || 0,
        addons,
        onboarded: true,
      });
      navigate('/dashboard', { replace: true });
    } catch (e) {
      alert('שגיאה: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="loading">טוען…</div>;

  return (
    <div className="app">
      <div className="header">
        <h1>👋 ברוך הבא!</h1>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>שלב 1 — שם העסק</h3>
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="הספרות של דני"
        />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>שלב 2 — מחיר תספורת</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          המחיר ברירת המחדל לתספורת רגילה (20 דק׳). אפשר תמיד להוסיף שירותים נוספים בהגדרות.
        </p>
        <div className="field">
          <label>מחיר ₪</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={haircutPrice}
            onChange={(e) => setHaircutPrice(e.target.value)}
            placeholder="60"
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>שלב 3 — מחירי תוספות</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          הלקוח יוכל להוסיף תוספות אלה על התור שלו. אם לא רלוונטי — השאר ריק (₪0) ואפשר למחוק בהגדרות.
        </p>
        {addons.map((a) => (
          <div key={a.id} className="field">
            <label>
              {a.name}
              <span className="muted" style={{ fontSize: '0.85rem', marginRight: 6 }}>
                (+{a.duration} דק׳)
              </span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={a.price || ''}
              onChange={(e) => setAddonPrice(a.id, e.target.value)}
              placeholder="₪"
            />
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={finish} disabled={saving} style={{ width: '100%' }}>
        {saving ? 'שומר…' : '✓ סיום והתחלה'}
      </button>
      <div className="spacer" />
      <p className="muted text-center" style={{ fontSize: '0.85rem' }}>
        תוכל לערוך כל הגדרה גם אחר כך מהדשבורד.
      </p>
    </div>
  );
}
