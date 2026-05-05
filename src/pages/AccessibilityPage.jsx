import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Accessibility } from 'lucide-react';

// Israeli Equal Rights of People with Disabilities Law (1998) requires every
// public-facing web service to publish an accessibility statement that:
//   - identifies the operator
//   - states the WCAG conformance level achieved
//   - lists the steps taken
//   - provides a contact for accessibility issues
//   - shows the last review date

export default function AccessibilityPage() {
  const navigate = useNavigate();
  return (
    <div className="app legal-page">
      <div className="header">
        <h1><Accessibility size={20} className="icon-inline" />הצהרת נגישות</h1>
        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} className="icon-inline" />חזור
        </button>
      </div>

      <div className="card legal-content">
        <p className="muted" style={{ margin: 0 }}>תאריך עדכון אחרון: 5 במאי 2026</p>

        <section>
          <h2>מחויבותנו לנגישות</h2>
          <p>
            אנו רואים בנגישות ערך עליון ופועלים להפיכת השירות לנגיש עבור
            כלל המשתמשים, כולל אנשים עם מוגבלויות, בהתאם להוראות חוק
            שוויון זכויות לאנשים עם מוגבלות (התשנ"ח-1998) ותקנותיו.
          </p>
        </section>

        <section>
          <h2>רמת תאימות</h2>
          <p>
            השירות מותאם לתקן הישראלי <strong>ת"י 5568:2020</strong> ולקווים
            המנחים <strong>WCAG 2.1 ברמה AA</strong>, בהתאם לתקנות שוויון זכויות
            לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013.
            ההתאמה מתבצעת בעמודי הניהול ובדפי ההזמנה הציבוריים כאחד.
          </p>
        </section>

        <section>
          <h2>פעולות הנגשה שננקטו</h2>
          <ul>
            <li>תאימות מלאה לקוראי מסך (NVDA / VoiceOver / TalkBack)</li>
            <li>ניווט מלא במקלדת — כל פעולה זמינה ללא עכבר</li>
            <li>חיווי focus ויזואלי על כל אלמנט אינטראקטיבי (טבעת זהב 2px)</li>
            <li>ניגודיות צבעים מינימלית של 4.5:1 לטקסט רגיל ו-3:1 לטקסט גדול</li>
            <li>תוויות ARIA על כל אייקון-בלבד-כפתור</li>
            <li>אלמנטים סמנטיים תקניים (HTML5)</li>
            <li>תמיכה ב-<code dir="ltr">prefers-reduced-motion</code> — כיבוי אנימציות למשתמשים שביקשו זאת בהגדרות מערכת</li>
            <li>טקסט חלופי לכל תמונה משמעותית</li>
            <li>גודל גופן ניתן להגדלה עד 200% ללא איבוד תוכן או פונקציונליות</li>
            <li>תמיכה ב-RTL מלאה</li>
            <li>שפה עברית מצוינת ב-<code dir="ltr">html lang="he"</code></li>
            <li>טפסים עם תוויות ברורות ויחס label–input תקני</li>
          </ul>
        </section>

        <section>
          <h2>מגבלות ידועות</h2>
          <p>
            למרות מאמצינו, ייתכנו רכיבים אשר עדיין לא הותאמו במלואם, או
            תכנים מצד שלישי (סולק תשלומים, רכיבי וואטסאפ) שאינם תחת שליטתנו.
            במקרה שנתקלת בקושי בנגישות — אנא פנה אלינו לקבלת סיוע.
          </p>
        </section>

        <section>
          <h2>פניות בנושא נגישות</h2>
          <p>
            אם נתקלת בקושי בשימוש בשירות, או יש לך הצעה לשיפור הנגישות,
            ניתן לפנות אל רכז הנגישות:
          </p>
          <ul>
            <li><strong>רכז/ת נגישות:</strong> Toron — צוות התמיכה</li>
            <li><strong>אימייל:</strong> <a href="mailto:accessibility@toron.co.il">accessibility@toron.co.il</a></li>
            <li><strong>זמן תגובה:</strong> עד 14 ימי עסקים</li>
            <li><strong>שעות מענה:</strong> ימים א'–ה', 09:00–17:00</li>
          </ul>
        </section>

        <section>
          <h2>התאמות נוספות</h2>
          <p>
            אנו מבצעים סקירת נגישות תקופתית ומעדכנים את הצהרה זו בהתאם.
            ככל שיתגלו פערים, נפעל לתיקונם בתוך פרק זמן סביר.
          </p>
        </section>
      </div>
    </div>
  );
}
