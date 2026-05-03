// Firebase Cloud Messaging service worker
// IMPORTANT: hardcoded config — kept in sync with .env at build time via the
// inline constants below. If you change .env, also update this file.

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

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'תור חדש!';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/dashboard');
    }),
  );
});
