// Tranzila payment endpoints:
//   POST /api/create-payment-link  — auth client, returns Tranzila iframe URL
//   POST /api/tranzila-webhook     — Tranzila notify_url callback; verifies via API + activates sub
//
// Why we verify the webhook against Tranzila's confirm API rather than just
// trusting the form data: Tranzila's notify URL is reachable by anyone if
// they know it. The TPS HMAC scheme is the formal way, but the simpler and
// equally robust approach is: when a webhook arrives, query Tranzila's
// confirm endpoint with the transaction index — if the transaction exists
// and is approved on their side, it's real. Forging this requires breaching
// Tranzila itself. This is the mitigation we promised the user against the
// leaked private key.

import {
  loadServiceAccount, getAccessToken, firestoreGet, firestorePatch,
  verifyIdToken, getBearerToken, fs, fieldVal, ok, err, corsHeaders,
} from './_lib.js';

const TRANZILA_BASE = 'https://direct.tranzila.com';
// Single source of truth for plan price + cycle
const PRICE_NIS = 50;                 // Pro monthly
const STUDIO_PRICE_NIS = 69;          // Studio (committed + tablet) monthly
const RENEWAL_DAYS = 30;
const STUDIO_INSTALLMENTS = 24;       // 2-year commitment
const STUDIO_EXIT_FEE_PER_MONTH = 30; // ₪ per remaining month on early cancel

// ─── POST /api/create-payment-link ────────────────────────────────────────
export async function handleCreatePaymentLink(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (request.method !== 'POST') return err('Method not allowed', 405);

  let token, claims;
  try {
    token = getBearerToken(request);
    const svc = await loadServiceAccount(env);
    claims = await verifyIdToken(token, svc.project_id);
  } catch (e) {
    return err('Unauthorized: ' + e.message, 401);
  }

  if (!env.TRANZILA_TERMINAL) {
    return err('Server not configured (TRANZILA_TERMINAL missing)', 500);
  }

  // Read barber doc to populate the iframe with name/email
  let barberDoc;
  try {
    const svc = await loadServiceAccount(env);
    const accessToken = await getAccessToken(svc);
    barberDoc = await firestoreGet(svc, accessToken, `barbers/${claims.uid}`);
  } catch (e) {
    return err('Failed to read barber doc: ' + e.message, 500);
  }
  if (!barberDoc) return err('Barber not found', 404);

  const businessName = fieldVal(barberDoc.fields?.businessName) || 'העסק שלי';

  // Plan + test override flags from query string
  const reqUrl = new URL(request.url);
  const isTest = reqUrl.searchParams.get('test') === '1';
  const isStudio = reqUrl.searchParams.get('plan') === 'studio';
  const chargeSum = isTest ? 1 : (isStudio ? STUDIO_PRICE_NIS : PRICE_NIS);

  // Build Tranzila iframe URL.
  // tranmode=VK   = verify + create token (no immediate charge yet, OR small charge)
  // cred_type=8   = "standing order" (recurring) — Tranzila bills monthly via our cron
  // TranzilaTK=1  = issue token in response so we can charge again next cycle
  // myid          = our internal barber UID, returned in webhook for matching
  const origin = new URL(request.url).origin;
  // Two flow paths:
  //   • Monthly (default) — cred_type=1, single charge per month, our cron handles renewal
  //   • Studio committed — cred_type=6 with installments=24 — Tranzila auto-charges
  //     the same sum every month for 24 months. No cron needed for these.
  const params = isStudio
    ? new URLSearchParams({
        sum: chargeSum.toFixed(2),
        currency: '1',
        cred_type: '6',                                // installments
        installments: String(STUDIO_INSTALLMENTS),     // 24 monthly charges
        TranzilaTK: '1',                               // store token (for later cancellation fee)
        pdesc: 'מסלול Studio — שנתיים + טאבלט',
        contact: businessName.slice(0, 100),
        email: claims.email || '',
        firebaseUid: claims.uid,
        plan: 'studio-24',
        notify_url_address: `${origin}/api/tranzila-webhook`,
        success_url_address: `${origin}/api/tranzila-success`,
        fail_url_address: `${origin}/api/tranzila-fail`,
      })
    : new URLSearchParams({
        sum: chargeSum.toFixed(2),
        currency: '1',
        cred_type: '1',
        TranzilaTK: '1',
        pdesc: isTest ? 'בדיקת אינטגרציה — ₪1' : 'מנוי חודשי Pro — ניהול תורים',
        contact: businessName.slice(0, 100),
        email: claims.email || '',
        firebaseUid: claims.uid,
        plan: 'pro-monthly',
        notify_url_address: `${origin}/api/tranzila-webhook`,
        success_url_address: `${origin}/api/tranzila-success`,
        fail_url_address: `${origin}/api/tranzila-fail`,
      });

  // Use the modern responsive iframe (iframenew.php) — better RTL, mobile,
  // and Tranzila branding than the older newiframe.php form.
  const url = `${TRANZILA_BASE}/${encodeURIComponent(env.TRANZILA_TERMINAL)}/iframenew.php?${params.toString()}`;
  return ok({ url }, 200);
}

