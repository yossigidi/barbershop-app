import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

// AI-powered morning briefing card.
// Replaces the static MorningSummaryCard with personalized insights from
// Groq. Caches the result per session so we don't re-spend on every tab
// switch. Refresh button forces regeneration.

const SESSION_KEY = 'bs_aiBriefing_';

export default function AIBriefingCard({ businessName }) {
  const { user } = useAuth();
  const [briefing, setBriefing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Cache key includes today's date so it auto-invalidates at midnight
  const todayKey = (() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  })();
  const cacheKey = SESSION_KEY + todayKey;

  useEffect(() => {
    if (!user) return;
    // Check session cache first
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.greeting) {
          setBriefing(parsed);
          return;
        }
      }
    } catch {}
    // Otherwise generate
    generate();
  }, [user, cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      const idToken = await user.getIdToken();
      const r = await fetch('/api/ai-briefing', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      if (!r.ok || !data.greeting) throw new Error(data.error || 'AI לא יצר סיכום');
      setBriefing(data);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function refresh() {
    try { sessionStorage.removeItem(cacheKey); } catch {}
    generate();
  }

  if (!briefing && busy) {
    return (
      <div className="card morning-card">
        <div className="muted text-center" style={{ padding: 12 }}>
          <Sparkles size={16} className="icon-inline" style={{ animation: 'spin 1.4s linear infinite' }} />
          AI מנתח את היומן שלך…
        </div>
      </div>
    );
  }

  if (!briefing && error) {
    return (
      <div className="card morning-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="muted">לא הצלחתי ליצור סיכום: {error}</span>
          <button className="btn-secondary" onClick={generate} style={{ padding: '6px 10px', fontSize: '0.82rem' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="card morning-card">
      <div className="morning-greeting" style={{ marginBottom: 14 }}>
        <Sparkles size={22} className="icon-inline" style={{ color: 'var(--gold)' }} />
        <span style={{ flex: 1 }}>{briefing.greeting}</span>
        <button
          type="button"
          className="btn-secondary"
          onClick={refresh}
          disabled={busy}
          style={{ padding: '6px 10px', fontSize: '0.78rem', flex: 'none' }}
          title="רענן ניתוח"
          aria-label="רענן"
        >
          <RefreshCw size={14} style={{ animation: busy ? 'spin 1.4s linear infinite' : '' }} />
        </button>
      </div>

      <ul className="briefing-insights">
        {briefing.insights.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>

      {briefing.stats && (
        <div className="briefing-stats">
          <div className="briefing-stat">
            <div className="briefing-stat-num">{briefing.stats.todayCount || 0}</div>
            <div className="briefing-stat-label">תורים היום</div>
          </div>
          {briefing.stats.todayRevenue > 0 && (
            <div className="briefing-stat is-revenue">
              <div className="briefing-stat-num">₪{briefing.stats.todayRevenue}</div>
              <div className="briefing-stat-label">הכנסה צפויה</div>
            </div>
          )}
          {briefing.stats.tomorrowCount > 0 && (
            <div className="briefing-stat">
              <div className="briefing-stat-num">{briefing.stats.tomorrowCount}</div>
              <div className="briefing-stat-label">תורים מחר</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
