import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, Trophy, PartyPopper, HeartCrack, Sparkles, Phone, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { getAccessState } from '../utils/subscription';
import PaywallModal from '../components/PaywallModal.jsx';
import AIComposeModal from '../components/AIComposeModal.jsx';
import { db } from '../firebase';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { dateToISO, DAY_LABELS_HE, DAYS_OF_WEEK } from '../utils/slots';
import { upcomingHolidays, holidayOn } from '../utils/holidays';
import { findDormantClients } from '../utils/clientMemory';
import { sumExpenses } from '../utils/expenses';

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

function bucket(bookings, fromISO, toISO) {
  let count = 0, revenue = 0;
  for (const b of bookings) {
    if (b.status !== 'booked') continue;
    if (b.date >= fromISO && b.date <= toISO) {
      count++;
      revenue += Number(b.price) || 0;
    }
  }
  return { count, revenue };
}

function pct(curr, prev) {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / prev) * 100);
}

export default function ReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [barberData, setBarberData] = useState(null);
  const [winbackTarget, setWinbackTarget] = useState(null);

  useEffect(() => {
    if (!user) return;
    // Load all bookings (including completed and cancelled). Each section
    // below filters to the statuses it cares about — dormant detection
    // needs cancelled visits to compute risk, top customers want completed too.
    const q = query(collection(db, 'barbers', user.uid, 'bookings'));
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const qExp = query(collection(db, 'barbers', user.uid, 'expenses'));
    const unsubExp = onSnapshot(qExp, (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubBarber = onSnapshot(doc(db, 'barbers', user.uid), (snap) => {
      if (snap.exists()) setBarberData(snap.data());
    });
    return () => { unsub(); unsubExp(); unsubBarber(); };
  }, [user]);

  const access = getAccessState(barberData);
  if (barberData && !access.granted) return <PaywallModal access={access} />;

  const data = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = dateToISO(today);
    const yesterdayISO = dateToISO(addDays(today, -1));

    // This week
    const weekStart = startOfWeek(today);
    const weekStartISO = dateToISO(weekStart);
    const lastWeekStart = addDays(weekStart, -7);
    const lastWeekEnd = addDays(weekStart, -1);

    // This month
    const monthStart = startOfMonth(today);
    const monthStartISO = dateToISO(monthStart);
    const lastMonthStart = addMonths(monthStart, -1);
    const lastMonthEnd = addDays(monthStart, -1);

    const day = bucket(bookings, todayISO, todayISO);
    const yesterday = bucket(bookings, yesterdayISO, yesterdayISO);
    const week = bucket(bookings, weekStartISO, todayISO);
    const lastWeek = bucket(bookings, dateToISO(lastWeekStart), dateToISO(lastWeekEnd));
    const month = bucket(bookings, monthStartISO, todayISO);
    const lastMonth = bucket(bookings, dateToISO(lastMonthStart), dateToISO(lastMonthEnd));

    // Day-of-week breakdown (last 60 days)
    const dowCount = [0, 0, 0, 0, 0, 0, 0];
    const dowRev = [0, 0, 0, 0, 0, 0, 0];
    const sixtyDaysAgo = dateToISO(addDays(today, -60));
    for (const b of bookings) {
      if (b.status !== 'booked' || b.date < sixtyDaysAgo) continue;
      const [y, m, d] = b.date.split('-').map(Number);
      const dayIdx = new Date(y, m - 1, d).getDay();
      dowCount[dayIdx]++;
      dowRev[dayIdx] += Number(b.price) || 0;
    }

    // Last 7 days bars
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const iso = dateToISO(d);
      const stat = bucket(bookings, iso, iso);
      last7.push({ date: d, iso, ...stat });
    }
    const max7 = Math.max(1, ...last7.map((x) => x.count));

    // Holidays in next 12 months with bookings
    const holidays = upcomingHolidays(todayISO, 12).map((h) => {
      const stat = bucket(bookings, h.date, h.date);
      return { ...h, ...stat };
    });

    // All-time totals
    const total = bucket(bookings, '0000-00-00', '9999-99-99');

    // Top customers (last 6 months)
    const sixMonthsAgo = dateToISO(addMonths(today, -6));
    const byClient = new Map();
    for (const b of bookings) {
      if (b.status !== 'booked' && b.status !== 'completed') continue;
      if (b.date < sixMonthsAgo) continue;
      const key = b.clientPhone;
      const existing = byClient.get(key) || { name: b.clientName, phone: key, count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += Number(b.price) || 0;
      byClient.set(key, existing);
    }
    const topCustomers = [...byClient.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    // Busy hours (which hour-of-day has most bookings)
    const hourCount = Array(24).fill(0);
    for (const b of bookings) {
      if (b.status !== 'booked' && b.status !== 'completed') continue;
      if (b.date < sixMonthsAgo) continue;
      const h = Number(b.time.split(':')[0]);
      if (h >= 0 && h < 24) hourCount[h]++;
    }
    const maxHour = Math.max(1, ...hourCount);

    // Net-profit math — pair this month's revenue (from `month`) with this
    // month's expenses (sum from the expenses subscription). Same window
    // for last month. Margin = profit / revenue. Stored as nullable so the
    // UI can hide the card cleanly when there's nothing to show.
    const monthExpenses = sumExpenses(expenses, monthStartISO, todayISO);
    const lastMonthExpenses = sumExpenses(
      expenses, dateToISO(lastMonthStart), dateToISO(lastMonthEnd),
    );
    const monthProfit = month.revenue - monthExpenses;
    const lastMonthProfit = lastMonth.revenue - lastMonthExpenses;
    const monthMargin = month.revenue > 0
      ? Math.round((monthProfit / month.revenue) * 100)
      : null;

    // Dormant clients — driven by per-client memory (visits, avg cycle,
    // days-since-last). Sorted longest-gap first.
    const dormants = findDormantClients(bookings, todayISO);

    return {
      day, yesterday, week, lastWeek, month, lastMonth,
      dowCount, dowRev, last7, max7, holidays, total,
      topCustomers, hourCount, maxHour,
      dormants,
      monthExpenses, lastMonthExpenses, monthProfit, lastMonthProfit, monthMargin,
    };
  }, [bookings, expenses]);

  return (
    <div className="app">
      <div className="header">
        <h1><BarChart3 size={20} className="icon-inline" />דוחות</h1>
        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => navigate('/dashboard')}>חזור</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>השוואה</h3>
        <Compare label="היום מול אתמול" curr={data.day} prev={data.yesterday} />
        <Compare label="השבוע מול השבוע שעבר" curr={data.week} prev={data.lastWeek} />
        <Compare label="החודש מול החודש שעבר" curr={data.month} prev={data.lastMonth} />
      </div>

      {(data.monthExpenses > 0 || data.month.revenue > 0) && (
        <div className="card profit-card">
          <h3 style={{ marginTop: 0 }}>
            <TrendingUp size={18} className="icon-inline" />רווח נטו (החודש)
          </h3>
          <div className="profit-grid">
            <div className="profit-cell">
              <div className="profit-label">הכנסות</div>
              <div className="profit-num is-positive">₪{data.month.revenue.toLocaleString('he-IL')}</div>
            </div>
            <div className="profit-cell">
              <div className="profit-label">הוצאות</div>
              <div className="profit-num is-negative">₪{data.monthExpenses.toLocaleString('he-IL')}</div>
            </div>
            <div className="profit-cell profit-cell-net">
              <div className="profit-label">רווח נטו</div>
              <div className={`profit-num ${data.monthProfit >= 0 ? 'is-profit' : 'is-loss'}`}>
                ₪{data.monthProfit.toLocaleString('he-IL')}
              </div>
              {data.monthMargin != null && (
                <div className="profit-margin">{data.monthMargin}% רווחיות</div>
              )}
            </div>
          </div>
          {data.lastMonthProfit !== 0 && (
            <div className="profit-prev">
              חודש שעבר: ₪{data.lastMonthProfit.toLocaleString('he-IL')} רווח · ₪{data.lastMonthExpenses.toLocaleString('he-IL')} הוצאות
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}><CalendarDays size={18} className="icon-inline" />7 ימים אחרונים</h3>
        <div className="bars">
          {data.last7.map((d) => (
            <div key={d.iso} className="bar-col">
              <div className="bar-num">{d.count || ''}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ height: `${(d.count / data.max7) * 100}%` }} />
              </div>
              <div className="bar-label">
                {DAY_LABELS_HE[DAYS_OF_WEEK[d.date.getDay()]].slice(0, 1)}
                <br />
                {d.date.getDate()}/{d.date.getMonth() + 1}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><BarChart3 size={18} className="icon-inline" />לפי יום בשבוע (60 ימים אחרונים)</h3>
        <div className="dow-list">
          {DAYS_OF_WEEK.map((day, i) => {
            const max = Math.max(1, ...data.dowCount);
            const pctW = (data.dowCount[i] / max) * 100;
            return (
              <div key={day} className="dow-row">
                <div className="dow-name">{DAY_LABELS_HE[day]}</div>
                <div className="dow-bar"><div className="dow-fill" style={{ width: `${pctW}%` }} /></div>
                <div className="dow-stats">
                  {data.dowCount[i]} • ₪{data.dowRev[i]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><Trophy size={18} className="icon-inline" />לקוחות מובילים (6 חודשים)</h3>
        {data.topCustomers.length === 0 ? (
          <div className="empty">אין מספיק נתונים</div>
        ) : (
          data.topCustomers.map((c, i) => (
            <div key={c.phone} className="timeline-row">
              <span className="timeline-time">{i + 1}.</span>
              <span style={{ flex: 1 }}>
                <strong>{c.name}</strong>
                <a href={`tel:${c.phone}`} className="muted" style={{ marginRight: 8, fontSize: '0.85rem' }}>{c.phone}</a>
              </span>
              <span className="text-dim">{c.count} תורים{c.revenue ? ` • ₪${c.revenue}` : ''}</span>
            </div>
          ))
        )}
      </div>

      {data.dormants.length > 0 && (
        <div className="card winback-card">
          <h3 style={{ marginTop: 0 }}>
            <HeartCrack size={18} className="icon-inline" />לקוחות שנעלמו ({data.dormants.length})
          </h3>
          <p className="muted" style={{ marginTop: -6, fontSize: '0.86rem' }}>
            לקוחות שלא חזרו זמן רב מהקצב הרגיל שלהם — אין להם תור עתידי. AI יכתוב להם הודעה אישית בלחיצה אחת.
          </p>
          {data.dormants.slice(0, 12).map((d) => (
            <div key={d.phone} className="winback-row">
              <div className="winback-info">
                <strong>{d.name || 'ללא שם'}</strong>
                <a href={`tel:${d.phone}`} className="muted" style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 4, marginInlineStart: 8 }}>
                  <Phone size={11} />{d.phone}
                </a>
                <div className="winback-meta">
                  <span>{d.memory.visits} ביקורים</span>
                  {d.memory.revenue > 0 && <span> · ₪{d.memory.revenue}</span>}
                  {d.memory.preferredService && <span> · {d.memory.preferredService}</span>}
                  <span className="winback-gap"> · נעלם {d.memory.weeksSinceLastVisit} שבועות</span>
                </div>
              </div>
              <button
                className="btn-gold winback-btn"
                onClick={() => setWinbackTarget(d)}
              >
                <Sparkles size={14} className="icon-inline" />כתב הודעה
              </button>
            </div>
          ))}
          {data.dormants.length > 12 && (
            <p className="muted text-center" style={{ marginTop: 10, fontSize: '0.82rem' }}>
              + {data.dormants.length - 12} לקוחות נוספים
            </p>
          )}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>⏰ שעות עמוסות (6 חודשים)</h3>
        <div className="bars" style={{ height: 120 }}>
          {data.hourCount.map((c, h) => {
            // Only show hours that have any data, or default range 7-22
            if (c === 0 && (h < 7 || h > 22)) return null;
            return (
              <div key={h} className="bar-col">
                <div className="bar-num">{c || ''}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${(c / data.maxHour) * 100}%` }} />
                </div>
                <div className="bar-label" style={{ fontSize: '0.65rem' }}>{h}:00</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}><PartyPopper size={18} className="icon-inline" />חגים קרובים</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          לחיצה על תאריך תראה כמה תורים נקבעו (אם כבר נקבעו).
        </p>
        {data.holidays.length === 0 ? (
          <div className="empty">אין חגים בקרוב</div>
        ) : (
          <div>
            {data.holidays.map((h) => (
              <div key={h.date} className="holiday-row">
                <div className="holiday-emoji">{h.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div className="holiday-name">{h.name}</div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>{formatHebDate(h.date)}</div>
                </div>
                <div className="text-dim">{h.count} תורים</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>סה״כ מתחילת הזמן</h3>
        <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="stat-cell">
            <div className="muted" style={{ fontSize: '0.8rem' }}>תורים</div>
            <div className="stat-num">{data.total.count}</div>
          </div>
          <div className="stat-cell">
            <div className="muted" style={{ fontSize: '0.8rem' }}>הכנסות</div>
            <div className="stat-num">₪{data.total.revenue}</div>
          </div>
        </div>
      </div>

      <div className="spacer" />

      {winbackTarget && (
        <AIComposeModal
          open={true}
          onClose={() => setWinbackTarget(null)}
          booking={{
            clientName: winbackTarget.name,
            clientPhone: winbackTarget.phone,
            serviceName: winbackTarget.memory.preferredService || '',
            date: winbackTarget.memory.lastVisitDate || '',
            time: '',
            addons: [],
          }}
          businessName={barberData?.businessName || ''}
          aiGender={barberData?.aiGender || 'neutral'}
          defaultScenario="winback"
        />
      )}
    </div>
  );
}

function Compare({ label, curr, prev }) {
  const dCount = pct(curr.count, prev.count);
  const dRev = pct(curr.revenue, prev.revenue);
  const arrowCount = dCount > 0 ? '↑' : dCount < 0 ? '↓' : '→';
  const arrowRev = dRev > 0 ? '↑' : dRev < 0 ? '↓' : '→';
  const colorCount = dCount > 0 ? 'text-success' : dCount < 0 ? 'text-danger' : 'text-dim';
  const colorRev = dRev > 0 ? 'text-success' : dRev < 0 ? 'text-danger' : 'text-dim';
  return (
    <div className="compare-row">
      <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 4 }}>{label}</div>
      <div className="row" style={{ gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="muted" style={{ fontSize: '0.75rem' }}>תורים</div>
          <div>
            <strong>{curr.count}</strong>
            <span className={colorCount} style={{ marginRight: 6, fontSize: '0.85rem' }}>
              {arrowCount} {Math.abs(dCount)}%
            </span>
          </div>
          <div className="muted" style={{ fontSize: '0.75rem' }}>היה: {prev.count}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="muted" style={{ fontSize: '0.75rem' }}>הכנסות</div>
          <div>
            <strong>₪{curr.revenue}</strong>
            <span className={colorRev} style={{ marginRight: 6, fontSize: '0.85rem' }}>
              {arrowRev} {Math.abs(dRev)}%
            </span>
          </div>
          <div className="muted" style={{ fontSize: '0.75rem' }}>היה: ₪{prev.revenue}</div>
        </div>
      </div>
    </div>
  );
}

function formatHebDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
