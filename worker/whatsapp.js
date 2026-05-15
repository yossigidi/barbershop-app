// WhatsApp messaging via Meta's WhatsApp Cloud API (graph.facebook.com).
// No BSP / no middleman / no monthly platform fee — we pay Meta directly
// per message. Configured by three Worker vars:
//   WHATSAPP_TOKEN     (secret)    — Meta access token
//   WHATSAPP_PHONE_ID  (plaintext) — the sending number's phone-number id
//   WHATSAPP_WABA_ID   (plaintext) — WhatsApp Business Account id
//
// Everything here is FULLY AUTOMATIC and CRON-DRIVEN — there is no
// barber-facing "send" button. handleCronWhatsApp runs hourly and, per
// barber, does two passes:
//
//   1. Reminders — only if reminderSettings.enabled. The barber picks ONE
//      strategy in settings:
//        • batchDayBefore : one batch the evening before  (BATCH_DAY_BEFORE_HOUR)
//        • batchSameDay   : one batch the morning of      (BATCH_SAME_DAY_HOUR)
//        • perClient      : per appointment, N hours before (N = 1/2/3)
//
//   2. Thank-you — only if thankYouEnabled and a Google review URL is set.
//      Sent THANKYOU_DELAY_MIN minutes after each appointment's scheduled
//      end (per the calendar — independent of whether the barber marked it
//      "done"). Goes to every non-cancelled booking that has a phone.
//
// Per-booking dedup: `reminderSent` / `thankYouSent` flags on the booking.
//
// What does NOT go through here:
//   • A one-off message to a single client → the barber's own wa.me.
//   • A "message to all clients" → the barber's own WhatsApp client group
//     (SettingsPage waGroupLink).
//
// Both automatic message kinds are business-initiated, so Meta requires an
// APPROVED TEMPLATE: appointment_reminder (Utility), appointment_thankyou
// (Marketing).

import {
  loadServiceAccount, getAccessToken, firestoreGet, firestorePatch, firestoreQuery,
  verifyIdToken, getBearerToken, fs, fieldVal, ok, err, corsHeaders,
} from './_lib.js';

const GRAPH_VERSION = 'v22.0';

const TEMPLATE_REMINDER = 'appointment_reminder';        // Utility
const TEMPLATE_THANKYOU = 'appointment_thankyou';        // Marketing
const TEMPLATE_CONFIRMATION = 'appointment_confirmation';// Utility — sent when the barber approves a pending booking

const BATCH_DAY_BEFORE_HOUR = 18; // Israel hour for the "day before" batch
const BATCH_SAME_DAY_HOUR = 8;    // Israel hour for the "same day" batch
const THANKYOU_DELAY_MIN = 30;    // minutes after appointment end → thank-you

// ─── Core sender ──────────────────────────────────────────────────────────

// Israeli local number → E.164 digits with no '+'. 0501234567 → 972501234567.
export function normalizePhone(raw) {
  let n = String(raw || '').replace(/[^\d]/g, '');
  if (!n) return '';
  if (n.startsWith('0') && (n.length === 9 || n.length === 10)) {
    n = '972' + n.slice(1);
  }
  return n;
}

// Body-only component helper — our templates are a body with positional
// {{1}}, {{2}}… params. Pass the values in order.
export function bodyParams(...values) {
  return [{
    type: 'body',
    parameters: values.map((v) => ({ type: 'text', text: String(v ?? '') })),
  }];
}

// Send one template message. Returns { ok, id?, error?, code? }.
export async function sendTemplate(env, { to, template, language = 'he', components = [] }) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) {
    return { ok: false, error: 'whatsapp-not-configured' };
  }
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, error: 'bad-phone' };

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${env.WHATSAPP_PHONE_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: template,
      language: { code: language },
      ...(components.length ? { components } : {}),
    },
  };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = j?.error?.message || `HTTP ${r.status}`;
      console.error('WA_SEND_FAIL', phone, r.status, JSON.stringify(j?.error || {}).slice(0, 300));
      return { ok: false, error: msg, code: j?.error?.code };
    }
    return { ok: true, id: j?.messages?.[0]?.id || '' };
  } catch (e) {
    console.error('WA_SEND_ERR', phone, e?.message);
    return { ok: false, error: e?.message || 'fetch-failed' };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

// YYYY-MM-DD for "today + offsetDays" in Israel time.
function israelDateISO(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
}

// Current Israel { hour, min } as 0-23 / 0-59.
function israelHourMin() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { hour: get('hour'), min: get('minute') };
}

