// Shared worker utilities: Firebase service-account OAuth, Firestore REST,
// Firebase ID token verification (for authenticating client requests),
// and small helpers.

export async function loadServiceAccount(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
  }
  const svc = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!svc.private_key || !svc.client_email || !svc.project_id) {
    throw new Error('Service account JSON missing required fields');
  }
  return svc;
}

export async function getAccessToken(svc) {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: svc.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const enc = (obj) => base64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const key = await importPkcs8(svc.private_key);
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(new Uint8Array(sigBuf))}`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const j = await tokenRes.json();
  if (!j.access_token) throw new Error('Token exchange failed: ' + JSON.stringify(j));
  return j.access_token;
}

export async function firestoreGet(svc, accessToken, path) {
  const url = `https://firestore.googleapis.com/v1/projects/${svc.project_id}/databases/(default)/documents/${path}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore GET ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

// PATCH with explicit field mask — only updates the listed paths, leaves the rest.
export async function firestorePatch(svc, accessToken, path, fields, updateMask) {
  const params = new URLSearchParams();
  if (updateMask && updateMask.length) {
    for (const f of updateMask) params.append('updateMask.fieldPaths', f);
  }
  const url = `https://firestore.googleapis.com/v1/projects/${svc.project_id}/databases/(default)/documents/${path}?${params.toString()}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(`Firestore PATCH ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

// Run a structured query against Firestore REST. Pass a `structuredQuery`
// object (per Firestore docs) and we'll POST it. Returns the array of raw
// document objects (with .document.fields) — caller decodes with fieldVal.
export async function firestoreQuery(svc, accessToken, structuredQuery) {
  const url = `https://firestore.googleapis.com/v1/projects/${svc.project_id}/databases/(default)/documents:runQuery`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!r.ok) throw new Error(`Firestore runQuery: ${r.status} ${await r.text()}`);
  const arr = await r.json();
  return (arr || []).filter((row) => row.document).map((row) => ({
    name: row.document.name,
    fields: row.document.fields || {},
  }));
}

// Firestore field encoders — REST API requires typed values
export const fs = {
  str: (v) => ({ stringValue: String(v ?? '') }),
  num: (v) => ({ integerValue: String(Math.round(Number(v) || 0)) }),
  bool: (v) => ({ booleanValue: !!v }),
  ts: (date) => ({ timestampValue: (date instanceof Date ? date : new Date(date)).toISOString() }),
  map: (obj) => ({ mapValue: { fields: obj } }),
  arr: (items) => ({ arrayValue: { values: items } }),
};

export function fieldVal(f) {
  if (!f) return undefined;
  if ('stringValue' in f) return f.stringValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return Number(f.doubleValue);
  if ('booleanValue' in f) return f.booleanValue;
  if ('timestampValue' in f) return new Date(f.timestampValue);
  if ('mapValue' in f) {
    const out = {};
    for (const [k, v] of Object.entries(f.mapValue.fields || {})) out[k] = fieldVal(v);
    return out;
  }
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(fieldVal);
  if ('nullValue' in f) return null;
  return undefined;
}

// ─── Firebase ID token verification (JWK-based) ───────────────────────────
// Verifies a Firebase Auth ID token against Google's public JWKs.
// Returns { uid, email } or throws.

let _jwkCache = null;
let _jwkExpiry = 0;

async function getGoogleJwks() {
  if (_jwkCache && Date.now() < _jwkExpiry) return _jwkCache;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('Failed to fetch JWKs');
  const json = await r.json();
  const cacheControl = r.headers.get('cache-control') || '';
  const m = cacheControl.match(/max-age=(\d+)/);
  const ttl = m ? parseInt(m[1], 10) : 3600;
  _jwkCache = json;
  _jwkExpiry = Date.now() + ttl * 1000;
  return json;
}

async function importRsaPublicKeyFromJwk(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

export async function verifyIdToken(token, projectId) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error('Token expired');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Bad issuer');
  if (payload.aud !== projectId) throw new Error('Bad audience');
  if (!payload.sub) throw new Error('No subject');

  const jwks = await getGoogleJwks();
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown kid');

  const key = await importRsaPublicKeyFromJwk(jwk);
  const sig = base64UrlToUint8(parts[2]);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const ok = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    key,
    sig,
    data,
  );
  if (!ok) throw new Error('Bad signature');

  return { uid: payload.sub, email: payload.email || '' };
}

// ─── Generic helpers ──────────────────────────────────────────────────────

export function base64url(buf) {
  let str = '';
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function base64UrlToUint8(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function importPkcs8(pem) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export function getBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) throw new Error('Missing Authorization Bearer');
  return m[1];
}

export function ok(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
export function err(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// CORS preflight + helper
export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
