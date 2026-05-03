import { getToken, onMessage } from 'firebase/messaging';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db, getMessagingIfSupported, VAPID_KEY } from '../firebase';

export async function requestPushPermission() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null;
  if (!VAPID_KEY) {
    console.warn('VITE_FIREBASE_VAPID_KEY missing');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;

  // Register the FCM service worker
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg,
  });

  // Foreground message → show as a basic notification
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title || 'תור חדש!';
    const body = payload.notification?.body || '';
    new Notification(title, { body, icon: '/icon-192.png' });
  });

  return token;
}

export async function registerFcmToken(uid, token) {
  await updateDoc(doc(db, 'barbers', uid), {
    fcmTokens: arrayUnion(token),
  });
}