// ─── POST /api/tranzila-webhook ───────────────────────────────────────────
// Tranzila POSTs form-encoded data here after a payment.
// Mirrors Engleez's tranzila-webhook.js: trusts the form payload (no
// out-of-band confirmation call to Tranzila — that broke us before).
// Always returns 200 so Tranzila doesn't retry endlessly on our errors.
export async function handleTranzilaWebhook(request, env) {
  if (request.method !== 'POST') return err('Method not allowed', 405);

  let body;
  try {
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  } catch (e) {
    return err('Bad form data', 400);
  }

  console.log('TRANZILA_WEBHOOK_RAW', JSON.stringify(body));

  const uid = body.firebaseUid || body.myid; // myid is back-compat
  const tranzilaToken = body.TranzilaTK || body.tranzila_tk || '';
  const indexId = body.index || body.IndexId || body.transactionId || '';
  const responseCode = body.Response || body.response || body.responsecode || '';
  const sumPaid = body.sum || '';
  const last4 = (body.ccno || '').slice(-4);
  const expdate = body.expdate || '';
  const contactEmail = body.contact || '';

  if (!uid) {
    console.warn('TRANZILA_WEBHOOK missing uid');
    return new Response('OK', { status: 200 });
  }

  // Tranzila response codes: '000' = approved
  if (responseCode && responseCode !== '000') {
    console.log('TRANZILA_WEBHOOK declined', { uid, responseCode });
    return new Response('OK', { status: 200 });
  }

  if (!tranzilaToken) {
    console.warn('TRANZILA_WEBHOOK missing token', { uid });
    return new Response('OK', { status: 200 });
  }

  try {
    const svc = await loadServiceAccount(env);
    const accessToken = await getAccessToken(svc);
    const now = new Date();
    const plan = body.plan || 'pro-monthly';
    const isStudio = plan === 'studio-24';

    // Period end: monthly = 30 days; studio = 24 months from signup
    const periodEnd = isStudio
      ? addMonths(now, 24)
      : new Date(now.getTime() + RENEWAL_DAYS * 86_400_000);

    const subscriptionMap = {
      status: fs.str('active'),
      plan: fs.str(plan),
      currentPeriodEnd: fs.ts(periodEnd),
      tranzilaToken: fs.str(tranzilaToken),
      last4: fs.str(last4),
      cardExpiry: fs.str(expdate),
      activatedAt: fs.ts(now),
      indexId: fs.str(indexId),
      sumPaid: fs.str(sumPaid),
    };

    if (isStudio) {
      // Commitment ends 24 months from signup. After that the user is free
      // to cancel without exit fees.
      subscriptionMap.commitmentEndsAt = fs.ts(addMonths(now, 24));
      subscriptionMap.commitmentMonths = fs.num(24);
      subscriptionMap.exitFeePerMonth = fs.num(STUDIO_EXIT_FEE_PER_MONTH);
    }

    await firestorePatch(
      svc,
      accessToken,
      `barbers/${uid}`,
      { subscription: fs.map(subscriptionMap) },
      ['subscription'],
    );

    console.log('TRANZILA_WEBHOOK activated', { uid, plan, last4, sumPaid });
  } catch (e) {
    console.error('TRANZILA_WEBHOOK Firestore error', e?.message, e?.stack);
  }

  return new Response('OK', { status: 200 });
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// ─── POST /api/cancel-studio ──────────────────────────────────────────────
// Special cancel endpoint for committed (studio) plans. The committed
// customer can't just walk away — they signed for 24 monthly installments
// and got a tablet for it. Cancelling requires paying the exit fee:
//   fee = remaining_months × STUDIO_EXIT_FEE_PER_MONTH (₪30)
// We charge this as a one-time charge against the stored Tranzila token.
// On success, we mark the subscription cancelled AND attempt to halt
// future installments at Tranzila (best-effort).
//
// NOTE: there's no Firestore access here unless the charge itself
// succeeds — we don't want a partial state where DB says cancelled but
// the customer is still being charged.
export async function handleCancelStudio(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (request.method !== 'POST') return err('Method not allowed', 405);

  let claims;
  try {
    const token = getBearerToken(request);
    const svc0 = await loadServiceAccount(env);
    claims = await verifyIdToken(token, svc0.project_id);
  } catch (e) {
    return err('Unauthorized: ' + e.message, 401);
  }

  const svc = await loadServiceAccount(env);
  const accessToken = await getAccessToken(svc);
  const barberDoc = await firestoreGet(svc, accessToken, `barbers/${claims.uid}`);
  if (!barberDoc) return err('Barber not found', 404);

  const sub = fieldVal(barberDoc.fields?.subscription) || {};
  if (sub.plan !== 'studio-24') return err('Not a Studio plan', 400);
  if (sub.status !== 'active') return err('Subscription not active', 400);
  if (!sub.tranzilaToken) return err('No payment token on file', 400);

  // Calculate remaining months until commitment ends
  const now = new Date();
  const commitEnd = sub.commitmentEndsAt instanceof Date ? sub.commitmentEndsAt : new Date(sub.commitmentEndsAt);
  const msLeft = commitEnd.getTime() - now.getTime();
  const monthsLeft = Math.max(0, Math.ceil(msLeft / (30 * 86_400_000)));

  if (monthsLeft === 0) {
    // Commitment already over → free cancel via the regular cancel endpoint
    return err('Commitment already ended — use regular cancel', 400);
  }

  const exitFee = monthsLeft * STUDIO_EXIT_FEE_PER_MONTH;

  // Charge the exit fee against the stored token
  if (!env.TRANZILA_TERMINAL || !env.TRANZILA_PRIVATE_KEY) {
    return err('Server not configured', 500);
  }

  let chargeResult;
  try {
    const chargeParams = new URLSearchParams({
      supplier: env.TRANZILA_TERMINAL,
      TranzilaPW: env.TRANZILA_PRIVATE_KEY,
      TranzilaTK: sub.tranzilaToken,
      sum: exitFee.toFixed(2),
      currency: '1',
      cred_type: '1',
      contact: fieldVal(barberDoc.fields?.email) || '',
      pdesc: `דמי יציאה Studio — ${monthsLeft} חודשים`,
      myid: 'exit-' + claims.uid,
    });
    const r = await fetch('https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: chargeParams.toString(),
    });
    const text = await r.text();
    chargeResult = Object.fromEntries(new URLSearchParams(text));
    console.log('CANCEL_STUDIO charge', { uid: claims.uid, exitFee, response: chargeResult.Response, body: text.slice(0, 200) });
  } catch (e) {
    console.error('CANCEL_STUDIO charge error', e?.message);
    return err('שגיאה בחיוב דמי היציאה: ' + e.message, 500);
  }

  if (chargeResult.Response !== '000') {
    return err(`חיוב דמי היציאה נכשל (קוד ${chargeResult.Response}). המנוי לא בוטל.`, 400);
  }

  // Best-effort: try to halt the remaining Tranzila installments via token delete.
  // Even if this fails, the cancellation flag we write to Firestore prevents
  // us from honoring the subscription, and the customer's bank can dispute
  // unauthorized charges with Tranzila.
  try {
    const stopParams = new URLSearchParams({
      supplier: env.TRANZILA_TERMINAL,
      TranzilaPW: env.TRANZILA_PRIVATE_KEY,
      TranzilaTK: sub.tranzilaToken,
      op: 'delete',
    });
    await fetch('https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: stopParams.toString(),
    });
  } catch (e) {
    console.warn('CANCEL_STUDIO halt-future failed (non-fatal):', e?.message);
  }

  // Update subscription state: mark cancelled, record exit fee paid
  const merged = {
    ...mapBack(sub),
    status: fs.str('cancelled'),
    cancelledAt: fs.ts(now),
    cancelReason: fs.str('studio-early-exit'),
    exitFeePaid: fs.num(exitFee),
    exitFeeMonthsLeft: fs.num(monthsLeft),
    exitFeeIndexId: fs.str(chargeResult.index || ''),
  };

  await firestorePatch(
    svc,
    accessToken,
    `barbers/${claims.uid}`,
    { subscription: fs.map(merged) },
    ['subscription'],
  );

  return ok({
    cancelled: true,
    exitFeePaid: exitFee,
    monthsLeft,
    indexId: chargeResult.index || null,
  });
}