function timeToMin(t) {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

const HEB_DOWS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
function hebDateLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `יום ${HEB_DOWS[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

// Barber's public booking link, from their custom slug / short code.
function barberLink(env, barberFields) {
  const slug = fieldVal(barberFields.customSlug) || fieldVal(barberFields.shortCode) || '';
  const origin = env.PUBLIC_ORIGIN || 'https://toron.co.il';
  return slug ? `${origin}/${slug}` : '';
}

// Pull one day's bookings for a barber (decoded). cancelled rows excluded.
async function dayBookings(svc, accessToken, uid, dateISO) {
  const rows = await firestoreQuery(svc, accessToken, {
    from: [{ collectionId: 'bookings' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'date' },
        op: 'EQUAL',
        value: { stringValue: dateISO },
      },
    },
  }, `barbers/${uid}`);
  return rows
    .map((b) => ({
      id: b.name.split('/').pop(),
      clientName: fieldVal(b.fields.clientName) || '',
      clientPhone: fieldVal(b.fields.clientPhone) || '',
      time: fieldVal(b.fields.time) || '',
      duration: Number(fieldVal(b.fields.duration)) || 20,
      status: fieldVal(b.fields.status) || '',
      reminderSent: fieldVal(b.fields.reminderSent) === true,
      thankYouSent: fieldVal(b.fields.thankYouSent) === true,
    }))
    .filter((b) => b.status !== 'cancelled' && b.clientPhone);
}

// ─── Hourly cron — handleCronWhatsApp(env) ────────────────────────────────
export async function handleCronWhatsApp(env) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) {
    console.warn('CRON_WHATSAPP skipping: WhatsApp not configured');
    return { skipped: 'no-whatsapp' };
  }

  const svc = await loadServiceAccount(env);
  const accessToken = await getAccessToken(svc);

  // Small barber count — pull them all and decide per-barber in code.
  const barbers = await firestoreQuery(svc, accessToken, {
    from: [{ collectionId: 'barbers' }],
  });

  const { hour, min } = israelHourMin();
  const nowMin = hour * 60 + min;
  const todayISO = israelDateISO(0);
  const tomorrowISO = israelDateISO(1);

  let reminders = 0;
  let thankYous = 0;

  for (const row of barbers) {
    const uid = row.name.split('/').pop();
    const fields = row.fields || {};
    const businessName = fieldVal(fields.businessName) || 'העסק';
    const link = barberLink(env, fields) || 'הקישור בפרופיל';
    const reviewUrl = (fieldVal(fields.googleReviewUrl) || '').trim();
    const thankYouEnabled = fieldVal(fields.thankYouEnabled) === true;
    const rs = fieldVal(fields.reminderSettings) || {};
    const remindersOn = rs.enabled === true;

    // Skip barbers with nothing to do this hour.
    const wantsBatchDayBefore = remindersOn && rs.mode === 'batchDayBefore' && hour === BATCH_DAY_BEFORE_HOUR;
    const wantsBatchSameDay = remindersOn && rs.mode === 'batchSameDay' && hour === BATCH_SAME_DAY_HOUR;
    const wantsPerClient = remindersOn && rs.mode === 'perClient';
    const wantsThankYou = thankYouEnabled && reviewUrl;
    if (!wantsBatchDayBefore && !wantsBatchSameDay && !wantsPerClient && !wantsThankYou) continue;

    // Tomorrow's bookings — only the day-before batch needs them.
    if (wantsBatchDayBefore) {
      try {
        const list = await dayBookings(svc, accessToken, uid, tomorrowISO);
        const label = hebDateLabel(tomorrowISO);
        for (const b of list) {
          if (b.reminderSent) continue;
          const ok = await sendReminder(env, businessName, link, label, b);
          if (ok) {
            reminders++;
            await markBooking(svc, accessToken, uid, b.id, 'reminderSent');
          }
        }
      } catch (e) {
        console.error('CRON_WHATSAPP dayBefore failed', uid, e?.message);
      }
    }

    // Today's bookings — shared by same-day reminders, per-client reminders
    // and thank-yous. Query once, reuse.
    if (wantsBatchSameDay || wantsPerClient || wantsThankYou) {
      let today;
      try {
        today = await dayBookings(svc, accessToken, uid, todayISO);
      } catch (e) {
        console.error('CRON_WHATSAPP today query failed', uid, e?.message);
        continue;
      }
      const label = hebDateLabel(todayISO);
      const hoursBefore = [1, 2, 3].includes(rs.hoursBefore) ? rs.hoursBefore : 2;

      for (const b of today) {
        // Reminder pass
        if (!b.reminderSent && (wantsBatchSameDay || wantsPerClient)) {
          let due = wantsBatchSameDay;
          if (wantsPerClient) {
            const apptMin = timeToMin(b.time);
            const windowStart = apptMin - hoursBefore * 60;
            due = nowMin >= windowStart && nowMin < apptMin;
          }
          if (due) {
            const ok = await sendReminder(env, businessName, link, label, b);
            if (ok) {
              reminders++;
              b.reminderSent = true;
              await markBooking(svc, accessToken, uid, b.id, 'reminderSent');
            }
          }
        }
        // Thank-you pass — THANKYOU_DELAY_MIN after the scheduled end.
        if (wantsThankYou && !b.thankYouSent) {
          const endMin = timeToMin(b.time) + b.duration;
          if (nowMin >= endMin + THANKYOU_DELAY_MIN) {
            const ok = await sendThankYou(env, businessName, reviewUrl, b);
            if (ok) {
              thankYous++;
              await markBooking(svc, accessToken, uid, b.id, 'thankYouSent');
            }
          }
        }
      }
    }
  }

  console.log(`CRON_WHATSAPP done: hour=${hour} reminders=${reminders} thankYous=${thankYous} barbers=${barbers.length}`);
  return { reminders, thankYous, barbers: barbers.length };
}

async function sendReminder(env, businessName, link, dateLabel, booking) {
  const firstName = (booking.clientName || '').trim().split(/\s+/)[0] || 'לקוח/ה';
  const res = await sendTemplate(env, {
    to: booking.clientPhone,
    template: TEMPLATE_REMINDER,
    components: bodyParams(firstName, businessName, dateLabel, booking.time, link),
  });
  if (!res.ok) console.warn('REMINDER send failed', booking.clientPhone, res.error);
  return res.ok;
}

async function sendThankYou(env, businessName, reviewUrl, booking) {
  const firstName = (booking.clientName || '').trim().split(/\s+/)[0] || 'לקוח/ה';
  const res = await sendTemplate(env, {
    to: booking.clientPhone,
    template: TEMPLATE_THANKYOU,
    components: bodyParams(firstName, businessName, reviewUrl),
  });
  if (!res.ok) console.warn('THANKYOU send failed', booking.clientPhone, res.error);
  return res.ok;
}

async function markBooking(svc, accessToken, uid, bookingId, flag) {
  try {
    await firestorePatch(svc, accessToken, `barbers/${uid}/bookings/${bookingId}`,
      { [flag]: fs.bool(true) }, [flag]);
  } catch (e) {
    console.warn('CRON_WHATSAPP mark failed', uid, bookingId, flag, e?.message);
  }
}

// ─── POST /api/approve-booking ────────────────────────────────────────────
// The barber approves a pending booking from the dashboard. We flip the
// status to 'booked' and, if WhatsApp is configured, fire the confirmation
// template to the client. Idempotent — if the booking is already booked,
// returns success without resending. Body: { bookingId, link? }
export async function handleApproveBooking(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (request.method !== 'POST') return err('Method not allowed', 405);

  let svc, claims, accessToken;
  try {
    const token = getBearerToken(request);
    svc = await loadServiceAccount(env);
    claims = await verifyIdToken(token, svc.project_id);
    accessToken = await getAccessToken(svc);
  } catch (e) {
    return err('Unauthorized: ' + e.message, 401);
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const bookingId = String(body?.bookingId || '');
  const linkOverride = String(body?.link || '').trim().slice(0, 200);
  if (!bookingId) return err('Missing bookingId', 400);

  const uid = claims.uid;
  const bookingPath = `barbers/${uid}/bookings/${bookingId}`;

  let booking;
  try {
    booking = await firestoreGet(svc, accessToken, bookingPath);
  } catch (e) {
    return err('Failed to read booking: ' + e.message, 500);
  }
  if (!booking) return err('Booking not found', 404);

  const bf = booking.fields || {};
  const currentStatus = fieldVal(bf.status);
  // Idempotent — only flip if still pending.
  if (currentStatus && currentStatus !== 'pendingApproval') {
    return ok({ approved: true, alreadyHandled: true, status: currentStatus });
  }

  try {
    await firestorePatch(svc, accessToken, bookingPath,
      { status: fs.str('booked'), approvedAt: fs.ts(new Date()) },
      ['status', 'approvedAt']);
  } catch (e) {
    return err('Failed to update booking: ' + e.message, 500);
  }

  // Fire the confirmation template. Failures here don't undo the approval —
  // the booking is confirmed regardless. The cron-driven reminder and
  // thank-you still apply normally.
  let waSent = false;
  let waError = null;
  if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID) {
    try {
      const barberDoc = await firestoreGet(svc, accessToken, `barbers/${uid}`);
      const barberFields = barberDoc?.fields || {};
      const businessName = fieldVal(barberFields.businessName) || 'העסק';
      const firstName = (fieldVal(bf.clientName) || '').trim().split(/\s+/)[0] || 'לקוח/ה';
      const clientPhone = fieldVal(bf.clientPhone) || '';
      const dateISO = fieldVal(bf.date) || '';
      const dateLabel = dateISO ? hebDateLabel(dateISO) : '';
      const time = fieldVal(bf.time) || '';
      const finalLink = linkOverride || barberLink(env, barberFields) || 'הקישור בפרופיל';
      if (clientPhone && dateISO && time) {
        const res = await sendTemplate(env, {
          to: clientPhone,
          template: TEMPLATE_CONFIRMATION,
          components: bodyParams(firstName, businessName, dateLabel, time, finalLink),
        });
        waSent = res.ok;
        if (!res.ok) waError = res.error;
      }
    } catch (e) {
      waError = e?.message || 'whatsapp-error';
    }
  }

  return ok({ approved: true, waSent, waError });
}
