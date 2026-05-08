import { useCallback, useEffect, useRef, useState } from 'react';

// Web Wake Lock API hook — keeps the device screen awake while the barber is
// actively working on phone/tablet. Browsers automatically RELEASE the lock
// whenever the page becomes hidden (tab switch, lock screen, app background)
// so we re-acquire on visibilitychange while the user wants it on.
//
// Supported on iOS Safari 16.4+, Chrome (desktop + Android), Edge. On older
// browsers `navigator.wakeLock` is undefined — `supported` flips to false and
// the toggle UI should hide itself or show an explanation.
//
// Persistence: the user's choice is remembered in localStorage so the lock is
// re-acquired across page reloads (within the same browser).

const STORAGE_KEY = 'toron_wake_lock_v1';

export function useWakeLock() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch { return false; }
  });
  const sentinelRef = useRef(null);
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const release = useCallback(async () => {
    try {
      if (sentinelRef.current) {
        await sentinelRef.current.release();
        sentinelRef.current = null;
      }
    } catch { /* ignore — release errors are non-actionable */ }
  }, []);

  const acquire = useCallback(async () => {
    if (!supported || document.visibilityState !== 'visible') return;
    if (sentinelRef.current) return; // already held
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      sentinel.addEventListener('release', () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
      });
    } catch (e) {
      // Request can fail on low battery, OS-level "Low Power Mode", or denial.
      console.warn('wake lock request failed:', e?.name, e?.message);
    }
  }, [supported]);

  // Acquire / release on toggle change + persist
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch {}
    if (enabled) acquire();
    else release();
    return () => { release(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Re-acquire on visibility change — the browser auto-releases when the
  // page is hidden, so without this the screen would dim after the user
  // switches tabs once.
  useEffect(() => {
    if (!supported) return;
    function onVis() {
      if (enabled && document.visibilityState === 'visible') acquire();
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [enabled, supported, acquire]);

  return {
    enabled,
    supported,
    toggle: () => setEnabled((v) => !v),
    setEnabled,
  };
}
