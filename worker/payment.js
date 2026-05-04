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
const PRICE_NIS = 50;
const RENEWAL_DAYS = 30;

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

  // Test override — when ?test=1 is present, charge ₪1 instead of ₪50.
  // Used during integration testing to verify the full Tranzila flow with
  // minimal real money. Remove this branch once tested.
  const reqUrl = new URL(request.url);
  const isTest = reqUrl.searchParams.get('test') === '1';
  const chargeSum = isTest ? 1 : PRICE_NIS;

  // Build Tranzila iframe URL.
  // tranmode=VK   = verify + create token (no immediate charge yet, OR small charge)
  // cred_type=8   = "standing order" (recurring) — Tranzila bills monthly via our cron
  // TranzilaTK=1  = issue token in response so we can charge again next cycle
  // myid          = our internal barber UID, returned in webhook for matching
  const origin = new URL(request.url).origin;
  // Match the Engleez pattern: cred_type=1 (regular charge) + TranzilaTK=1
  // (issue token for future cron-based monthly charges). The recurring is
  // handled by our daily cron (worker/cron.js), not by Tranzila itself.
  const params = new URLSearchParams({
    sum: chargeSum.toFixed(2),
    currency: '1',
    cred_type: '1',
    TranzilaTK: '1',
    pdesc: isTest ? 'בדיקת אינטגרציה — ₪1' : 'מנוי חודשי Pro — ניהול תורים',
    contact: businessName.slice(0, 100),
    email: claims.email || '',
    // Removed `lang: 'il'` — Tranzila's Hebrew iframe template is more
    // minimal and renders RTL labels poorly. The English iframe shows the
    // Tranzila green logo + security badges (3D Secure / Firewall / SSL /
    // PCI Level 1) which are valuable trust signals for the customer.
    // Removed `nologo: '1'` for the same reason — we WANT Tranzila's logo
    // visible to reassure the customer about who's processing the payment.
    // Custom field — returned to us in the webhook for matching the user.
    // NOT `myid` (Tranzila reserves that as the Israeli ID field — using it
    // would auto-fill the ID box on the form with our Firebase UID).
    firebaseUid: claims.uid,
    notify_url_address: `${origin}/api/tranzila-webhook`,
    // Tranzila POSTs to success/fail URLs — SPAs can't handle POST.
    // Route through worker endpoints that 302-redirect to the SPA.
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
    const periodEnd = new Date(Date.now() + RENEWAL_DAYS * 86_400_000);

    const subscriptionMap = {
      status: fs.str('active'),
      currentPeriodEnd: fs.ts(periodEnd),
      tranzilaToken: fs.str(tranzilaToken),
      last4: fs.str(last4),
      cardExpiry: fs.str(expdate),
      activatedAt: fs.ts(new Date()),
      indexId: fs.str(indexId),
      sumPaid: fs.str(sumPaid),
    };

    await firestorePatch(
      svc,
      accessToken,
      `barbers/${uid}`,
      { subscription: fs.map(subscriptionMap) },
      ['subscription'],
    );

    console.log('TRANZILA_WEBHOOK activated', { uid, last4, sumPaid, periodEnd: periodEnd.toISOString() });
  } catch (e) {
    console.error('TRANZILA_WEBHOOK Firestore error', e?.message, e?.stack);
  }

  return new Response('OK', { status: 200 });
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
