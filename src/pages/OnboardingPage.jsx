import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { DAYS_OF_WEEK, DAY_LABELS_HE, defaultWorkingHours } from '../utils/slots';

// Suggested catalog of services and add-ons. Barber toggles which apply
// and sets prices. Durations are pre-set but editable.
const SERVICE_DURATIONS = [20, 40, 60, 80, 100, 120];
const ADDON_DURATIONS = [0, 5, 10, 15, 20, 30];

const STANDARD_SERVICES = [
  { id: 'haircut', name: 'תספורת רגילה', duration: 20 },
  { id: 'haircut_beard', name: 'תספורת + זקן', duration: 40 },
  { id: 'kids', name: 'תספורת ילדים', duration: 20 },
  { id: 'premium', name: 'שירות פרימיום', duration: 60 },
  { id: 'laser', name: 'טיפולי לייזר', duration: 60 },
];
const STANDARD_ADDONS = [
  { id: 'beard', name: 'עיצוב זקן', duration: 10 },
  { id: 'nose', name: 'שעווה באף', duration: 5 },
  { id: 'ears', name: 'שעווה באוזניים', duration: 5 },
  { id: 'eyebrows', name: 'עיצוב גבות', duration: 10 },
];

function ServiceCard({ item, options, onToggle, onPrice, onDuration }) {
  return (
    <div className={`onb-card ${item.offered ? 'active' : ''}`}>
      <label className="onb-toggle">
        <input type="checkbox" checked={item.offered} onChange={() => onToggle(item.id)} />
        <span className="onb-name">{item.name}</span>
      </label>
      {item.offered && (
        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label className="muted" style={{ fontSize: '0.85rem' }}>אורך</label>
            <select value={item.duration} onChange={(e) => onDuration(item.id, e.target.value)}>
              {options.map((d) => <option key={d} value={d}>{d === 0 ? 'ללא' : `${d} דק׳`}</option>)}
            </select>
          </div>
          <div>
            <label className="muted" style={{ fontSize: '0.85rem' }}>מחיר ₪</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={item.price || ''}
              onChange={(e) => onPrice(item.id, e.target.value)}
              placeholder="₪"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [hours, setHours] = useState(defaultWorkingHours());
  const [services, setServices] = useState(
    STANDARD_SERVICES.map((s) => ({ ...s, offered: false, price: 0 })),
  );
  const [addons, setAddons] = useState(
    STANDARD_ADDONS.map((a) => ({ ...a, offered: false, price: 0 })),
  );
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
        if (data.workingHours) {
          setHours({ ...defaultWorkingHours(), ...data.workingHours });
        }
        // Hydrate from any pre-seeded services/addons (carry-over from old signup)
        if (Array.isArray(data.services) && data.services.length) {
          setServices((cur) =>
            cur.map((c) => {
              const m = data.services.find((s) => s.id === c.id);
              return m ? { ...c, offered: true, price: m.price || 0, duration: m.duration || c.duration } : c;
            }),
          );
        }
        if (Array.isArray(data.addons) && data.addons.length) {
          setAddons((cur) =>
            cur.map((c) => {
              const m = data.addons.find((a) => a.id === c.id);
              return m ? { ...c, offered: true, price: m.price || 0, duration: m.duration || c.duration } : c;
            }),
          );
        }
      }
      setLoaded(true);
    })();
  }, [user, navigate]);

  function toggleDay(day) {
    setHours((h) => ({ ...h, [day]: { ...h[day], active: !h[day].active } }));
  }
  function setDayTime(day, key, val) {
    setHours((h) => ({ ...h, [day]: { ...h[day], [key]: val } }));
  }

  function toggleSvc(id) {
    setServices((list) => list.map((s) => (s.id === id ? { ...s, offered: !s.offered } : s)));
  }
  function priceSvc(id, p) {
    setServices((list) => list.map((s) => (s.id === id ? { ...s, price: Number(p) || 0 } : s)));
  }
  function durationSvc(id, d) {
    setServices((list) => list.map((s) => (s.id === id ? { ...s, duration: Number(d) || 20 } : s)));
  }
  function toggleAdd(id) {
    setAddons((list) => list.map((a) => (a.id === id ? { ...a, offered: !a.offered } : a)));
  }
  function priceAdd(id, p) {
    setAddons((list) => list.map((a) => (a.id === id ? { ...a, price: Number(p) || 0 } : a)));
  }
  function durationAdd(id, d) {
    setAddons((list) => list.map((a) => (a.id === id ? { ...a, duration: Number(d) || 0 } : a)));
  }

  async function finish() {
    const offeredSvc = services
      .filter((s) => s.offered)
      .map((s) => ({ id: s.id, name: s.name, duration: s.duration, price: s.price }));
    const offeredAdd = addons
      .filter((a) => a.offered)
      .map((a) => ({ id: a.id, name: a.name, duration: a.duration, price: a.price }));

    if (offeredSvc.length === 0) {
      if (!confirm('לא הגדרת אף שירות. תוכל להוסיף אחר כך בהגדרות. להמשיך?')) return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'barbers', user.uid), {
        businessName: businessName.trim() || 'הספרות שלי',
        workingHours: hours,
        services: offeredSvc,
        addons: offeredAdd,
        defaultDuration: 20,
        defaultPrice: offeredSvc[0]?.price || 0,
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

  const offeredCount = services.filter((s) => s.offered).length;

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
        <h3 style={{ marginTop: 0 }}>שלב 2 — ימים ושעות עבודה</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          סמן ✓ כל יום שאתה עובד והגדר את שעות הפתיחה והסגירה. הפסקת צהריים אפשר להוסיף אחר כך בהגדרות.
        </p>
        {DAYS_OF_WEEK.map((day) => {
          const cfg = hours[day];
          return (
            <div key={day} className={`onb-card ${cfg.active ? 'active' : ''}`}>
              <label className="onb-toggle">
                <input type="checkbox" checked={cfg.active} onChange={() => toggleDay(day)} />
                <span className="onb-name">{DAY_LABELS_HE[day]}</span>
                {!cfg.active && <span className="muted" style={{ fontSize: '0.85rem' }}>סגור</span>}
              </label>
              {cfg.active && (
                <div className="row" style={{ marginTop: 10 }}>
                  <div>
                    <label className="muted" style={{ fontSize: '0.85rem' }}>פתיחה</label>
                    <input type="time" value={cfg.start} onChange={(e) => setDayTime(day, 'start', e.target.value)} />
                  </div>
                  <div>
                    <label className="muted" style={{ fontSize: '0.85rem' }}>סגירה</label>
                    <input type="time" value={cfg.end} onChange={(e) => setDayTime(day, 'end', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>שלב 3 — שירותים שאתה מציע</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          סמן ✓ כל שירות שאתה מציע, ועדכן מחיר ואורך. לקוחות יראו רק את אלה שתסמן.
        </p>
        {services.map((s) => (
          <ServiceCard
            key={s.id}
            item={s}
            options={SERVICE_DURATIONS}
            onToggle={toggleSvc}
            onPrice={priceSvc}
            onDuration={durationSvc}
          />
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>שלב 4 — תוספות שאתה מציע</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          תוספות שלקוח יכול להוסיף על השירות שלו (זקן, שעווה, גבות וכו׳). הלקוח רואה אותן כ-checkboxes ויכול לבחור כמה שירצה.
        </p>
        {addons.map((a) => (
          <ServiceCard
            key={a.id}
            item={a}
            options={ADDON_DURATIONS}
            onToggle={toggleAdd}
            onPrice={priceAdd}
            onDuration={durationAdd}
          />
        ))}
      </div>

      <div className="card" style={{ background: 'rgba(212, 166, 74, 0.06)', borderColor: 'var(--accent)' }}>
        <strong>💡 איך זה עובד ללקוח</strong>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: 6, marginBottom: 0 }}>
          הלקוח בוחר <strong>שירות אחד ראשי</strong> (תספורת/לייזר/פרימיום) ואז יכול לסמן <strong>כמה תוספות שירצה</strong>
          (זקן + שעווה באף). המחיר והזמן מתחברים אוטומטית — והסלוטים שמוצגים מתאימים בדיוק לאורך הכולל.
        </p>
      </div>

      <button className="btn-primary" onClick={finish} disabled={saving} style={{ width: '100%' }}>
        {saving ? 'שומר…' : `✓ סיום והתחלה (${offeredCount} שירותים)`}
      </button>
      <div className="spacer" />
      <p className="muted text-center" style={{ fontSize: '0.85rem' }}>
        תוכל לערוך/להוסיף שירותים מותאמים אישית גם אחר כך מהגדרות.
      </p>
    </div>
  );
}
