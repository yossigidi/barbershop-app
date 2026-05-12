import { useEffect, useMemo, useState } from 'react';
import {
  Megaphone, Send, X, Tag, Palmtree, PartyPopper, Sparkles, AlertCircle, Filter,
  Smartphone, ClipboardPaste, UserPlus, CalendarPlus,
} from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { whatsappUrl } from '../utils/whatsapp';
import {
  extractPhones, isValidIsraeliPhone, normalizeIsraeliPhone,
  pickContactsFromDevice, isContactPickerSupported,
} from '../utils/phoneImport';

// Mass-broadcast modal — sends one message to ALL the barber's saved
// clients via WhatsApp. Use cases: price-increase notice, going on
// vacation, holiday greeting, opening-hours change, general announcement.
//
// WhatsApp doesn't expose a real broadcast API at the wa.me URL level —
// each recipient still requires a separate tab. We mitigate that by
// batching (default 5 at a time) so the popup blocker doesn't choke,
// and tracking sent state in localStorage so the operator can resume
// later without sending duplicates.
//
// Props:
//   open, onClose, barberId, businessName

function buildTemplates(shortLink) {
  const link = shortLink || '';
  return [
    {
      key: 'invite',
      label: 'הזמנה לקבוע תור',
      icon: CalendarPlus,
      body:
        `שלום!\n\n` +
        `מזמין/ה אותך לקבוע תור אצלי דרך הקישור הבא:\n` +
        (link ? `${link}\n\n` : `[הקישור שלך — מופיע בדף "עוד" של הדשבורד]\n\n`) +
        `שולח/ת ישירות לוואטסאפ של הלקוחות. ללא יישום להוריד, ללא הרשמה ארוכה.\n\n` +
        `נתראה!`,
    },
    {
      key: 'priceUp',
      label: 'עליית מחירים',
      icon: Tag,
      body:
        `שלום!\n\n` +
        `אני רוצה לעדכן אותך מראש שהחל מ-[תאריך], המחירים אצלי יתעדכנו מעט.\n` +
        `המחיר החדש לתספורת/טיפול: ₪[סכום].\n\n` +
        `מודה לך על האמון, ונתראה בהקדם 🙏`,
    },
    {
      key: 'vacation',
      label: 'חופשה',
      icon: Palmtree,
      body:
        `שלום!\n\n` +
        `אני יוצא/ת לחופשה מ-[תאריך התחלה] עד [תאריך סיום].\n` +
        `מי שצריך תור — אשמח לקבוע לפני או אחרי 🙂\n\n` +
        `נתראה!`,
    },
    {
      key: 'holiday',
      label: 'ברכת חג',
      icon: PartyPopper,
      body:
        `שלום!\n\n` +
        `חג שמח 🎉\n` +
        `מאחל/ת לך ולבני המשפחה חג מאיר ושמח, מלא בריאות ושמחה.\n\n` +
        `אם תרצה/י לקבוע תור לקראת החג — אני כאן.`,
    },
    {
      key: 'custom',
      label: 'משלך',
      icon: Sparkles,
      body: '',
    },
  ];
}

const PROGRESS_KEY = 'bs_broadcastProgress_v1';
const BATCH_SIZE = 5;

