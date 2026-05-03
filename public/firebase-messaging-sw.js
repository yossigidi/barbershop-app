// Firebase Cloud Messaging service worker
// SW_VERSION: 2 — bump when changing this file so iOS/Chrome refresh it.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD_e6hue4SQyxfjvKG8lEPtfGc1RJ3WXgY',
  authDomain: 'barbershop-app-2026.firebaseapp.com',
  projectId: 'barbershop-app-2026',
  storageBucket: 'barbershop-app-2026.firebasestorage.app',
  messagingSenderId: '870082875000',
  appId: '1:870082875000:web:54571eb6c69c43b92e278d',
});

const messaging = firebase.messaging();

// Take over open clients on install/update so a fresh SW handles clicks.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'תור חדש!';
  const link = payload.data?.link || payload.fcmOptions?.link || '/dashboard';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { ...payload.data, link },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/dashboard';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // If the app is already open in any window, focus it and navigate
    for (const c of all) {
      try {
        if (c.url.includes(self.location.origin)) {
          await c.focus();
          if ('navigate' in c) await c.navigate(link);
          return;
        }
      } catch {}
    }
    if (self.clients.openWindow) return self.clients.openWindow(link);
  })());
});
