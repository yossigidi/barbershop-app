// Cloudflare Worker entrypoint.
// Routes:
//   POST /api/notify                → FCM push notification
//   POST /api/create-payment-link   → Tranzila iframe URL (auth required)
//   POST /api/tranzila-webhook      → Tranzila notify_url callback
//   POST /api/redeem-promo          → apply a promo code (auth required)
//   anything else                   → static assets (Vite build in ./dist), with SPA fallback

import { handleNotify } from './notify.js';
import {
  handleCreatePaymentLink, handleTranzilaWebhook, handleCancelSubscription,
  handleCancelStudio, handleTranzilaSuccess, handleTranzilaFail,
} from './payment.js';
import { handleRedeemPromo } from './promo.js';
import { handleAiCompose } from './ai.js';
import { handleAiBriefing } from './briefing.js';
import { handleSendConfirmationEmail } from './email.js';
import { handleBrevoStatus, handleAuthDomainsStatus } from './admin.js';
import { handleCronBilling } from './cron.js';
import { handleCronFacebookPost, postToFacebookNow } from './fb-cron.js';
import { maybeRewriteOg } from './og.js';

const apiHandlers = {
  '/api/notify': handleNotify,
  '/api/create-payment-link': handleCreatePaymentLink,
  '/api/tranzila-webhook': handleTranzilaWebhook,
  '/api/tranzila-success': handleTranzilaSuccess,
  '/api/tranzila-fail': handleTranzilaFail,
  '/api/cancel-subscription': handleCancelSubscription,
  '/api/cancel-studio': handleCancelStudio,
  '/api/redeem-promo': handleRedeemPromo,
  '/api/ai-compose': handleAiCompose,
  '/api/ai-briefing': handleAiBriefing,
  '/api/send-confirmation-email': handleSendConfirmationEmail,
  '/api/admin/brevo-status': handleBrevoStatus,
  '/api/admin/auth-domains': handleAuthDomainsStatus,
  // Manual trigger — POST with header `x-admin-key: <ADMIN_KEY>` to test
  // a Facebook post before the cron fires.
  '/api/admin/fb-post-now': async (req, env) => {
    if (req.headers.get('x-admin-key') !== env.ADMIN_KEY) {
      return new Response('forbidden', { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const r = await postToFacebookNow(env, body?.message);
    return new Response(JSON.stringify(r), {
      status: r.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const handler = apiHandlers[url.pathname];

    if (handler) {
      try {
        return await handler(request, env);
      } catch (e) {
        console.error(`API_ERROR ${url.pathname}`, e?.message, e?.stack);
        return new Response(JSON.stringify({ error: e?.message || 'unknown' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Barber booking pages (/b/<code> or /<slug>) get their OG meta
    // tags rewritten with the barber's logo + business name so that
    // WhatsApp / Facebook / iMessage link previews show the barber's
    // brand instead of Toron's generic shell. Falls through to the
    // standard asset pipeline if the path isn't a barber slug.
    try {
      const og = await maybeRewriteOg(request, env);
      if (og) return og;
    } catch (e) {
      console.warn('OG_REWRITE_FAIL', e?.message);
    }

    return env.ASSETS.fetch(request);
  },

  // Cloudflare Cron Trigger — see wrangler.jsonc "triggers.crons".
  // We register more than one schedule there; `event.cron` is the matched
  // cron pattern so we can dispatch to the right handler.
  async scheduled(event, env, ctx) {
    console.log('CRON_TRIGGER', event.cron, new Date().toISOString());
    // Daily billing — runs at 06:00 UTC, every day.
    if (event.cron === '0 6 * * *') {
      ctx.waitUntil(
        handleCronBilling(env).catch((e) => console.error('CRON_FATAL', e?.message, e?.stack)),
      );
      return;
    }
    // Facebook post — registered as daily 08:00 UTC because Cloudflare's
    // cron parser refused weekday-specific patterns. The handler itself
    // skips out on days other than Sun (0) / Tue (2) / Thu (4) so the
    // net schedule is the same: 3 posts/week ~10-11 IL.
    if (event.cron === '0 8 * * *') {
      const day = new Date().getUTCDay();
      if (day === 0 || day === 2 || day === 4) {
        ctx.waitUntil(
          handleCronFacebookPost(env).catch((e) => console.error('FB_CRON_FATAL', e?.message, e?.stack)),
        );
      } else {
        console.log('FB_CRON_SKIP day=', day);
      }
      return;
    }
    console.warn('CRON_UNHANDLED', event.cron);
  },
};
