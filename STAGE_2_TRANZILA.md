# Stage 2 — Tranzila Integration

Stage 1 (already shipped) gave us the foundation: subscription field, paywall, pricing page, grandfathering, locked Firestore rules. Now to wire real payment.

## What's needed from you

### Tranzila merchant account
- [ ] Open Tranzila merchant account (https://tranzila.com)
- [ ] Get terminal credentials:
  - `terminal_name` (the supplier code)
  - `terminal_password` (for token-based charges)
- [ ] Enable "Iframe Standard" in your terminal settings
- [ ] Configure `notify_url_address` → will point to our Cloudflare Worker
- [ ] Enable "Token mode" — required for monthly recurring charges

### Cloudflare Worker secrets
Set via `wrangler secret put`:
- [ ] `TRANZILA_TERMINAL` — terminal name
- [ ] `TRANZILA_PASSWORD` — terminal password (for API charges)
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` — for Admin SDK writes (Stage 2 reuse of existing FCM service account is fine)

## Endpoints to build in `worker/index.js`

### 1. `POST /api/create-payment-link`
Caller: client (PricingPage when user clicks "Subscribe").
Auth: Firebase ID token in `Authorization` header → verify via Admin SDK.
Returns: `{ url: 'https://direct.tranzila.com/...?...' }`

Tranzila iframe URL format:
```
https://direct.tranzila.com/{TRANZILA_TERMINAL}/iframenew.php?
  sum=50&
  currency=1&
  cred_type=1&
  tranmode=VK&
  TranzilaTK=1&
  notify_url_address=https://barbershop-app.yosigidi1979.workers.dev/api/tranzila-webhook&
  pdesc=מנוי+חודשי+Pro&
  email={user_email}&
  contact={businessName}&
  u71=1&u72=1
```
- `tranmode=VK` = recurring authorization (token issuance)
- `TranzilaTK=1` = create token for future charges
- `u71/u72` = J-series fields if needed for Israeli VAT/invoice

### 2. `POST /api/tranzila-webhook`
Caller: Tranzila notify_url after payment.
Body: form-encoded with token, transaction info.
**Critical:** verify origin (Tranzila publishes their IP range OR use a shared secret in URL path).
Action:
- Find barber by email
- Update `barbers/{uid}.subscription` to:
  ```js
  {
    status: 'active',
    tranzilaToken: <returned token>,
    last4: <last 4 digits>,
    currentPeriodEnd: now + 30 days,
    activatedAt: now,
  }
  ```

### 3. `POST /api/redeem-promo`
Caller: client (PricingPage promo input).
Auth: Firebase ID token.
Body: `{ code: 'FREE2026' }`
Action:
- Read `promoCodes/{code}` doc
- Validate: not expired, not over `maxUses`, user not in `usedBy`
- Extend `subscription.trialEndsAt` (or `currentPeriodEnd`) by `freeDays`
- Push user to `usedBy` array atomically

### 4. `POST /api/cancel-subscription`
Caller: client (Settings → "Cancel").
Auth: Firebase ID token.
Action:
- Set `subscription.status = 'cancelled'`, `cancelAt = now`
- Don't touch `currentPeriodEnd` — user keeps access until end of paid period
- Don't actually contact Tranzila (their tokens just won't be charged next cycle)

### 5. Cron — daily monthly charge runner
Cloudflare Workers Cron Triggers (`wrangler.jsonc`):
```json
"triggers": {
  "crons": ["0 6 * * *"]
}
```
Runs daily at 06:00. Logic:
- Query `barbers` where `subscription.status == 'active'` AND `currentPeriodEnd <= today + 1day`
- For each: charge their stored `tranzilaToken` for ₪50 via Tranzila token-charge API
- On success: extend `currentPeriodEnd += 30 days`, log to `paymentHistory/{uid}/...`
- On failure: mark `subscription.status = 'expired'`, send WhatsApp/push to barber

Tranzila token-charge endpoint:
```
POST https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi
form-data: {
  supplier: <TRANZILA_TERMINAL>,
  TranzilaPW: <TRANZILA_PASSWORD>,
  TranzilaTK: <stored token>,
  sum: 50,
  currency: 1,
  cred_type: 1,
  myid: <barber uid for tracking>
}
```

## Promo codes data model

```
/promoCodes/{code}
  freeDays: 30
  maxUses: 1 (or unlimited)
  usedBy: ['uid1', 'uid2']
  expiresAt: Timestamp
  createdBy: 'admin' | uid
  createdAt: Timestamp
```

Initial codes to create manually via Firebase Console:
- `FREE2026` — 30 days free, unlimited uses, expires end of 2026
- `LAUNCH50` — 30 days free, max 50 uses
- `PARTNER` — 90 days free, internal partners

## Firestore rules to add (Stage 2)

```
match /promoCodes/{code} {
  allow read: if request.auth != null;       // anyone can read to validate
  allow write: if false;                     // only Worker via Admin SDK
}
match /paymentHistory/{uid}/{txId} {
  allow read: if isOwner(uid);
  allow write: if false;
}
```

## Stage 2 UX plumbing (small JS changes only)

- `PricingPage.startCheckout()` — `fetch('/api/create-payment-link', {auth header}).then(redirect)`
- `PricingPage.applyPromo()` — `fetch('/api/redeem-promo')` + show success toast
- `SettingsPage` — add "Cancel subscription" button if status === 'active'
- Worker error path → user sees friendly toast, stays on /pricing

## Test plan

- [ ] New signup → trial 14d → expire → paywall
- [ ] Subscribe → iframe → payment → webhook updates Firestore → access restored
- [ ] Cron renewal at day 30 → +30 days
- [ ] Card declined on cron → status='expired' → barber gets push
- [ ] Cancel mid-month → keeps access until period end → then locked
- [ ] Promo code FREE2026 → +30 days
- [ ] Promo can't be used twice by same user
- [ ] Devtools attempt to edit subscription field → blocked by rules
- [ ] Webhook with missing/wrong signature → rejected

## Order of work for Stage 2

1. Setup Tranzila account + secrets
2. Build `/api/create-payment-link` first (proves iframe flow)
3. Build `/api/tranzila-webhook` (proves token storage)
4. Build cron renewal (proves recurring)
5. Build promo redeem (last — UX nicety)
6. End-to-end test in Tranzila's sandbox
7. Switch DNS / activate
