// Email confirmations via Brevo (free tier, 300 emails/day).
// POST /api/send-confirmation-email
// Body: { manageToken, email, manageUrl? }
//
// Looks up the booking from the manage token, builds a clean RTL HTML
// email with the manage link, and sends via Brevo. Public endpoint —
// the manage token IS the credential (anyone with it can already manage
// the booking, so no extra auth needed for the email).

import { ok, err, corsHeaders } from './_lib.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
// Sender — uses Engleez's verified domain since the user already owns it.
// To use a different sender domain, set SENDER_EMAIL secret on the Worker.
const DEFAULT_SENDER_EMAIL = 'noreply@engleez.co.il';
const DEFAULT_SENDER_NAME = 'הזמנת תור';

export async function handleSendConfirmationEmail(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (request.method !== 'POST') return err('Method not allowed', 405);
  if (!env.BREVO_API_KEY) return err('Email not configured (missing BREVO_API_KEY)', 500);

  let body;
  try { body = await request.json(); } catch { return err('Bad JSON', 400); }
  const { manageToken, email, manageUrl } = body || {};
  if (!manageToken || !email) return err('Missing manageToken or email', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Invalid email', 400);

  // Resolve token → booking via Firestore REST (public endpoint, no auth needed)
  let booking, barber;
  try {
    const tokenDoc = await fsPublicGet(`manageTokens/${manageToken}`);
    if (!tokenDoc) return err('Invalid manage token', 404);
    const uid = tokenDoc.fields?.uid?.stringValue;
    const bookingId = tokenDoc.fields?.bookingId?.stringValue;
    if (!uid || !bookingId) return err('Bad manage token doc', 400);

    booking = await fsPublicGet(`barbers/${uid}/bookings/${bookingId}`);
    barber = await fsPublicGet(`barbers/${uid}`);
    if (!booking) return err('Booking not found', 404);
  } catch (e) {
    return err('Lookup failed: ' + e.message, 500);
  }

  // Decode the fields we need
  const businessName = barber?.fields?.businessName?.stringValue || 'העסק';
  const logoUrl = barber?.fields?.logoUrl?.stringValue || '';
  const clientName = booking.fields?.clientName?.stringValue || '';
  const date = booking.fields?.date?.stringValue || '';
  const time = booking.fields?.time?.stringValue || '';
  const serviceName = booking.fields?.serviceName?.stringValue || 'תור';
  const duration = Number(booking.fields?.duration?.integerValue) || 20;
  const price = Number(booking.fields?.price?.integerValue) || 0;
  const firstName = (clientName || '').split(/\s+/)[0] || '';

  // Format date in Hebrew (the function runs server-side, no Intl.DateTimeFormat
  // pre-loaded with Hebrew, so do it manually)
  const dateFormatted = formatHebrewDate(date);

  const finalManageUrl = manageUrl || (request.headers.get('origin')
    ? `${request.headers.get('origin')}/manage/${manageToken}`
    : `https://barbershop-app.yosigidi1979.workers.dev/manage/${manageToken}`);

  const subject = `אישור הזמנת תור — ${businessName}`;
  const html = buildEmail({
    businessName, logoUrl, firstName, dateFormatted, time, serviceName,
    duration, price, manageUrl: finalManageUrl,
  });

  // Send via Brevo
  try {
    const senderEmail = env.SENDER_EMAIL || DEFAULT_SENDER_EMAIL;
    const senderName = env.SENDER_NAME || DEFAULT_SENDER_NAME;
    const r = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email }],
        subject,
        htmlContent: html,
        replyTo: { email: senderEmail, name: businessName },
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('BREVO send failed', r.status, errText.slice(0, 300));
      return err(`Email send failed (${r.status})`, 502);
    }
  } catch (e) {
    console.error('BREVO fetch error', e?.message);
    return err('Email service unavailable: ' + e.message, 502);
  }

  return ok({ sent: true });
}

