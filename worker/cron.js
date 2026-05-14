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

// ─── Trial-expiry reminder emails ────────────────────────────────────────
// Runs daily alongside billing. For barbers still on the Pro trial, sends
// a reminder email at the 3-days-left and 1-day-left marks so they don't
// silently lapse. Dedup via subscription.trialReminderTier — once we email
// a tier we never re-send it. Pro only; Studio has no trial.
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

export async function handleCronTrialReminders(env) {
  if (!env.BREVO_API_KEY) {
    console.warn('TRIAL_REMINDERS skipping: no BREVO_API_KEY');
    return { skipped: 'no-brevo' };
  }
  const svc = await loadServiceAccount(env);
  const accessToken = await getAccessToken(svc);

  const candidates = await firestoreQuery(svc, accessToken, {
    from: [{ collectionId: 'barbers' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'subscription.status' },
        op: 'EQUAL',
        value: { stringValue: 'trialing' },
      },
    },
  });

  const now = new Date();
  let sent = 0, skipped = 0, errored = 0;

  for (const row of candidates) {
    const uid = row.name.split('/').pop();
    const sub = fieldVal(row.fields.subscription) || {};
    const email = fieldVal(row.fields.email) || '';
    const businessName = fieldVal(row.fields.businessName) || 'העסק שלך';
    try {
      const end = sub.trialEndsAt instanceof Date ? sub.trialEndsAt : null;
      if (!end || !email) { skipped++; continue; }
      const daysLeft = Math.ceil((end - now) / 86_400_000);
      const tier = Number.isFinite(sub.trialReminderTier) ? sub.trialReminderTier : 99;

      let sendTier = null;
      if (daysLeft <= 1 && tier > 1) sendTier = 1;
      else if (daysLeft <= 3 && tier > 3) sendTier = 3;
      if (sendTier === null) { skipped++; continue; }

      const origin = env.PUBLIC_ORIGIN || 'https://toron.co.il';
      const okSend = await sendTrialReminderEmail(env, {
        to: email, businessName, daysLeft: Math.max(0, daysLeft),
        pricingUrl: `${origin}/pricing`,
      });
      if (!okSend) { errored++; continue; }

      await patchSubscription(svc, accessToken, uid, sub, { trialReminderTier: sendTier });
      console.log(`[trial-reminder] sent tier=${sendTier} to ${uid} (${daysLeft}d left)`);
      sent++;
    } catch (e) {
      console.error(`[trial-reminder] error ${uid}:`, e?.message);
      errored++;
    }
  }
  console.log(`[trial-reminder] done: sent=${sent} skipped=${skipped} errored=${errored} total=${candidates.length}`);
  return { sent, skipped, errored, total: candidates.length };
}

async function sendTrialReminderEmail(env, { to, businessName, daysLeft, pricingUrl }) {
  const when = daysLeft <= 1 ? 'מחר' : `בעוד ${daysLeft} ימים`;
  const subject = daysLeft <= 1
    ? '⏰ תקופת הניסיון שלך ב-Toron מסתיימת מחר'
    : `תקופת הניסיון שלך ב-Toron מסתיימת ${when}`;
  const html = `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#f4f4f7;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e6ec;">
      <div style="background:linear-gradient(135deg,#D43396,#6541C1 55%,#14B8FE);padding:24px;text-align:center;">
        <div style="color:#fff;font-size:1.3rem;font-weight:800;">תקופת הניסיון מסתיימת ${escapeHtml(when)}</div>
      </div>
      <div style="padding:24px;text-align:center;">
        <p style="font-size:1rem;color:#18181b;margin:0 0 8px;">שלום,</p>
        <p style="font-size:0.95rem;color:#4a4a55;line-height:1.6;margin:0 0 20px;">
          תקופת הניסיון של 30 הימים ל-<strong>${escapeHtml(businessName)}</strong> מסתיימת ${escapeHtml(when)}.
          כדי להמשיך לנהל את היומן, הלקוחות וההכנסות בלי הפרעה — בחר/י מסלול עכשיו.
        </p>
        <a href="${escapeHtml(pricingUrl)}" style="display:inline-block;background:linear-gradient(135deg,#D43396,#6541C1 55%,#14B8FE);color:#fff;padding:14px 34px;border-radius:12px;text-decoration:none;font-weight:800;font-size:1rem;">
          המשך עם Toron — ₪50/חודש
        </a>
        <p style="font-size:0.8rem;color:#8a8a92;margin:20px 0 0;line-height:1.6;">
          לא עשית כלום? החשבון פשוט ייסגר בתום הניסיון — בלי חיוב, בלי התחייבות.
        </p>
      </div>
    </div>
    <p style="text-align:center;color:#a0a0a8;font-size:0.72rem;margin:14px 0 0;">Toron — ניהול תורים · toron.co.il</p>
  </div>
</body></html>`;
  try {
    const senderEmail = env.SENDER_EMAIL || 'noreply@toron.co.il';
    const r = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Toron', email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        replyTo: { email: env.OWNER_EMAIL || 'support@toron.co.il', name: 'Toron' },
      }),
    });
    if (!r.ok) { console.error('TRIAL_REMINDER brevo', r.status, await r.text()); return false; }
    return true;
  } catch (e) {
    console.error('TRIAL_REMINDER fetch', e?.message);
    return false;
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
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
