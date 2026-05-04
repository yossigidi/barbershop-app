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
import { handleCronBilling } from './cron.js';

const apiHandlers = {
  '/api/notify': handleNotify,
  '/api/create-payment-link': handleCreatePaymentLink,
  '/api/tranzila-webhook': handleTranzilaWebhook,
  '/api/tranzila-success': handleTranzilaSuccess,
  '/api/tranzila-fail': handleTranzilaFail,
  '/api/cancel-subscription': handleCancelSubscription,
  '/api/cancel-studio': handleCancelStudio,
  '/api/redeem-promo': handleRedeemPromo,
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

    return env.ASSETS.fetch(request);
  },

  // Cloudflare Cron Trigger — see wrangler.jsonc "triggers.crons"
  async scheduled(event, env, ctx) {
    console.log('CRON_TRIGGER', event.cron, new Date().toISOString());
    ctx.waitUntil(
      handleCronBilling(env).catch((e) => console.error('CRON_FATAL', e?.message, e?.stack)),
    );
  },
};
