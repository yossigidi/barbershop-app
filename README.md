# Barbershop — מערכת ניהול תורים לספרים

מערכת רב-ספרים: כל ספר נרשם, מקבל לינק קצר, ושולח אותו ללקוחות.
לקוחות מזמינים תור (30 דקות) דרך הלינק. הספר מקבל פוש בכל הזמנה.

## Stack
- React 19 + Vite 7
- Firebase (Auth, Firestore, FCM) — project `barbershop-app-2026`
- Cloudflare Pages (hosting + Pages Functions ל-`/api/notify`)

## Local dev

```bash
npm install
cp .env.example .env   # מלא את הפרטים מ-Firebase Console
npm run dev
```

## Deploy

`git push` → Cloudflare Pages בונה ו-deploy אוטומטית.

## Firebase setup (פעם אחת בקונסולה)

1. **Firestore** — Firebase Console → Build → Firestore → Create database → Production mode → אזור eur3.
2. **Authentication** — Build → Authentication → Sign-in method → הפעל Google.
3. **Cloud Messaging — VAPID key**:
   - Project settings → Cloud Messaging → Web Push certificates → Generate key pair.
   - העתק את ה-key למשתנה `VITE_FIREBASE_VAPID_KEY` ב-`.env` ובמשתני סביבה של Cloudflare Pages.
4. **Service account** (לפוש מצד שרת):
   - Project settings → Service accounts → Generate new private key.
   - הדבק את כל ה-JSON כמשתנה סביבה `FIREBASE_SERVICE_ACCOUNT_JSON` ב-Cloudflare Pages.

### Deploy Firestore rules

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Cloudflare Pages — חיבור חד-פעמי

1. Pages → Create project → Connect to Git → `yossigidi/barbershop-app`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Environment variables: כל ה-`VITE_FIREBASE_*` + `FIREBASE_SERVICE_ACCOUNT_JSON`

## מודל נתונים

```
barbers/{uid}              שם עסק, shortCode, workingHours, fcmTokens
  /clients/{phone}         לקוחות (firstName, lastName, phone)
  /bookings/{id}           תורים (date YYYY-MM-DD, time HH:MM, status)
shortCodes/{code}          { uid }
```

## דגשי iOS

פוש ל-Web ב-iOS עובד **רק כש-PWA מותקן ב-Home Screen**:
Safari → כפתור שיתוף → "הוסף למסך הבית" → פתח מהאייקון. אז ניתן להפעיל התראות בדשבורד.
