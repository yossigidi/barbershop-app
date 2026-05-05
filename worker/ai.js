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
    instruction: 'Write a friendly WhatsApp reminder for an appointment tomorrow. Tone: warm, casual, brief (2-3 lines max). Include the date, time, and service. End with something like "נתראה!" or "מחכה לך!".',
  },
  'thank-you': {
    label: 'תודה אחרי תור',
    instruction: 'Write a warm WhatsApp thank-you message to a client who came yesterday. Tone: appreciative, personal, brief. If the business has a Google review URL, gently invite them to leave a review.',
  },
  'winback': {
    label: 'חזרה ללקוח שנעלם',
    instruction: 'Write a soft win-back WhatsApp message to a client who has not booked in several weeks. Tone: caring, low-pressure, no guilt-tripping. Mention you noticed and would love to see them again.',
  },
  'reschedule': {
    label: 'בקשה להעברת תור',
    instruction: 'Write a polite WhatsApp message asking the client to reschedule their appointment because the business owner cannot make it. Tone: apologetic, professional. Suggest you will offer alternative times soon.',
  },
  'vip-welcome': {
    label: 'ברכת VIP',
    instruction: 'Write a special WhatsApp message acknowledging a loyal repeat client. Tone: warm, personal, makes them feel valued. Brief.',
  },
  'holiday': {
    label: 'ברכת חג',
    instruction: 'Write a warm WhatsApp holiday greeting from the business to a client. Tone: festive, brief, personal. Mention the upcoming holiday name if provided.',
  },
};

const SYSTEM_PROMPT = `You write short, warm, personal WhatsApp messages for an Israeli service professional (barber, manicurist, pedicurist, cosmetician, or similar appointment-based business) to send to their clients.
Rules:
- Hebrew only. Natural everyday Hebrew, not formal.
- Adapt vocabulary to the profession from context — e.g. "תספורת" for barber, "מניקור" for manicurist, "טיפול" generic.
- Use grammatical gender appropriately: barber/cosmetician is often female, sometimes male; client is also gender-aware. Default to neutral phrasing when unsure.
- Short (2-4 lines). One emoji max per message.
- First-person voice (the business owner speaking).
- Personal: use the client's first name if provided.
- No marketing buzzwords. No "Dear customer". No "We at X".
- Output ONLY a valid JSON array of exactly 3 strings. No prose, no markdown, no commentary, no code fences.
- Each string should differ in tone slightly: warm / professional / casual+playful.`;

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

  const contextLines = [];
  if (c.firstName || c.fullName) contextLines.push(`שם הלקוח: ${c.firstName || c.fullName}`);
  if (c.visits) contextLines.push(`מספר ביקורים בעבר: ${c.visits}`);
  if (c.weeksSinceLastVisit) contextLines.push(`עברו ${c.weeksSinceLastVisit} שבועות מהביקור האחרון`);
  if (b.date) contextLines.push(`תאריך התור: ${b.date}`);
  if (b.time) contextLines.push(`שעה: ${b.time}`);
  if (b.service) contextLines.push(`שירות: ${b.service}`);
  if (b.addons && b.addons.length) contextLines.push(`תוספות: ${b.addons.join(', ')}`);
  if (biz.name) contextLines.push(`שם העסק: ${biz.name}`);
  if (biz.profession) contextLines.push(`תחום: ${biz.profession}`);
  if (biz.googleReviewUrl) contextLines.push(`לינק ביקורת Google: ${biz.googleReviewUrl}`);
  if (body.holidayName) contextLines.push(`שם החג: ${body.holidayName}`);

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
        temperature: 0.85,
        max_tokens: 700,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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
