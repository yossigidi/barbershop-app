import { useEffect, useMemo, useState } from 'react';
import { BarChart3, X, Share2 } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { dateToISO } from '../utils/slots';
import { whatsappUrl } from '../utils/whatsapp';

// Sunday-morning banner that summarises the previous week.
// In Israel the working week starts on Sunday; we surface this between Sunday
// 00:00 and Sunday 23:59 so the barber sees it the moment they open the app.
export default function WeeklyReportCard({ uid, businessName }) {
  const [stats, setStats] = useState(null);
  const [hidden, setHidden] = useState(() => {
    // remember "hide for today" so it doesn't keep showing
    try {
      const k = localStorage.getItem('bs_weeklyHidden');
      const today = dateToISO(new Date());
      return k === today;
    } catch { return false; }
  });

  const isSunday = new Date().getDay() === 0;

  // Range: previous Sun 00:00 → previous Sat 23:59
  const range = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lastSat = new Date(today); lastSat.setDate(today.getDate() - 1); // yesterday = sat (if today is sun)
    const lastSun = new Date(lastSat); lastSun.setDate(lastSat.getDate() - 6);
    return { from: dateToISO(lastSun), to: dateToISO(lastSat) };
  }, []);

  useEffect(() => {
    if (!isSunday || hidden) return;
    (async () => {
      const q = query(
        collection(db, 'barbers', uid, 'bookings'),
        where('date', '>=', range.from),
        where('date', '<=', range.to),
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const completed = list.filter((b) => b.status === 'completed' || b.status === 'booked' || b.status === 'inProgress');
      const cancelled = list.filter((b) => b.status === 'cancelled');
      const revenue = completed.reduce((s, b) => s + (Number(b.price) || 0), 0);
      const uniqueClients = new Set(completed.map((b) => b.clientPhone)).size;
      setStats({
        count: completed.length,
        revenue,
        cancelled: cancelled.length,
        uniqueClients,
      });
    })();
  }, [uid, range.from, range.to, isSunday, hidden]);

  if (!isSunday || hidden || !stats) return null;

  function dismiss() {
    try { localStorage.setItem('bs_weeklyHidden', dateToISO(new Date())); } catch {}
    setHidden(true);
  }

  function share() {
    const txt =
      `📊 דוח שבועי — ${businessName}\n\n` +
      `🪒 ${stats.count} תורים\n` +
      `💰 ₪${stats.revenue} הכנסה\n` +
      `👥 ${stats.uniqueClients} לקוחות שונים\n` +
      (stats.cancelled > 0 ? `❌ ${stats.cancelled} ביטולים\n` : '') +
      `\nשבוע טוב!`;
    window.open(whatsappUrl(txt), '_blank');
  }

  return (
    <div className="card weekly-card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <strong><BarChart3 size={16} className="icon-inline" />השבוע שעבר</strong>
          <div className="weekly-stats">
            <span><strong>{stats.count}</strong> תורים</span>
            <span>•</span>
            <span><strong>₪{stats.revenue}</strong></span>
            <span>•</span>
            <span><strong>{stats.uniqueClients}</strong> לקוחות</span>
            {stats.cancelled > 0 && (
              <>
                <span>•</span>
                <span className="text-danger"><strong>{stats.cancelled}</strong> ביטולים</span>
              </>
            )}
          </div>
        </div>
        <button
          className="btn-secondary"
          style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 'none' }}
          onClick={dismiss}
          aria-label="סגור"
        >
          <X size={14} />
        </button>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn-secondary" style={{ flex: 1, fontSize: '0.85rem' }} onClick={share}>
          <Share2 size={14} className="icon-inline" />שתף
        </button>
      </div>
    </div>
  );
}
