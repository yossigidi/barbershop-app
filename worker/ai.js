// AI message composer — POST /api/ai-compose
// Calls Groq's llama-3.3-70b to generate Hebrew WhatsApp messages
// personalized for the barber's specific client + scenario.
//
// Body: { scenario, client, booking, business }
// Returns: { variations: [string, string, string] }

import {
  loadServiceAccount, verifyIdToken, getBearerToken, ok, err, corsHeaders,
} from './_lib.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Scenario → tone + structural guidance for the LLM. Wording is
// profession-neutral; the actual profession (barber / manicurist /
// pedicurist / cosmetician / etc.) is passed in `business.profession`
// and the LLM adapts the language accordingly.
const SCENARIOS = {
  'reminder': {
    label: 'תזכורת',
    instruction:
`Write 3 short, friendly WhatsApp reminders for tomorrow's appointment.
- 2-3 lines each.
- Mention the service in 1-2 words ("תספורת", "מניקור ג'ל", "טיפול פנים"). DO NOT list the add-ons individually.
- Mention only the time. Date is "מחר".
- If a "Manage URL" is in context, append it on its own line at the end with a short prefix: "לעריכה / ביטול: <url>".
- End the body (before the URL) with something natural like "נתראה" or "מחכה לך".

GOOD example: "היי דני, תזכורת קטנה — מחר ב-10:00 לתספורת. נתראה! ✂️\\nלעריכה / ביטול: <url>"
BAD example: "מה שבוע היה! דני, תזכורת לתור המצחיק שלך מחר תספורת + זקן + שעווה באוזניים..."`,
  },
  'thank-you': {
    label: 'תודה אחרי תור',
    instruction:
`Write 3 short thank-you messages to a client who came yesterday.
- 2-3 lines each.
- DO NOT list services or add-ons. The client knows what they got.
- DO NOT use awkward openings like "מה שבוע היה" or "התור המצחיק".
- If a Google review URL is provided in context, mention naturally — "אם בא לך, אשמח לביקורת קצרה ב-Google" — and put the URL on its own line.
- The 3 variations differ in tone: warm / brief-and-professional / friendly-casual.

GOOD example: "תודה שהיית היום אצלי, דני. שמחתי לראות אותך 🙏"
BAD example: "מה שבוע היה! דני, תודה על התור המצחיק אתמול, תספורת + זקן + שעווה באוזניים..."`,
  },
  'winback': {
    label: 'חזרה ללקוח שנעלם',
    instruction:
`Write 3 soft win-back messages to a client who hasn't booked in a while.
- 2-3 lines each.
- Caring, low-pressure. No guilt-tripping ("איפה היית?" is forbidden).
- Mention casually that some time has passed.
- End with an open invitation ("אשמח לראות אותך שוב" / "אם בא לך לקבוע — אני כאן").

GOOD example: "היי דני, חשבתי עליך — עבר זמן. אם בא לך לקבוע, אני כאן 🌸"
BAD example: "דני! איפה אתה? כבר 8 שבועות לא ראיתי אותך, התגעגעתי..."`,
  },
  'reschedule': {
    label: 'בקשה להעברת תור',
    instruction:
`Write 3 polite messages to a client asking to reschedule their appointment because the business owner cannot make it.
- 2-3 lines each.
- Apologetic but not over-the-top. Don't share personal medical details.
- Suggest you'll offer new times soon.

GOOD example: "היי דני, מצטערת — נאלצת לבטל את התור של מחר. אצור איתך קשר לתאם זמן חדש."
BAD example: "אני חולה במיגרנה רעה ולא יכולה לתספר אף אחד..."`,
  },
  'vip-welcome': {
    label: 'ברכת VIP',
    instruction:
`Write 3 short messages acknowledging a loyal repeat client (5+ visits).
- 2-3 lines each.
- Make them feel seen. Not "you are a VIP" (cringe), but personal.
- Optional: mention something small (kept-aside time, priority).

GOOD example: "תמיד שמחה לראות אותך אצלי, דני. עוד פעם הצלחת לעשות לי את היום 💛"
BAD example: "ברוך הבא, לקוח VIP יקר! מסלול הזהב שלנו..."`,
  },
  'holiday': {
    label: 'ברכת חג',
    instruction:
`Write 3 short holiday greetings.
- 2-3 lines each.
- Mention the holiday by name (passed in context).
- Warm but brief. One emoji.

GOOD example: "חג פסח שמח, דני! מאחלת לך וולמשפחה ימים טובים 🌸"
BAD example: "שלום ולברכה. בכל יום ויום אנו מודים על הזכות..."`,
  },
};

