import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QrModal({ link, businessName, onClose }) {
  const printRef = useRef(null);

  function handlePrint() {
    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) return alert('הדפדפן חסם את חלון ההדפסה');
    const svg = printRef.current?.querySelector('svg')?.outerHTML || '';
    win.document.write(`<!doctype html>
<html dir="rtl"><head><meta charset="utf-8">
<title>QR — ${businessName}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2 { font-size: 18px; color: #444; margin: 0 0 24px; font-weight: 400; }
  .qr { display: inline-block; padding: 20px; background: #fff; border: 2px solid #000; border-radius: 16px; }
  .link { font-family: monospace; font-size: 14px; margin-top: 24px; direction: ltr; word-break: break-all; }
  .footer { margin-top: 16px; font-size: 14px; color: #666; }
</style></head>
<body>
<h1>${businessName}</h1>
<h2>📱 סרוק לקביעת תור</h2>
<div class="qr">${svg}</div>
<div class="footer">או היכנס ל:</div>
<div class="link">${link}</div>
<script>window.onload = () => { window.print(); };</script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>🔳 QR לחלון החנות</h2>
        <p className="muted">לקוחות סורקים → מגיעים ישירות לדף ההזמנה.</p>
        <div ref={printRef} style={{ background: 'white', padding: 24, borderRadius: 12, textAlign: 'center', margin: '12px 0' }}>
          <QRCodeSVG value={link} size={240} level="M" includeMargin={false} />
        </div>
        <p className="muted text-center" style={{ fontSize: '0.8rem', wordBreak: 'break-all', direction: 'ltr' }}>{link}</p>
        <div className="spacer" />
        <button className="btn-primary" onClick={handlePrint} style={{ width: '100%', marginBottom: 8 }}>
          🖨️ הדפס
        </button>
        <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>
          סגור
        </button>
      </div>
    </div>
  );
}
