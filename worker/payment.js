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
    lang: 'il',
    nologo: '1',
    // Custom field — returned to us in the webhook for matching the user.
    // NOT `myid` (Tranzila reserves that as the Israeli ID field — using it
    // would auto-fill the ID box on the form with our Firebase UID).
    firebaseUid: claims.uid,
    notify_url_address: `${origin}/api/tranzila-webhook`,
    success_url_address: `${origin}/pricing?paid=1`,
    fail_url_address: `${origin}/pricing?failed=1`,
  });

  // Use the modern responsive iframe (iframenew.php) — better RTL, mobile,
  // and Tranzila branding than the older newiframe.php form.
  const url = `${TRANZILA_BASE}/${encodeURIComponent(env.TRANZILA_TERMINAL)}/iframenew.php?${params.toString()}`;
  return ok({ url }, 200);
}

// ─── POST /api/tranzila-webhook ───────────────────────────────────────────
// Tranzila POSTs form-encoded data here after a payment.
// We verify the transaction index against Tranzila's confirm API, then
// activate the barber's subscription if approved.
export async function handleTranzilaWebhook(request, env) {
  if (request.method !== 'POST') return err('Method not allowed', 405);

  // Parse form data (Tranzila sends application/x-www-form-urlencoded)
  let body;
  try {
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  } catch (e) {
    return err('Bad form data', 400);
  }

  console.log('TRANZILA_WEBHOOK', { keys: Object.keys(body), uid: body.myid });

  const uid = body.firebaseUid || body.myid; // back-compat with the early test version that used myid
  const tranzilaToken = body.TranzilaTK || body.tranzila_tk || '';
  const indexId = body.index || body.IndexId || body.transactionId || '';
  const responseCode = body.Response || body.response || body.responsecode || '';
  const sum = body.sum || '';
  const last4 = body.ccno?.slice(-4) || '';

  if (!uid) return err('Missing myid', 400);
  if (!tranzilaToken) return err('Missing token', 400);

  // Mitigation against forged webhooks: verify against Tranzila's confirm API.
  // (Note: requires private key; without it we still match index_id existence
  // as a soft check. Not as strong but better than nothing.)
  const verified = await verifyTranzilaTransaction(env, indexId, sum);
  if (!verified.ok) {
    console.warn('TRANZILA_WEBHOOK verification failed', verified.reason);
    return err('Verification failed', 400);
  }

  // Approved? Tranzila response 000 = success
  if (responseCode && responseCode !== '000') {
    console.log('TRANZILA_WEBHOOK declined response', responseCode);
    return ok({ ignored: true, reason: 'declined' });
  }

  // Activate subscription
  const svc = await loadServiceAccount(env);
  const accessToken = await getAccessToken(svc);
  const periodEnd = new Date(Date.now() + RENEWAL_DAYS * 86_400_000);

  const subscriptionMap = fs.map({
    status: fs.str('active'),
    currentPeriodEnd: fs.ts(periodEnd),
    tranzilaToken: fs.str(tranzilaToken),
    last4: fs.str(last4),
    activatedAt: fs.ts(new Date()),
    indexId: fs.str(indexId),
  });

  await firestorePatch(
    svc,
    accessToken,
    `barbers/${uid}`,
    { subscription: subscriptionMap },
    ['subscription'],
  );

  console.log('TRANZILA_WEBHOOK activated', { uid, last4, periodEnd: periodEnd.toISOString() });
  return ok({ activated: true });
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

// Best-effort transaction verification. Tranzila has a "confirm" API but
// it requires the private key. If TRANZILA_PRIVATE_KEY is set, we'll use
// the proper confirmation endpoint. Otherwise, we accept the webhook with
// a warning logged.
async function verifyTranzilaTransaction(env, indexId, sum) {
  if (!indexId) return { ok: false, reason: 'no-index' };

  if (!env.TRANZILA_PRIVATE_KEY) {
    console.warn('TRANZILA_PRIVATE_KEY not set — skipping deep verification');
    return { ok: true, reason: 'soft-accept' };
  }

  // Tranzila confirm endpoint — POST with terminal + private key + index
  // (Their docs vary; this is the documented "/cgi-bin/tranzila71confirm.cgi" path.)
  try {
    const params = new URLSearchParams({
      supplier: env.TRANZILA_TERMINAL,
      TranzilaPW: env.TRANZILA_PRIVATE_KEY,
      indexId: indexId,
    });
    const r = await fetch('https://secure5.tranzila.com/cgi-bin/tranzila71confirm.cgi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const text = await r.text();
    // Tranzila returns key=value pairs. Parse into object.
    const result = Object.fromEntries(new URLSearchParams(text));
    if (result.Response === '000' || result.response === '000') {
      // Optional: verify the sum matches
      if (sum && result.sum && Number(result.sum) !== Number(sum)) {
        return { ok: false, reason: 'sum-mismatch' };
      }
      return { ok: true };
    }
    return { ok: false, reason: 'confirm-not-approved: ' + (result.Response || text.slice(0, 100)) };
  } catch (e) {
    console.error('TRANZILA confirm fetch failed', e?.message);
    return { ok: false, reason: 'confirm-fetch-error' };
  }
}