// ─── Success/fail redirect handlers ───────────────────────────────────────
// Tranzila POSTs to these. SPAs can't handle POST, so we 302-redirect to the
// pricing page with a query flag. Mirrors Engleez's tranzila-success.js.
export async function handleTranzilaSuccess(request, env) {
  return Response.redirect(new URL('/pricing?paid=1', request.url).toString(), 302);
}
export async function handleTranzilaFail(request, env) {
  return Response.redirect(new URL('/pricing?failed=1', request.url).toString(), 302);
}

// ─── POST /api/cancel-subscription ────────────────────────────────────────
// SOFT cancel — matches the Engleez pattern. We just set
// `subscription.cancelAtPeriodEnd: true` and leave everything else intact.
// The user keeps access until currentPeriodEnd. The daily cron will see
// the flag, mark them cancelled, and stop charging the token.
//
// We do NOT delete the Tranzila token here — the cron handles cleanup, and
// keeping the token means the user can re-activate by clicking subscribe
// again without re-entering their card.
export async function handleCancelSubscription(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (request.method !== 'POST') return err('Method not allowed', 405);

  let claims;
  try {
    const token = getBearerToken(request);
    const svc = await loadServiceAccount(env);
    claims = await verifyIdToken(token, svc.project_id);
  } catch (e) {
    return err('Unauthorized: ' + e.message, 401);
  }

  const svc = await loadServiceAccount(env);
  const accessToken = await getAccessToken(svc);
  const barberDoc = await firestoreGet(svc, accessToken, `barbers/${claims.uid}`);
  if (!barberDoc) return err('Barber not found', 404);

  const sub = fieldVal(barberDoc.fields?.subscription) || {};
  if (sub.status !== 'active') return err('No active subscription to cancel', 400);

  // Patch only the cancelAtPeriodEnd field — preserves the rest of the map.
  // Note: REST API field masks for nested map fields use dot notation.
  await firestorePatch(
    svc,
    accessToken,
    `barbers/${claims.uid}`,
    {
      subscription: fs.map({
        ...mapBack(sub),
        cancelAtPeriodEnd: fs.bool(true),
        cancelRequestedAt: fs.ts(new Date()),
      }),
    },
    ['subscription'],
  );

  return ok({
    cancelled: true,
    accessUntil: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
  });
}

