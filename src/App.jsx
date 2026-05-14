import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import AccessibilityWidget from './components/AccessibilityWidget.jsx';

// Eager-load the two most common public landing surfaces — these are the
// pages a fresh visitor is most likely to hit (homepage + a booking link
// shared by a barber). Loading them eagerly avoids the lazy-chunk delay
// on first paint.
import HomePage from './pages/HomePage.jsx';
import BookingPage from './pages/BookingPage.jsx';

// Stale-chunk recovery. When we deploy a new version, the old index.html
// in a user's cache still references the previous JS chunk filenames.
// Our Cloudflare SPA fallback (`not_found_handling: single-page-application`)
// returns index.html for any missing path — including those stale chunks —
// so the browser ends up trying to execute HTML as JS and crashes with a
// blank screen on iOS Safari.
//
// Wrap every lazy() import so we recover automatically: on first failure
// we force-reload once (which refetches the current index.html and gets
// the up-to-date chunk names). The session flag prevents an infinite
// reload loop if the second attempt also fails (real broken build).
function lazyRetry(loader) {
  return lazy(async () => {
    const RELOAD_KEY = 'toron_chunk_reload_v1';
    const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === '1';
    try {
      const mod = await loader();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (e) {
      if (!alreadyReloaded) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
        // Return a never-resolving promise so React doesn't surface the
        // error before the reload happens.
        return new Promise(() => {});
      }
      throw e;
    }
  });
}

// Everything behind auth is lazy so a client opening /b/<code> doesn't
// download the full dashboard / settings / reports bundle they will never
// use. Dropped ~50-60% off the booking-page initial JS.
const AuthPage = lazyRetry(() => import('./pages/AuthPage.jsx'));
const DashboardPage = lazyRetry(() => import('./pages/DashboardPage.jsx'));
const ClientsPage = lazyRetry(() => import('./pages/ClientsPage.jsx'));
const SettingsPage = lazyRetry(() => import('./pages/SettingsPage.jsx'));
const OnboardingPage = lazyRetry(() => import('./pages/OnboardingPage.jsx'));
const ReportsPage = lazyRetry(() => import('./pages/ReportsPage.jsx'));
const PricingPage = lazyRetry(() => import('./pages/PricingPage.jsx'));
const TermsPage = lazyRetry(() => import('./pages/TermsPage.jsx'));
const PrivacyPage = lazyRetry(() => import('./pages/PrivacyPage.jsx'));
const RefundPage = lazyRetry(() => import('./pages/RefundPage.jsx'));
const AccessibilityPage = lazyRetry(() => import('./pages/AccessibilityPage.jsx'));
const ManageBookingPage = lazyRetry(() => import('./pages/ManageBookingPage.jsx'));
const WhatsAppTemplatesPage = lazyRetry(() => import('./pages/WhatsAppTemplatesPage.jsx'));
const PromoPage = lazyRetry(() => import('./pages/PromoPage.jsx'));

function Loading() {
  return <div className="loading" role="status" aria-live="polite">טוען…</div>;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/onboarding" element={<Protected><OnboardingPage /></Protected>} />
          <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
          <Route path="/clients" element={<Protected><ClientsPage /></Protected>} />
          <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
          <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />
          <Route path="/pricing" element={<Protected><PricingPage /></Protected>} />
          <Route path="/whatsapp-templates" element={<Protected><WhatsAppTemplatesPage /></Protected>} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/refund" element={<RefundPage />} />
          <Route path="/accessibility" element={<AccessibilityPage />} />
          <Route path="/promo" element={<PromoPage />} />
          <Route path="/b/:code" element={<BookingPage />} />
          <Route path="/manage/:token" element={<ManageBookingPage />} />
          {/* Custom-slug catch-all — toron.co.il/ramos style. BookingPage
              checks reserved words + shortCodes lookup; redirects to /
              when nothing matches. Must be the LAST route. */}
          <Route path="/:code" element={<BookingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <AccessibilityWidget />
    </>
  );
}
