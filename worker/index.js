// Cloudflare Worker entrypoint.
// Routes:
//   POST /api/notify  → FCM push notification
//   anything else     → static assets (Vite build in ./dist), with SPA fallback

import { handleNotify } from './notify.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/notify') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }
      try {
        return await handleNotify(request, env);
      } catch (e) {
        return new Response('Internal: ' + e.message, { status: 500 });
      }
    }

    // Fall through to static assets binding (configured in wrangler.jsonc)
    return env.ASSETS.fetch(request);
  },
};
