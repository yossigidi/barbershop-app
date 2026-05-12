import { useEffect, useState } from 'react';
import {
  Scissors, ChevronLeft, AlertTriangle, Check, Share2,
  Calendar, Wallet, CheckCircle2, Sun, Cloud, Moon, Sunset, Clock,
} from 'lucide-react';
import { timeToMin } from '../utils/slots';
import { whatsappUrl } from '../utils/whatsapp';

// Time-of-day greeting + matching icon (replaces the emoji prefix).
// Returns a lucide icon component for crisp rendering at any size.
function greetingFor(hour, name) {
  let greeting;
  let Icon = Sun;
  if (hour >= 5 && hour < 12) { greeting = 'בוקר טוב'; Icon = Sun; }
  else if (hour >= 12 && hour < 17) { greeting = 'צהריים טובים'; Icon = Sun; }
  else if (hour >= 17 && hour < 22) { greeting = 'ערב טוב'; Icon = Sunset; }
  else { greeting = 'לילה טוב'; Icon = Moon; }
  return {
    greeting: name ? `${greeting}, ${name}` : greeting,
    Icon,
  };
}

export default function MorningSummaryCard({ displayName, businessName, todayBookings, onTapBooking }) {
  // Re-render every minute so "X דק׳ מעכשיו" stays accurate
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const firstName = (displayName || businessName || '').split(' ')[0];
  const { greeting, Icon: GreetingIcon } = greetingFor(now.getHours(), firstName);

  const active = todayBookings.filter((b) => b.status === 'booked' || b.status === 'inProgress');
  const sorted = [...active].sort((a, b) => a.time.localeCompare(b.time));
  const totalRevenue = active.reduce((s, b) => s + (Number(b.price) || 0), 0);
  const completedRevenue = todayBookings
    .filter((b) => b.status === 'completed')
    .reduce((s, b) => s + (Number(b.price) || 0), 0);
  const completedCount = todayBookings.filter((b) => b.status === 'completed').length;

  const inProgress = sorted.find((b) => b.status === 'inProgress');
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const upcoming = sorted.filter((b) => b.status === 'booked');
  const next = upcoming.find((b) => timeToMin(b.time) >= nowMin) || upcoming[0];

  function describe(b) {
    return [b.serviceName, b.addons?.length ? `+ ${b.addons.length} תוספות` : ''].filter(Boolean).join(' ');
  }

  function share() {
    const dateLabel = now.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const lines = [`☀️ סיכום היום — ${dateLabel}`, ''];
    if (todayBookings.length === 0) {
      lines.push('🌤 יום שקט — אין תורים');
    } else {
      lines.push(`🪒 ${active.length} תורים פעילים`);
      if (totalRevenue > 0) lines.push(`💰 ${totalRevenue}₪ הכנסה צפויה`);
      if (completedCount > 0) lines.push(`✓ ${completedCount} כבר הסתיימו`);
      if (inProgress) lines.push('', `🪒 כעת: ${inProgress.clientName}`);
      else if (next) {
        lines.push('', `⏭ הבא: ${next.clientName} ב-${next.time}`);
      }
      const upcomingList = upcoming.filter((b) => timeToMin(b.time) >= nowMin).slice(0, 5);
      if (upcomingList.length > 0) {
        lines.push('', '📋 לוח היום:');
        for (const b of upcomingList) {
          lines.push(`• ${b.time} — ${b.clientName}`);
        }
      }
    }
    window.open(whatsappUrl(lines.join('\n')), '_blank');
  }

  // ── Empty state ──────────────────────────────────────────────────────
  if (todayBookings.length === 0) {
    return (
      <div className="msc-hero msc-empty">
        <div className="msc-hero-bg" aria-hidden="true" />
        <div className="msc-hero-content">
          <div className="msc-icon-wrap">
            <Cloud size={28} aria-hidden="true" />
          </div>
          <h2 className="msc-greeting">{greeting}</h2>
          <p className="msc-empty-line">יום שקט היום</p>
          <p className="msc-empty-sub">אין תורים מתוכננים — זמן מצוין לשתף את הלינק שלך עם לקוחות.</p>
        </div>
      </div>
    );
  }

  // ── Active day ───────────────────────────────────────────────────────
  return (
    <>
      <div className="msc-hero">
        <div className="msc-hero-bg" aria-hidden="true" />
        <div className="msc-hero-content">
          <div className="msc-hero-row">
            <div className="msc-icon-wrap">
              <GreetingIcon size={26} aria-hidden="true" />
            </div>
            <h2 className="msc-greeting">{greeting}</h2>
            <button
              type="button"
              className="msc-share-btn"
              onClick={share}
              aria-label="שתף סיכום בוואטסאפ"
            >
              <Share2 size={14} aria-hidden="true" />
              <span>שתף</span>
            </button>
          </div>
        </div>
      </div>

      <div className="msc-stats">
        <div className="msc-stat-card">
          <div className="msc-stat-icon msc-stat-icon-purple">
            <Calendar size={18} aria-hidden="true" />
          </div>
          <div className="msc-stat-body">
            <div className="msc-stat-label">תורים פעילים</div>
            <div className="msc-stat-num">{active.length}</div>
            {completedCount > 0 && (
              <div className="msc-stat-sub">{completedCount} הסתיימו</div>
            )}
          </div>
        </div>

        <div className="msc-stat-card">
          <div className="msc-stat-icon msc-stat-icon-indigo">
            <Wallet size={18} aria-hidden="true" />
          </div>
          <div className="msc-stat-body">
            <div className="msc-stat-label">הכנסה צפויה</div>
            <div className="msc-stat-num">₪{totalRevenue}</div>
            {completedRevenue > 0 && (
              <div className="msc-stat-sub">₪{completedRevenue} כבר נכנסו</div>
            )}
          </div>
        </div>

        <div className="msc-stat-card msc-stat-card-wide">
          <div className="msc-stat-icon msc-stat-icon-blue">
            <Clock size={18} aria-hidden="true" />
          </div>
          <div className="msc-stat-body">
            <div className="msc-stat-label">{inProgress ? 'מסתיים בעוד' : next ? 'התור הבא' : 'סוף היום'}</div>
            <div className="msc-stat-num">
              {inProgress
                ? `${Math.max(0, timeToMin(inProgress.time) + (inProgress.duration || 20) - nowMin)} דק׳`
                : next
                  ? next.time
                  : '—'}
            </div>
            <div className="msc-stat-sub">
              {inProgress ? inProgress.clientName : next ? next.clientName : 'אין יותר תורים'}
            </div>
          </div>
        </div>
      </div>

      {/* Spotlight card — current customer or next up */}
      {inProgress ? (
        <button
          type="button"
          className="msc-spotlight msc-spotlight-active"
          onClick={() => onTapBooking?.(inProgress)}
        >
          <div className="msc-spotlight-pulse" aria-hidden="true" />
          <div className="msc-spotlight-head">
            <Scissors size={14} aria-hidden="true" className="icon-inline" />
            <span>כעת בכיסא</span>
            <span className="msc-pill msc-pill-live">LIVE</span>
          </div>
          <div className="msc-spotlight-name">{inProgress.clientName}</div>
          <div className="msc-spotlight-meta">
            {inProgress.time}
            {' • '}
            {describe(inProgress)}
            {inProgress.price > 0 ? ` • ₪${inProgress.price}` : ''}
          </div>
        </button>
      ) : next ? (
        <button
          type="button"
          className="msc-spotlight"
          onClick={() => onTapBooking?.(next)}
        >
          <div className="msc-spotlight-head">
            {timeToMin(next.time) >= nowMin ? (
              <>
                <ChevronLeft size={14} aria-hidden="true" className="icon-inline" />
                <span>הבא בתור</span>
                <span className="msc-pill msc-pill-soon">
                  בעוד {Math.max(0, timeToMin(next.time) - nowMin)} דק׳
                </span>
              </>
            ) : (
              <>
                <AlertTriangle size={14} aria-hidden="true" className="icon-inline" />
                <span>התור הראשון להיום</span>
              </>
            )}
          </div>
          <div className="msc-spotlight-name">{next.clientName}</div>
          <div className="msc-spotlight-meta">
            {next.time}
            {' • '}
            {describe(next)}
            {next.price > 0 ? ` • ₪${next.price}` : ''}
          </div>
        </button>
      ) : (
        <div className="msc-spotlight msc-spotlight-done">
          <div className="msc-spotlight-head">
            <CheckCircle2 size={14} aria-hidden="true" className="icon-inline" />
            <span>סיימת להיום</span>
          </div>
          <div className="msc-spotlight-meta">אין יותר תורים — הופ הבא יתפוס.</div>
        </div>
      )}
    </>
  );
}
