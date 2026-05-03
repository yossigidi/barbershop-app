import { useRef, useState } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_DIM = 400;
const TARGET_QUALITY = 0.85;

async function resizeImage(file) {
  const img = await createImageBitmap(file);
  const ratio = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))), 'image/jpeg', TARGET_QUALITY),
  );
}

export default function LogoUploader({ uid, currentUrl, onChange }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('הקובץ לא תקין — בחר תמונה');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const blob = await resizeImage(file);
      const path = `barbers/${uid}/logo.jpg`;
      const r = storageRef(storage, path);
      await uploadBytes(r, blob, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(r);
      // Append timestamp so the cached old logo is bypassed
      onChange(`${url}&v=${Date.now()}`);
    } catch (e) {
      console.error(e);
      setErr('שגיאת העלאה: ' + (e?.message || ''));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function removeLogo() {
    if (!confirm('להסיר את הלוגו?')) return;
    setBusy(true);
    try {
      const r = storageRef(storage, `barbers/${uid}/logo.jpg`);
      await deleteObject(r).catch(() => {}); // ignore if doesn't exist
      onChange('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="logo-uploader">
      {currentUrl ? (
        <div className="logo-preview-wrap">
          <img src={currentUrl} alt="לוגו" className="logo-preview" />
        </div>
      ) : (
        <div className="logo-empty">אין לוגו</div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn-secondary"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          type="button"
          style={{ flex: 1 }}
        >
          {busy ? 'מעלה…' : currentUrl ? '🔄 החלף לוגו' : '📷 העלה לוגו'}
        </button>
        {currentUrl && (
          <button
            className="btn-secondary"
            onClick={removeLogo}
            disabled={busy}
            type="button"
            style={{ flex: 'none', padding: '12px 16px' }}
          >
            🗑
          </button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {err && <p className="text-danger" style={{ fontSize: '0.85rem', marginTop: 6 }}>{err}</p>}
      <p className="muted" style={{ fontSize: '0.75rem', marginTop: 6 }}>
        תמונה מרובעת עובדת הכי טוב • מקסימום 2MB • נדחסת אוטומטית
      </p>
    </div>
  );
}