export default function BroadcastModal({ open, onClose, barberId, businessName, shortLink, initialBody, initialTemplateKey }) {
  const TEMPLATES = useMemo(() => buildTemplates(shortLink), [shortLink]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [templateKey, setTemplateKey] = useState(initialTemplateKey || 'custom');
  const [body, setBody] = useState(initialBody || '');
  // Sync if the parent re-opens us with a different pre-fill (e.g. user
  // saved a NEW vacation right after the previous one).
  useEffect(() => {
    if (!open) return;
    if (initialBody !== undefined) setBody(initialBody || '');
    if (initialTemplateKey !== undefined) setTemplateKey(initialTemplateKey || 'custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialBody, initialTemplateKey]);
  const [personalize, setPersonalize] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);
  const [sentIds, setSentIds] = useState(new Set());
  const [confirmFirst, setConfirmFirst] = useState(false);
  // Import sub-flow
  const [importOpen, setImportOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  // Persist sent state per session+barberId so the operator can resume.
  // Key includes the message hash so a NEW message starts a fresh log.
  const sentKey = useMemo(() => {
    const hash = (body || '').slice(0, 40).replace(/\s+/g, '_');
    return `${PROGRESS_KEY}_${barberId}_${hash}`;
  }, [barberId, body]);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(sentKey);
      setSentIds(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { setSentIds(new Set()); }
  }, [open, sentKey]);

  useEffect(() => {
    try { localStorage.setItem(sentKey, JSON.stringify([...sentIds])); } catch {}
  }, [sentIds, sentKey]);

  // Load clients once when modal opens
  useEffect(() => {
    if (!open || !barberId) return;
    let stale = false;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'barbers', barberId, 'clients'));
        if (stale) return;
        const list = snap.docs
          .map((d) => d.data())
          .filter((c) => c.phone && c.firstName)
          .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'he'));
        setClients(list);
      } catch (e) {
        console.error('clients load failed', e?.message);
      } finally {
        if (!stale) setLoading(false);
      }
    })();
    return () => { stale = true; };
  }, [open, barberId]);

  function pickTemplate(t) {
    setTemplateKey(t.key);
    setBody(t.body);
    setSentIds(new Set());
  }

  // ── Contact import ──────────────────────────────────────────────────
  // Save imported phones to barbers/{uid}/clients/{phone}. Reuses the same
  // collection that real signups write to, so they appear in this modal's
  // client list immediately. Marks `source: 'imported'` so we can spot
  // them later (e.g. for analytics or offering a "convert to real" CTA).
  async function importContacts(entries) {
    if (!entries || entries.length === 0) return { added: 0, skipped: 0 };
    const existing = new Set(clients.map((c) => c.phone));
    let added = 0;
    let skipped = 0;
    for (const e of entries) {
      const phone = normalizeIsraeliPhone(e.phone);
      if (!isValidIsraeliPhone(phone)) { skipped++; continue; }
      if (existing.has(phone)) { skipped++; continue; }
      try {
        await setDoc(doc(db, 'barbers', barberId, 'clients', phone), {
          phone,
          firstName: (e.firstName || '').trim() || 'לקוח',
          lastName: (e.lastName || '').trim(),
          createdAt: new Date().toISOString(),
          source: 'imported',
        }, { merge: true });
        added++;
      } catch (err) {
        console.warn('import failed for', phone, err?.message);
        skipped++;
      }
    }
    // Refresh local list
    if (added > 0) {
      const snap = await getDocs(collection(db, 'barbers', barberId, 'clients'));
      const list = snap.docs.map((d) => d.data())
        .filter((c) => c.phone && c.firstName)
        .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'he'));
      setClients(list);
    }
    return { added, skipped };
  }

  async function pickFromDevice() {
    setImporting(true);
    setImportMsg('');
    try {
      const picked = await pickContactsFromDevice();
      if (picked.length === 0) {
        setImportMsg('לא נבחרו אנשי קשר.');
        return;
      }
      const { added, skipped } = await importContacts(picked);
      setImportMsg(`נוספו ${added} אנשי קשר חדשים${skipped > 0 ? `, ${skipped} דולגו (כבר קיימים או לא תקינים)` : ''}.`);
    } catch (e) {
      setImportMsg(e.message || 'שגיאה בטעינת אנשי קשר');
    } finally {
      setImporting(false);
    }
  }

  async function importFromPaste() {
    setImporting(true);
    setImportMsg('');
    try {
      const phones = extractPhones(pasteText);
      if (phones.length === 0) {
        setImportMsg('לא נמצאו מספרי טלפון בטקסט. נסה להדביק שוב.');
        return;
      }
      const entries = phones.map((p) => ({ phone: p, firstName: '', lastName: '' }));
      const { added, skipped } = await importContacts(entries);
      setImportMsg(`נוספו ${added} מספרים חדשים${skipped > 0 ? `, ${skipped} דולגו (כבר קיימים או לא תקינים)` : ''}.`);
      if (added > 0) setPasteText('');
    } catch (e) {
      setImportMsg(e.message || 'שגיאה');
    } finally {
      setImporting(false);
    }
  }

  // Active = booked at least once in the last 6 months — looser than the
  // "win-back" memory module, but a useful coarse filter for broadcasts.
  const filteredClients = useMemo(() => {
    if (!activeOnly) return clients;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return clients.filter((c) => {
      const last = c.lastBookingAt;
      if (!last) return true; // unknown = include
      const lastDate = last?.toDate?.() || new Date(last);
      return lastDate >= cutoff;
    });
  }, [clients, activeOnly]);

  const pendingClients = filteredClients.filter((c) => !sentIds.has(c.phone));

  function buildMessage(c) {
    const greeting = personalize && c.firstName
      ? body.replace(/^שלום!?\s*/, `שלום ${c.firstName}!\n\n`)
      : body;
    // Sign-off only for non-custom templates that don't already mention the business
    if (!greeting.includes(businessName) && templateKey !== 'custom') {
      return `${greeting}\n\n— ${businessName}`;
    }
    return greeting;
  }

  function sendBatch() {
    if (!body.trim()) {
      alert('נא לכתוב הודעה לפני שליחה');
      return;
    }
    if (pendingClients.length === 0) return;

    if (!confirmFirst && pendingClients.length > BATCH_SIZE) {
      const ok = window.confirm(
        `נפתחו ${Math.min(BATCH_SIZE, pendingClients.length)} חלוניות וואטסאפ בסיבוב הזה. ` +
        `סה״כ ${pendingClients.length} לקוחות לשליחה — תוכל/י להמשיך עם "סיבוב הבא" אחרי כל קבוצה.`,
      );
      if (!ok) return;
      setConfirmFirst(true);
    }

    const batch = pendingClients.slice(0, BATCH_SIZE);
    const newSent = new Set(sentIds);
    for (const c of batch) {
      const msg = buildMessage(c);
      window.open(whatsappUrl(msg, c.phone), '_blank');
      newSent.add(c.phone);
    }
    setSentIds(newSent);
  }

  function resetSent() {
    if (confirm('לאפס את סימוני "נשלח" עבור ההודעה הזו?')) {
      setSentIds(new Set());
    }
  }

  if (!open) return null;

  const sentCount = filteredClients.filter((c) => sentIds.has(c.phone)).length;
  const total = filteredClients.length;
  const allSent = total > 0 && sentCount === total;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal broadcast-modal" onClick={(e) => e.stopPropagation()}>
        <div className="broadcast-head">
          <h2 style={{ margin: 0 }}>
            <Megaphone size={20} className="icon-inline" />
            הודעה לכל הלקוחות
          </h2>
          <button type="button" className="auth-close" onClick={onClose} aria-label="סגור">
            <X size={18} />
          </button>
        </div>
        <p className="muted" style={{ marginTop: 4, fontSize: '0.86rem' }}>
          שולח/ת הודעת WhatsApp לכל הלקוחות שנשמרו אצלך. מתאים לעליית מחירים,
          חופשה, ברכת חג, או הזמנה ראשונית למי שטרם קבע.
        </p>

        {/* Import contacts */}
        <div className="broadcast-import">
          <button
            type="button"
            className="broadcast-import-toggle"
            onClick={() => setImportOpen((o) => !o)}
            aria-expanded={importOpen}
          >
            <UserPlus size={16} aria-hidden="true" />
            הוסף אנשי קשר {importOpen ? '▴' : '▾'}
          </button>
          {importOpen && (
            <div className="broadcast-import-panel">
              <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 10px' }}>
                הוסף לקוחות חדשים שעוד לא קבעו דרך הקישור — לאחר ההוספה יקבלו
                את ההודעה בלחיצת "שלח לכולם". מתאים לרשימת לקוחות מהוואטסאפ.
              </p>
              <div className="broadcast-import-actions">
                {isContactPickerSupported() && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={pickFromDevice}
                    disabled={importing}
                    style={{ width: '100%', marginBottom: 8 }}
                  >
                    <Smartphone size={16} className="icon-inline" />
                    בחר מאנשי הקשר בטלפון
                  </button>
                )}
                <label className="muted" style={{ fontSize: '0.82rem', display: 'block', marginBottom: 4 }}>
                  <ClipboardPaste size={12} className="icon-inline" />
                  או הדבק רשימת טלפונים (מהוואטסאפ / Excel / כל מקור):
                </label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'050-1234567\n0501234567, 052-9876543\n+972501112233'}
                  rows={3}
                  dir="ltr"
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    fontSize: '0.86rem',
                    background: 'var(--surface)',
                    resize: 'vertical',
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={importFromPaste}
                  disabled={importing || !pasteText.trim()}
                  style={{ width: '100%', marginTop: 6 }}
                >
                  <UserPlus size={14} className="icon-inline" />
                  הוסף את המספרים שהודבקו
                </button>
                {importMsg && (
                  <div className="broadcast-import-msg">{importMsg}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Templates */}
        <div className="broadcast-templates">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            const on = templateKey === t.key;
            return (
              <button
                key={t.key}
                type="button"
                className={`broadcast-template ${on ? 'is-on' : ''}`}
                onClick={() => pickTemplate(t)}
              >
                <Icon size={16} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body editor */}
        <div className="field" style={{ marginTop: 10 }}>
          <label className="muted" style={{ fontSize: '0.85rem' }}>תוכן ההודעה</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="כתוב/י כאן את ההודעה שתשלח לכל הלקוחות…"
            rows={7}
            maxLength={500}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              fontFamily: 'inherit',
              fontSize: '0.95rem',
              resize: 'vertical',
              background: 'var(--surface)',
              lineHeight: 1.55,
            }}
          />
          <div className="muted" style={{ fontSize: '0.74rem', textAlign: 'end', marginTop: 2 }}>
            {body.length}/500
          </div>
        </div>

        {/* Options */}
        <div className="broadcast-options">
          <label className="broadcast-option">
            <input type="checkbox" checked={personalize} onChange={(e) => setPersonalize(e.target.checked)} />
            <span>הוסף את שם הלקוח בתחילת ההודעה (מומלץ)</span>
          </label>
          <label className="broadcast-option">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            <span><Filter size={12} className="icon-inline" />רק לקוחות פעילים (6 חודשים אחרונים)</span>
          </label>
        </div>

        {/* Stats + send */}
        {loading ? (
          <div className="muted text-center" style={{ padding: 16 }}>טוען רשימת לקוחות…</div>
        ) : total === 0 ? (
          <div className="empty">
            <AlertCircle size={16} className="icon-inline" />
            אין עדיין לקוחות שמורים. ברגע שלקוחות יזמינו דרך הלינק שלך — הם יופיעו כאן.
          </div>
        ) : (
          <>
            <div className="reminder-progress" style={{ marginTop: 12 }}>
              <div className="reminder-progress-bar">
                <div
                  className="reminder-progress-fill"
                  style={{ width: `${(sentCount / total) * 100}%` }}
                />
              </div>
              <div className="reminder-progress-text">
                {sentCount} מתוך {total} נשלחו
                {pendingClients.length > 0 && ` · נותרו ${pendingClients.length}`}
              </div>
            </div>

            <div className="reminder-bulk-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn-gold"
                onClick={sendBatch}
                disabled={!body.trim() || allSent}
                style={{ flex: 1 }}
              >
                <Send size={16} className="icon-inline" />
                {allSent
                  ? '✓ נשלח לכולם'
                  : pendingClients.length > BATCH_SIZE
                    ? `שלח לקבוצה הבאה (${BATCH_SIZE})`
                    : `שלח לכל ה-${pendingClients.length} שנותרו`}
              </button>
            </div>

            {sentCount > 0 && (
              <button
                type="button"
                className="reminder-reset"
                onClick={resetSent}
              >
                איפוס סימוני "נשלח"
              </button>
            )}
          </>
        )}

        <div className="spacer" />
        <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>
          סגור
        </button>
      </div>
    </div>
  );
}
