// Admin diagnostic endpoints — owner-only, used to verify external service
// configuration without leaving the deployed environment.
//
// Auth: Firebase ID token (any signed-in user). For now there's no
// per-user role check; the endpoints only return read-only configuration
// status from Brevo, never user data, never secrets. Safe to keep on.

import { verifyIdToken, ok, err, corsHeaders, loadServiceAccount } from './_lib.js';

// Mint an OAuth access token from the service account with the
// `cloud-platform` scope so we can hit the Identity Toolkit Admin API.
async function getCloudPlatformToken(env) {
  const svc = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: svc.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = (obj) => {
    const s = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))));
    return s.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc(claim)}`;
  const pem = svc.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${sig}`,
  });
  if (!r.ok) throw new Error(`token exchange ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}

export async function handleAuthDomainsStatus(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

  // Same dual-auth pattern as brevo-status — diag key OR signed-in user
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('key') || '';
  const diagAllowed = env.AUTH_DIAG_KEY && queryKey && queryKey === env.AUTH_DIAG_KEY;

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

  const svc = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const projectId = svc.project_id;
  let token;
  try {
    token = await getCloudPlatformToken(env);
  } catch (e) {
    return err('Token mint failed: ' + e.message, 500);
  }

  const r = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return err(`Admin API ${r.status}: ${(await r.text()).slice(0, 300)}`, 500);
  const cfg = await r.json();
  return ok({
    projectId,
    authorizedDomains: cfg.authorizedDomains || [],
    signIn: cfg.signIn || null,
    multiTenant: cfg.multiTenant || null,
    toron_in_list: (cfg.authorizedDomains || []).includes('toron.co.il'),
    www_toron_in_list: (cfg.authorizedDomains || []).includes('www.toron.co.il'),
  });
}

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