// Grammatical-gender helper — Hebrew is gendered, the AI must match the
// business owner's gender exactly or messages sound wrong (e.g. "הייתי
// שמחה" from a male barber). Three modes:
//   'male'   — use masculine present-tense adjectives/verbs
//   'female' — use feminine
//   'neutral' (default) — prefer past tense and gender-neutral phrasing
function genderRules(g) {
  if (g === 'male') return `
- The business owner is MALE. Use MASCULINE first-person Hebrew throughout.
  CORRECT: "שמחתי לראות אותך", "אני כאן", "אני שמח", "מחכה לך"
  WRONG (female forms): "שמחה לראות", "אני שמחה", "הייתי שמחה"`;
  if (g === 'female') return `
- The business owner is FEMALE. Use FEMININE first-person Hebrew throughout.
  CORRECT: "שמחה לראות אותך", "אני שמחה", "הייתי שמחה", "מחכה לך"
  WRONG (male forms): "שמח לראות", "אני שמח", "הייתי שמח"`;
  return `
- The business owner's gender is unspecified — avoid gendered present-tense
  adjectives. Prefer past-tense forms ("שמחתי", "ראיתי") and gender-neutral
  phrasings. Do NOT write "שמחה לראות" or "שמח לראות" — instead "שמחתי
  לראות אותך" works for both.`;
}

// One general system prompt — the per-scenario instructions stack on top.
function buildSystemPrompt(gender) {
  return `You write short, warm, personal WhatsApp messages in Hebrew for an Israeli service professional (barber, manicurist, pedicurist, cosmetician, or similar appointment-based business) to send to their clients.

GENERAL RULES (apply to every scenario):
- Hebrew only. Use natural everyday Hebrew, like a friendly text between people who know each other.
- Short. 2-3 lines per message. NEVER more than 4 lines.
- First-person voice — the business owner is speaking directly.
- Use the client's first name when provided.
${genderRules(gender)}
- DO NOT list services and add-ons mechanically. If the service name is needed, say it in 1-2 words ("תספורת", "מניקור ג'ל", "טיפול פנים"). NEVER write "תספורת + זקן + שעווה באוזניים" as a list.
- DO NOT use the literal English word "appointment" or its mistranslation "תור מצחיק". The Hebrew word is "תור".
- DO NOT open with awkward phrases: "מה שבוע היה", "מה שלום", "אהוי", "ברוך הבא", "Dear customer", "We at", "אנו ב".
- DO NOT use marketing speak: "המסלול הזהבי", "חוויה בלתי נשכחת", "אקסקלוסיבי".
- One emoji per message AT MOST. Pick one that's clearly relevant (✂️🌸💅💆🎉🙏✨💛). DO NOT end the message mid-emoji.
- Output ONLY a valid JSON array of exactly 3 strings. No prose, no markdown, no code fences, no commentary.
- The 3 variations should be DISTINCT — different opening, slightly different tone (warm / professional / playful).
- Keep each variation under 220 characters so it fits comfortably in a WhatsApp preview.`;
}

