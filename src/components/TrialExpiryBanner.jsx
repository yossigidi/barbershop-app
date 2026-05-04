import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Sparkles, X } from 'lucide-react';

// Top-of-dashboard banner that warns the barber before the trial expires.
// Tiers:
//   • days 4–7  → yellow warning, dismissible per browser session
//   • days 1–3  → red critical, NOT dismissible (this is the last call)
//   • cancelled-pending → grey informational (no urgency, just clarity)
//
// Past day 0 the PaywallModal takes over so this never has to handle expired.

const SESSION_KEY = 'bs_trialBannerDismissed';

export default function TrialExpiryBanner({ access }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Reset dismissal once a day so the user sees it again tomorrow
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const { day } = JSON.parse(stored);
        const today = new Date().toDateString();
        if (day === today) setDismissed(true);
      }
    } catch {}
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ day: new Date().toDateString() }));
    } catch {}
  }

  if (!access) return null;
  if (access.reason !== 'trial' && access.reason !== 'cancelled-pending') return null;

  const days = access.daysLeft;

  // Trial: only nag in the last week
  if (access.reason === 'trial' && days > 7) return null;

  const isCritical = access.reason === 'trial' && days <= 3;
  const isCancelledPending = access.reason === 'cancelled-pending';
  const tone = isCancelledPending ? 'info' : isCritical ? 'critical' : 'warning';

  // Critical mode is non-dismissible. Cancelled-pending is also non-dismissible
  // (informational, low key, doesn't need to disappear).
  const canDismiss = !isCritical && !isCancelledPending;
  if (canDismiss && dismissed) return null;

  let icon, headline, subtext, ctaText;
  if (isCancelledPending) {
    icon = <Sparkles size={20} />;
    headline = `המנוי בוטל. נותרו ${days} ימי גישה.`;
    subtext = 'אחרי כן האפליקציה תינעל. אפשר לחזור למסלול בכל זמן.';
    ctaText = 'חזור למסלול';
  } else if (isCritical) {
    icon = <AlertTriangle size={20} />;
    headline = days <= 1
      ? 'תקופת הניסיון מסתיימת היום!'
      : `נותרו רק ${days} ימים לסיום תקופת הניסיון`;
    subtext = 'בלי הרשמה למסלול, האפליקציה תינעל ולקוחות לא יוכלו לקבוע תור.';
    ctaText = 'הירשם עכשיו — ₪50/חודש';
  } else {
    icon = <Sparkles size={20} />;
    headline = `נותרו ${days} ימים בתקופת הניסיון`;
    subtext = 'הירשם למסלול חודשי כדי להמשיך — ₪50 בלבד.';
    ctaText = 'ראה מסלולים';
  }

  return (
    <div className={`trial-banner trial-banner--${tone}`}>
      <div className="trial-banner-icon">{icon}</div>
      <div className="trial-banner-text">
        <div className="trial-banner-headline">{headline}</div>
        <div className="trial-banner-sub">{subtext}</div>
      </div>
      <button
        type="button"
        className="trial-banner-cta"
        onClick={() => navigate('/pricing')}
      >
        {ctaText}
      </button>
      {canDismiss && (
        <button
          type="button"
          className="trial-banner-dismiss"
          onClick={dismiss}
          aria-label="סגור"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
