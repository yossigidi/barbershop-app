import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Search, Phone, MessageCircle, Star, Users,
  CalendarClock, TrendingDown, Mail, Repeat, Scissors, Clock,
  AlertTriangle, CalendarPlus, Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import AccessibleModal from '../components/AccessibleModal.jsx';
import ClientPhotos from '../components/ClientPhotos.jsx';

// Barber-facing client book. Merges the clients sub-collection (name,
// phone, notes, VIP) with every booking the barber has, aggregated per
// phone into a rich profile — visits, spend, cadence, favourite service,
// preferred day/time, cancellation rate, next appointment, and a
// predicted return date. The more the barber knows, the better.

const LOST_DAYS = 60;
const HEB_DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function waPhone(phone) {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = '972' + p.slice(1);
  else if (!p.startsWith('972')) p = '972' + p;
  return p;
}
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
function isoToDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function daysSince(iso) {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - isoToDate(iso).getTime()) / 86_400_000);
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function topKey(counts) {
  let best = null, max = 0;
  for (const [k, v] of Object.entries(counts)) if (v > max) { max = v; best = k; }
  return best;
}
function timeBucket(hhmm) {
  const h = Number(String(hhmm || '').slice(0, 2));
  if (h < 12) return 'בוקר';
  if (h < 16) return 'צהריים';
  return 'אחר הצהריים';
}

