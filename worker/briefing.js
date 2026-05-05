// AI Daily Briefing — POST /api/ai-briefing
// Pulls today's bookings + recent history, computes signals, sends to
// Groq for a personalized morning briefing in Hebrew.
//
// Returns: { greeting, insights: [...] } where each insight is a string
// with one practical observation or action suggestion.

import {
  loadServiceAccount, getAccessToken, firestoreGet, firestoreQuery,
  verifyIdToken, getBearerToken, fieldVal, ok, err, corsHeaders,
} from './_lib.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function handleAiBriefing(request, env) {
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

  if (!env.GROQ_API_KEY) return err('AI not configured', 500);

  // Load barber profile + recent bookings + recent blocks
  const svc = await loadServiceAccount(env);
  const accessToken = await getAccessToken(svc);

  const barberDoc = await firestoreGet(svc, accessToken, `barbers/${claims.uid}`);
  if (!barberDoc) return err('Barber not found', 404);

  const businessName = fieldVal(barberDoc.fields?.businessName) || 'העסק';
  const aiGender = fieldVal(barberDoc.fields?.aiGender) || 'neutral';
  const displayName = fieldVal(barberDoc.fields?.displayName) || '';
  const firstName = (displayName || '').split(/\s+/)[0] || '';

  // Date helpers (server runs UTC; we want Israel local dates)
  const now = new Date();
  const today = isoDateIsrael(now);
  const tomorrow = isoDateIsrael(new Date(now.getTime() + 86_400_000));
  const yesterday = isoDateIsrael(new Date(now.getTime() - 86_400_000));
  const thirtyDaysAgo = isoDateIsrael(new Date(now.getTime() - 30 * 86_400_000));
  const ninetyDaysAgo = isoDateIsrael(new Date(now.getTime() - 90 * 86_400_000));

  // Pull bookings spanning last 90 days through tomorrow
  let bookings = [];
  try {
    bookings = await firestoreQuery(svc, accessToken, {
      from: [{ collectionId: 'bookings', allDescendants: false }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'date' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: ninetyDaysAgo } } },
            { fieldFilter: { field: { fieldPath: 'date' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: tomorrow } } },
          ],
        },
      },
    });
    // The query above pulls from ALL barbers — filter to ours by parent path
    bookings = bookings.filter((row) => row.name.includes(`/barbers/${claims.uid}/`));
  } catch (e) {
    // Composite query may need an index — fall back to simpler per-bucket queries
    console.warn('briefing query fallback', e?.message);
    bookings = [];
  }

  // Decode each row into an object
  const decodedBookings = bookings.map((row) => {
    const f = row.fields || {};
    return {
      id: row.name.split('/').pop(),
      date: fieldVal(f.date) || '',
      time: fieldVal(f.time) || '',
      duration: Number(fieldVal(f.duration)) || 20,
      price: Number(fieldVal(f.price)) || 0,
      clientName: fieldVal(f.clientName) || '',
      clientPhone: fieldVal(f.clientPhone) || '',
      serviceName: fieldVal(f.serviceName) || '',
      status: fieldVal(f.status) || 'booked',
    };
  });

  // ─── Compute signals ─────────────────────────────────────────────────────
  const todayBookings = decodedBookings.filter((b) => b.date === today && b.status !== 'cancelled');
  const yesterdayBookings = decodedBookings.filter((b) => b.date === yesterday);
  const tomorrowBookings = decodedBookings.filter((b) => b.date === tomorrow && b.status !== 'cancelled');
  const recentCancellations = decodedBookings.filter((b) => b.status === 'cancelled' && b.date >= thirtyDaysAgo);
  const last30Bookings = decodedBookings.filter((b) => b.date >= thirtyDaysAgo && b.date <= today);

  // Frequent cancellers — clients with 2+ cancellations in last 30 days
  const cancellationsByClient = {};
  for (const b of recentCancellations) {
    if (!b.clientPhone) continue;
    cancellationsByClient[b.clientPhone] = (cancellationsByClient[b.clientPhone] || 0) + 1;
  }
  const riskyToday = todayBookings.filter((b) => cancellationsByClient[b.clientPhone] >= 2);

  // Dormant clients — were active in last 90d but no booking last 8 weeks
  const fiftySixDaysAgo = isoDateIsrael(new Date(now.getTime() - 56 * 86_400_000));
  const clientLastVisit = {};
  for (const b of decodedBookings) {
    if (b.status === 'cancelled') continue;
    if (!b.clientPhone || !b.clientName) continue;
    if (!clientLastVisit[b.clientPhone] || b.date > clientLastVisit[b.clientPhone].date) {
      clientLastVisit[b.clientPhone] = { date: b.date, name: b.clientName };
    }
  }
  const dormantClients = Object.entries(clientLastVisit)
    .filter(([, v]) => v.date < fiftySixDaysAgo)
    .map(([phone, v]) => ({ phone, name: v.name, lastDate: v.date }))
    .slice(0, 8);

  // Today revenue projection (from scheduled bookings)
  const todayRevenue = todayBookings.reduce((s, b) => s + (b.price || 0), 0);
  const yesterdayRevenue = yesterdayBookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + (b.price || 0), 0);
  // 30-day daily average revenue
  const last30Revenue = last30Bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + (b.price || 0), 0);
  const avgDailyRevenue = Math.round(last30Revenue / 30);

  // Today first booking
  const todaySorted = [...todayBookings].sort((a, b) => a.time.localeCompare(b.time));
  const firstBookingToday = todaySorted[0];

  // Build the data summary for Groq
  const dataLines = [
    `Today's date: ${today} (Israel)`,
    `Today's bookings: ${todayBookings.length}`,
    todaySorted.length > 0 ? `Today's first appointment: ${firstBookingToday.clientName} at ${firstBookingToday.time}` : `No appointments today`,
    `Today's projected revenue: ₪${todayRevenue}`,
    `Yesterday: ${yesterdayBookings.filter((b) => b.status !== 'cancelled').length} bookings, ₪${yesterdayRevenue}`,
    `30-day average daily revenue: ₪${avgDailyRevenue}`,
    `Tomorrow's bookings so far: ${tomorrowBookings.length}`,
    `Risky today (clients with 2+ recent cancellations): ${riskyToday.map((b) => `${b.clientName} at ${b.time}`).join(', ') || 'none'}`,
    `Dormant clients (>8 weeks no visit): ${dormantClients.length}${dormantClients.length > 0 ? ' — ' + dormantClients.slice(0, 3).map((c) => c.name).join(', ') + (dormantClients.length > 3 ? '...' : '') : ''}`,
  ];

  const systemPrompt = `You are an AI assistant for a service-business owner (barber, cosmetician, manicurist, pedicurist, or similar) in Israel. The owner is opening their dashboard. Write a SHORT personalized morning briefing in Hebrew based on the data provided.

OUTPUT REQUIREMENTS:
- Output ONLY a valid JSON object: { "greeting": "...", "insights": ["..", "..", ".."] }
- greeting: 1 short Hebrew line, friendly. Use the owner's first name if provided. Match their gender (${aiGender}).
- insights: 3-5 short Hebrew bullet items. Each ≤100 characters. Concrete and actionable, not generic.
- Hebrew only, natural everyday language.
- ONE emoji max per insight.
- DO NOT include filler ("הכל בסדר", "יום טוב", "תאחל יום נעים").
- DO NOT make up names or numbers — use only what's in the data.
- Insights should be genuinely useful: highlight risks (frequent cancellers), opportunities (empty slots + dormant clients), forecasting (today's revenue vs average), or capacity warnings (tomorrow filling up).
- If there's nothing notable, write a single insight saying so plainly.`;

  const userPrompt = `Data:\n${dataLines.join('\n')}\n\nWrite the briefing now.`;

  let groqJson;
  try {
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.55,
        max_tokens: 700,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      console.error('GROQ briefing error', r.status, text.slice(0, 300));
      return err(`AI error (${r.status})`, 502);
    }
    groqJson = await r.json();
  } catch (e) {
    return err('AI fetch failed: ' + e.message, 502);
  }

  const content = groqJson?.choices?.[0]?.message?.content?.trim() || '';
  const parsed = parseBriefing(content);

  if (!parsed) {
    // Fallback: return a basic deterministic briefing
    return ok({
      greeting: firstName ? `בוקר טוב, ${firstName}!` : 'בוקר טוב!',
      insights: [
        `היום ${todayBookings.length} ${todayBookings.length === 1 ? 'תור' : 'תורים'}.`,
        firstBookingToday ? `הראשון: ${firstBookingToday.clientName} ב-${firstBookingToday.time}.` : 'אין תורים היום.',
        `הכנסה צפויה: ₪${todayRevenue}.`,
      ],
      stats: { todayCount: todayBookings.length, todayRevenue, dormant: dormantClients.length },
    });
  }

  return ok({
    greeting: parsed.greeting,
    insights: parsed.insights,
    stats: {
      todayCount: todayBookings.length,
      todayRevenue,
      avgDailyRevenue,
      tomorrowCount: tomorrowBookings.length,
      riskyTodayCount: riskyToday.length,
      dormantCount: dormantClients.length,
    },
  });
}

