# Facebook auto-posting — setup

3 פוסטים בשבוע אוטומטית לדף הפייסבוק של Toron (יום א׳ / ג׳ / ה׳ ב-10:00-11:00 בבוקר ישראל).

## למה צריך

- **`FB_PAGE_ID`** — המספר הייחודי של דף הפייסבוק (לא ה-username).
- **`FB_PAGE_ACCESS_TOKEN`** — Page Access Token עם הרשאת `pages_manage_posts`, רצוי "never-expires" (נגזר מ-user token ארוך-טווח של אדמין).
- **`ADMIN_KEY`** — מחרוזת אקראית כדי לאבטח את endpoint הבדיקה הידני (`/api/admin/fb-post-now`).

## שלב 1: למצוא את ה-Page ID

1. כנס/י לדף שלך בפייסבוק
2. גלול/י למטה ל-**About → Page transparency** (או דף → ההגדרות → "מידע על הדף")
3. ה-**Page ID** מופיע כמספר ארוך (לא ה-username של הדף, מספר טהור)

## שלב 2: ליצור Page Access Token שלא פג

זה החלק המסובך — Facebook הופך user tokens ל-Page tokens, אבל ברירת המחדל היא token של שעה. צריך לעבור 3 שלבים כדי לקבל אחד שלא פג.

### 2a. השג user token זמני
1. https://developers.facebook.com/tools/explorer/
2. בחר את האפליקציה שלך — `Toron` (App ID: 4006951739436636)
3. **Permissions** → הוסף: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`
4. לחץ **Generate Access Token**, אשר/י את ההרשאות
5. **העתק/י את ה-token** — זה user token זמני (פג בעוד שעה)

### 2b. החלף אותו ל-user token ארוך-טווח (60 ימים)

קח/י את `APP_ID` ו-`APP_SECRET` שלך מ:
https://developers.facebook.com/apps/4006951739436636/settings/basic/

ואז בטרמינל:

```bash
curl -G "https://graph.facebook.com/v21.0/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=4006951739436636" \
  --data-urlencode "client_secret=YOUR_APP_SECRET" \
  --data-urlencode "fb_exchange_token=SHORT_LIVED_USER_TOKEN_FROM_2A"
```

מקבל/ת `access_token` חדש (long-lived user token, ~60 ימים).

### 2c. שלוף Page Access Token שלא פג

עם ה-long-lived user token, קרא ל:

```bash
curl -G "https://graph.facebook.com/v21.0/me/accounts" \
  --data-urlencode "access_token=LONG_LIVED_USER_TOKEN_FROM_2B"
```

תקבל/י רשימת דפים, כל אחד עם `id` ו-`access_token`. ה-`access_token` של הדף שלך הוא **Page Access Token שלא פג** (page tokens שמקורם ב-long-lived user token עם הרשאות אדמין הם לעולם לא יפוגו, כל עוד הסיסמה / 2FA של המשתמש לא משתנים).

**שמור/י** את ה-`id` (Page ID) ואת ה-`access_token` (Page Token).

### 2d. ודא שהוא באמת לא יפוג

```bash
curl -G "https://graph.facebook.com/v21.0/debug_token" \
  --data-urlencode "input_token=PAGE_TOKEN" \
  --data-urlencode "access_token=APP_ID|APP_SECRET"
```

`"expires_at": 0` במענה = לא פג ✓.
אם זה לא 0 — חזור על שלב 2b עם user token טרי וודא שיש לו הרשאת `pages_manage_posts`.

## שלב 3: שמור את הסודות ב-Cloudflare

מהתיקייה של הפרויקט:

```bash
npx wrangler secret put FB_PAGE_ID
# הדבק את ה-Page ID

npx wrangler secret put FB_PAGE_ACCESS_TOKEN
# הדבק את ה-Page Access Token

npx wrangler secret put ADMIN_KEY
# מחרוזת אקראית באורך 32+ תווים — שמור גם אצלך
```

(`ADMIN_KEY` מאבטח את endpoint הבדיקה. ייתכן שכבר הגדרת אותו עבור שירותים אחרים — אז דלג/י.)

## שלב 4: בדיקה ידנית

לפני שמחכים ל-cron — תוודא שזה עובד:

```bash
curl -X POST https://toron.co.il/api/admin/fb-post-now \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"בדיקה — אם זה עולה לדף, ההגדרה תקינה. אפשר למחוק."}'
```

תקבל בחזרה `{ ok: true, id: "..." }` והפוסט אמור להופיע בדף. אחרי שזה מאומת — תמחק את הפוסט-הבדיקה ידנית מהדף.

## שלב 5: לוח הזמנים

הקרון מוגדר ב-`wrangler.jsonc`:

| Cron | מתי | מה |
|------|-----|-----|
| `0 6 * * *` | יומי 06:00 UTC | Tranzila billing (ישן) |
| `0 8 * * 0,2,4` | א׳ / ג׳ / ה׳ 08:00 UTC | Facebook post |

08:00 UTC = 10:00 IL בחורף, 11:00 IL בקיץ (DST). 3 פוסטים בשבוע = קצב בריא, פייסבוק לא מענישה.

## מה מתפרסם

10 פוסטים שונים בעברית, רוטציה לפי `dayOfYear % 10`. כל אחד עם:
- כותרת תופסת
- 2-4 שורות עיקרים
- לינק ל-`https://toron.co.il/promo`

לערוך/להוסיף — `worker/fb-cron.js`, `POSTS` array.

## איך לעקוב שזה רץ

- **Cloudflare Workers → Logs** — חפש "FB_POSTED" (הצלחה) או "FB_POST_FAIL" (כשל)
- **Firestore → `fbPosts/{YYYY-MM-DD}`** — לוג audit של כל הרצה
- **Facebook → Toron Page** — הפוסט עצמו 😊

## אם משהו נשבר

- **"expired access token"** — ה-Page Token עוד פגה (לא הצלחנו ליצור never-expires). חזור על שלב 2.
- **"requires pages_manage_posts permission"** — חסרה הרשאה. חזור על 2a עם ההרשאה.
- **"missing-secrets"** ב-logs — הסודות לא נטענו. בדוק עם `npx wrangler secret list`.
- **הפוסט עלה אבל בלי preview/תמונה** — ייתכן ש-Open Graph של `/promo` חסר תמונה. אפשר להוסיף `<meta property="og:image">` ל-`index.html`.
