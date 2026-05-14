import { useRef, useState } from 'react';
import { Camera, Trash2, X } from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, db } from '../firebase';
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';

// Per-client before/after photo gallery. The barber's recurring pain:
// "what did I do to this client last time?" — now it's one tap away.
// Photos resize client-side to ~1200px JPEG, upload to
// barbers/{uid}/clients/{phone}/{id}.jpg, and the ref is appended to the
// client doc's photos[] array.

const MAX_DIM = 1200;
const QUALITY = 0.82;

async function resizeImage(file) {
  const img = await createImageBitmap(file);
  const ratio = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('resize failed'))), 'image/jpeg', QUALITY),
  );
}

export default function ClientPhotos({ uid, phone, photos = [] }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState(null);

  // Newest first.
  const sorted = [...photos].sort((a, b) => (b.at || 0) - (a.at || 0));

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('בחר/י תמונה'); return; }
    setBusy(true);
    setErr('');
    try {
      const blob = await resizeImage(file);
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const path = `barbers/${uid}/clients/${phone}/${id}.jpg`;
      const r = storageRef(storage, path);
      await uploadBytes(r, blob, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(r);
      const entry = { url, path, at: Date.now() };
      // setDoc+merge so it works even if the client doc was never written
      // (synthesised-from-bookings clients).
      await setDoc(
        doc(db, 'barbers', uid, 'clients', phone),
        { photos: arrayUnion(entry), phone, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (e) {
      console.error(e);
      setErr('שגיאת העלאה: ' + (e?.message || ''));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function removePhoto(p) {
    if (!confirm('למחוק את התמונה?')) return;
    setBusy(true);
    try {
      await deleteObject(storageRef(storage, p.path)).catch(() => {}); // ignore if gone
      await updateDoc(doc(db, 'barbers', uid, 'clients', phone), {
        photos: arrayRemove(p),
      });
      setLightbox(null);
    } catch (e) {
      setErr('שגיאת מחיקה: ' + (e?.message || ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="client-photos">
      <h3><Camera size={16} className="icon-inline" /> תמונות ({sorted.length})</h3>
      <div className="client-photos-grid">
        <button
          type="button"
          className="client-photo-add"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          <Camera size={22} />
          <span>{busy ? 'מעלה…' : 'הוסף'}</span>
        </button>
        {sorted.map((p) => (
          <button
            key={p.path}
            type="button"
            className="client-photo-thumb"
            onClick={() => setLightbox(p)}
          >
            <img src={p.url} alt="תמונת לקוח" loading="lazy" />
          </button>
        ))}
      </div>
      {err && <p className="text-danger" style={{ fontSize: '0.82rem', marginTop: 6 }}>{err}</p>}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {lightbox && (
        <div className="client-photo-lightbox" onClick={() => setLightbox(null)} role="presentation">
          <button
            type="button"
            className="client-photo-lb-close"
            onClick={() => setLightbox(null)}
            aria-label="סגור"
          >
            <X size={22} />
          </button>
          <img src={lightbox.url} alt="תמונת לקוח" onClick={(e) => e.stopPropagation()} />
          <button
            type="button"
            className="client-photo-lb-delete"
            onClick={(e) => { e.stopPropagation(); removePhoto(lightbox); }}
            disabled={busy}
          >
            <Trash2 size={16} /> מחק תמונה
          </button>
        </div>
      )}
    </div>
  );
}
