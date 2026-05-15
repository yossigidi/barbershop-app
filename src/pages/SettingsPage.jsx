import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, CreditCard, Lightbulb, ChevronUp, Scissors, Sparkles, Trash2, Clock, Briefcase, Check, Star, XCircle, Repeat, Loader2, Bell, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { DAYS_OF_WEEK, DAY_LABELS_HE, defaultWorkingHours } from '../utils/slots';
import { PROFESSION_LIST, readProfessions, presetCatalogForMany } from '../utils/professions';
import { nameToSlug, normalizeSlug, validateSlug } from '../utils/slugs';
import { DEFAULT_THEME, getThemeKey } from '../utils/themes';
import ThemePicker from '../components/ThemePicker.jsx';
import { getAccessState } from '../utils/subscription';
import LogoUploader from '../components/LogoUploader.jsx';
import PaywallModal from '../components/PaywallModal.jsx';

const DURATION_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];

function emptyService() {
  return { id: Math.random().toString(36).slice(2, 9), name: '', description: '', duration: 20, price: 0 };
}
function emptyAddon() {
  return { id: Math.random().toString(36).slice(2, 9), name: '', duration: 0, price: 0 };
}
function emptyProduct() {
  return { id: Math.random().toString(36).slice(2, 9), name: '', price: 0, description: '' };
}
function emptyEmployee() {
  return { id: Math.random().toString(36).slice(2, 9), name: '', photoUrl: '', active: true };
}
const ADDON_DURATION_OPTIONS = [0, 10, 20, 30, 40, 50, 60];

