import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { DAYS_OF_WEEK, DAY_LABELS_HE, defaultWorkingHours } from '../utils/slots';

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [hours, setHours] = useState(defaultWorkingHours());
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const snap = await getDoc(doc(db, 'barbers', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setBusinessName(data.businessName || '');
        setHours({ ...defaultWorkingHours(), ...(data.workingHours || {}) });
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

  async function save() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'barbers', user.uid), {
        businessName: businessName.trim() || 'הספרות שלי',
        workingHours: hours,
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
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>שעות עבודה</h3>
        <p className="muted">תור = 30 דקות. הפסקת צהריים אופציונלית.</p>
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
