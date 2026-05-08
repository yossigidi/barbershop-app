import { useEffect, useMemo, useState } from 'react';
import { Plus, Receipt, ChevronRight, ChevronLeft, Edit3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { categoryByKey, categoryBreakdown, sumExpenses } from '../utils/expenses';
import { dateToISO, DAY_LABELS_HE, DAYS_OF_WEEK } from '../utils/slots';
import ExpenseModal from './ExpenseModal.jsx';

function formatHebDate(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dayLabel = DAY_LABELS_HE[DAYS_OF_WEEK[d.getDay()]];
  return `${dayLabel}, ${d.getDate()}/${d.getMonth() + 1}`;
}

// Self-contained "expenses" tab. Live-subscribes to the barber's full
// expenses collection, lets them filter by month, view a category
// breakdown, and add/edit/delete entries via the ExpenseModal.

const HEB_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function ExpensesTab() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(undefined); // undefined=closed, null=add, obj=edit
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'barbers', user.uid, 'expenses'));
    const unsub = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.warn('expenses snapshot error', err.message);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Inclusive ISO range for the selected month
  const monthRange = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0); // last day of month
    return { from: dateToISO(first), to: dateToISO(last) };
  }, [year, month]);

  const monthly = useMemo(() => {
    const list = expenses
      .filter((e) => e.date >= monthRange.from && e.date <= monthRange.to)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const total = sumExpenses(expenses, monthRange.from, monthRange.to);
    const byCategory = categoryBreakdown(expenses, monthRange.from, monthRange.to);
    return { list, total, byCategory };
  }, [expenses, monthRange]);

  function prevMonth() {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }
  function nextMonth() {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  // Group monthly list by date for clean display
  const groupedByDate = useMemo(() => {
    const groups = new Map();
    for (const e of monthly.list) {
      const arr = groups.get(e.date) || [];
      arr.push(e);
      groups.set(e.date, arr);
    }
    return [...groups.entries()];
  }, [monthly.list]);

  return (
    <>
      {/* Month selector + total */}
      <div className="card expense-summary">
        <div className="expense-month-nav">
          <button className="btn-secondary" onClick={nextMonth} aria-label="חודש הבא" style={{ padding: '6px 10px' }}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="expense-month-label">
            {HEB_MONTHS[month]} {year}
            {isCurrentMonth && <span className="expense-month-badge">החודש</span>}
          </div>
          <button className="btn-secondary" onClick={prevMonth} aria-label="חודש קודם" style={{ padding: '6px 10px' }}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="expense-total">
          <div className="expense-total-label">סך הכל הוצאות</div>
          <div className="expense-total-num">₪{monthly.total.toLocaleString('he-IL', { maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Add new expense */}
      <button
        className="btn-gold"
        onClick={() => setEditing(null)}
        style={{ width: '100%', marginBottom: 12 }}
      >
        <Plus size={18} className="icon-inline" />הוצאה חדשה
      </button>

      {/* Category breakdown */}
      {monthly.byCategory.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}><Receipt size={18} className="icon-inline" />לפי קטגוריה</h3>
          {monthly.byCategory.map((c) => {
            const pct = monthly.total > 0 ? (c.total / monthly.total) * 100 : 0;
            return (
              <div key={c.key} className="cat-row">
                <span className="cat-emoji">{c.emoji}</span>
                <div className="cat-info">
                  <div className="cat-line">
                    <span>{c.label}</span>
                    <strong>₪{c.total.toLocaleString('he-IL', { maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="cat-bar">
                    <div className="cat-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="cat-pct">{Math.round(pct)}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Itemised list grouped by date */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>פירוט הוצאות</h3>
        {loading ? (
          <div className="muted text-center" style={{ padding: 20 }}>טוען…</div>
        ) : monthly.list.length === 0 ? (
          <div className="empty">אין הוצאות בחודש זה. לחיצה על "הוצאה חדשה" מתחילה את הרישום.</div>
        ) : (
          groupedByDate.map(([date, items]) => (
            <div key={date} className="exp-group">
              <div className="exp-group-date">{formatHebDate(date)}</div>
              {items.map((e) => {
                const cat = categoryByKey(e.category);
                return (
                  <button
                    type="button"
                    key={e.id}
                    className="exp-row"
                    onClick={() => setEditing(e)}
                  >
                    <span className="exp-emoji">{cat.emoji}</span>
                    <span className="exp-info">
                      <strong>{cat.label}</strong>
                      {e.description && <span className="exp-desc"> · {e.description}</span>}
                    </span>
                    <span className="exp-amount">₪{Number(e.amount).toLocaleString('he-IL', { maximumFractionDigits: 2 })}</span>
                    <Edit3 size={13} className="exp-edit-icon" />
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <ExpenseModal
        open={editing !== undefined}
        expense={editing || null}
        onClose={() => setEditing(undefined)}
      />

      <div className="spacer" />
    </>
  );
}
