// Subscription gating — grandfathering + trial logic.
//
// Source of truth: the barber doc carries `subscription` (Stage 1 reads it,
// Stage 2 writes it via Cloudflare Worker only). Existing accounts created
// before LAUNCH_DATE are permanently free.
//
// Why client never writes `subscription`: prevents the well-known
// "self-grant" hole — a malicious user typing into devtools to flip
// status:'active'. See firestore.rules for enforcement.

// Cutoff: accounts created BEFORE this moment are grandfathered (free forever).
// Anyone who signs up AT/AFTER this gets the 14-day trial → paid.
// Set to the start of the launch day (Israel time).
export const LAUNCH_DATE = new Date('2026-05-04T00:00:00+03:00');
export const PRICE_NIS = 50;          // Pro monthly
export const STUDIO_PRICE_NIS = 69;   // Studio (committed + tablet) monthly
export const TRIAL_DAYS = 30;
export const RENEWAL_DAYS = 30;

// Grandfathering — anyone who signed up before launch keeps the app forever,
// no payment ever. This is intentional (you've already shipped value to them).
export function isGrandfathered(barber) {
  if (!barber || !barber.createdAt) return false;
  const created = typeof barber.createdAt.toDate === 'function'
    ? barber.createdAt.toDate()
    : new Date(barber.createdAt);
  return created < LAUNCH_DATE;
}

// Returns { granted, reason, daysLeft, status }.
//   reason ∈ 'grandfathered' | 'active' | 'trial' | 'no-sub' | 'expired' | 'cancelled'
//   daysLeft is positive when granted, negative when reason='expired'
export function getAccessState(barber) {
  if (!barber) return { granted: false, reason: 'no-barber', daysLeft: 0 };
  if (isGrandfathered(barber)) {
    return { granted: true, reason: 'grandfathered', daysLeft: Infinity };
  }

  const sub = barber.subscription;
  if (!sub) return { granted: false, reason: 'no-sub', daysLeft: 0 };

  const now = Date.now();

  if (sub.status === 'active') {
    const end = msFromTimestamp(sub.currentPeriodEnd);
    const days = Math.floor((end - now) / 86_400_000);
    if (end > now) {
      // Soft-cancel state: still active, but cron will stop charging at period end
      if (sub.cancelAtPeriodEnd) {
        return { granted: true, reason: 'cancelled-pending', daysLeft: days, periodEnd: end, status: sub.status };
      }
      return { granted: true, reason: 'active', daysLeft: days, periodEnd: end, status: sub.status };
    }
  }

  if (sub.status === 'past_due') {
    // Cron is retrying — keep access until period end OR show payment problem warning
    const end = msFromTimestamp(sub.currentPeriodEnd);
    const days = Math.floor((end - now) / 86_400_000);
    if (end > now) return { granted: true, reason: 'past-due-grace', daysLeft: days, periodEnd: end, status: sub.status };
    return { granted: false, reason: 'past-due-expired', daysLeft: 0, status: sub.status };
  }

  if (sub.status === 'trialing') {
    const end = msFromTimestamp(sub.trialEndsAt);
    const days = Math.floor((end - now) / 86_400_000);
    if (end > now) return { granted: true, reason: 'trial', daysLeft: days, periodEnd: end, status: sub.status };
  }

  // Studio signups get NO free trial — the plan includes a subsidised
  // tablet, so access is withheld until the commitment is signed and the
  // first payment clears (the Tranzila webhook flips status to 'active').
  if (sub.status === 'pending') {
    return { granted: false, reason: 'needs-payment', daysLeft: 0, status: sub.status };
  }

  if (sub.status === 'cancelled') {
    // Grace until end of paid period
    const end = msFromTimestamp(sub.currentPeriodEnd);
    const days = Math.floor((end - now) / 86_400_000);
    if (end > now) return { granted: true, reason: 'cancelled-grace', daysLeft: days, periodEnd: end, status: sub.status };
    return { granted: false, reason: 'cancelled', daysLeft: days, status: sub.status };
  }

  return { granted: false, reason: 'expired', daysLeft: 0, status: sub.status };
}

function msFromTimestamp(t) {
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.toDate === 'function') return t.toDate().getTime();
  if (typeof t === 'number') return t;
  if (typeof t === 'string') return new Date(t).getTime();
  return 0;
}

// Build the initial subscription object set on a new barber doc.
//   • Studio plan → status 'pending', NO trial. The plan ships a
//     subsidised tablet, so access is granted only after the agreement
//     is signed and the first payment clears (webhook → 'active').
//   • Everything else (Pro) → the standard 30-day trial.
// Stage 2 (the Tranzila webhook) replaces this on first payment.
export function initialSubscription(plan) {
  if (plan === 'studio') {
    return {
      status: 'pending',
      plan: 'studio-24-pending',
      startedAt: new Date(),
    };
  }
  return {
    status: 'trialing',
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
    startedAt: new Date(),
  };
}
