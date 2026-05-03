import { useEffect, useState } from 'react';
import { timeToMin } from '../utils/slots';

function greetingFor(hour, name) {
  let greeting, emoji;
  if (hour >= 5 && hour < 12) { greeting = 'בוקר טוב'; emoji = '🌅'; }
  else if (hour >= 12 && hour < 17) { greeting = 'צהריים טובים'; emoji = '☀️'; }
  else if (hour >= 17 && hour < 22) { greeting = 'ערב טוב'; emoji = '🌆'; }
  else { greeting = 'לילה טוב'; emoji = '🌙'; }
  return { greeting: name ? `${greeting}, ${name}` : greeting, emoji };
}

export default function MorningSummaryCard({ displayName, businessName, todayBookings, onTapBooking }) {
  // Tick every minute so "X דק׳ מעכשיו" stays accurate
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const firstName = (displayName || businessName || '').split(' ')[0];
  const { greeting, emoji } = greetingFor(now.getHours(), firstName);

  const active = todayBookings.filter((b) => b.status === 'booked' || b.status === 'inProgress');
  const sorted = [...active].sort((a, b) => a.time.localeCompare(b.time));
  const totalRevenue = active.reduce((s, b) => s + (Number(b.price) || 0), 0);
  const completedCount = todayBookings.filter((b) => b.status === 'completed').length;

  const inProgress = sorted.find((b) => b.status === 'inProgress');
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const upcoming = sorted.filter((b) => b.status === 'booked');
  const next = upcoming.find((b) => timeToMin(b.time) >= nowMin) || upcoming[0];

  function describe(b) {
    return [b.serviceName, b.addons?.length ? `+ ${b.addons.length} תוספות` : ''].filter(Boolean).join(' ');
  }

  return (
    <div className="card morning-card">
      <div className="morning-greeting">
        <span className="morning-emoji">{emoji}</span>
        <span>{greeting}!</span>
      </div>

      {todayBookings.length === 0 ? (
        <div className="morning-empty">
          🌤 יום שקט היום<br />
          <span className="muted">אין תורים מתוכננים</span>
        </div>
      ) : (
        <>
          <div className="morning-stats">
            <div className="morning-stat">
              <div className="morning-stat-label">תורים</div>
              <div className="morning-stat-num">{active.length}</div>
              {completedCount > 0 && (
                <div className="morning-stat-sub">+ {completedCount} הסתיימו</div>
              )}
            </div>
            {totalRevenue > 0 && (
              <div className="morning-stat">
                <div className="morning-stat-label">הכנסה צפויה</div>
                <div className="morning-stat-num">₪{totalRevenue}</div>
              </div>
            )}
          </div>

          {inProgress ? (
            <div className="morning-current in-progress" onClick={() => onTapBooking?.(inProgress)}>
              <div className="morning-current-label">🪒 כעת בכיסא</div>
              <div className="morning-current-name">{inProgress.clientName}</div>
              <div className="morning-current-meta">
                {inProgress.time} • {describe(inProgress)}
                {inProgress.price > 0 ? ` • ₪${inProgress.price}` : ''}
              </div>
            </div>
          ) : next ? (
            <div className="morning-current" onClick={() => onTapBooking?.(next)}>
              <div className="morning-current-label">
                {timeToMin(next.time) >= nowMin ? '⏭ הבא בתור' : '⚠ הראשון להיום'}
              </div>
              <div className="morning-current-name">{next.clientName}</div>
              <div className="morning-current-meta">
                {next.time}
                {timeToMin(next.time) >= nowMin && ` • בעוד ${Math.max(0, timeToMin(next.time) - nowMin)} דק׳`}
                {' • '}{describe(next)}
                {next.price > 0 ? ` • ₪${next.price}` : ''}
              </div>
            </div>
          ) : (
            <div className="morning-current">
              <div className="morning-current-label">✓ סיימת להיום</div>
              <div className="muted">אין יותר תורים — הופ הבא יתפוס</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
