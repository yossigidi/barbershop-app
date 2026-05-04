import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, HandHeart, Trash2, Lightbulb, Save, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { DAYS_OF_WEEK, DAY_LABELS_HE, defaultWorkingHours } from '../utils/slots';
import { PROFESSION_LIST, presetCatalogFor, getProfession } from '../utils/professions';
import LogoUploader from '../components/LogoUploader.jsx';

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
  const [profession, setProfession] = useState('barber');
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [hours, setHours] = useState(defaultWorkingHours());
  const initialPreset = presetCatalogFor('barber');
  const [services, setServices] = useState(initialPreset.services);
  const [addons, setAddons] = useState(initialPreset.addons);
  const [serviceDurations, setServiceDurations] = useState(initialPreset.serviceDurations);
  const [addonDurations, setAddonDurations] = useState(initialPreset.addonDurations);
  const [packages, setPackages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isReturning, setIsReturning] = useState(false);

  // Swap the catalog when the profession changes (only if it differs from
  // what's already loaded — won't wipe a returning user's offered services).
  function changeProfession(nextKey) {
    if (nextKey === profession) return;
    setProfession(nextKey);
    const preset = presetCatalogFor(nextKey);
    setServices(preset.services);
    setAddons(preset.addons);
    setServiceDurations(preset.serviceDurations);
    setAddonDurations(preset.addonDurations);
    setPackages([]);
    // Default business name only if user hasn't typed one yet
    setBusinessName((cur) => cur.trim() ? cur : '');
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      const snap = await getDoc(doc(db, 'barbers', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.onboarded === true) setIsReturning(true);
        const profKey = data.profession || 'barber';
        setProfession(profKey);
        const preset = presetCatalogFor(profKey);
        setServiceDurations(preset.serviceDurations);
        setAddonDurations(preset.addonDurations);
        setBusinessName(data.businessName || '');
        setLogoUrl(data.logoUrl || '');
        if (data.workingHours) {
          setHours({ ...defaultWorkingHours(), ...data.workingHours });
        }
        // Hydrate offered services from saved data on top of the preset
        const savedServices = (data.services || []).filter((s) => !s.isPackage);
        const presetSvcs = preset.services;
        const merged = [
          ...savedServices.map((s) => ({
            id: s.id,
            name: s.name,
            duration: s.duration || 20,
            price: s.price || 0,
            offered: true,
          })),
          ...presetSvcs.filter(
            (ps) => !savedServices.some((s) => s.name.trim() === ps.name.trim()),
          ),
        ];
        setServices(merged);

        const savedAddons = data.addons || [];
        const presetAddons = preset.addons;
        const mergedAddons = [
          ...savedAddons.map((a) => ({
            id: a.id,
            name: a.name,
            duration: a.duration || 0,
            price: a.price || 0,
            offered: true,
          })),
          ...presetAddons.filter(
            (pa) => !savedAddons.some((a) => a.name.trim() === pa.name.trim()),
          ),
        ];
        setAddons(mergedAddons);

        const existingPackages = (data.services || []).filter((s) => s.isPackage);
        if (existingPackages.length) setPackages(existingPackages);
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

  // --- Packages ---
  function addPackage() {
    setPackages((p) => [
      ...p,
      {
        id: `pkg_${Math.random().toString(36).slice(2, 9)}`,
        name: '',
        includes: [], // array of { kind: 'service'|'addon', id }
        duration: 0,
        price: 0,
        manualOverride: false,
        isPackage: true,
      },
    ]);
  }
  function updatePackage(id, patch) {
    setPackages((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function removePackage(id) {
    setPackages((list) => list.filter((p) => p.id !== id));
  }
  function togglePackageItem(pkgId, kind, itemId) {
    setPackages((list) => list.map((p) => {
      if (p.id !== pkgId) return p;
      const has = p.includes.some((i) => i.kind === kind && i.id === itemId);
      const next = has
        ? p.includes.filter((i) => !(i.kind === kind && i.id === itemId))
        : [...p.includes, { kind, id: itemId }];
      // Recompute auto totals (unless overridden)
      let dur = 0, price = 0;
      for (const inc of next) {
        const src = inc.kind === 'service'
          ? services.find((s) => s.id === inc.id)
          : addons.find((a) => a.id === inc.id);
        if (src) { dur += Number(src.duration) || 0; price += Number(src.price) || 0; }
      }
      return {
        ...p,
        includes: next,
        duration: p.manualOverride ? p.duration : dur,
        price: p.manualOverride ? p.price : price,
      };
    }));
  }

  async function finish() {
    const offeredSvc = services
      .filter((s) => s.offered)
      .map((s) => ({ id: s.id, name: s.name, duration: s.duration, price: s.price }));
    const offeredAdd = addons
      .filter((a) => a.offered)
      .map((a) => ({ id: a.id, name: a.name, duration: a.duration, price: a.price }));

    // Build package "services" — bundles of selected items.
    const cleanedPackages = packages
      .filter((p) => p.name.trim() && p.includes.length > 0)
      .map((p) => {
        const includesNames = p.includes.map((i) => {
          const src = i.kind === 'service' ? services.find((s) => s.id === i.id) : addons.find((a) => a.id === i.id);
          return src?.name || '';
        }).filter(Boolean);
        return {
          id: p.id,
          name: p.name.trim(),
          description: 'כולל: ' + includesNames.join(' + '),
          duration: Number(p.duration) || 0,
          price: Number(p.price) || 0,
          isPackage: true,
          includes: p.includes,
        };
      });

    const allServices = [...offeredSvc, ...cleanedPackages];

    if (allServices.length === 0) {
      if (!confirm('לא הגדרת אף שירות. תוכל להוסיף אחר כך בהגדרות. להמשיך?')) return;
    }
    setSaving(true);
    try {
      const profCfg = getProfession(profession);
      const fallbackName = profCfg.defaultBusinessName('');
      await updateDoc(doc(db, 'barbers', user.uid), {
        profession,
        businessName: businessName.trim() || fallbackName,
        logoUrl: logoUrl || '',
        workingHours: hours,
        services: allServices,
        addons: offeredAdd,
        defaultDuration: profCfg.serviceDurations[0] || 20,
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
        <h1>
          {isReturning
            ? <><Scissors size={20} className="icon-inline" />קטלוג שירותים</>
            : <><HandHeart size={20} className="icon-inline" />ברוך הבא!</>}
        </h1>
        {isReturning && (
          <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => navigate('/dashboard')}>חזור</button>
        )}
      </div>

      <div className="card card-feature">
        <h3 style={{ marginTop: 0 }}><Sparkles size={18} className="icon-inline" />שלב 1 — מה תחום העיסוק שלך?</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          הבחירה תקבע את הקטלוג ההתחלתי של השירותים והתוספות. אפשר לערוך אחר כך.
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {PROFESSION_LIST.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => changeProfession(p.id)}
              className={profession === p.id ? 'btn-primary' : 'btn-secondary'}
              style={{ flex: '1 0 130px', padding: '14px 8px', fontSize: '0.95rem' }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>שלב 2 — שם ולוגו של העסק</h3>
        <div className="field">
          <label>שם העסק</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="העסק של דני"
          />
        </div>
        <div className="field">
          <label>לוגו (אופציונלי)</label>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: -4, marginBottom: 8 }}>
            יופיע בלינק הציבורי שלך וכן בדשבורד.
          </p>
          <LogoUploader uid={user.uid} currentUrl={logoUrl} onChange={setLogoUrl} />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>שלב 3 — ימים ושעות עבודה</h3>
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
        <h3 style={{ marginTop: 0 }}>שלב 4 — שירותים שאתה מציע</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          סמן ✓ כל שירות שאתה מציע, ועדכן מחיר ואורך. לקוחות יראו רק את אלה שתסמן.
        </p>
        {services.map((s) => (
          <ServiceCard
            key={s.id}
            item={s}
            options={serviceDurations}
            onToggle={toggleSvc}
            onPrice={priceSvc}
            onDuration={durationSvc}
          />
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>שלב 5 — תוספות שאתה מציע</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          תוספות שלקוח יכול להוסיף על השירות שלו (זקן, שעווה, גבות וכו׳). הלקוח רואה אותן כ-checkboxes ויכול לבחור כמה שירצה.
        </p>
        {addons.map((a) => (
          <ServiceCard
            key={a.id}
            item={a}
            options={addonDurations}
            onToggle={toggleAdd}
            onPrice={priceAdd}
            onDuration={durationAdd}
          />
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>שלב 6 — חבילות (אופציונלי)</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          הרכב חבילות משירותים ותוספות עם מחיר וזמן משלהן (יכולות לכלול הנחה).
          הלקוח רואה אותן כפריט אחד ובוחר אותן ישירות.
        </p>

        {packages.map((p, idx) => {
          const offeredSvcItems = services.filter((s) => s.offered);
          const offeredAddItems = addons.filter((a) => a.offered);
          const allItems = [
            ...offeredSvcItems.map((s) => ({ ...s, kind: 'service' })),
            ...offeredAddItems.map((a) => ({ ...a, kind: 'addon' })),
          ];
          if (offeredSvcItems.length === 0 && offeredAddItems.length === 0) {
            return (
              <div key={p.id} className="onb-card">
                <p className="muted">קודם כל סמן ✓ שירותים ותוספות בשלבים 4–5.</p>
                <button className="btn-secondary" onClick={() => removePackage(p.id)} type="button">הסר</button>
              </div>
            );
          }

          return (
            <div key={p.id} className="onb-card active" style={{ marginBottom: 12 }}>
              <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}>
                <input
                  placeholder={`שם החבילה (חבילה ${idx + 1})`}
                  value={p.name}
                  onChange={(e) => updatePackage(p.id, { name: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button className="btn-danger" style={{ padding: '8px 12px', flex: 'none' }} onClick={() => removePackage(p.id)} type="button" aria-label="מחק"><Trash2 size={16} /></button>
              </div>

              <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 6 }}>סמן מה כלול:</div>
              <div className="pkg-items">
                {allItems.map((it) => {
                  const checked = p.includes.some((i) => i.kind === it.kind && i.id === it.id);
                  return (
                    <label key={`${it.kind}-${it.id}`} className={`pkg-item ${checked ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePackageItem(p.id, it.kind, it.id)}
                      />
                      <span style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>{it.name}</span>
                        <span className="muted" style={{ fontSize: '0.8rem', marginInlineStart: 6 }}>
                          {it.duration ? `${it.duration} דק׳` : ''}
                          {it.price ? ` • ₪${it.price}` : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <div>
                  <label className="muted" style={{ fontSize: '0.85rem' }}>זמן (דק׳)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={p.duration || ''}
                    onChange={(e) => updatePackage(p.id, { duration: Number(e.target.value) || 0, manualOverride: true })}
                  />
                </div>
                <div>
                  <label className="muted" style={{ fontSize: '0.85rem' }}>מחיר ₪</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={p.price || ''}
                    onChange={(e) => updatePackage(p.id, { price: Number(e.target.value) || 0, manualOverride: true })}
                  />
                </div>
              </div>
              {p.manualOverride && (
                <p className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                  מחיר/זמן ידני — לא מתעדכן אוטומטית.{' '}
                  <a href="#" onClick={(e) => {
                    e.preventDefault();
                    let dur = 0, price = 0;
                    for (const inc of p.includes) {
                      const src = inc.kind === 'service' ? services.find((s) => s.id === inc.id) : addons.find((a) => a.id === inc.id);
                      if (src) { dur += Number(src.duration) || 0; price += Number(src.price) || 0; }
                    }
                    updatePackage(p.id, { duration: dur, price, manualOverride: false });
                  }}>חזור לחישוב אוטומטי</a>
                </p>
              )}
            </div>
          );
        })}

        <button className="btn-secondary" onClick={addPackage} type="button" style={{ width: '100%', marginTop: 8 }}>
          + הוסף חבילה
        </button>
      </div>

      <div className="card" style={{ borderColor: 'var(--gold)', background: 'rgba(184, 137, 58, 0.04)' }}>
        <strong><Lightbulb size={16} className="icon-inline" />איך זה עובד ללקוח</strong>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: 6, marginBottom: 0 }}>
          הלקוח רואה את <strong>השירותים והחבילות יחד</strong> ובוחר אחד. אם זה שירות רגיל, הוא יכול להוסיף תוספות.
          אם זו חבילה, הכל כבר כלול. הסלוטים שמוצגים מותאמים בדיוק לאורך הכולל.
        </p>
      </div>

      <button className="btn-primary" onClick={finish} disabled={saving} style={{ width: '100%' }}>
        {saving ? 'שומר…' : isReturning
          ? <><Save size={18} className="icon-inline" />{`שמור (${offeredCount} שירותים)`}</>
          : <><Check size={18} className="icon-inline" />{`סיום והתחלה (${offeredCount} שירותים)`}</>}
      </button>
      <div className="spacer" />
      <p className="muted text-center" style={{ fontSize: '0.85rem' }}>
        תוכל לערוך/להוסיף שירותים מותאמים אישית גם אחר כך מהגדרות.
      </p>
    </div>
  );
}
