import { useMemo } from 'react';
import { dateToISO } from '../utils/slots';

export default function StatsCard({ bookings }) {
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = dateToISO(today);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    const weekStartISO = dateToISO(startOfWeek);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartISO = dateToISO(startOfMonth);

    let todayCount = 0, todayRev = 0;
    let weekCount = 0, weekRev = 0;
    let monthCount = 0, monthRev = 0;

    for (const b of bookings) {
      if (b.status !== 'booked') continue;
      const price = Number(b.price) || 0;
      if (b.date === todayISO) { todayCount++; todayRev += price; }
      if (b.date >= weekStartISO && b.date <= todayISO) { weekCount++; weekRev += price; }
      if (b.date >= monthStartISO && b.date <= todayISO) { monthCount++; monthRev += price; }
    }
    return { todayCount, todayRev, weekCount, weekRev, monthCount, monthRev };
  }, [bookings]);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>📊 סטטיסטיקות</h3>
      <div className="stats-grid">
        <Stat label="היום" count={stats.todayCount} revenue={stats.todayRev} />
        <Stat label="השבוע" count={stats.weekCount} revenue={stats.weekRev} />
        <Stat label="החודש" count={stats.monthCount} revenue={stats.monthRev} />
      </div>
    </div>
  );
}

function Stat({ label, count, revenue }) {
  return (
    <div className="stat-cell">
      <div className="muted" style={{ fontSize: '0.8rem' }}>{label}</div>
      <div className="stat-num">{count}</div>
      {revenue > 0 && <div className="stat-rev">₪{revenue}</div>}
    </div>
  );
}