export default function ClientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [barber, setBarber] = useState(null);
  const [clientDocs, setClientDocs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [lostOnly, setLostOnly] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    let gotClients = false, gotBookings = false;
    const markLoaded = () => { if (gotClients && gotBookings) setLoaded(true); };
    const unsubBarber = onSnapshot(doc(db, 'barbers', user.uid), (snap) => {
      if (snap.exists()) setBarber(snap.data());
    });
    const unsubClients = onSnapshot(collection(db, 'barbers', user.uid, 'clients'), (snap) => {
      setClientDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      gotClients = true; markLoaded();
    });
    const unsubBookings = onSnapshot(collection(db, 'barbers', user.uid, 'bookings'), (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      gotBookings = true; markLoaded();
    });
    return () => { unsubBarber(); unsubClients(); unsubBookings(); };
  }, [user]);

  const loyalty = barber?.loyalty?.enabled ? barber.loyalty : null;

  // Rich per-phone aggregation.
  const statsByPhone = useMemo(() => {
    const map = {};
    const today = todayISO();
    for (const b of bookings) {
      const ph = b.clientPhone;
      if (!ph) continue;
      if (!map[ph]) map[ph] = {
        visits: 0, spent: 0, lastVisit: '', firstSeen: '', total: 0, cancelled: 0,
        upcoming: 0, nextBooking: null, history: [],
        serviceCounts: {}, dowCounts: {}, bucketCounts: {}, email: '',
        completedDates: [],
      };
      const s = map[ph];
      s.total += 1;
      s.history.push(b);
      if (b.clientEmail && !s.email) s.email = b.clientEmail;
      if (!s.firstSeen || b.date < s.firstSeen) s.firstSeen = b.date;
      if (b.status === 'cancelled') s.cancelled += 1;
      if (b.status === 'completed') {
        s.visits += 1;
        s.spent += Number(b.price) || 0;
        s.completedDates.push(b.date);
        if (b.date > s.lastVisit) s.lastVisit = b.date;
        if (b.serviceName) s.serviceCounts[b.serviceName] = (s.serviceCounts[b.serviceName] || 0) + 1;
        const dow = isoToDate(b.date).getDay();
        s.dowCounts[dow] = (s.dowCounts[dow] || 0) + 1;
        const bucket = timeBucket(b.time);
        s.bucketCounts[bucket] = (s.bucketCounts[bucket] || 0) + 1;
      }
      if ((b.status === 'booked' || b.status === 'inProgress') && b.date >= today) {
        s.upcoming += 1;
        if (!s.nextBooking || (b.date + b.time) < (s.nextBooking.date + s.nextBooking.time)) {
          s.nextBooking = b;
        }
      }
    }
    for (const ph of Object.keys(map)) {
      const s = map[ph];
      s.history.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
      // Average cadence (days between completed visits) — needs ≥2 visits.
      s.completedDates.sort();
      if (s.completedDates.length >= 2) {
        let gaps = 0;
        for (let i = 1; i < s.completedDates.length; i++) {
          gaps += (isoToDate(s.completedDates[i]) - isoToDate(s.completedDates[i - 1])) / 86_400_000;
        }
        s.avgCadence = Math.round(gaps / (s.completedDates.length - 1));
      } else {
        s.avgCadence = null;
      }
    }
    return map;
  }, [bookings]);

  const clients = useMemo(() => {
    const byPhone = {};
    for (const c of clientDocs) {
      byPhone[c.phone || c.id] = {
        phone: c.phone || c.id,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || (c.phone || c.id),
        notes: c.notes || '',
        vip: !!c.vip,
        clientSince: c.createdAt?.toDate ? c.createdAt.toDate() : null,
        photos: Array.isArray(c.photos) ? c.photos : [],
        loyaltyRedeemed: Number(c.loyaltyRedeemed) || 0,
      };
    }
    for (const b of bookings) {
      const ph = b.clientPhone;
      if (!ph || byPhone[ph]) continue;
      byPhone[ph] = {
        phone: ph, name: b.clientName || ph, notes: '', vip: false, clientSince: null,
        photos: [], loyaltyRedeemed: 0,
      };
    }
    return Object.values(byPhone).map((c) => {
      const s = statsByPhone[c.phone] || {
        visits: 0, spent: 0, lastVisit: '', firstSeen: '', total: 0, cancelled: 0,
        upcoming: 0, nextBooking: null, history: [], serviceCounts: {}, dowCounts: {},
        bucketCounts: {}, email: '', avgCadence: null,
      };
      const sinceLast = daysSince(s.lastVisit);
      const avg = s.visits > 0 ? Math.round(s.spent / s.visits) : 0;
      const favService = topKey(s.serviceCounts);
      const favDow = topKey(s.dowCounts);
      const favBucket = topKey(s.bucketCounts);
      const cancelRate = s.total > 0 ? Math.round((s.cancelled / s.total) * 100) : 0;
      // Predicted next visit = last visit + average cadence.
      let predictedInDays = null;
      if (s.avgCadence && s.lastVisit) {
        predictedInDays = s.avgCadence - sinceLast; // negative = overdue
      }
      return {
        ...c,
        visits: s.visits, spent: s.spent, lastVisit: s.lastVisit, firstSeen: s.firstSeen,
        upcoming: s.upcoming, nextBooking: s.nextBooking, history: s.history,
        email: c.email || s.email, sinceLast, avgSpend: avg,
        favService, favDow: favDow != null ? HEB_DOW[favDow] : null, favBucket,
        cancelRate, cancelled: s.cancelled, totalBookings: s.total,
        avgCadence: s.avgCadence, predictedInDays,
        lost: s.visits > 0 && sinceLast > LOST_DAYS && s.upcoming === 0,
      };
    });
  }, [clientDocs, bookings, statsByPhone]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = clients;
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    if (lostOnly) list = list.filter((c) => c.lost);
    list = [...list];
    if (sortBy === 'spent') list.sort((a, b) => b.spent - a.spent);
    else if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'he'));
    else list.sort((a, b) => (b.lastVisit || '0').localeCompare(a.lastVisit || '0'));
    return list;
  }, [clients, search, sortBy, lostOnly]);

  const lostCount = useMemo(() => clients.filter((c) => c.lost).length, [clients]);
  const totalRevenue = useMemo(() => clients.reduce((s, c) => s + c.spent, 0), [clients]);
  const selectedClient = selected ? clients.find((c) => c.phone === selected) : null;

  return (
    <div className="app clients-page" dir="rtl" lang="he">
      <div className="header" style={{ paddingBottom: 12 }}>
        <button className="link-button clients-back" onClick={() => navigate('/dashboard')}>
          <ArrowRight size={18} /> חזרה
        </button>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={22} className="icon-inline" /> לקוחות
        </h1>
        <span style={{ width: 56 }} aria-hidden="true" />
      </div>

      <div className="clients-summary">
        <div className="clients-summary-item">
          <span className="cs-num">{clients.length}</span>
          <span className="cs-lbl">לקוחות</span>
        </div>
        <div className="clients-summary-item">
          <span className="cs-num">₪{totalRevenue.toLocaleString('he-IL')}</span>
          <span className="cs-lbl">סך הכנסות</span>
        </div>
        <button
          className={`clients-summary-item cs-lost ${lostOnly ? 'is-active' : ''}`}
          onClick={() => setLostOnly((v) => !v)}
          type="button"
        >
          <span className="cs-num">{lostCount}</span>
          <span className="cs-lbl"><TrendingDown size={12} /> נעלמו</span>
        </button>
      </div>

      <div className="clients-search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם או טלפון…"
        />
      </div>

      <div className="clients-sort">
        {[['recent', 'אחרון'], ['spent', 'הכנסה'], ['name', 'שם']].map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            className={sortBy === k ? 'is-active' : ''}
            onClick={() => setSortBy(k)}
          >
            {lbl}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="loading">טוען…</div>
      ) : filtered.length === 0 ? (
        <div className="clients-empty">
          <Users size={38} aria-hidden="true" />
          <p>{search || lostOnly ? 'לא נמצאו לקוחות שתואמים לסינון.' : 'עוד אין לקוחות. הם יתווספו אוטומטית עם התור הראשון.'}</p>
        </div>
      ) : (
        <div className="clients-list">
          {filtered.map((c) => (
            <button
              key={c.phone}
              type="button"
              className="client-row"
              onClick={() => setSelected(c.phone)}
            >
              <span className="client-avatar">{c.name.charAt(0) || '?'}</span>
              <span className="client-row-main">
                <span className="client-row-name">
                  {c.vip && <Star size={12} className="client-vip-star" aria-label="VIP" />}
                  {c.name}
                </span>
                <span className="client-row-sub">
                  {c.visits > 0 ? `${c.visits} ביקורים · ₪${c.spent.toLocaleString('he-IL')}` : 'עוד לא ביקר'}
                  {c.nextBooking && <span className="client-upcoming"> · תור {fmtDate(c.nextBooking.date)}</span>}
                </span>
              </span>
              <span className="client-row-side">
                {c.lost ? (
                  <span className="client-lost-badge">לא חזר {c.sinceLast} ימים</span>
                ) : c.lastVisit ? (
                  <span className="client-last">{fmtDate(c.lastVisit)}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          uid={user.uid}
          loyalty={loyalty}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ── Client detail — the full profile ────────────────────────────────────
function ClientDetailModal({ client, uid, loyalty, onClose }) {
  const [notes, setNotes] = useState(client.notes || '');
  const [vip, setVip] = useState(client.vip);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => { setVip(client.vip); }, [client.vip]);

  // Loyalty punch-card maths — pure derived from visit count.
  const everyN = loyalty ? Math.max(2, Number(loyalty.everyN) || 10) : 0;
  const earned = everyN ? Math.floor(client.visits / everyN) : 0;
  const available = Math.max(0, earned - client.loyaltyRedeemed);
  const progress = everyN ? client.visits % everyN : 0;
  const toGo = everyN ? everyN - progress : 0;

  async function redeemReward() {
    if (available <= 0) return;
    setRedeeming(true);
    try {
      await setDoc(
        doc(db, 'barbers', uid, 'clients', client.phone),
        { loyaltyRedeemed: increment(1), phone: client.phone, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (e) {
      alert('שגיאה: ' + (e?.message || ''));
    } finally {
      setRedeeming(false);
    }
  }

  async function saveNotes() {
    setSavingNotes(true); setNotesSaved(false);
    try {
      await setDoc(
        doc(db, 'barbers', uid, 'clients', client.phone),
        { notes: notes.trim(), phone: client.phone, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2200);
    } catch (e) {
      alert('שגיאה בשמירה: ' + (e?.message || ''));
    } finally { setSavingNotes(false); }
  }
  async function toggleVip() {
    const next = !vip;
    setVip(next);
    try {
      await setDoc(
        doc(db, 'barbers', uid, 'clients', client.phone),
        { vip: next, phone: client.phone, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (e) {
      setVip(!next);
      alert('שגיאה: ' + (e?.message || ''));
    }
  }

  const wa = `https://wa.me/${waPhone(client.phone)}`;
  const tel = `tel:${client.phone}`;

  // "Client since" — months of tenure, from clientSince or first booking.
  const sinceDate = client.clientSince || (client.firstSeen ? isoToDate(client.firstSeen) : null);
  let tenure = null;
  if (sinceDate) {
    const months = Math.floor((Date.now() - sinceDate.getTime()) / (30 * 86_400_000));
    tenure = months < 1 ? 'פחות מחודש' : months < 12 ? `${months} חודשים` : `${Math.floor(months / 12)} שנים`;
  }

  // Predicted return
  let predictionText = null, predictionTone = 'normal';
  if (client.predictedInDays != null && client.upcoming === 0) {
    if (client.predictedInDays <= -7) { predictionText = `באיחור — בדרך כלל חוזר כל ${client.avgCadence} ימים`; predictionTone = 'overdue'; }
    else if (client.predictedInDays <= 3) { predictionText = 'צפוי לחזור בימים הקרובים'; predictionTone = 'soon'; }
    else { predictionText = `צפוי לחזור בעוד ~${client.predictedInDays} ימים`; predictionTone = 'normal'; }
  }

  return (
    <AccessibleModal open onClose={onClose} titleId="client-detail-title" maxWidth="480px">
      <div className="client-detail-head">
        <span className="client-avatar client-avatar-lg">{client.name.charAt(0) || '?'}</span>
        <div style={{ minWidth: 0 }}>
          <h2 id="client-detail-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            {vip && <Star size={16} className="client-vip-star" aria-label="VIP" />}
            {client.name}
          </h2>
          <a href={tel} className="client-detail-phone" dir="ltr">{client.phone}</a>
          {client.email && (
            <a href={`mailto:${client.email}`} className="client-detail-email" dir="ltr">
              <Mail size={12} /> {client.email}
            </a>
          )}
        </div>
      </div>

      {/* Next appointment — the most actionable thing */}
      {client.nextBooking && (
        <div className="client-next">
          <CalendarPlus size={16} />
          <div>
            <strong>התור הבא</strong>
            <span>{fmtDate(client.nextBooking.date)} · {client.nextBooking.time} · {client.nextBooking.serviceName || 'תור'}</span>
          </div>
        </div>
      )}

      {/* Core stats */}
      <div className="client-detail-stats">
        <div><span className="cd-num">{client.visits}</span><span className="cd-lbl">ביקורים</span></div>
        <div><span className="cd-num">₪{client.spent.toLocaleString('he-IL')}</span><span className="cd-lbl">סה״כ שילם</span></div>
        <div><span className="cd-num">₪{client.avgSpend}</span><span className="cd-lbl">ממוצע לביקור</span></div>
      </div>

      {/* Insight rows — only what we actually have data for */}
      <div className="client-insights">
        {tenure && (
          <div className="ci-row"><Sparkles size={15} /><span>לקוח כבר <strong>{tenure}</strong></span></div>
        )}
        {client.lastVisit && (
          <div className="ci-row"><CalendarClock size={15} /><span>ביקור אחרון: <strong>{fmtDate(client.lastVisit)}</strong> ({client.sinceLast} ימים)</span></div>
        )}
        {client.avgCadence && (
          <div className="ci-row"><Repeat size={15} /><span>חוזר בממוצע כל <strong>{client.avgCadence} ימים</strong></span></div>
        )}
        {predictionText && (
          <div className={`ci-row ci-${predictionTone}`}><Clock size={15} /><span>{predictionText}</span></div>
        )}
        {client.favService && (
          <div className="ci-row"><Scissors size={15} /><span>שירות מועדף: <strong>{client.favService}</strong></span></div>
        )}
        {(client.favDow || client.favBucket) && (
          <div className="ci-row"><Clock size={15} /><span>
            בדרך כלל מגיע{client.favDow ? <> ביום <strong>{client.favDow}</strong></> : ''}{client.favBucket ? <>, ב<strong>{client.favBucket}</strong></> : ''}
          </span></div>
        )}
        {client.cancelRate >= 25 && client.totalBookings >= 3 && (
          <div className="ci-row ci-warn"><AlertTriangle size={15} /><span>
            אחוז ביטולים גבוה: <strong>{client.cancelRate}%</strong> ({client.cancelled} מתוך {client.totalBookings})
          </span></div>
        )}
      </div>

      {client.lost && (
        <div className="client-lost-note">
          <TrendingDown size={15} /> הלקוח לא חזר {client.sinceLast} ימים — אולי שווה הודעת "מתגעגעים".
        </div>
      )}

      {/* Loyalty punch card */}
      {loyalty && (
        <div className={`client-loyalty ${available > 0 ? 'has-reward' : ''}`}>
          <div className="client-loyalty-head">
            <span><Star size={15} /> כרטיסיית נאמנות</span>
            {available > 0
              ? <span className="cl-reward-badge">🎁 {available} פרסים זמינים</span>
              : <span className="cl-togo">עוד {toGo} ל{loyalty.reward}</span>}
          </div>
          <div className="client-loyalty-dots">
            {Array.from({ length: everyN }).map((_, i) => (
              <span key={i} className={`cl-dot ${i < progress ? 'is-punched' : ''}`} />
            ))}
          </div>
          {available > 0 && (
            <button
              type="button"
              className="btn-gold cl-redeem"
              onClick={redeemReward}
              disabled={redeeming}
            >
              {redeeming ? 'רושם…' : `מימש פרס — ${loyalty.reward}`}
            </button>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="client-actions">
        <a href={wa} target="_blank" rel="noopener noreferrer" className="client-action client-action-wa">
          <MessageCircle size={17} /> WhatsApp
        </a>
        <a href={tel} className="client-action client-action-call">
          <Phone size={17} /> חיוג
        </a>
        <button type="button" className={`client-action client-action-vip ${vip ? 'is-on' : ''}`} onClick={toggleVip}>
          <Star size={17} /> {vip ? 'VIP ✓' : 'סמן VIP'}
        </button>
      </div>

      {/* Notes */}
      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="client-notes">הערות (אלרגיות, העדפות, תזכורות)</label>
        <textarea
          id="client-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="לדוגמה: רגיש לתספורת קצרה מדי, מעדיף בוקר, תמיד מאחר 10 דק׳…"
        />
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 8, fontSize: '0.88rem' }}
          onClick={saveNotes}
          disabled={savingNotes || notes.trim() === (client.notes || '').trim()}
        >
          {savingNotes ? 'שומר…' : notesSaved ? 'נשמר ✓' : 'שמור הערות'}
        </button>
      </div>

      {/* Before/after photos */}
      <ClientPhotos uid={uid} phone={client.phone} photos={client.photos} />

      {/* History */}
      <div className="client-history">
        <h3><CalendarClock size={16} className="icon-inline" /> היסטוריית תורים ({client.history.length})</h3>
        {client.history.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.86rem' }}>אין עדיין תורים.</p>
        ) : (
          <ul>
            {client.history.slice(0, 40).map((b) => (
              <li key={b.id} className={`client-hist-row status-${b.status}`}>
                <span className="ch-date">{fmtDate(b.date)} · {b.time}</span>
                <span className="ch-service">{b.serviceName || 'תור'}</span>
                <span className="ch-meta">
                  {b.price > 0 && <span className="ch-price">₪{b.price}</span>}
                  <span className={`ch-status ch-status-${b.status}`}>
                    {b.status === 'completed' ? 'הושלם'
                      : b.status === 'cancelled' ? 'בוטל'
                      : b.status === 'inProgress' ? 'בתהליך'
                      : 'מתוכנן'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AccessibleModal>
  );
}
