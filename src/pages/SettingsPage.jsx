import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { DAYS_OF_WEEK, DAY_LABELS_HE, defaultWorkingHours } from '../utils/slots';
import LogoUploader from '../components/LogoUploader.jsx';

const DURATION_OPTIONS = [20, 40, 60, 80, 100, 120];

function emptyService() {
  return { id: Math.random().toString(36).slice(2, 9), name: '', description: '', duration: 20, price: 0 };
}
function emptyAddon() {
  return { id: Math.random().toString(36).slice(2, 9), name: '', duration: 0, price: 0 };
}
const ADDON_DURATION_OPTIONS = [0, 5, 10, 15, 20, 30];

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bitPhone, setBitPhone] = useState('');
  const [payboxPhone, setPayboxPhone] = useState('');
  const [bitLink, setBitLink] = useState('');
  const [payboxLink, setPayboxLink] = useState('');
  const [paypalUsername, setPaypalUsername] = useState('');
  const [showPayHelp, setShowPayHelp] = useState(false);
  const [hours, setHours] = useState(defaultWorkingHours());
  const [services, setServices] = useState([]);
  const [addons, setAddons] = useState([]);
  const [defaultDuration, setDefaultDuration] = useState(20);
  const [defaultPrice, setDefaultPrice] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const snap = await getDoc(doc(db, 'barbers', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setBusinessName(data.businessName || '');
        setLogoUrl(data.logoUrl || '');
        setBitPhone(data.bitPhone || '');
        setPayboxPhone(data.payboxPhone || '');
        setBitLink(data.bitLink || '');
        setPayboxLink(data.payboxLink || '');
        setPaypalUsername(data.paypalUsername || '');
        setHours({ ...defaultWorkingHours(), ...(data.workingHours || {}) });
        setServices(Array.isArray(data.services) ? data.services : []);
        setAddons(Array.isArray(data.addons) ? data.addons : []);
        setDefaultDuration(data.defaultDuration || 20);
        setDefaultPrice(data.defaultPrice || 0);
      }
      setLoaded(true);
    })();
  }, [user]);

  function updateDay(day, patch) {
    setHours((h) => ({ ...h, [day]: { ...h[day], ...patch } }));
  }
  function updateBreak(day, patch) {
    setHours((h) => ({ ...h, [day]: { ...h[day], break: { ...h[day].break, ...patch } } }));
  }

  function updateService(id, patch) {
    setServices((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addService() {
    setServices((list) => [...list, emptyService()]);
  }
  function removeService(id) {
    setServices((list) => list.filter((s) => s.id !== id));
  }
  function updateAddon(id, patch) {
    setAddons((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function addAddon() {
    setAddons((list) => [...list, emptyAddon()]);
  }
  function removeAddon(id) {
    setAddons((list) => list.filter((a) => a.id !== id));
  }

  async function save() {
    setSaving(true);
    try {
      const cleanedServices = services
        .map((s) => ({
          id: s.id,
          name: (s.name || '').trim(),
          description: (s.description || '').trim(),
          duration: Number(s.duration) || 20,
          price: Number(s.price) || 0,
        }))
        .filter((s) => s.name.length > 0);
      const cleanedAddons = addons
        .map((a) => ({
          id: a.id,
          name: (a.name || '').trim(),
          duration: Number(a.duration) || 0,
          price: Number(a.price) || 0,
        }))
        .filter((a) => a.name.length > 0);
      await updateDoc(doc(db, 'barbers', user.uid), {
        businessName: businessName.trim() || 'הספרות שלי',
        logoUrl: logoUrl || '',
        bitPhone: (bitPhone || '').replace(/[^\d]/g, '') || '',
        payboxPhone: (payboxPhone || '').replace(/[^\d]/g, '') || '',
        bitLink: (bitLink || '').trim(),
        payboxLink: (payboxLink || '').trim(),
        paypalUsername: (paypalUsername || '').trim().replace(/^.*paypal\.me\//i, ''),
        workingHours: hours,
        services: cleanedServices,
        addons: cleanedAddons,
        defaultDuration: Number(defaultDuration) || 20,
        defaultPrice: Number(defaultPrice) || 0,
      });
      navigate('/dashboard');
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
        <h1>⚙️ הגדרות</h1>
        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => navigate('/dashboard')}>חזור</button>
      </div>

      <div className="card">
        <div className="field">
          <label>שם העסק</label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="הספרות של דני" />
        </div>
        <div className="field">
          <label>לוגו</label>
          <LogoUploader uid={user.uid} currentUrl={logoUrl} onChange={setLogoUrl} />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>💸 קבלת תשלום מהלקוח (אופציונלי)</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          אחרי הזמנת תור, הלקוח יראה כפתורי תשלום לפי מה שתמלא כאן.
          ככל שתמלא יותר, כך תהיה ללקוח יותר אפשרות.
        </p>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowPayHelp((s) => !s)}
          style={{ width: '100%', marginBottom: 12, fontSize: '0.9rem' }}
        >
          {showPayHelp ? '▲ הסתר הוראות' : '💡 איך משיגים את הלינקים? — הוראות'}
        </button>

        {showPayHelp && (
          <div className="card-inset" style={{ marginBottom: 16, fontSize: '0.9rem', lineHeight: 1.6 }}>
            <strong>🅿️ PayPal (התשלום הכי חלק — סכום אוטומטי, ללא הקלדה)</strong>
            <ol style={{ paddingInlineStart: 20, marginTop: 4, marginBottom: 12 }}>
              <li>היכנס ל-<a href="https://www.paypal.com/il" target="_blank" rel="noopener">paypal.com/il</a> ופתח חשבון (חינם)</li>
              <li>לך ל-<a href="https://www.paypal.com/paypalme/" target="_blank" rel="noopener">paypal.me</a> ובחר שם משתמש</li>
              <li>הדבק את ה-username בלבד (למשל <code>danibarber</code>) — לא את ה-URL המלא</li>
            </ol>

            <strong>🔵 Bit לעסק</strong>
            <ol style={{ paddingInlineStart: 20, marginTop: 4, marginBottom: 12 }}>
              <li>פתח אפליקציית Bit → תפריט עליון → "Bit לעסק"</li>
              <li>אם אין לך — לחץ "פתיחת חשבון עסקי" (חינם, דרך הבנק)</li>
              <li>במסך עסק לחץ "קישור לתשלום" → "צור קישור" → העתק</li>
              <li>הדבק כאן (URL מלא שמתחיל ב-https://)</li>
              <li>אם אין לך עסקי — מלא רק את שדה "מספר Bit (גיבוי)" למטה</li>
            </ol>

            <strong>🟣 PayBox</strong>
            <ol style={{ paddingInlineStart: 20, marginTop: 4, marginBottom: 0 }}>
              <li>פתח אפליקציית PayBox → "עסקים"</li>
              <li>הירשם כעסק (חינם, דרך דיסקונט/פפר)</li>
              <li>בעמוד העסק → "קישור לתשלום" → העתק</li>
              <li>הדבק כאן</li>
            </ol>
          </div>
        )}

        <div className="field">
          <label>🅿️ PayPal — שם משתמש (Best!)</label>
          <input
            value={paypalUsername}
            onChange={(e) => setPaypalUsername(e.target.value)}
            placeholder="danibarber"
            dir="ltr"
            style={{ direction: 'ltr', textAlign: 'left' }}
          />
          {paypalUsername && (
            <p className="muted" style={{ fontSize: '0.75rem', marginTop: 4, direction: 'ltr', textAlign: 'left' }}>
              paypal.me/{paypalUsername.replace(/^.*paypal\.me\//i, '')}/AMOUNT/ILS
            </p>
          )}
        </div>

        <div className="field">
          <label>🔵 Bit — לינק עסקי לתשלום</label>
          <input
            value={bitLink}
            onChange={(e) => setBitLink(e.target.value)}
            placeholder="https://www.bitpay.co.il/..."
            dir="ltr"
            style={{ direction: 'ltr', textAlign: 'left' }}
          />
        </div>

        <div className="field">
          <label>🟣 PayBox — לינק עסקי לתשלום</label>
          <input
            value={payboxLink}
            onChange={(e) => setPayboxLink(e.target.value)}
            placeholder="https://payboxapp.com/..."
            dir="ltr"
            style={{ direction: 'ltr', textAlign: 'left' }}
          />
        </div>

        <div className="card-inset">
          <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 8px' }}>
            <strong>גיבוי:</strong> אם אין לך לינק עסקי, מלא רק את מספרי הטלפון. הלקוח יראה את המספר ויוכל להעתיק אותו ולשלם ידנית באפליקציה.
          </p>
          <div className="field" style={{ marginBottom: 8 }}>
            <label className="muted">📞 מספר Bit (אם אין לינק)</label>
            <input type="tel" inputMode="numeric" value={bitPhone} onChange={(e) => setBitPhone(e.target.value)} placeholder="050-1234567" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="muted">📞 מספר PayBox (אם אין לינק)</label>
            <input type="tel" inputMode="numeric" value={payboxPhone} onChange={(e) => setPayboxPhone(e.target.value)} placeholder="050-1234567" />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>💈 שירותים</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          ללקוח יוצגו רק שירותים שתוסיף כאן. אם הרשימה ריקה, יוצג שירות אחד "ברירת מחדל" עם הזמן והמחיר למטה.
        </p>
        {services.map((s) => (
          <div key={s.id} className="service-row">
            <input
              placeholder="שם השירות (תספורת, צבע…)"
              value={s.name}
              onChange={(e) => updateService(s.id, { name: e.target.value })}
              style={{ marginBottom: 6 }}
            />
            <div className="row">
              <div>
                <label className="muted" style={{ fontSize: '0.85rem' }}>אורך</label>
                <select value={s.duration} onChange={(e) => updateService(s.id, { duration: e.target.value })}>
                  {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d} דק׳</option>)}
                </select>
              </div>
              <div>
                <label className="muted" style={{ fontSize: '0.85rem' }}>מחיר ₪</label>
                <input type="number" inputMode="numeric" min="0" value={s.price} onChange={(e) => updateService(s.id, { price: e.target.value })} />
              </div>
              <div style={{ flex: 'none' }}>
                <label className="muted" style={{ fontSize: '0.85rem', visibility: 'hidden' }}>מחק</label>
                <button className="btn-danger" style={{ padding: '12px 14px' }} onClick={() => removeService(s.id)} type="button">🗑</button>
              </div>
            </div>
          </div>
        ))}
        <button className="btn-secondary" onClick={addService} type="button" style={{ width: '100%', marginTop: 8 }}>
          + הוסף שירות
        </button>

        {services.length === 0 && (
          <>
            <div className="spacer" />
            <h4 style={{ margin: '0 0 8px' }}>ברירת מחדל</h4>
            <div className="row">
              <div>
                <label className="muted" style={{ fontSize: '0.85rem' }}>אורך תור</label>
                <select value={defaultDuration} onChange={(e) => setDefaultDuration(e.target.value)}>
                  {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d} דק׳</option>)}
                </select>
              </div>
              <div>
                <label className="muted" style={{ fontSize: '0.85rem' }}>מחיר ₪ (לסטטיסטיקה)</label>
                <input type="number" inputMode="numeric" min="0" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>✨ תוספות (אופציונלי ללקוח)</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          תוספות שהלקוח יכול להוסיף על השירות (עיצוב זקן, שעווה באף/באוזניים…). מתווסף לזמן ולמחיר.
        </p>
        {addons.map((a) => (
          <div key={a.id} className="service-row">
            <input
              placeholder="שם התוספת (עיצוב זקן, שעווה באף…)"
              value={a.name}
              onChange={(e) => updateAddon(a.id, { name: e.target.value })}
              style={{ marginBottom: 6 }}
            />
            <div className="row">
              <div>
                <label className="muted" style={{ fontSize: '0.85rem' }}>זמן נוסף</label>
                <select value={a.duration} onChange={(e) => updateAddon(a.id, { duration: e.target.value })}>
                  {ADDON_DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d === 0 ? 'ללא' : `+${d} דק׳`}</option>)}
                </select>
              </div>
              <div>
                <label className="muted" style={{ fontSize: '0.85rem' }}>מחיר ₪</label>
                <input type="number" inputMode="numeric" min="0" value={a.price} onChange={(e) => updateAddon(a.id, { price: e.target.value })} />
              </div>
              <div style={{ flex: 'none' }}>
                <label className="muted" style={{ fontSize: '0.85rem', visibility: 'hidden' }}>מחק</label>
                <button className="btn-danger" style={{ padding: '12px 14px' }} onClick={() => removeAddon(a.id)} type="button">🗑</button>
              </div>
            </div>
          </div>
        ))}
        <button className="btn-secondary" onClick={addAddon} type="button" style={{ width: '100%', marginTop: 8 }}>
          + הוסף תוספת
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>🕒 שעות עבודה</h3>
        <p className="muted" style={{ marginTop: -6 }}>הפסקת צהריים אופציונלית.</p>
        {DAYS_OF_WEEK.map((day) => {
          const cfg = hours[day];
          return (
            <div key={day} style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
              <div className="row" style={{ marginBottom: 8 }}>
                <strong style={{ flex: 'none', width: 60 }}>{DAY_LABELS_HE[day]}</strong>
                <div
                  className={`toggle ${cfg.active ? 'on' : ''}`}
                  onClick={() => updateDay(day, { active: !cfg.active })}
                  style={{ flex: 'none' }}
                />
                <span className="muted" style={{ flex: 'none', marginRight: 8 }}>
                  {cfg.active ? 'פתוח' : 'סגור'}
                </span>
              </div>
              {cfg.active && (
                <>
                  <div className="row">
                    <div>
                      <label className="muted" style={{ fontSize: '0.85rem' }}>פתיחה</label>
                      <input type="time" value={cfg.start} onChange={(e) => updateDay(day, { start: e.target.value })} />
                    </div>
                    <div>
                      <label className="muted" style={{ fontSize: '0.85rem' }}>סגירה</label>
                      <input type="time" value={cfg.end} onChange={(e) => updateDay(day, { end: e.target.value })} />
                    </div>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <div>
                      <label className="muted" style={{ fontSize: '0.85rem' }}>הפסקה מ־</label>
                      <input type="time" value={cfg.break?.start || ''} onChange={(e) => updateBreak(day, { start: e.target.value })} />
                    </div>
                    <div>
                      <label className="muted" style={{ fontSize: '0.85rem' }}>עד</label>
                      <input type="time" value={cfg.break?.end || ''} onChange={(e) => updateBreak(day, { end: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <button className="btn-primary" onClick={save} disabled={saving} style={{ width: '100%' }}>
        {saving ? 'שומר…' : 'שמור'}
      </button>
      <div className="spacer" />
    </div>
  );
}
