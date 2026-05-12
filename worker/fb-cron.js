// Facebook Page auto-posting cron — runs Sun / Tue / Thu at 08:00 UTC
// (= 10-11 IL depending on DST) and posts the next post in a 10-message
// rotation to the Toron Facebook Page.
//
// Setup: see FACEBOOK_SETUP.md. The two secrets we need:
//   FB_PAGE_ID            (the numeric Page ID — not the slug)
//   FB_PAGE_ACCESS_TOKEN  (a long-lived Page token, never expires when
//                          generated from a long-lived user token of an
//                          admin)
//
// The post rotation is deterministic by day-of-year, so even if cron
// fires a second time the same day we'll re-post the same message
// (Facebook will accept it as a fresh post — they don't dedupe). The
// runner logs each post id to console.log so the operator can grep
// Cloudflare logs for "FB_POSTED".
//
// We log every fire to Firestore at `fbPosts/{YYYY-MM-DD}` so the
// operator can audit what went out and (optionally) prevent same-day
// double-fires.

import {
  loadServiceAccount, getAccessToken, firestoreGet, firestorePatch,
  fs, fieldVal,
} from './_lib.js';

const PROMO_URL = 'https://toron.co.il/promo';

// 10 Hebrew Facebook posts that rotate by day-of-year. Each leads with a
// different angle — discount, AI, calendar, WhatsApp, lost-customer
// detection, revenue tracking, per-profession highlights, the public
// link, and a final pricing pitch.
const POSTS = [
  `🎁 חודש שלם של ניהול תורים חכם — חינם

לבעלי מקצוע (ספרים, מניקור, פדיקור, קוסמטיקה):
ביי לפנקס, ביי ל-Excel, ביי לשיחות "מה היה ה-WhatsApp שלך?"

✓ AI בעברית כותב הודעות במקומך
✓ לינק אישי ללקוחות
✓ יומן אוטומטי בזמן אמת
✓ ללא כרטיס אשראי`,

  `שואל את עצמך מה לכתוב ללקוח שלא הגיע השבוע?

AI של Toron כותב במקומך — בעברית, מותאם ללשון זכר/נקבה, 3 גרסאות לבחירה. תזכורות, תודות, הזמנות חזרה — בלי לחשוב.

חודש חינם, ללא כרטיס אשראי 👇`,

  `יש לך WhatsApp Business?

Toron נותנת לך 8 תבניות תגובה מהירה מוכנות בעברית:
/אישור · /תזכורת · /תודה · /ביקורת · /חזרה · /ביטול · /איחור · /הגעה

מעתיק → מדביק ב-WA Business → כל הודעה ללקוח בקליק.`,

  `לוח 20-דקה ברירת מחדל, שעות עבודה גמישות לכל יום, חופשות אוטומטיות, חסימות — סינכרון בזמן אמת מכל מכשיר.

הלקוחות שלך מזמינים בלינק האישי שלך, אתה מקבל התראת פוש מיידית.

חודש חינם, ללא כרטיס אשראי 👇`,

  `לקוחות חוזרים פעם בחודש בדרך כלל — ובאופן פתאומי 3 כבר חודשיים לא הזמינו.

Toron מזהה את זה אוטומטית. לחיצה אחת = הודעת חזרה אישית בוואטסאפ.

🎁 30 יום חינם 👇`,

  `כמה הרווחת השבוע? בלי לחשב.
כמה הוצאת? בלי לחפש קבלות.
מה הרווחיות שלך החודש? בלי Excel.

Toron עוקבת אחרי הכל אוטומטית. דוחות חודשיים והשוואה לחודש קודם — בלחיצה.`,

  `ספרים בישראל — אם אתם עוד רושמים תורים בפנקס:

Toron בנויה במיוחד בשבילכם. תספורת + זקן ב-40 דק' default, לוח חודש קדימה, AI שכותב תזכורת ערב לפני.

חודש שלם חינם 👇`,

  `מניקוריסטיות, פדיקוריסטיות, קוסמטיקאיות:

לוח 20 דק' שמותאם לטיפולים שלכן, תוספות שהלקוחה בוחרת תוך כדי הזמנה, יומן שמסונכרן עם הטלפון.

🎁 30 יום ניסיון חינם 👇`,

  `כל לקוח שלך מקבל לינק קצר ויפה: toron.co.il/השם-שלך

לוחץ → רואה רק את הזמנים הפנויים שלך → ממלא שם וטלפון → מקבל אישור.
בלי אפליקציה. בלי הרשמה. בלי לוגו של ספק.`,

  `50 ש"ח לחודש (פטור ממע"מ). ביטול בקליק. ללא הגבלת לקוחות.

זה כל מה שתשלם על Toron — אחרי 30 יום של ניסיון מלא חינם.

לבעלי מקצוע שיודעים שהזמן שלהם שווה יותר מ-50 ש"ח 👇`,
];

function dayOfYear(d = new Date()) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

function pickPost() {
  return POSTS[dayOfYear() % POSTS.length];
}

export async function handleCronFacebookPost(env) {
  const pageId = env.FB_PAGE_ID;
  const token = env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) {
    console.error('FB_CRON skipping: missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN');
    return { error: 'missing-secrets' };
  }

  const message = pickPost();
  // The Graph API /{page-id}/feed endpoint accepts message + link and
  // auto-renders the link card from the page's Open Graph tags.
  const body = new URLSearchParams({
    message: `${message}\n\n${PROMO_URL}`,
    link: PROMO_URL,
    access_token: token,
  });

  let result;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      method: 'POST',
      body,
    });
    result = await r.json();
    if (!r.ok) throw new Error(result?.error?.message || `HTTP ${r.status}`);
    console.log('FB_POSTED', result.id, 'len=', message.length);
  } catch (e) {
    console.error('FB_POST_FAIL', e?.message);
    result = { error: e?.message };
  }

  // Best-effort audit log into fbPosts/{YYYY-MM-DD}. If Firestore is
  // unavailable, the post itself already went out — we don't fail the cron.
  try {
    const svc = await loadServiceAccount(env);
    const accessToken = await getAccessToken(svc);
    const isoDate = new Date().toISOString().slice(0, 10);
    await firestorePatch(svc, accessToken, `fbPosts/${isoDate}`, {
      fields: {
        postId: fs.string(result?.id || ''),
        message: fs.string(message),
        error: fs.string(result?.error || ''),
        firedAt: fs.timestamp(new Date()),
        ok: fs.bool(!result?.error),
      },
    });
  } catch (e) {
    console.warn('FB_CRON audit log failed:', e?.message);
  }

  return result;
}

// Manual trigger — call from an admin-authenticated endpoint to test.
// Same logic, returns the result instead of just logging.
export async function postToFacebookNow(env, overrideMessage) {
  const pageId = env.FB_PAGE_ID;
  const token = env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return { error: 'missing-secrets' };
  const message = overrideMessage || pickPost();
  const body = new URLSearchParams({
    message: `${message}\n\n${PROMO_URL}`,
    link: PROMO_URL,
    access_token: token,
  });
  const r = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: 'POST', body,
  });
  const data = await r.json();
  return r.ok ? { ok: true, id: data.id, message } : { ok: false, error: data?.error?.message || 'unknown' };
}