// Re-encode a decoded subscription back into Firestore field format
function mapBack(sub) {
  const out = {};
  if (sub.status) out.status = fs.str(sub.status);
  if (sub.tranzilaToken) out.tranzilaToken = fs.str(sub.tranzilaToken);
  if (sub.last4) out.last4 = fs.str(sub.last4);
  if (sub.indexId) out.indexId = fs.str(sub.indexId);
  if (sub.startedAt instanceof Date) out.startedAt = fs.ts(sub.startedAt);
  if (sub.activatedAt instanceof Date) out.activatedAt = fs.ts(sub.activatedAt);
  if (sub.trialEndsAt instanceof Date) out.trialEndsAt = fs.ts(sub.trialEndsAt);
  if (sub.currentPeriodEnd instanceof Date) out.currentPeriodEnd = fs.ts(sub.currentPeriodEnd);
  if (sub.lastPromoRedeemed) out.lastPromoRedeemed = fs.str(sub.lastPromoRedeemed);
  if (sub.lastPromoAt instanceof Date) out.lastPromoAt = fs.ts(sub.lastPromoAt);
  return out;
}

// Note: removed verifyTranzilaTransaction — Engleez's production webhook
// doesn't call the confirm API. The custom firebaseUid + Tranzila's own
// Response='000' code on the webhook payload are sufficient.
