import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';

function backHref(navigate) {
  return () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
}

// Cancellation & refund policy — Hebrew, fully aligned with the Israeli
// Consumer Protection (Cancellation of Transactions) Regulations 5771-2010
// (תקנות הגנת הצרכן (ביטול עסקה) תשע"א-2010) and Consumer Protection Law
// section 14C. Mandatory cancellation rights are honored explicitly. The
// Studio commitment plan is also covered with its own clearly labelled
// section so customers understand the early-exit fee mechanism.

export default function RefundPage() {
  const navigate = useNavigate();
  return (
    <div className="app legal-page">
      <div className="header">
        <h1><RotateCcw size={20} className="icon-inline" />מדיניות ביטולים והחזרים</h1>
        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={backHref(navigate)}>
          <ArrowLeft size={14} className="icon-inline" />חזור
        </button>
      </div>

      <div className="card legal-content">
        <p className="muted" style={{ margin: 0 }}>תאריך עדכון אחרון: 5 במאי 2026</p>

        <section>
          <h2>1. תקופת התנסות חינם</h2>
          <p>
            כל משתמש חדש מקבל אוטומטית <strong>30 ימי התנסות חינם</strong> במסלול Pro.
            במהלך תקופת ההתנסות לא ייגבה תשלום. ביטול לפני תום התקופה אינו כרוך בכל עלות.
            אם לא תבחר/י מסלול עד תום ההתנסות, החשבון יינעל אוטומטית — לא יבוצע חיוב ללא הסכמה.
          </p>
        </section>

        <section>
          <h2>2. זכות הביטול לפי החוק (Cooling-off)</h2>
          <p>
            בהתאם לסעיף 14ג ל<strong>חוק הגנת הצרכן, תשמ"א-1981</strong> ולתקנות
            <strong> הגנת הצרכן (ביטול עסקה) תשע"א-2010</strong>, רשאי/ת לבטל את העסקה:
          </p>
          <ul>
            <li>עד <strong>14 ימים</strong> מיום ביצוע העסקה (במנוי שאינו לתקופה קצובה — מיום החיוב).</li>
            <li>אדם עם מוגבלות, אזרח ותיק (65+) או עולה חדש — עד <strong>4 חודשים</strong> מהעסקה,
              בכפוף לכך שהעסקה כללה שיחה עמך (כולל תקשורת אלקטרונית).</li>
            <li>הביטול ייעשה בהודעה למייל <a href="mailto:support@toron.co.il">support@toron.co.il</a>,
              דרך טופס יצירת קשר באפליקציה, או בכל אמצעי תיעוד אחר.</li>
            <li>ההחזר יבוצע תוך <strong>14 ימים</strong> מקבלת הודעת הביטול,
              באותו אמצעי תשלום בו שולמה העסקה.</li>
          </ul>
          <p>
            <strong>חשוב להבהיר:</strong> הסעיף הזה מתייחס לעסקה בלבד —
            במסלול <strong>Pro חודשי</strong> (תוכנה בלבד, ללא ציוד פיזי) ביטול cooling-off
            מבוצע בלחיצה ולא דורש החזרת ציוד.
            במסלול <strong>Studio</strong>, שכולל ציוד פיזי (טאבלט),
            תקנות הביטול לטובין מרחוק חלות בנוסף — ראה סעיף 4 להלן.
          </p>
          <p>
            דמי ביטול — בהתאם לחוק, ניתן לגבות דמי ביטול בשיעור של <strong>5%</strong> מערך העסקה
            או <strong>100 ש"ח</strong>, לפי הנמוך מביניהם, ובלבד שהביטול לא נעשה בשל פגם או
            הטעיה. במסלול Pro חודשי Toron מוותרת על דמי הביטול אלה. במסלול Studio
            (כולל ציוד) חלים דמי יציאה ייחודיים בנוסף — ראה סעיף 4.
          </p>
        </section>

        <section>
          <h2>3. מסלול Pro חודשי — ביטול בכל עת</h2>
          <ul>
            <li>המסלול הוא חיוב חודשי מתחדש (50 ש"ח לחודש), ללא תקופת התחייבות.</li>
            <li>ניתן לבטל בכל עת מההגדרות באפליקציה או בפנייה לתמיכה.</li>
            <li>הביטול ייכנס לתוקף בתום החודש ששולם — <strong>לא נחזיר חיוב חלקי</strong> על חודש
              שכבר התחיל, אלא אם יש לך זכות החזר תקופת cooling-off (סעיף 2).</li>
            <li>החשבון, הנתונים והתורים יישארו זמינים עד תום החודש המשולם.</li>
          </ul>
        </section>

        <section>
          <h2>4. מסלול Studio — התחייבות 24 חודשים + טאבלט</h2>
          <p>
            מסלול Studio כולל ציוד פיזי (טאבלט) במחיר מסובסד דרך פריסת תשלומים.
            ביטול מוקדם של המסלול כפוף ל<strong>דמי יציאה</strong> אשר נועדו לכסות את עלות
            הציוד ועלות פריסת התשלומים.
          </p>
          <ul>
            <li>דמי היציאה: <strong>30 ש"ח לכל חודש שנותר עד תום ההתחייבות</strong>.</li>
            <li>דמי היציאה מוצגים באפליקציה לפני אישור הביטול — שקיפות מלאה.</li>
            <li>במידה ובוטל בתוך 14 ימים מהעסקה (cooling-off) — לא ייגבו דמי יציאה,
              אך הטאבלט יוחזר במצב מקורי, על חשבון הלקוח, או ייגבה מחירו המלא.</li>
            <li>במקרה של פגם בציוד או חוסר התאמה לתיאור — אין דמי יציאה (זכות מלאה לבטל).</li>
            <li><strong>קודי הנחה אינם תקפים על מסלול Studio.</strong></li>
          </ul>
        </section>

        <section>
          <h2>5. החזר עקב תקלה או חוסר זמינות</h2>
          <p>
            במקרה של תקלה משמעותית מצדנו (downtime ממושך, איבוד נתונים שאינו ניתן לשיחזור),
            או אם השירות שונה מהותית באופן הפוגע בתוחלת השימוש — תהיה זכאי/ת להחזר יחסי
            או לפיצוי הוגן בהתאם להוראות החוק. פנה אלינו ב-<a href="mailto:support@toron.co.il">support@toron.co.il</a>.
          </p>
        </section>

        <section>
          <h2>6. החזר אינו אפשרי במקרים הבאים</h2>
          <ul>
            <li>חודש שכבר חויב לאחר תום ה-cooling-off והשירות סופק כסדרו.</li>
            <li>נזק כספי שטוען המשתמש בעקיפין (אובדן רווחים, וכו') — תקרת הפיצוי
              מוגבלת לסכום ששילמת ב-12 החודשים שקדמו לאירוע (ראה תקנון השירות).</li>
            <li>שימוש בניגוד לתקנון (זיוף, פגיעה במערכת, ניצול לרעה).</li>
          </ul>
        </section>

        <section>
          <h2>7. מימוש הביטול</h2>
          <p>אופן הביטול:</p>
          <ol>
            <li><strong>באפליקציה</strong> — בדף "מסלול וחיוב" → "ביטול מנוי".</li>
            <li><strong>במייל</strong> — <a href="mailto:support@toron.co.il" dir="ltr">support@toron.co.il</a>
              עם הפרטים: שם, אימייל, סוג מסלול וסיבת הביטול (לא חובה).</li>
            <li><strong>בטלפון</strong> — <a href="tel:+972532702270" dir="ltr">053-270-2270</a> בימים א'-ה' 09:00-17:00.</li>
          </ol>
          <p>
            נשלח לך אישור ביטול בכתב תוך <strong>14 ימי עסקים</strong>. ההחזר הכספי
            (אם רלוונטי) יבוצע באותה דרך בה שולמה העסקה תוך <strong>14 ימים</strong>
            מאישור הביטול, בהתאם לחוק.
          </p>
        </section>

        <section>
          <h2>8. יצירת קשר</h2>
          <p>
            <strong>Toron — ניהול תורים</strong><br />
            תמיכה: <a href="mailto:support@toron.co.il">support@toron.co.il</a><br />
            ביטול והחזרים: <a href="mailto:cancel@toron.co.il">cancel@toron.co.il</a>
          </p>
          <p className="muted">
            במקרה של מחלוקת — בית הדין לתביעות קטנות הוא הערכאה המתאימה לרוב הסכסוכים
            הצרכניים, בכפוף לתקרת תביעה של 39,900 ש"ח.
          </p>
        </section>
      </div>
    </div>
  );
}