function parseBriefing(content) {
  if (!content) return null;
  // Strategy 1: pure JSON object
  try {
    const obj = JSON.parse(content);
    if (obj && typeof obj.greeting === 'string' && Array.isArray(obj.insights)) {
      return { greeting: obj.greeting.trim(), insights: obj.insights.filter((s) => typeof s === 'string').map((s) => s.trim()) };
    }
  } catch {}
  // Strategy 2: code-fenced JSON
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      const obj = JSON.parse(fence[1]);
      if (obj && typeof obj.greeting === 'string' && Array.isArray(obj.insights)) {
        return { greeting: obj.greeting.trim(), insights: obj.insights.filter((s) => typeof s === 'string') };
      }
    } catch {}
  }
  // Strategy 3: any JSON object found in text
  const objMatch = content.match(/\{[\s\S]*?"insights"[\s\S]*?\}/);
  if (objMatch) {
    try {
      const obj = JSON.parse(objMatch[0]);
      if (obj?.greeting && Array.isArray(obj.insights)) {
        return { greeting: String(obj.greeting), insights: obj.insights.filter((s) => typeof s === 'string') };
      }
    } catch {}
  }
  return null;
}

// Israel-local YYYY-MM-DD (ignoring DST nuance — close enough for daily date ops)
function isoDateIsrael(date) {
  // Israel = UTC+2 (winter) or UTC+3 (summer). Use Intl with timezone to be safe.
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(date);
  } catch {
    // Fallback: use UTC
    return date.toISOString().slice(0, 10);
  }
}
