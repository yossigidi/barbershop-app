// Daily Tranzila billing cron — Cloudflare Workers Cron Trigger entry.
// Mirrors Engleez's cron-tranzila-billing.js but adapted to Workers + Firestore REST.
//
// Schedule (in wrangler.jsonc): runs every morning. For each barber whose
// subscription is `active` and `currentPeriodEnd <= now`:
//   • If `cancelAtPeriodEnd === true` → mark cancelled, stop charging
//   • Else → charge stored tranzilaToken via tranzila71u.cgi
//     - Success: extend currentPeriodEnd by 30 days, reset retryCount
//     - Failure: bump retryCount; after 3 → cancel; otherwise leave for tomorrow
//
// We also process `past_due` rows (last failed) so we keep retrying daily
// for up to 3 attempts before giving up.

import {
  loadServiceAccount, getAccessToken, firestoreQuery, firestorePatch,
  fs, fieldVal,
} from './_lib.js';

const RENEWAL_DAYS = 30;
const PRICE_NIS = 50;
const MAX_RETRIES = 3;
const TRANZILA_CHARGE_URL = 'https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi';

export async function handleCronBilling(env) {
  if (!env.TRANZILA_TERMINAL || !env.TRANZILA_PRIVATE_KEY) {
    console.error('CRON skipping: missing TRANZILA secrets');
    return { error: 'missing-secrets' };
  }

  const svc = await loadServiceAccount(env);
  const accessToken = await getAccessToken(svc);

  // Pull every barber with subscription.status in {active, past_due}.
  // Firestore can't compare nested timestamp easily here without an index;
  // we filter in code. The collection is small (sub-thousands), fine.
  const candidates = await firestoreQuery(svc, accessToken, {
    from: [{ collectionId: 'barbers' }],
    where: {
      compositeFilter: {
        op: 'OR',
        filters: [
          { fieldFilter: { field: { fieldPath: 'subscription.status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
          { fieldFilter: { field: { fieldPath: 'subscription.status' }, op: 'EQUAL', value: { stringValue: 'past_due' } } },
        ],
      },
    },
  });

  const now = new Date();
  let charged = 0;
  let failed = 0;
  let cancelled = 0;
  let skipped = 0;

  for (const row of candidates) {
    const uid = row.name.split('/').pop();
    const sub = fieldVal(row.fields.subscription) || {};
    const email = fieldVal(row.fields.email) || '';

    try {
      const periodEnd = sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd : null;

      // Active and not yet due → leave alone
      if (sub.status === 'active' && periodEnd && periodEnd > now) {
        skipped++;
        continue;
      }

      // Cancellation requested + period passed → mark cancelled, no more charges
      if (sub.cancelAtPeriodEnd) {
        await patchSubscription(svc, accessToken, uid, sub, {
          status: 'cancelled',
          cancelAtPeriodEnd: false,
          cancelledAt: now,
        });
        console.log(`[cron] cancelled at period end: ${uid}`);
        cancelled++;
        continue;
      }

      // past_due — wait at least 24h since last failure before retry
      if (sub.status === 'past_due') {
        const lastFailedAt = sub.lastFailedAt instanceof Date ? sub.lastFailedAt : null;
        if (lastFailedAt && (now - lastFailedAt) < 24 * 60 * 60 * 1000) {
          skipped++;
          continue;
        }
        const retryCount = sub.retryCount || 0;
        if (retryCount >= MAX_RETRIES) {
          await patchSubscription(svc, accessToken, uid, sub, {
            status: 'cancelled',
            cancelReason: 'payment_failed_max_retries',
            cancelledAt: now,
          });
          console.log(`[cron] max retries reached, cancelled: ${uid}`);
          cancelled++;
          continue;
        }
      }

      if (!sub.tranzilaToken) {
        console.warn(`[cron] no token for ${uid}`);
        failed++;
        continue;
      }

      // Charge the token
      const result = await chargeToken(env, sub.tranzilaToken, PRICE_NIS, email);
      if (result.Response === '000') {
        const nextEnd = new Date(now.getTime() + RENEWAL_DAYS * 86_400_000);
        await patchSubscription(svc, accessToken, uid, sub, {
          status: 'active',
          currentPeriodEnd: nextEnd,
          lastChargedAt: now,
          retryCount: 0,
          lastFailedAt: null,
          lastFailedResponse: null,
          indexId: result.index || sub.indexId,
        });
        console.log(`[cron] charged ${uid}: ₪${PRICE_NIS} → ${nextEnd.toISOString()}`);
        charged++;
      } else {
        const newRetry = (sub.retryCount || 0) + 1;
        await patchSubscription(svc, accessToken, uid, sub, {
          status: 'past_due',
          lastFailedAt: now,
          lastFailedResponse: String(result.Response || 'unknown'),
          retryCount: newRetry,
        });
        console.warn(`[cron] charge failed ${uid}: Response=${result.Response}`);
        failed++;
      }
    } catch (e) {
      console.error(`[cron] error processing ${uid}:`, e?.message);
      failed++;
    }
  }

  console.log(`[cron] done: charged=${charged} failed=${failed} cancelled=${cancelled} skipped=${skipped}`);
  return { charged, failed, cancelled, skipped, total: candidates.length };
}

async function chargeToken(env, token, sum, email) {
  const params = new URLSearchParams({
    supplier: env.TRANZILA_TERMINAL,
    TranzilaPW: env.TRANZILA_PRIVATE_KEY,
    TranzilaTK: token,
    sum: Number(sum).toFixed(2),
    currency: '1',
    cred_type: '1',
    contact: email || '',
    pdesc: 'מנוי חודשי Pro — חידוש',
  });
  const r = await fetch(TRANZILA_CHARGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await r.text();
  return Object.fromEntries(new URLSearchParams(text));
}

async function patchSubscription(svc, accessToken, uid, currentSub, changes) {
  // Merge current sub with changes, then re-encode the whole map.
  const merged = { ...currentSub, ...changes };
  const fields = {};
  for (const [k, v] of Object.entries(merged)) {
    if (v === null || v === undefined) continue;
    if (v instanceof Date) fields[k] = fs.ts(v);
    else if (typeof v === 'boolean') fields[k] = fs.bool(v);
    else if (typeof v === 'number') fields[k] = fs.num(v);
    else fields[k] = fs.str(String(v));
  }
  await firestorePatch(svc, accessToken, `barbers/${uid}`, { subscription: fs.map(fields) }, ['subscription']);
}
