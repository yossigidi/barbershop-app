import { useEffect, useRef, useState } from 'react';
import { FileSignature, RotateCcw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import AccessibleModal from './AccessibleModal.jsx';

// Studio plan = a 24-month commitment with a subsidised tablet. Before we
// hand the customer to Tranzila we capture a real signed agreement: full
// name, Israeli ID, and a drawn signature. Saved to barbers/{uid} under
// `studioAgreement` so there's a record the commitment terms were shown
// and accepted. Firestore rules allow the owner to write any field on
// their own doc except `subscription`.

// Standard Israeli ID checksum (Luhn-like, weights 1/2 alternating).
function isValidIsraeliId(raw) {
  const id = String(raw || '').trim();
  if (!/^\d{5,9}$/.test(id)) return false;
  const padded = id.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(padded[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

export default function StudioAgreementModal({ open, onClose, user, onSigned }) {
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPt = useRef(null);

  // Size the canvas to its rendered width on open, accounting for DPR so
  // the signature stays crisp. Reset everything when the modal closes.
  useEffect(() => {
    if (!open) {
      setFullName(''); setIdNumber(''); setAgreed('');
      setHasSignature(false); setBusy(false); setErr('');
      return;
    }
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cv.getBoundingClientRect();
    cv.width = Math.round(rect.width * dpr);
    cv.height = Math.round(rect.height * dpr);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0E1F3D';
  }, [open]);

  function ptFromEvent(e) {
    const cv = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function startDraw(e) {
    e.preventDefault();
    drawing.current = true;
    lastPt.current = ptFromEvent(e);
  }
  function moveDraw(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = ptFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPt.current = p;
    if (!hasSignature) setHasSignature(true);
  }
  function endDraw() { drawing.current = false; }
  function clearSignature() {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    setHasSignature(false);
  }

  async function submit() {
    setErr('');
    if (fullName.trim().length < 2) { setErr('יש להזין שם מלא'); return; }
    if (!isValidIsraeliId(idNumber)) { setErr('מספר תעודת זהות לא תקין'); return; }
    if (!hasSignature) { setErr('יש לחתום במסגרת'); return; }
    if (!agreed) { setErr('יש לאשר את תנאי ההתחייבות'); return; }
    if (!user) { setErr('יש להתחבר מחדש'); return; }

    setBusy(true);
    try {
      const signatureDataUrl = canvasRef.current.toDataURL('image/png');
      await updateDoc(doc(db, 'barbers', user.uid), {
        studioAgreement: {
          fullName: fullName.trim(),
          idNumber: String(idNumber).trim(),
          signatureDataUrl,
          commitmentMonths: 24,
          exitFeePerMonth: 30,
          signedAt: serverTimestamp(),
          signedAtClient: new Date().toISOString(),
          userAgent: navigator.userAgent.slice(0, 200),
        },
      });
      onSigned();
    } catch (e) {
      setErr('שגיאה בשמירת ההסכם: ' + (e?.message || 'נסה שוב'));
      setBusy(false);
    }
  }

  return (
    <AccessibleModal
      open={open}
      onClose={busy ? undefined : onClose}
      titleId="studio-agreement-title"
      maxWidth="520px"
      closeOnBackdrop={!busy}
    >
      <h2 id="studio-agreement-title" className="modal-title">
        <FileSignature size={20} className="icon-inline" aria-hidden="true" />
        הסכם התחייבות — מסלול Studio
      </h2>
      <p className="muted" style={{ marginTop: -4 }}>
        מסלול Studio הוא בהתחייבות ל-24 חודשים (₪50/חודש) הכולל טאבלט מסובסד.
        כדי להמשיך לתשלום יש לחתום על ההסכם.
      </p>

      <div className="studio-commit-box">
        <strong><ShieldCheck size={15} className="icon-inline" />עיקרי ההתחייבות</strong>
        <ul>
          <li>24 תשלומים חודשיים של ₪50 דרך Tranzila.</li>
          <li>הטאבלט מסובסד דרך התשלום החודשי — לכן יש התחייבות.</li>
          <li>יציאה מוקדמת: דמי יציאה של ₪30 לכל חודש שנותר עד תום ההתחייבות.</li>
          <li>בתום 24 החודשים — המנוי ממשיך חודשי רגיל, וניתן לבטל בלי דמי יציאה.</li>
        </ul>
      </div>

      <div className="field">
        <label htmlFor="sa-name">שם מלא</label>
        <input
          id="sa-name"
          data-autofocus
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="שם פרטי ושם משפחה"
          autoComplete="name"
          maxLength={80}
        />
      </div>

      <div className="field">
        <label htmlFor="sa-id">תעודת זהות</label>
        <input
          id="sa-id"
          type="tel"
          inputMode="numeric"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="9 ספרות"
          maxLength={9}
          dir="ltr"
          style={{ direction: 'ltr', textAlign: 'left' }}
        />
      </div>

      <div className="field">
        <label>חתימה</label>
        <div className="sig-pad-wrap">
          <canvas
            ref={canvasRef}
            className="sig-pad"
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            onPointerCancel={endDraw}
          />
          {!hasSignature && <span className="sig-pad-hint">חתום/י כאן באצבע</span>}
          <button
            type="button"
            className="sig-pad-clear"
            onClick={clearSignature}
            aria-label="נקה חתימה"
          >
            <RotateCcw size={14} /> נקה
          </button>
        </div>
      </div>

      <label className="studio-agree-row">
        <input
          type="checkbox"
          checked={!!agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>
          קראתי ואני מאשר/ת את תנאי ההתחייבות, ה<Link to="/terms" target="_blank">תקנון</Link>{' '}
          ו<Link to="/refund" target="_blank">מדיניות הביטולים</Link>.
        </span>
      </label>

      {err && <div className="auth-alert auth-alert-error" role="alert">{err}</div>}

      <button
        type="button"
        className="btn-gold"
        style={{ width: '100%', padding: '14px', marginTop: 4 }}
        onClick={submit}
        disabled={busy}
      >
        {busy ? 'שומר…' : 'חתום והמשך לתשלום'}
      </button>
      <button
        type="button"
        className="link-button"
        style={{ display: 'block', margin: '10px auto 0' }}
        onClick={onClose}
        disabled={busy}
      >
        ביטול
      </button>
    </AccessibleModal>
  );
}
