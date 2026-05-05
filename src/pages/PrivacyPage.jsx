import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

// Privacy policy — Hebrew, aligned with Israeli Privacy Protection Law
// (חוק הגנת הפרטיות, תשמ"א-1981) and accepted GDPR-equivalent practice.
// IMPORTANT: this is a draft prepared with care; the operator should still
// have a privacy lawyer review before scaling. Mandatory rights (access,
// correction, deletion, withdrawal of consent) are honored throughout.

export default function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div className="app legal-page">
      <div className="header">
        <h1><ShieldCheck size={20} className="icon-inline" />מדיניות פרטיות</h1>
        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} className="icon-inline" />חזור
        </button>
      </div>

      <div className="card legal-content">
        <p className="muted" style={{ margin: 0 }}>תאריך עדכון אחרון: 5 במאי 2026</p>

        <section>
          <h2>1. מי אנחנו</h2>
          <p>
            Toron ("<strong>השירות</strong>", "<strong>אנחנו</strong>") היא מערכת ניהול
            תורים מקוונת לבעלי מקצוע (ספרים, מניקור, פדיקור, קוסמטיקה ועוד).
            מסמך זה מתאר אילו פרטים אנחנו אוספים, מדוע, ואיך אנחנו מגנים עליהם.
          </p>
          <p>
            כתובת ליצירת קשר בעניין פרטיות: <a href="mailto:privacy@toron.co.il">privacy@toron.co.il</a>.
            מדיניות זו פועלת בכפיפות ל<strong>חוק הגנת הפרטיות, תשמ"א-1981</strong> ולתקנות שמכוחו.
          </p>
        </section>

        <section>
          <h2>2. אילו פרטים אנחנו אוספים</h2>
          <p>אנחנו אוספים מידע בשלושה אופנים:</p>
          <h3>2.1 מידע שאת/ה מספק/ת בעצמך (בעלי מקצוע)</h3>
          <ul>
            <li>שם מלא, כתובת מייל וסיסמה (או חיבור Google)</li>
            <li>שם העסק, סוג השירות, לוגו ושעות פעילות</li>
            <li>פרטי שירות, מחירים ולוח זמנים</li>
            <li>פרטי אמצעי תשלום (מאוחסנים אצל ספק הסליקה Tranzila — <strong>לא אצלנו</strong>)</li>
          </ul>
          <h3>2.2 מידע על לקוחות הקצה (מי שמזמין/ה תור דרך לינק שלך)</h3>
          <ul>
            <li>שם פרטי ושם משפחה, מספר טלפון, כתובת מייל אופציונלית</li>
            <li>פרטי תור: תאריך, שעה, שירות שנבחר, מחיר</li>
            <li>היסטוריית תורים אצל אותו בעל מקצוע</li>
          </ul>
          <p className="muted">
            המידע על לקוחות הקצה נאסף עבור בעל המקצוע, והוא הבעלים שלו (Data Controller).
            Toron משמשת מעבדת מידע (Data Processor) בלבד עבור בעל המקצוע.
          </p>
          <h3>2.3 מידע טכני שנאסף אוטומטית</h3>
          <ul>
            <li>סוג מכשיר, דפדפן ומערכת הפעלה</li>
            <li>כתובת IP מצומצמת לצורכי אבטחה ומניעת הונאה</li>
            <li>קובצי Cookie פונקציונליים בלבד (התחברות, העדפות) — אין מעקב פרסומי</li>
          </ul>
        </section>

        <section>
          <h2>3. למה אנחנו משתמשים בפרטים שלך</h2>
          <ul>
            <li><strong>אספקת השירות</strong> — שמירת חשבונך, יומן תורים, שליחת אישורים והתראות.</li>
            <li><strong>תקשורת</strong> — אישור הזמנת תור, תזכורות, הודעות שירות חיוניות.</li>
            <li><strong>חיוב ומסים</strong> — באמצעות Tranzila, להפקת חשבונית ולחיוב מנוי.</li>
            <li><strong>שיפור המוצר</strong> — נתונים מצרפיים אנונימיים בלבד (לא מזהים אישית).</li>
            <li><strong>אבטחה ומניעת הונאה</strong> — זיהוי גישה חריגה.</li>
            <li><strong>חובות חוקיות</strong> — שמירה לפי חוק (למשל ניהול ספרים, חוק התיישנות).</li>
          </ul>
          <p>
            אנחנו <strong>לא</strong> מוכרים פרטים אישיים לצדדים שלישיים, ולא משתמשים בהם
            למטרות פרסום ממוקד (retargeting / behavioural advertising).
          </p>
        </section>

        <section>
          <h2>4. עם מי אנחנו חולקים פרטים</h2>
          <p>אנחנו חולקים מידע רק עם נותני שירות הכרחיים:</p>
          <ul>
            <li><strong>Firebase / Google Cloud</strong> — אחסון ואותנטיקציה (תקני SOC 2 / ISO 27001).</li>
            <li><strong>Cloudflare</strong> — שירותי CDN, DNS ואבטחה.</li>
            <li><strong>Tranzila</strong> — סליקת אשראי (PCI-DSS Level 1) ושמירת אסימוני תשלום.</li>
            <li><strong>Brevo</strong> — שליחת מיילי אישור תור. ההסכם איתם אוסר שימוש שיווקי.</li>
            <li><strong>Groq</strong> — עיבוד הודעות AI. הקלט אינו משמש לאימון מודלים לפי תנאיהם.</li>
            <li><strong>רשויות מוסמכות</strong> — אם נחויב על פי דין (צו בית משפט, רשות מס).</li>
          </ul>
          <p className="muted">
            כל ספקי המשנה כפופים להסכמי סודיות (DPA) ומאוחסנים בענן (חלק בארה"ב/אירופה).
          </p>
        </section>

        <section>
          <h2>5. שמירת מידע ומחיקה</h2>
          <ul>
            <li>חשבון פעיל — שמירת מלוא המידע כל עוד החשבון פעיל.</li>
            <li>חשבון שבוטל — מחיקה תוך 90 ימים, למעט מסמכי חיוב הנדרשים שמירה לפי חוק (7 שנים — חוק מס הכנסה).</li>
            <li>תורים שבוטלו / לקוחות שלא חזרו — נשמרים כל זמן שהחשבון פעיל לטובת ניתוח עסקי של בעל המקצוע.</li>
            <li>גיבויים מוצפנים — נשמרים עד 30 יום ואז נמחקים אוטומטית.</li>
          </ul>
        </section>

        <section>
          <h2>6. הזכויות שלך</h2>
          <p>בהתאם לחוק הגנת הפרטיות, יש לך זכות:</p>
          <ul>
            <li><strong>עיון</strong> — לבקש לראות את כל המידע שיש עליך אצלנו.</li>
            <li><strong>תיקון</strong> — לעדכן או לתקן פרטים שגויים.</li>
            <li><strong>מחיקה</strong> — לבקש מחיקת חשבונך והמידע האישי שלך (כפוף לחובות שמירה לפי חוק).</li>
            <li><strong>ניידות</strong> — לקבל את המידע שלך בקובץ קריא (JSON / CSV).</li>
            <li><strong>חזרה מהסכמה</strong> — לבטל הסכמה לדיוור, התראות או כל עיבוד מבוסס הסכמה.</li>
            <li><strong>תלונה</strong> — לפנות לרשם מאגרי המידע ברשות להגנת הפרטיות במשרד המשפטים.</li>
          </ul>
          <p>
            לפנייה במימוש זכויות: <a href="mailto:privacy@toron.co.il">privacy@toron.co.il</a>.
            אנו נשיב תוך 30 ימים. אין עלות.
          </p>
        </section>

        <section>
          <h2>7. אבטחת מידע</h2>
          <ul>
            <li>הצפנה בתעבורה (HTTPS / TLS 1.3) בכל התקשורת.</li>
            <li>הצפנה במנוחה (encrypted at rest) בכל בסיסי הנתונים והגיבויים.</li>
            <li>גישה חכמה (least-privilege) — כל עובד ניגש רק למה שהוא מוכרח.</li>
            <li>סיסמאות מאוחסנות עם hashing חזק (לא בטקסט גלוי).</li>
            <li>פיקוח אבטחה רציף, ניטור גישות חריגות ועדכוני אבטחה תקופתיים.</li>
          </ul>
          <p>
            למרות מאמצינו, אף מערכת אינה חסינה לחלוטין. במקרה של אירוע אבטחה משמעותי
            ניידע אותך תוך 72 שעות בהתאם להנחיות הרשות להגנת הפרטיות.
          </p>
        </section>

        <section>
          <h2>8. ילדים</h2>
          <p>
            השירות מיועד לבעלי עסקים מגיל 18 ומעלה. איננו אוספים ביודעין פרטים
            של ילדים מתחת לגיל 18. אם זיהית ילד שנרשם, אנא צור איתנו קשר ונמחק מיד.
          </p>
        </section>

        <section>
          <h2>9. העברת מידע מחוץ לישראל</h2>
          <p>
            חלק משירותי הענן שלנו מאוחסנים בארה"ב ובאירופה (Firebase, Cloudflare, Brevo).
            כל הספקים מחויבים לרמת הגנה ההולמת את חוק הגנת הפרטיות הישראלי, או חתומים
            על תניות המגן הסטנדרטיות (SCC). לא נעשה שימוש בנתונים אישיים ע"י הספקים
            לצרכים מסחריים שלהם.
          </p>
        </section>

        <section>
          <h2>10. עדכונים למדיניות זו</h2>
          <p>
            אנחנו רשאים לעדכן מדיניות זו מעת לעת. שינוי מהותי יוצג בהודעה בולטת
            באפליקציה ובמייל לפחות 14 יום לפני תחולתו. המשך שימוש לאחר העדכון
            מהווה הסכמה לנוסח החדש.
          </p>
        </section>

        <section>
          <h2>11. יצירת קשר</h2>
          <p>
            <strong>Toron — ניהול תורים</strong><br />
            מייל פרטיות: <a href="mailto:privacy@toron.co.il">privacy@toron.co.il</a><br />
            תמיכה כללית: <a href="mailto:support@toron.co.il">support@toron.co.il</a>
          </p>
        </section>
      </div>
    </div>
  );
}