export default function SettingsPage() {
  const { user, setPasswordForCurrentUser } = useAuth();
  const hasPasswordProvider = (user?.providerData || []).some((p) => p.providerId === 'password');
  const [newPassword, setNewPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  async function handleSetPassword() {
    if (newPassword.length < 6) { setPwError('הסיסמה חייבת להיות לפחות 6 תווים'); return; }
    setPwBusy(true); setPwError(''); setPwSuccess(false);
    try {
      await setPasswordForCurrentUser(newPassword);
      setPwSuccess(true);
      setNewPassword('');
    } catch (e) {
      if (e.code === 'auth/provider-already-linked' || e.code === 'auth/credential-already-in-use') {
        setPwError('כבר יש סיסמה לחשבון. אם שכחת — צא והכנס שוב דרך "שכחתי סיסמה" במסך הכניסה.');
      } else {
        setPwError(e.message || 'שגיאה בהגדרת הסיסמה');
      }
    } finally {
      setPwBusy(false);
    }
  }
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
  // Products — physical retail items the barber sells alongside services
  // (shampoo, wax, gel, accessories). For now we only collect them in
  // Settings; future iterations can surface them on the booking page or
  // for in-person sale tracking.
  const [products, setProducts] = useState([]);
  // Employees — lite multi-staff. The owner stays the primary user but
  // can add additional people (e.g. a partner barber, a junior staff
  // member). Each has just a name + optional photo URL for now;
  // working hours and per-employee services are TODO for a later
  // iteration. The booking page will show a "pick employee" step when
  // employees.length > 0.
  const [employees, setEmployees] = useState([]);
  // Number of physical chairs / stations in the shop. Default 1 means
  // the dashboard timeline stays a single column (current behaviour).
  // When > 1, the timeline splits into N parallel columns so the owner
  // can see who's at which station; bookings get round-robin assigned
  // to a chair on creation.
  const [chairsCount, setChairsCount] = useState(1);
  const [defaultDuration, setDefaultDuration] = useState(20);
  const [defaultPrice, setDefaultPrice] = useState(0);
  const [professions, setProfessions] = useState(['barber']);
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [aiGender, setAiGender] = useState('neutral');
  const [customSlug, setCustomSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  // Live slug-availability state. Updated by a debounced effect that hits
  // shortCodes/{slug} as the user types; lets us show ✓ "פנוי" / ✗ "תפוס"
  // inline so they don't only learn after pressing "שמור".
  // 'idle' | 'checking' | 'available' | 'taken' | 'mine' | 'invalid'
  const [slugStatus, setSlugStatus] = useState('idle');
  // When true, the public booking page exposes the "תור קבוע" (recurring
  // appointment) option to clients. Off by default — many barbers prefer
  // to manage recurring booking creation themselves rather than letting
  // a one-time client lock 12 future slots.
  const [allowRecurring, setAllowRecurring] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMode, setReminderMode] = useState('batchDayBefore');
  const [reminderHoursBefore, setReminderHoursBefore] = useState(2);
  const [thankYouEnabled, setThankYouEnabled] = useState(false);
  const [waGroupLink, setWaGroupLink] = useState('');
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyEveryN, setLoyaltyEveryN] = useState(10);
  const [loyaltyReward, setLoyaltyReward] = useState('תספורת חינם');
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [barberData, setBarberData] = useState(null);

  useEffect(() => {
    if (!user) return;
    // Live-subscribe to the barber doc so the subscription card reflects
    // webhook-driven updates (e.g. payment just succeeded → status flips
    // to 'active' and the cancel button appears without a manual refresh).
    let initialized = false;
    return onSnapshot(doc(db, 'barbers', user.uid), (snap) => {
      if (!snap.exists()) { setLoaded(true); return; }
      const data = snap.data();
      setBarberData(data);
      // Form fields are initialized ONCE — otherwise typing into them
      // would be overwritten by every snapshot tick.
      if (!initialized) {
        initialized = true;
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
        setProducts(Array.isArray(data.products) ? data.products : []);
        setEmployees(Array.isArray(data.employees) ? data.employees : []);
        setChairsCount(Number(data.chairsCount) || 1);
        setDefaultDuration(data.defaultDuration || 20);
        setDefaultPrice(data.defaultPrice || 0);
        setProfessions(readProfessions(data));
        setGoogleReviewUrl(data.googleReviewUrl || '');
        setAiGender(data.aiGender || 'neutral');
        setCustomSlug(data.customSlug || '');
        setAllowRecurring(data.allowRecurring === true);
        setRequireApproval(data.bookingApprovalMode === 'manual');
        if (data.reminderSettings) {
          setReminderEnabled(data.reminderSettings.enabled === true);
          const m = data.reminderSettings.mode;
          setReminderMode(['batchDayBefore', 'batchSameDay', 'perClient'].includes(m) ? m : 'batchDayBefore');
          setReminderHoursBefore([1, 2, 3].includes(data.reminderSettings.hoursBefore) ? data.reminderSettings.hoursBefore : 2);
        }
        setThankYouEnabled(data.thankYouEnabled === true);
        setWaGroupLink(data.waGroupLink || '');
        if (data.loyalty) {
          setLoyaltyEnabled(data.loyalty.enabled === true);
          setLoyaltyEveryN(Number(data.loyalty.everyN) || 10);
          setLoyaltyReward(data.loyalty.reward || 'תספורת חינם');
        }
        setTheme(getThemeKey(data));
      }
      setLoaded(true);
    });
  }, [user]);

  // Debounced availability check — runs whenever the user changes the
  // customSlug input. Skipped when the slug equals the user's previous
  // saved slug (their own).
  useEffect(() => {
    const trimmed = normalizeSlug(customSlug);
    if (!trimmed) { setSlugStatus('idle'); return; }
    if (trimmed === normalizeSlug(barberData?.customSlug || '')) {
      setSlugStatus('mine'); return;
    }
    const formatErr = validateSlug(trimmed);
    if (formatErr) { setSlugStatus('invalid'); return; }
    setSlugStatus('checking');
    const t = setTimeout(async () => {
      try {
        const snap = await getDoc(doc(db, 'shortCodes', trimmed));
        if (!snap.exists()) { setSlugStatus('available'); return; }
        if (snap.data().uid === user?.uid) { setSlugStatus('mine'); return; }
        setSlugStatus('taken');
      } catch {
        // If the lookup fails (offline / quota) keep the user unblocked —
        // the save() call will re-check authoritatively before writing.
        setSlugStatus('idle');
      }
    }, 350);
    return () => clearTimeout(t);
  }, [customSlug, barberData?.customSlug, user?.uid]);

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
  function updateProduct(id, patch) {
    setProducts((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function addProduct() {
    setProducts((list) => [...list, emptyProduct()]);
  }
  function removeProduct(id) {
    setProducts((list) => list.filter((p) => p.id !== id));
  }
  function updateEmployee(id, patch) {
    setEmployees((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function addEmployee() {
    setEmployees((list) => [...list, emptyEmployee()]);
  }
  function removeEmployee(id) {
    setEmployees((list) => list.filter((e) => e.id !== id));
  }

  async function save() {
    setSlugError('');
    // Validate the slug — but never block the whole save because of it.
    // If it's invalid we just won't persist the slug change; the user
    // sees an alert + the slug error inline; everything else still saves.
    const desiredSlug = normalizeSlug(customSlug);
    const previousSlug = normalizeSlug(barberData?.customSlug || '');
    let slugToSave = previousSlug;     // default: keep the old slug
    let slugProblem = null;            // human-readable reason if we skipped
    let slugChanged = false;

    if (desiredSlug !== previousSlug) {
      if (!desiredSlug) {
        // User cleared the slug deliberately — accept the clear.
        slugToSave = '';
        slugChanged = true;
      } else {
        const err = validateSlug(desiredSlug);
        if (err) {
          slugProblem = err;
        } else {
          try {
            const existing = await getDoc(doc(db, 'shortCodes', desiredSlug));
            if (existing.exists() && existing.data().uid !== user.uid) {
              slugProblem = 'הכתובת הזו כבר תפוסה — בחר/י כתובת אחרת';
            } else {
              slugToSave = desiredSlug;
              slugChanged = true;
            }
          } catch (e) {
            slugProblem = 'שגיאת רשת בעת בדיקת הכתובת — הכתובת לא עודכנה. שאר השדות כן ייכנסו.';
          }
        }
      }
      if (slugProblem) {
        setSlugError(slugProblem);
      }
    }

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
      const cleanedProducts = products
        .map((p) => ({
          id: p.id,
          name: (p.name || '').trim(),
          description: (p.description || '').trim(),
          price: Number(p.price) || 0,
        }))
        .filter((p) => p.name.length > 0);
      const cleanedEmployees = employees
        .map((e) => ({
          id: e.id,
          name: (e.name || '').trim(),
          photoUrl: (e.photoUrl || '').trim(),
          active: e.active !== false,
        }))
        .filter((e) => e.name.length > 0);
      await updateDoc(doc(db, 'barbers', user.uid), {
        businessName: businessName.trim() || 'העסק שלי',
        logoUrl: logoUrl || '',
        bitPhone: (bitPhone || '').replace(/[^\d]/g, '') || '',
        payboxPhone: (payboxPhone || '').replace(/[^\d]/g, '') || '',
        bitLink: (bitLink || '').trim(),
        payboxLink: (payboxLink || '').trim(),
        paypalUsername: (paypalUsername || '').trim().replace(/^.*paypal\.me\//i, ''),
        workingHours: hours,
        services: cleanedServices,
        addons: cleanedAddons,
        products: cleanedProducts,
        employees: cleanedEmployees,
        chairsCount: Math.max(1, Math.min(10, Number(chairsCount) || 1)),
        defaultDuration: Number(defaultDuration) || 20,
        defaultPrice: Number(defaultPrice) || 0,
        professions,
        profession: professions[0],
        googleReviewUrl: (googleReviewUrl || '').trim(),
        aiGender,
        customSlug: slugToSave,
        allowRecurring: !!allowRecurring,
        bookingApprovalMode: requireApproval ? 'manual' : 'auto',
        reminderSettings: {
          enabled: !!reminderEnabled,
          mode: ['batchDayBefore', 'batchSameDay', 'perClient'].includes(reminderMode) ? reminderMode : 'batchDayBefore',
          hoursBefore: [1, 2, 3].includes(Number(reminderHoursBefore)) ? Number(reminderHoursBefore) : 2,
        },
        thankYouEnabled: !!thankYouEnabled,
        waGroupLink: (waGroupLink || '').trim(),
        loyalty: {
          enabled: !!loyaltyEnabled,
          everyN: Math.max(2, Math.min(50, Number(loyaltyEveryN) || 10)),
          reward: (loyaltyReward || 'תספורת חינם').trim().slice(0, 60),
        },
        theme,
      });

      // Slug bookkeeping: create/update the shortCodes/{slug} pointer and
      // delete the previous one if the slug changed (or was cleared).
      if (slugChanged && slugToSave) {
        await setDoc(doc(db, 'shortCodes', slugToSave), { uid: user.uid });
      }
      if (slugChanged && previousSlug && previousSlug !== slugToSave) {
        try { await deleteDoc(doc(db, 'shortCodes', previousSlug)); } catch {}
      }

      // If we skipped the slug because it was invalid, tell the user
      // EXPLICITLY (alert is intentional — the inline slug error is
      // small and lives in a different section, easy to miss).
      if (slugProblem) {
        alert(`השמירה הצליחה — אבל כתובת הקישור לא עודכנה:\n${slugProblem}\n\nכתובת הקישור הנוכחית: ${slugToSave || '(אוטומטית)'}`);
      }

      navigate('/dashboard');
    } catch (e) {
      console.error('Settings save failed:', e);
      alert('שגיאה בשמירה: ' + (e?.message || 'לא ידוע') + '\n\nאם זה חוזר על עצמו — ייתכן שכתובת הקישור חסומה. נסה/י לרוקן את שדה "הקישור שלך ללקוחות" ושמור.');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="loading">טוען…</div>;
  const access = getAccessState(barberData);
  if (!access.granted) return <PaywallModal access={access} />;

  // Subscription management lives on /pricing — settings just shows status.
  const sub = barberData?.subscription || {};
  const periodEnd = sub.currentPeriodEnd?.toDate
    ? sub.currentPeriodEnd.toDate()
    : (sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null);

  return (
    <div className="app">
      <div className="header">
        <h1><SettingsIcon size={20} className="icon-inline" />הגדרות</h1>
        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => navigate('/dashboard')}>חזור</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Sparkles size={18} className="icon-inline" />מנוי</h3>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>
          {access.reason === 'grandfathered' && '🎁 משתמש/ת ותיק/ה — הגישה חינם לתמיד.'}
          {access.reason === 'trial' && <>תקופת ניסיון — נותרו <strong>{access.daysLeft}</strong> ימים.</>}
          {access.reason === 'active' && (
            <>✓ מנוי פעיל. החיוב הבא: <strong>{periodEnd?.toLocaleDateString('he-IL')}</strong>
            {sub.last4 && <> (כרטיס {sub.last4})</>}</>
          )}
          {access.reason === 'cancelled-pending' && (
            <>⏳ המנוי בוטל. גישה עד <strong>{periodEnd?.toLocaleDateString('he-IL')}</strong>.</>
          )}
          {access.reason === 'past-due-grace' && (
            <span style={{ color: 'var(--danger)' }}>⚠ בעיה בחיוב — מנסה שוב יומית.</span>
          )}
        </p>
        {access.reason !== 'grandfathered' && (
          <button className="btn-secondary" style={{ width: '100%' }} onClick={() => navigate('/pricing')}>
            <Sparkles size={14} className="icon-inline" />ניהול מנוי וחיוב →
          </button>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>🔐 סיסמה לכניסה מהאפליקציה</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.86rem' }}>
          באייפון, האפליקציה המותקנת על המסך לא שומרת חיבור עם Google (מגבלה של iOS).
          הגדר/י סיסמה לחשבון שלך פעם אחת כאן — ואז באייפון תתחבר/י עם <strong dir="ltr">{user?.email || 'המייל שלך'}</strong> והסיסמה הזו, ותישאר/י מחובר/ת תמיד.
        </p>
        {hasPasswordProvider && !pwSuccess ? (
          <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#16a34a' }}>
            ✓ סיסמה כבר הוגדרה לחשבון — אפשר להשתמש בה לכניסה באפליקציה.
          </p>
        ) : (
          <>
            <div className="field" style={{ marginTop: 6 }}>
              <label>סיסמה חדשה (6+ תווים)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="new-password"
                minLength={6}
              />
            </div>
            {pwError && (
              <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 8px' }}>⚠️ {pwError}</p>
            )}
            {pwSuccess && (
              <p style={{ color: '#16a34a', fontSize: '0.88rem', margin: '0 0 8px' }}>
                ✓ הסיסמה הוגדרה! בפעם הבאה ב-PWA — היכנס/י עם <strong dir="ltr">{user?.email}</strong> והסיסמה החדשה, ותישאר/י מחובר/ת.
              </p>
            )}
            <button
              type="button"
              className="btn-gold"
              onClick={handleSetPassword}
              disabled={pwBusy || newPassword.length < 6}
              style={{ width: '100%' }}
            >
              {pwBusy ? 'שומר…' : 'הגדר סיסמה'}
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Lightbulb size={18} className="icon-inline" />הדרכה למערכת</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
          סיור קצר שמסביר איך כל חלק במערכת עובד — היומן, קביעת תורים, הלקוחות וההודעות האוטומטיות.
        </p>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%' }}
          onClick={() => navigate('/dashboard?guide=1')}
        >
          <Lightbulb size={14} className="icon-inline" />צפה שוב בהדרכה
        </button>
      </div>

      <div className="card">
        <div className="field">
          <label>שם העסק</label>
          <input
            value={businessName}
            onChange={(e) => {
              setBusinessName(e.target.value);
              // Auto-suggest slug only when the field hasn't been customized
              const auto = nameToSlug(e.target.value);
              const prevAuto = nameToSlug(barberData?.businessName || '');
              if (auto && (customSlug === '' || customSlug === prevAuto)) {
                setCustomSlug(auto);
                setSlugError('');
              }
            }}
            placeholder="העסק של דני"
            maxLength={50}
          />
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
            השם הזה מופיע ללקוחות בלוגו ובהזמנת התור. עדיף קצר ויפה.
          </p>
        </div>

        <div className="field">
          <label htmlFor="setting-custom-slug">הקישור שלך ללקוחות</label>
          <div className={`slug-input-wrap slug-status-${slugStatus}`}>
            <span className="slug-prefix" dir="ltr">toron.co.il/</span>
            <input
              id="setting-custom-slug"
              type="text"
              dir="ltr"
              value={customSlug}
              onChange={(e) => {
                setCustomSlug(normalizeSlug(e.target.value));
                setSlugError('');
              }}
              placeholder={barberData?.shortCode || 'ramos'}
              maxLength={30}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            {customSlug && (
              <span className="slug-indicator" aria-live="polite">
                {slugStatus === 'checking' && (
                  <Loader2 size={14} className="slug-spin" aria-hidden="true" />
                )}
                {slugStatus === 'available' && (
                  <span className="slug-badge slug-badge-ok">
                    <Check size={12} aria-hidden="true" />פנוי
                  </span>
                )}
                {slugStatus === 'mine' && (
                  <span className="slug-badge slug-badge-mine">
                    <Check size={12} aria-hidden="true" />שלך
                  </span>
                )}
                {slugStatus === 'taken' && (
                  <span className="slug-badge slug-badge-bad">
                    <XCircle size={12} aria-hidden="true" />תפוס
                  </span>
                )}
                {slugStatus === 'invalid' && (
                  <span className="slug-badge slug-badge-bad">
                    <XCircle size={12} aria-hidden="true" />לא תקין
                  </span>
                )}
              </span>
            )}
          </div>
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
            {customSlug ? (
              <>הקישור יהיה: <strong dir="ltr">toron.co.il/{customSlug}</strong></>
            ) : (
              <>אם תשאיר/י ריק — הקישור יהיה <strong dir="ltr">toron.co.il/{barberData?.shortCode || 'XXXXXX'}</strong> (אוטומטי)</>
            )}
          </p>
          {slugStatus === 'taken' && !slugError && (
            <p style={{ color: 'var(--danger)', fontSize: '0.84rem', marginTop: 4 }}>
              הכתובת הזו תפוסה — נסה תוספת כמו <strong dir="ltr">{customSlug}-2</strong> או שם אחר
            </p>
          )}
          {slugError && (
            <p style={{ color: 'var(--danger)', fontSize: '0.84rem', marginTop: 4 }}>{slugError}</p>
          )}
        </div>

        <div className="field">
          <label>לוגו</label>
          <LogoUploader uid={user.uid} currentUrl={logoUrl} onChange={setLogoUrl} />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Sparkles size={18} className="icon-inline" />עיצוב הדף ללקוחות</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
          בחר/י את התמה שתופיע בדף שהלקוחות פותחים מהלינק שלך. אפשר לעדכן בכל זמן.
          הדשבורד שלך לא מושפע מהבחירה.
        </p>
        <ThemePicker value={theme} onSelect={setTheme} businessName={businessName} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Briefcase size={18} className="icon-inline" />תחומי העיסוק</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
          סמן את כל מה שאתה/את מציע/ה. אפשר לבחור כמה מקצועות ביחד (למשל מניקור + פדיקור + קוסמטיקה). אחרי שינוי תוכל/י ללחוץ "טען שירותים מומלצים" כדי להחליף את רשימת השירותים בקטלוג של המקצוע החדש.
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {PROFESSION_LIST.map((p) => {
            const on = professions.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProfessions((cur) => {
                    const has = cur.includes(p.id);
                    const next = has ? cur.filter((x) => x !== p.id) : [...cur, p.id];
                    return next.length === 0 ? cur : next;
                  });
                }}
                className={on ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: '1 0 130px', padding: '10px 8px', fontSize: '0.88rem' }}
              >
                {on && <Check size={14} className="icon-inline" />}
                {p.label}
              </button>
            );
          })}
        </div>
        {professions.length > 1 && (
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10, marginBottom: 0 }}>
            <Sparkles size={12} className="icon-inline" />
            נבחרו {professions.length} תחומים — בקטלוג יוצגו שירותים מכל אחד.
          </p>
        )}

        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%', marginTop: 12, fontSize: '0.92rem' }}
          onClick={() => {
            // Replace current services + addons with the catalog of the
            // currently-selected professions. Confirm first because this
            // wipes any custom services the user added — the change isn't
            // persisted until they hit "שמור" anyway, so they can navigate
            // away to undo.
            const labelList = PROFESSION_LIST
              .filter((p) => professions.includes(p.id))
              .map((p) => p.label)
              .join(' + ');
            const ok = confirm(
              `להחליף את רשימת השירותים והתוספות ברשימה המומלצת ל-${labelList}?\n\nהשירותים שהוספת ידנית יימחקו (השינוי ייכנס לתוקף רק אחרי "שמור").`
            );
            if (!ok) return;
            const cat = presetCatalogForMany(professions);
            setServices(
              cat.services.map((s) => ({ id: s.id, name: s.name, description: '', duration: s.duration, price: s.price }))
            );
            setAddons(
              cat.addons.map((a) => ({ id: a.id, name: a.name, duration: a.duration, price: a.price }))
            );
          }}
        >
          <Sparkles size={14} className="icon-inline" />
          טען שירותים מומלצים למקצוע{professions.length > 1 ? 'ות' : ''} שנבחר{professions.length > 1 ? 'ו' : ''}
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Sparkles size={18} className="icon-inline" />הודעות AI</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
          ה-AI כותב הודעות עברית בגוף ראשון. בעברית הפעלים מקבלים מין דקדוקי (זכר/נקבה).
          בחר/י איך לכתוב הודעות בשמך כדי שיישמעו טבעיות.
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {[
            { v: 'female', label: 'נקבה', desc: '"שמחה לראות"' },
            { v: 'male',   label: 'זכר',  desc: '"שמח לראות"' },
            { v: 'neutral',label: 'נטרלי',desc: '"שמחתי לראות" (לשני המגדרים)' },
          ].map((opt) => {
            const on = aiGender === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => setAiGender(opt.v)}
                className={on ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: '1 0 130px', padding: '10px 8px', fontSize: '0.85rem', flexDirection: 'column', gap: 3 }}
              >
                <span style={{ fontWeight: 700 }}>{opt.label}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 400 }}>{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Star size={18} className="icon-inline" />ביקורות בגוגל</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
          הדבק את הקישור שגוגל נותן לך ב-"שתף את הביקורת". המערכת תשלב אותו אוטומטית בהודעת התודה שנשלחת ללקוח חצי שעה אחרי שהתור נגמר — דרך מצוינת לקבל ביקורות חיוביות.
        </p>
        <div className="field">
          <label>לינק לביקורת</label>
          <input
            type="url"
            value={googleReviewUrl}
            onChange={(e) => setGoogleReviewUrl(e.target.value)}
            placeholder="https://g.page/r/..."
            dir="ltr"
            style={{ direction: 'ltr', textAlign: 'left' }}
          />
          <p className="muted" style={{ fontSize: '0.75rem', marginTop: 6 }}>
            איך משיגים? כנס/י ל-
            <a href="https://business.google.com" target="_blank" rel="noopener noreferrer">Google Business Profile</a>
            {' '}→ "Get more reviews" → "Share review form" → העתק את הקישור.
          </p>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><MessageCircle size={18} className="icon-inline" />הודעות WhatsApp ללקוחות</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
          תזכורות והודעות תודה נשלחות אוטומטית — מגדירים פעם אחת וזהו, בלי כפתורים.
        </p>

        <label className="row" style={{ alignItems: 'center', cursor: 'pointer', gap: 12, marginBottom: reminderEnabled ? 14 : 0 }}>
          <div
            className={`toggle ${reminderEnabled ? 'on' : ''}`}
            onClick={() => setReminderEnabled((v) => !v)}
            role="switch"
            aria-checked={reminderEnabled}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setReminderEnabled((v) => !v); } }}
            style={{ flex: 'none' }}
          />
          <div style={{ flex: 1 }}>
            <strong><Bell size={14} className="icon-inline" />תזכורת אוטומטית לפני התור</strong>
            <div className="muted" style={{ fontSize: '0.84rem', marginTop: 2, lineHeight: 1.5 }}>
              הלקוח מקבל תזכורת ב-WhatsApp עם שם העסק, התאריך, השעה והקישור שלך.
            </div>
          </div>
        </label>
        {reminderEnabled && (
          <div className="card-inset" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>מתי לשלוח?</label>
              <select value={reminderMode} onChange={(e) => setReminderMode(e.target.value)}>
                <option value="batchDayBefore">יום לפני — לכל לקוחות המחר ביחד (בערב)</option>
                <option value="batchSameDay">באותו יום — לכל לקוחות היום ביחד (בבוקר)</option>
                <option value="perClient">לכל לקוח בנפרד — כמה שעות לפני התור שלו</option>
              </select>
            </div>
            {reminderMode === 'perClient' && (
              <div className="field" style={{ margin: 0 }}>
                <label>כמה זמן לפני התור?</label>
                <select value={reminderHoursBefore} onChange={(e) => setReminderHoursBefore(Number(e.target.value))}>
                  <option value={1}>שעה לפני</option>
                  <option value={2}>שעתיים לפני</option>
                  <option value={3}>שלוש שעות לפני</option>
                </select>
              </div>
            )}
          </div>
        )}

        <label className="row" style={{ alignItems: 'center', cursor: 'pointer', gap: 12 }}>
          <div
            className={`toggle ${thankYouEnabled ? 'on' : ''}`}
            onClick={() => setThankYouEnabled((v) => !v)}
            role="switch"
            aria-checked={thankYouEnabled}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setThankYouEnabled((v) => !v); } }}
            style={{ flex: 'none' }}
          />
          <div style={{ flex: 1 }}>
            <strong><Star size={14} className="icon-inline" />הודעת תודה + בקשת דירוג בגוגל</strong>
            <div className="muted" style={{ fontSize: '0.84rem', marginTop: 2, lineHeight: 1.5 }}>
              חצי שעה אחרי שהתור נגמר (לפי היומן), הלקוח מקבל הודעת תודה עם הקישור לדירוג בגוגל.
            </div>
          </div>
        </label>
        {thankYouEnabled && !googleReviewUrl && (
          <div className="card-inset" style={{ marginTop: 8, fontSize: '0.84rem', lineHeight: 1.6 }}>
            <strong style={{ color: '#b91c1c' }}>
              ⚠️ חסר לינק לביקורת בגוגל — בלעדיו הודעת התודה לא תישלח.
            </strong>
            <p style={{ margin: '6px 0 0' }}>
              ממש כדאי להוסיף — כל לקוח מרוצה שמשאיר ביקורת בגוגל מביא אליך לקוחות
              חדשים שמחפשים בעל מקצוע באזור.
            </p>
            <p style={{ margin: '8px 0 0' }}>
              <strong>איך משיגים (2 דקות):</strong><br />
              1. כנס/י ל-
              <a href="https://business.google.com" target="_blank" rel="noopener noreferrer">Google Business Profile</a><br />
              2. "קבל/י עוד ביקורות" ← "שתף/י טופס ביקורת"<br />
              3. העתק/י את הקישור והדבק/י בכרטיס <strong>"ביקורות בגוגל"</strong> למעלה ↑
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><MessageCircle size={18} className="icon-inline" />קבוצת לקוחות בוואטסאפ</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.85rem' }}>
          הדבק קישור לקבוצת הלקוחות שלך בוואטסאפ. בדשבורד, "הודעה לכל הלקוחות" יפתח את הקבוצה עם תבנית הודעה מוכנה.
        </p>
        <div className="field">
          <label>קישור לקבוצה</label>
          <input
            type="url"
            value={waGroupLink}
            onChange={(e) => setWaGroupLink(e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
            dir="ltr"
            style={{ direction: 'ltr', textAlign: 'left' }}
          />
          <p className="muted" style={{ fontSize: '0.75rem', marginTop: 6 }}>
            בוואטסאפ: פתח את הקבוצה → הקש על שם הקבוצה → "קישור הזמנה לקבוצה" → העתק.
          </p>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><CreditCard size={18} className="icon-inline" />קבלת תשלום מהלקוח (אופציונלי)</h3>
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
          {showPayHelp
            ? <><ChevronUp size={14} className="icon-inline" />הסתר הוראות</>
            : <><Lightbulb size={14} className="icon-inline" />איך משיגים את הלינקים? — הוראות</>}
        </button>

        {showPayHelp && (
          <div className="card-inset" style={{ marginBottom: 16, fontSize: '0.9rem', lineHeight: 1.6 }}>
            <strong>🔵 Bit</strong>
            <p style={{ marginTop: 4, marginBottom: 0 }}>
              Bit מבוססת על מספרי טלפון בלבד — אין יותר חשבונות עסקיים נפרדים ואין לינקים לתשלום. מלא את <strong>"מספר Bit"</strong> למטה (המספר שלך באפליקציה). כשהלקוח לוחץ "שלם ב-Bit" המספר שלך מועתק לקליפבורד עם הסכום, והוא פותח את Bit, מדביק וישלם.
            </p>

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
          <label>🟣 PayBox — לינק עסקי לתשלום</label>
          <input
            value={payboxLink}
            onChange={(e) => setPayboxLink(e.target.value)}
            placeholder="https://payboxapp.com/..."
            dir="ltr"
            style={{ direction: 'ltr', textAlign: 'left' }}
          />
        </div>

        {/* Legacy Bit URL field — only show if a user has one saved from
            before Bit removed business accounts (May 2026). New users
            don't get this field at all. */}
        {bitLink && (
          <div className="field">
            <label>🔵 Bit — לינק עסקי (לגאסי, לא קיים יותר ב-Bit החדשה)</label>
            <input
              value={bitLink}
              onChange={(e) => setBitLink(e.target.value)}
              placeholder=""
              dir="ltr"
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
            <p className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
              Bit ביטלה את שירות "Bit לעסקים" — תוכל למחוק את השדה ולהשתמש רק במספר Bit שלך למטה.
            </p>
          </div>
        )}

        <div className="card-inset">
          <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 8px' }}>
            <strong>Bit ו-PayBox:</strong> Bit עובדת לפי מספר טלפון בלבד. PayBox תומך גם בלינק וגם במספר. תמלא לפחות מספר אחד כדי שהלקוחות יוכלו לשלם.
          </p>
          <div className="field" style={{ marginBottom: 8 }}>
            <label className="muted">📞 מספר Bit שלך</label>
            <input type="tel" inputMode="numeric" value={bitPhone} onChange={(e) => setBitPhone(e.target.value)} placeholder="050-1234567" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="muted">📞 מספר PayBox (אם אין לינק)</label>
            <input type="tel" inputMode="numeric" value={payboxPhone} onChange={(e) => setPayboxPhone(e.target.value)} placeholder="050-1234567" />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Scissors size={18} className="icon-inline" />שירותים</h3>
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
                <button className="btn-danger" style={{ padding: '12px 14px' }} onClick={() => removeService(s.id)} type="button" aria-label="מחק"><Trash2 size={16} /></button>
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
        <h3 style={{ marginTop: 0 }}><Sparkles size={18} className="icon-inline" />תוספות (אופציונלי ללקוח)</h3>
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
                <button className="btn-danger" style={{ padding: '12px 14px' }} onClick={() => removeAddon(a.id)} type="button" aria-label="מחק"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        <button className="btn-secondary" onClick={addAddon} type="button" style={{ width: '100%', marginTop: 8 }}>
          + הוסף תוספת
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Sparkles size={18} className="icon-inline" />מוצרים למכירה</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          מוצרים פיזיים שאת/ה מוכר/ת בעסק (שמפו, ג'ל, שעוות, אביזרים). מוצגים כקטלוג ללקוח — בלי עגלת קניות עדיין.
        </p>
        {products.map((p) => (
          <div key={p.id} className="service-row">
            <input
              placeholder="שם המוצר (לדוגמה: שמפו מקצועי)"
              value={p.name}
              onChange={(e) => updateProduct(p.id, { name: e.target.value })}
              style={{ marginBottom: 6 }}
            />
            <input
              placeholder="תיאור קצר (אופציונלי)"
              value={p.description}
              onChange={(e) => updateProduct(p.id, { description: e.target.value })}
              style={{ marginBottom: 6, fontSize: '0.88rem' }}
            />
            <div className="row">
              <div style={{ flex: 1 }}>
                <label className="muted" style={{ fontSize: '0.85rem' }}>מחיר ₪</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={p.price}
                  onChange={(e) => updateProduct(p.id, { price: e.target.value })}
                />
              </div>
              <div style={{ flex: 'none' }}>
                <label className="muted" style={{ fontSize: '0.85rem', visibility: 'hidden' }}>מחק</label>
                <button
                  className="btn-danger"
                  style={{ padding: '12px 14px' }}
                  onClick={() => removeProduct(p.id)}
                  type="button"
                  aria-label="מחק"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        <button className="btn-secondary" onClick={addProduct} type="button" style={{ width: '100%', marginTop: 8 }}>
          + הוסף מוצר
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Briefcase size={18} className="icon-inline" />ניהול עובדים</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          הוסף עובדים נוספים שעובדים אצלך. כשהלקוח קובע תור הוא יבחר עם איזה עובד. ביומן תוכל לראות את התורים של כל עובד בנפרד.
        </p>
        {employees.length === 0 && (
          <p className="muted" style={{ fontSize: '0.84rem', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
            אין עובדים נוספים — אתה עובד/ת לבד. הוסף/י עובדים כדי לאפשר ללקוחות לבחור מי יטפל בהם.
          </p>
        )}
        {employees.map((e) => (
          <div key={e.id} className="service-row">
            <input
              placeholder="שם העובד (לדוגמה: דני)"
              value={e.name}
              onChange={(ev) => updateEmployee(e.id, { name: ev.target.value })}
              style={{ marginBottom: 6 }}
              maxLength={40}
            />
            <input
              placeholder="קישור לתמונה (אופציונלי)"
              value={e.photoUrl}
              onChange={(ev) => updateEmployee(e.id, { photoUrl: ev.target.value })}
              style={{ marginBottom: 6, fontSize: '0.88rem' }}
              dir="ltr"
            />
            <div className="row" style={{ alignItems: 'center', gap: 12 }}>
              <label className="row" style={{ alignItems: 'center', cursor: 'pointer', gap: 8, flex: 1 }}>
                <div
                  className={`toggle ${e.active !== false ? 'on' : ''}`}
                  onClick={() => updateEmployee(e.id, { active: e.active === false })}
                  role="switch"
                  aria-checked={e.active !== false}
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === ' ' || ev.key === 'Enter') {
                      ev.preventDefault();
                      updateEmployee(e.id, { active: e.active === false });
                    }
                  }}
                  style={{ flex: 'none' }}
                />
                <span className="muted" style={{ fontSize: '0.86rem' }}>
                  {e.active !== false ? 'פעיל — מופיע ללקוחות' : 'לא פעיל — מוסתר ללקוחות'}
                </span>
              </label>
              <button
                className="btn-danger"
                style={{ padding: '10px 14px', flex: 'none' }}
                onClick={() => removeEmployee(e.id)}
                type="button"
                aria-label="מחק עובד"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        <button className="btn-secondary" onClick={addEmployee} type="button" style={{ width: '100%', marginTop: 8 }}>
          + הוסף עובד
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Briefcase size={18} className="icon-inline" />כמות כסאות / עמדות עבודה</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: '0.86rem' }}>
          אם יש לך יותר מעמדה אחת (למשל 2-3 כסאות במספרה), היומן יתחלק לעמודות נפרדות — תוכל לראות מי יושב באיזה כסא. כל תור חדש יקבל מספר כסא אוטומטית. השאר על 1 אם אתה עובד/ת בכסא אחד.
        </p>
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <label className="muted" style={{ fontSize: '0.9rem', flex: 'none' }}>מספר כסאות</label>
          <select
            value={chairsCount}
            onChange={(e) => setChairsCount(Number(e.target.value) || 1)}
            style={{ flex: 1 }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>{n === 1 ? 'כסא אחד (ברירת מחדל)' : `${n} כסאות`}</option>
            ))}
          </select>
        </div>
        {chairsCount > 1 && (
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 10, marginBottom: 0, padding: 10, background: 'var(--gold-soft)', border: '1px solid rgba(184, 137, 58, 0.30)', borderRadius: 'var(--radius-sm)' }}>
            <Sparkles size={12} className="icon-inline" />
            <strong>{chairsCount} כסאות נבחרו.</strong> היומן ה-Day Timeline יציג {chairsCount} עמודות במקביל, וכל תור חדש יקבל מספר כסא (1-{chairsCount}) באופן אוטומטי.
          </p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Check size={18} className="icon-inline" />אישור תורים</h3>
        <label className="row" style={{ alignItems: 'center', cursor: 'pointer', gap: 12 }}>
          <div
            className={`toggle ${requireApproval ? 'on' : ''}`}
            onClick={() => setRequireApproval((v) => !v)}
            role="switch"
            aria-checked={requireApproval}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRequireApproval((v) => !v); }
            }}
            style={{ flex: 'none' }}
          />
          <div style={{ flex: 1 }}>
            <strong>דורש אישור שלי לכל תור חדש</strong>
            <div className="muted" style={{ fontSize: '0.84rem', marginTop: 2, lineHeight: 1.5 }}>
              כשדלוק — כל תור שלקוח קובע ממתין לאישור שלך לפני שנכנס ליומן.
              כשמכובה (ברירת מחדל) — התור נקבע אוטומטית.
            </div>
          </div>
        </label>
        {requireApproval && (
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 10, marginBottom: 0, padding: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', lineHeight: 1.55 }}>
            <Sparkles size={12} className="icon-inline" />
            אחרי שתאשר/י תור — הלקוח יקבל אישור אוטומטי ב-WhatsApp עם פרטי התור (כשהשירות פעיל).
          </p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Repeat size={18} className="icon-inline" />אפשרויות הזמנה</h3>
        <label className="row" style={{ alignItems: 'center', cursor: 'pointer', gap: 12 }}>
          <div
            className={`toggle ${allowRecurring ? 'on' : ''}`}
            onClick={() => setAllowRecurring((v) => !v)}
            role="switch"
            aria-checked={allowRecurring}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setAllowRecurring((v) => !v);
              }
            }}
            style={{ flex: 'none' }}
          />
          <div style={{ flex: 1 }}>
            <strong>אפשר ללקוח לקבוע "תור קבוע"</strong>
            <div className="muted" style={{ fontSize: '0.84rem', marginTop: 2, lineHeight: 1.5 }}>
              כשדלוק — ללקוח יוצג צ'קבוקס שמאפשר לקבוע סדרת תורים בתדירות קבועה (כל שבוע / שבועיים / 3 / 4 שבועות). כבוי כברירת מחדל כדי שתוכלו לנהל סדרות בעצמכם.
            </div>
          </div>
        </label>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Star size={18} className="icon-inline" />כרטיסיית נאמנות</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          כל לקוח צובר ביקורים, ואחרי מספר שתבחר/י — מגיע לו פרס. ההתקדמות מופיעה
          אוטומטית בכרטיס הלקוח.
        </p>
        <label className="row" style={{ alignItems: 'center', cursor: 'pointer', gap: 12, marginBottom: loyaltyEnabled ? 16 : 0 }}>
          <div
            className={`toggle ${loyaltyEnabled ? 'on' : ''}`}
            onClick={() => setLoyaltyEnabled((v) => !v)}
            role="switch"
            aria-checked={loyaltyEnabled}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setLoyaltyEnabled((v) => !v); }
            }}
            style={{ flex: 'none' }}
          />
          <div style={{ flex: 1 }}>
            <strong>הפעל כרטיסיית נאמנות</strong>
            <div className="muted" style={{ fontSize: '0.84rem', marginTop: 2, lineHeight: 1.5 }}>
              מנוע retention — לקוחות חוזרים כדי לצבור את הפרס.
            </div>
          </div>
        </label>
        {loyaltyEnabled && (
          <div className="card-inset" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>אחרי כמה ביקורים מגיע פרס?</label>
              <select value={loyaltyEveryN} onChange={(e) => setLoyaltyEveryN(Number(e.target.value))}>
                {[5, 6, 7, 8, 9, 10, 12, 15, 20].map((n) => (
                  <option key={n} value={n}>כל {n} ביקורים</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>מה הפרס?</label>
              <input
                value={loyaltyReward}
                onChange={(e) => setLoyaltyReward(e.target.value)}
                placeholder="לדוגמה: תספורת חינם / 50% הנחה / מוצר במתנה"
                maxLength={60}
              />
            </div>
            <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
              <Sparkles size={12} className="icon-inline" />
              דוגמה: "כל {loyaltyEveryN} ביקורים → {loyaltyReward || 'פרס'}". בכרטיס הלקוח תראה/י
              התקדמות וכפתור "מימש פרס".
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Clock size={18} className="icon-inline" />שעות עבודה</h3>
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
                  {cfg.break?.start && cfg.break?.end && (
                    <div className="field" style={{ marginTop: 10 }}>
                      <label className="muted" style={{ fontSize: '0.8rem' }}>זמינות ההפסקה</label>
                      <div className="row" style={{ gap: 4 }}>
                        {[
                          { v: 'closed',  label: 'סגורה',  desc: 'לא זמינה לאף אחד' },
                          { v: 'private', label: 'פרטית', desc: 'רק אתה משבץ' },
                          { v: 'open',    label: 'פתוחה', desc: 'גם לקוחות יכולים' },
                        ].map((opt) => {
                          const cur = cfg.break?.mode || 'closed';
                          const on = cur === opt.v;
                          return (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => updateBreak(day, { mode: opt.v })}
                              className={on ? 'btn-primary' : 'btn-secondary'}
                              title={opt.desc}
                              style={{ flex: 1, padding: '8px 4px', fontSize: '0.78rem', flexDirection: 'column', gap: 2 }}
                            >
                              <span>{opt.label}</span>
                              <span style={{ fontSize: '0.62rem', opacity: 0.7, fontWeight: 400 }}>{opt.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