// Public Firestore document GET (no auth — relies on the Firestore rules
// already allowing read on these specific paths)
async function fsPublicGet(path) {
  const url = `https://firestore.googleapis.com/v1/projects/barbershop-app-2026/databases/(default)/documents/${path}`;
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore GET ${path}: ${r.status}`);
  return r.json();
}

const HEB_DOWS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
function formatHebrewDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = HEB_DOWS[date.getDay()];
  return `יום ${dow}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function buildEmail({ businessName, logoUrl, firstName, dateFormatted, time, serviceName, duration, price, manageUrl }) {
  const greeting = firstName ? `שלום ${firstName}!` : 'שלום!';
  const logoBlock = logoUrl
    ? `<div style="text-align:center;margin-bottom:20px;"><img src="${logoUrl}" alt="${businessName}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid #b8893a;"></div>`
    : '';

  return `<!doctype html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>אישור הזמנת תור</title>
</head>
<body style="margin:0;padding:0;background:#faf8f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Heebo',sans-serif;">
  <div dir="rtl" style="max-width:560px;margin:0 auto;padding:24px;">

    <div style="background:linear-gradient(180deg,#0a0a0c,#18181b);color:#fff;padding:28px 20px;text-align:center;border-radius:14px 14px 0 0;">
      ${logoBlock}
      <h1 style="margin:0;font-size:1.5rem;font-weight:700;color:#fff;">${escape(businessName)}</h1>
      <div style="height:1px;background:linear-gradient(90deg,transparent,#b8893a,transparent);margin:12px auto 0;width:60%;"></div>
    </div>

    <div style="background:#fff;padding:28px 22px;border-radius:0 0 14px 14px;border:1px solid #e8e2d2;border-top:none;">

      <div style="text-align:center;margin-bottom:18px;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:rgba(22,163,74,0.10);border:2px solid #16a34a;color:#16a34a;font-size:30px;line-height:56px;">✓</div>
      </div>

      <h2 style="margin:0 0 8px;text-align:center;font-size:1.4rem;font-weight:700;color:#18181b;">${escape(greeting)}</h2>
      <p style="margin:0 0 20px;text-align:center;color:#6b6b73;">התור שלך נקבע בהצלחה.</p>

      <div style="background:#faf8f3;border:1px solid #e8e2d2;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8e2d2;">
          <span style="color:#6b6b73;">📅 תאריך</span>
          <strong style="color:#18181b;">${escape(dateFormatted)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8e2d2;">
          <span style="color:#6b6b73;">🕒 שעה</span>
          <strong style="color:#18181b;">${escape(time)}${duration ? ` (${duration} דק׳)` : ''}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;${price > 0 ? 'border-bottom:1px solid #e8e2d2;' : ''}">
          <span style="color:#6b6b73;">✂️ שירות</span>
          <strong style="color:#18181b;">${escape(serviceName)}</strong>
        </div>
        ${price > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;">
          <span style="color:#6b6b73;">💰 מחיר</span>
          <strong style="color:#b8893a;">₪${price}</strong>
        </div>` : ''}
      </div>

      <div style="text-align:center;margin:20px 0;">
        <a href="${escape(manageUrl)}" style="display:inline-block;background:linear-gradient(180deg,#c9974a,#b8893a,#8a6628);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:1rem;text-shadow:0 1px 1px rgba(0,0,0,0.18);box-shadow:0 4px 12px rgba(184,137,58,0.30);">ניהול התור (שינוי / ביטול)</a>
      </div>

      <div style="background:#fffbf0;border:1px dashed #b8893a;border-radius:8px;padding:12px 14px;margin:18px 0;font-size:0.85rem;color:#6b6b73;line-height:1.5;">
        💡 שמור את האימייל הזה — דרך הקישור למעלה תוכל לשנות או לבטל את התור בכל עת. הקישור פעיל גם אחרי 14 ימים.
      </div>

      <p style="margin:24px 0 0;text-align:center;color:#8a8a92;font-size:0.85rem;">
        מחכים לראות אותך 🙏<br>
        ${escape(businessName)}
      </p>

    </div>

    <p style="text-align:center;color:#a0a0a8;font-size:0.72rem;margin:14px 0 0;">
      הודעה זו נשלחה כי הזמנת תור ב-${escape(businessName)}. אם לא הזמנת — צור איתנו קשר.
    </p>

  </div>
</body>
</html>`;
}

function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