export async function handleAiCompose(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (request.method !== 'POST') return err('Method not allowed', 405);

  // Auth
  let claims;
  try {
    const token = getBearerToken(request);
    const svc = await loadServiceAccount(env);
    claims = await verifyIdToken(token, svc.project_id);
  } catch (e) {
    return err('Unauthorized: ' + e.message, 401);
  }

  if (!env.GROQ_API_KEY) {
    return err('GROQ_API_KEY not configured', 500);
  }

  let body;
  try { body = await request.json(); } catch { return err('Bad JSON', 400); }

  const scenarioKey = body?.scenario || 'reminder';
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario) return err('Unknown scenario', 400);

  // Build the user message with all the context the LLM needs
  const c = body.client || {};
  const b = body.booking || {};
  const biz = body.business || {};

  // Build context — service is condensed to ONE field (no separate addons list)
  // so the LLM doesn't mechanically dump them all into the message.
  const serviceLine = b.service
    ? (b.addons && b.addons.length ? `${b.service} + ${b.addons.length} תוספות` : b.service)
    : '';

  const contextLines = [];
  if (c.firstName || c.fullName) contextLines.push(`Client first name: ${(c.firstName || c.fullName).split(/\s+/)[0]}`);
  if (c.visits) contextLines.push(`Client previous visits: ${c.visits}`);
  if (c.weeksSinceLastVisit) contextLines.push(`Weeks since last visit: ${c.weeksSinceLastVisit}`);
  if (b.date) contextLines.push(`Appointment date: ${b.date} (refer to it as "מחר" if it's tomorrow)`);
  if (b.time) contextLines.push(`Appointment time: ${b.time}`);
  if (serviceLine) contextLines.push(`Service (do NOT list add-ons individually): ${serviceLine}`);
  if (biz.name) contextLines.push(`Business name: ${biz.name}`);
  if (biz.profession) contextLines.push(`Profession: ${biz.profession} (adapt vocabulary)`);
  if (biz.contact) contextLines.push(`Sender (business owner) name: ${biz.contact}`);
  if (biz.googleReviewUrl) contextLines.push(`Google review URL: ${biz.googleReviewUrl}`);
  if (body.manageUrl) contextLines.push(`Manage URL (client can edit/cancel via this link): ${body.manageUrl}`);
  if (body.holidayName) contextLines.push(`Holiday name: ${body.holidayName}`);

  const userPrompt = [
    `תרחיש: ${scenario.label}`,
    '',
    `הוראות סגנון:`,
    scenario.instruction,
    '',
    `הקשר:`,
    ...contextLines,
    '',
    `החזר 3 וריאציות שונות בעברית, בפורמט JSON array של 3 מחרוזות.`,
  ].join('\n');

  // Call Groq
  let groqRes;
  try {
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        // Lower temperature — 0.85 made the model "creative" in bad ways
        // ("מה שבוע היה", "התור המצחיק"). 0.55 gives natural variation
        // without hallucinated openers.
        temperature: 0.55,
        // Up max_tokens so the third message + closing emoji never gets
        // truncated mid-character (caused stray � in earlier outputs).
        max_tokens: 900,
        messages: [
          { role: 'system', content: buildSystemPrompt(biz.aiGender || 'neutral') },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      console.error('GROQ error', r.status, text.slice(0, 300));
      return err(`AI error (${r.status})`, 502);
    }
    groqRes = await r.json();
  } catch (e) {
    console.error('GROQ fetch error', e?.message);
    return err('Failed to reach AI: ' + e.message, 502);
  }

  const content = groqRes?.choices?.[0]?.message?.content?.trim() || '';
  const variations = parseVariations(content);

  if (variations.length === 0) {
    return err('AI returned no variations', 502);
  }

  return ok({ variations, scenario: scenarioKey });
}

// Parse the LLM's response. Models sometimes wrap in code fences or add prose.
// Try multiple strategies: pure JSON, JSON inside fences, line-split fallback.
function parseVariations(content) {
  if (!content) return [];

  // Strategy 1: pure JSON array
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string' && s.trim());
  } catch {}

  // Strategy 2: JSON inside ```json … ``` fences
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string' && s.trim());
    } catch {}
  }

  // Strategy 3: find a JSON array anywhere in the text
  const arrayMatch = content.match(/\[\s*"[\s\S]*?"\s*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string' && s.trim());
    } catch {}
  }

  // Strategy 4: numbered list fallback (1. ... 2. ... 3. ...)
  const numbered = content.split(/\n\s*\d+[\.\)]\s*/).slice(1).map((s) => s.trim()).filter(Boolean);
  if (numbered.length >= 2) return numbered.slice(0, 3);

  // Last resort: return the whole thing as a single variation
  return [content];
}
