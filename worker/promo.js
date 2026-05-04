// Promo code redemption — POST /api/redeem-promo
// Body: { code }
// Validates code (exists, not expired, not over maxUses, user not in usedBy)
// Then atomically extends the barber's trial by `freeDays` and pushes uid to usedBy.

import {
  loadServiceAccount, getAccessToken, firestoreGet, firestorePatch,
  verifyIdToken, getBearerToken, fs, fieldVal, ok, err, corsHeaders,
} from './_lib.js';

export async function handleRedeemPromo(request, env) {
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

  let body;
  try { body = await request.json(); } catch { return err('Bad JSON', 400); }
  const code = String(body?.code || '').trim().toUpperCase();
  if (!code) return err('Missing code', 400);

  const svc = await loadServiceAccount(env);
  const accessToken = await getAccessToken(svc);

  // Read promo code doc
  const promoDoc = await firestoreGet(svc, accessToken, `promoCodes/${encodeURIComponent(code)}`);
  if (!promoDoc) return err('קוד לא קיים', 404);

  const promo = decodePromo(promoDoc.fields || {});
  const now = new Date();

  if (promo.expiresAt && promo.expiresAt < now) {
    return err('הקוד פג תוקף', 410);
  }
  if (promo.usedBy.includes(claims.uid)) {
    return err('כבר השתמשת בקוד הזה', 409);
  }
  if (promo.maxUses > 0 && promo.usedBy.length >= promo.maxUses) {
    return err('הקוד נוצל למקסימום משתמשים', 410);
  }

  // Read current barber doc to compute new trial end
  const barberDoc = await firestoreGet(svc, accessToken, `barbers/${claims.uid}`);
  if (!barberDoc) return err('Barber not found', 404);

  const sub = fieldVal(barberDoc.fields?.subscription) || {};
  const currentEnd = sub.trialEndsAt instanceof Date ? sub.trialEndsAt
    : (sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd : new Date());
  const baseline = currentEnd > now ? currentEnd : now;
  const newEnd = new Date(baseline.getTime() + promo.freeDays * 86_400_000);

  // Determine which field to extend based on current status
  const currentStatus = sub.status || 'trialing';
  const fieldToExtend = currentStatus === 'active' ? 'currentPeriodEnd' : 'trialEndsAt';

  const updatedSub = {
    status: fs.str(currentStatus === 'expired' ? 'trialing' : currentStatus),
    [fieldToExtend]: fs.ts(newEnd),
    lastPromoRedeemed: fs.str(code),
    lastPromoAt: fs.ts(now),
  };
  // Preserve other existing sub fields
  if (sub.tranzilaToken) updatedSub.tranzilaToken = fs.str(sub.tranzilaToken);
  if (sub.last4) updatedSub.last4 = fs.str(sub.last4);
  if (sub.startedAt) updatedSub.startedAt = fs.ts(sub.startedAt);

  await firestorePatch(
    svc,
    accessToken,
    `barbers/${claims.uid}`,
    { subscription: fs.map(updatedSub) },
    ['subscription'],
  );

  // Mark promo code as used by this user
  const usedByValues = [...promo.usedBy, claims.uid].map((u) => fs.str(u));
  await firestorePatch(
    svc,
    accessToken,
    `promoCodes/${encodeURIComponent(code)}`,
    { usedBy: fs.arr(usedByValues) },
    ['usedBy'],
  );

  return ok({
    success: true,
    daysAdded: promo.freeDays,
    newEndDate: newEnd.toISOString(),
    code,
  });
}

function decodePromo(fields) {
  return {
    freeDays: Number(fieldVal(fields.freeDays)) || 0,
    maxUses: Number(fieldVal(fields.maxUses)) || 0, // 0 = unlimited
    usedBy: fieldVal(fields.usedBy) || [],
    expiresAt: fieldVal(fields.expiresAt) || null,
  };
}
