import { useState, useEffect } from 'react';
import { Trash2, Save, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { EXPENSE_CATEGORIES } from '../utils/expenses';
import { dateToISO } from '../utils/slots';

// Add/edit a single expense. Pass `expense` to edit, or null/undefined to add.
export default function ExpenseModal({ open, onClose, expense }) {
  const { user } = useAuth();
  const editing = !!expense?.id;

  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('supplies');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDate(expense.date || dateToISO(new Date()));
      setAmount(String(expense.amount ?? ''));
      setCategory(expense.category || 'other');
      setDescription(expense.description || '');
    } else {
      setDate(dateToISO(new Date()));
      setAmount('');
      setCategory('supplies');
      setDescription('');
    }
    setError('');
  }, [open, editing, expense]);

  if (!open) return null;

  async function save() {
    setError('');
    const amt = Number(amount);
    if (!date || !amt || amt <= 0) {
      setError('אנא הזן/י תאריך וסכום תקין');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        date,
        amount: amt,
        category,
        description: description.trim(),
      };
      if (editing) {
        await updateDoc(
          doc(db, 'barbers', user.uid, 'expenses', expense.id),
          payload,
        );
      } else {
        await addDoc(
          collection(db, 'barbers', user.uid, 'expenses'),
          { ...payload, createdAt: serverTimestamp() },
        );
      }
      onClose();
    } catch (e) {
      setError(e.message || 'שגיאה בשמירה');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirm('למחוק את ההוצאה הזו?')) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'barbers', user.uid, 'expenses', expense.id));
      onClose();
    } catch (e) {
      setError(e.message || 'שגיאה במחיקה');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2>{editing ? 'עריכת הוצאה' : 'הוצאה חדשה'}</h2>

        <div className="field">
          <label>סכום (₪)</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus={!editing}
            style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center' }}
          />
        </div>

        <div className="field">
          <label>קטגוריה</label>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {EXPENSE_CATEGORIES.map((c) => {
              const on = category === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className={on ? 'btn-primary' : 'btn-secondary'}
                  style={{ flex: '1 0 calc(33% - 4px)', padding: '8px 4px', fontSize: '0.78rem', flexDirection: 'column', gap: 2 }}
                >
                  <span style={{ fontSize: '1.15rem' }}>{c.emoji}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label>תאריך</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label>תיאור (אופציונלי)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="לדוגמה: שמפו לבר אסראל, חידוש ביטוח עסק…"
            maxLength={120}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '0.88rem', margin: '6px 0 10px' }}>{error}</p>
        )}

        <div className="row" style={{ gap: 8 }}>
          {editing && (
            <button className="btn-danger" onClick={remove} disabled={busy} style={{ flex: 1 }}>
              <Trash2 size={16} className="icon-inline" />מחיקה
            </button>
          )}
          <button className="btn-primary" onClick={save} disabled={busy} style={{ flex: 2 }}>
            <Save size={16} className="icon-inline" />{busy ? 'שומר…' : 'שמור'}
          </button>
        </div>
        <button className="btn-secondary" onClick={onClose} disabled={busy} style={{ width: '100%', marginTop: 8 }}>
          <X size={14} className="icon-inline" />ביטול
        </button>
      </div>
    </div>
  );
}
