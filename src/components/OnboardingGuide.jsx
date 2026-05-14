import { useState } from 'react';
import {
  Sparkles, Calendar, CalendarPlus, MoveHorizontal, Share2, Users,
  MessageCircle, Settings, ChevronRight, ChevronLeft,
} from 'lucide-react';

// First-run walkthrough — a short RTL carousel that explains how Toron
// works. Shown once per barber (tracked by barbers/<uid>.onboardingSeen),
// re-openable from Settings. The component is purely presentational; the
// trigger + the Firestore flag live in DashboardPage.

const STEPS = [
  {
    Icon: Sparkles,
    title: 'ברוכים הבאים ל-Toron',
    body: 'המערכת שתנהל לך את כל התורים, הלקוחות וההכנסות במקום אחד. בכמה צעדים קצרים נראה לך איך הכל עובד.',
  },
  {
    Icon: Calendar,
    title: 'היומן שלך',
    body: 'המסך הראשי הוא היומן — כל התורים של היום מסודרים לפי שעה. מחליפים יום עם החיצים שלמעלה, ולוחצים על תור כדי לראות פרטים ולערוך.',
  },
  {
    Icon: CalendarPlus,
    title: 'קביעת תור חדש',
    body: 'לוחצים על "+ תור חדש", או ישירות על שעה פנויה ביומן. ממלאים שם, טלפון ושירות — והתור נכנס ליומן.',
  },
  {
    Icon: MoveHorizontal,
    title: 'התחלה וסיום תור',
    body: 'מחליקים תור ימינה כדי להתחיל אותו, ושמאלה כדי לסיים. ככה היומן תמיד משקף בדיוק איפה אתם עומדים במהלך היום.',
  },
  {
    Icon: Share2,
    title: 'הלינק שלך ללקוחות',
    body: 'יש לך לינק אישי לקביעת תורים. שלח אותו ללקוחות בוואטסאפ — והם קובעים תור לבד, בלי שיחות טלפון. הלינק נמצא בלשונית "הודעות".',
  },
  {
    Icon: Users,
    title: 'כרטיסיית לקוחות',
    body: 'בלשונית "לקוחות" יש לכל לקוח כרטיס — היסטוריית תורים, כמה הוציא, מתי היה לאחרונה, כרטיסיית נאמנות ותמונות לפני/אחרי.',
  },
  {
    Icon: MessageCircle,
    title: 'הודעות אוטומטיות בוואטסאפ',
    body: 'אפשר להפעיל תזכורת אוטומטית ללקוח לפני כל תור, והודעת תודה עם בקשת דירוג בגוגל אחרי. מגדירים פעם אחת בהגדרות — והמערכת שולחת לבד.',
  },
  {
    Icon: Settings,
    title: 'הצעד הראשון שלך',
    body: 'כנס/י להגדרות והשלם/י את פרטי העסק — שעות עבודה, שירותים ומחירים. שם גם מפעילים את ההודעות האוטומטיות. אחרי זה אתם מוכנים לעבוד!',
  },
];

export default function OnboardingGuide({ onClose, onGoToSettings }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;
  const { Icon } = step;

  return (
    <div className="modal-backdrop og-backdrop" role="presentation">
      <div className="og-card" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="og-title">
        <button type="button" className="og-skip" onClick={onClose}>דלג</button>

        <div className="og-icon"><Icon size={40} strokeWidth={1.6} /></div>
        <h2 id="og-title" className="og-title">{step.title}</h2>
        <p className="og-body">{step.body}</p>

        <div className="og-dots" aria-hidden="true">
          {STEPS.map((_, idx) => (
            <span
              key={idx}
              className={`og-dot ${idx === i ? 'active' : ''} ${idx < i ? 'done' : ''}`}
            />
          ))}
        </div>

        <div className="og-nav">
          {i > 0 ? (
            <button type="button" className="btn-secondary" onClick={() => setI(i - 1)}>
              <ChevronRight size={18} className="icon-inline" />הקודם
            </button>
          ) : <span className="og-nav-spacer" />}
          {isLast ? (
            <button type="button" className="btn-gold" onClick={onGoToSettings}>
              <Settings size={18} className="icon-inline" />להגדרות
            </button>
          ) : (
            <button type="button" className="btn-gold" onClick={() => setI(i + 1)}>
              הבא<ChevronLeft size={18} className="icon-inline" />
            </button>
          )}
        </div>

        {isLast && (
          <button type="button" className="og-later" onClick={onClose}>
            אעשה את זה אחר כך — סגור
          </button>
        )}
      </div>
    </div>
  );
}
