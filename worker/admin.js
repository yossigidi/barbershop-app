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

  // Auth — accepts EITHER a signed-in Firebase ID token OR a one-time
  // diagnostic key (set as Worker secret BREVO_DIAG_KEY). The diagnostic
  // key path is for the operator to run one-shot checks without going
  // through a browser session. Response contains no secrets and no user
  // data — only Brevo configuration status.
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('key') || '';
  const diagAllowed = env.BREVO_DIAG_KEY && queryKey && queryKey === env.BREVO_DIAG_KEY;

  if (!diagAllowed) {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return err('Missing auth', 401);
    try {
      const svc = await loadServiceAccount(env);
      await verifyIdToken(token, svc.project_id);
    } catch (e) {
      return err('Auth failed: ' + e.message, 401);
    }
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
  // Pass through every key Brevo returns so we can spot the real
  // domain-name field (Brevo has used `domain`, `name`, `domain_name`)
  const domainList = (domains?.domains || []).map((d) => ({ ...d }));

  const reqStatus = required.map((email) => {
    const found = senderList.find((s) => s.email?.toLowerCase() === email.toLowerCase());
    return {
      email,
      configured: !!found,
      active: found?.active ?? null,
    };
  });

  const toronDomain = domainList.find((d) => {
    const candidates = [d.domain, d.name, d.domain_name].filter(Boolean).map((s) => String(s).toLowerCase());
    return candidates.includes('toron.co.il');
  });

  const toronVerified = !!toronDomain && (toronDomain.verified === true || toronDomain.authenticated === true);

  return ok({
    summary: {
      domain_toron_verified: toronVerified,
      toron_domain_record: toronDomain || null,
      addresses_required: reqStatus,
      verdict: toronVerified
        ? 'Domain toron.co.il is verified — any @toron.co.il address can send.'
        : toronDomain
            ? 'toron.co.il is added to Brevo but NOT yet verified. Check DKIM/SPF DNS records.'
            : (reqStatus.every((r) => r.configured && r.active)
                ? 'No domain auth, but all required addresses are configured as individual senders.'
                : 'Action needed — toron.co.il is not in Brevo yet. Senders & IPs → Domains → Add a domain.'),
    },
    senders: senderList,
    domains: domainList,
    errors: { senders: sendersErr, domains: domainsErr },
  });
}
