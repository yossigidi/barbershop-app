// Admin diagnostic endpoints — owner-only, used to verify external service
// configuration without leaving the deployed environment.
//
// Auth: Firebase ID token (any signed-in user). For now there's no
// per-user role check; the endpoints only return read-only configuration
// status from Brevo, never user data, never secrets. Safe to keep on.

import { verifyIdToken, ok, err, corsHeaders, loadServiceAccount } from './_lib.js';

export async function handleBrevoStatus(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (request.method !== 'GET') return err('Method not allowed', 405);

  // Auth — must be signed in
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return err('Missing auth', 401);
  try {
    const svc = await loadServiceAccount(env);
    await verifyIdToken(token, svc.project_id);
  } catch (e) {
    return err('Auth failed: ' + e.message, 401);
  }

  if (!env.BREVO_API_KEY) return err('BREVO_API_KEY not set on Worker', 500);

  // Pull both endpoints in parallel.
  const headers = {
    'api-key': env.BREVO_API_KEY,
    'accept': 'application/json',
  };
  let senders = null, sendersErr = null;
  let domains = null, domainsErr = null;

  try {
    const r = await fetch('https://api.brevo.com/v3/senders', { headers });
    if (r.ok) senders = await r.json();
    else sendersErr = `${r.status} ${await r.text().then((t) => t.slice(0, 200))}`;
  } catch (e) { sendersErr = e.message; }

  try {
    const r = await fetch('https://api.brevo.com/v3/senders/domains', { headers });
    if (r.ok) domains = await r.json();
    else domainsErr = `${r.status} ${await r.text().then((t) => t.slice(0, 200))}`;
  } catch (e) { domainsErr = e.message; }

  // Required addresses we want to see verified
  const required = ['support@toron.co.il', 'privacy@toron.co.il', 'accessibility@toron.co.il', 'noreply@toron.co.il'];

  const senderList = (senders?.senders || []).map((s) => ({
    email: s.email,
    name: s.name,
    active: s.active,
    id: s.id,
  }));
  const domainList = (domains?.domains || []).map((d) => ({
    domain: d.domain || d.name,
    verified: d.verified === true || d.authenticated === true,
    dkim: d.dkim_record || d.dkim || null,
    spf: d.spf_record || d.spf || null,
  }));

  const reqStatus = required.map((email) => {
    const found = senderList.find((s) => s.email?.toLowerCase() === email.toLowerCase());
    return {
      email,
      configured: !!found,
      active: found?.active ?? null,
    };
  });

  const toronDomain = domainList.find((d) => (d.domain || '').toLowerCase() === 'toron.co.il');

  return ok({
    summary: {
      domain_toron_verified: !!toronDomain?.verified,
      addresses_required: reqStatus,
      verdict: toronDomain?.verified
        ? 'Domain toron.co.il is verified — any @toron.co.il address can send.'
        : (reqStatus.every((r) => r.configured && r.active)
            ? 'No domain auth, but all required addresses are configured as individual senders.'
            : 'Action needed — see addresses_required for missing entries, OR verify the toron.co.il domain in Brevo Senders & IPs → Domains.'),
    },
    senders: senderList,
    domains: domainList,
    errors: { senders: sendersErr, domains: domainsErr },
  });
}
