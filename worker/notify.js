// FCM push handler — POST /api/notify
// Body: { barberId, title, body }
// Reads barber's fcmTokens from Firestore (REST + service account OAuth)
// and sends a push to each via FCM HTTP v1 API.

export async function handleNotify(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { barberId, bookingId, title, body } = payload || {};
  if (!barberId || !title) {
    return new Response('Missing fields', { status: 400 });
  }

  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error('NOTIFY missing FIREBASE_SERVICE_ACCOUNT_JSON');
    return new Response('Server not configured (missing FIREBASE_SERVICE_ACCOUNT_JSON)', { status: 500 });
  }

  let svc;
  try {
    svc = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    console.error('NOTIFY bad service account JSON', e?.message);
    return new Response('Bad service account JSON: ' + e?.message, { status: 500 });
  }

  if (!svc.private_key || !svc.client_email || !svc.project_id) {
    console.error('NOTIFY service account missing fields', Object.keys(svc));
    return new Response('Service account JSON missing fields. Has: ' + Object.keys(svc).join(','), { status: 500 });
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(svc);
  } catch (e) {
    console.error('NOTIFY token exchange failed', e?.message);
    return new Response('Token exchange failed: ' + e?.message, { status: 500 });
  }

  // Read barber doc from Firestore REST
  const docUrl = `https://firestore.googleapis.com/v1/projects/${svc.project_id}/databases/(default)/documents/barbers/${encodeURIComponent(barberId)}`;
  const docRes = await fetch(docUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!docRes.ok) {
    const errText = await docRes.text().catch(() => '');
    console.error('NOTIFY firestore read failed', docRes.status, errText);
    return new Response(`Barber not found (status ${docRes.status})`, { status: 404 });
  }
  const docJson = await docRes.json();
  const tokensField = docJson.fields?.fcmTokens?.arrayValue?.values || [];
  const tokens = tokensField.map((v) => v.stringValue).filter(Boolean);

  console.log('NOTIFY tokens found:', tokens.length, 'for barber', barberId);

  if (tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no tokens' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results = await Promise.all(
    tokens.map((token) => sendFcm(svc.project_id, accessToken, token, title, body || '', bookingId || '')),
  );
  const sent = results.filter((r) => r.ok).length;

  return new Response(JSON.stringify({ sent, total: tokens.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendFcm(projectId, accessToken, token, title, body, bookingId) {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const link = bookingId ? `/dashboard?booking=${bookingId}` : '/dashboard';
  const message = {
    message: {
      token,
      notification: { title, body },
      webpush: {
        notification: { title, body, icon: '/icon-192.png', badge: '/icon-192.png' },
        fcm_options: { link },
        data: { link, bookingId: bookingId || '' },
      },
      data: { link, bookingId: bookingId || '' },
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
  return { ok: res.ok, status: res.status };
}

async function getAccessToken(svc) {
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
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) throw new Error('Token exchange failed: ' + JSON.stringify(tokenJson));
  return tokenJson.access_token;
}

function base64url(buf) {
  let str = '';
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function importPkcs8(pem) {
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
