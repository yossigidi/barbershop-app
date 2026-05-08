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

// Everything behind auth is lazy so a client opening /b/<code> doesn't
// download the full dashboard / settings / reports bundle they will never
// use. Dropped ~50-60% off the booking-page initial JS.
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const PricingPage = lazy(() => import('./pages/PricingPage.jsx'));
const TermsPage = lazy(() => import('./pages/TermsPage.jsx'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.jsx'));
const RefundPage = lazy(() => import('./pages/RefundPage.jsx'));
const AccessibilityPage = lazy(() => import('./pages/AccessibilityPage.jsx'));
const ManageBookingPage = lazy(() => import('./pages/ManageBookingPage.jsx'));
const WhatsAppTemplatesPage = lazy(() => import('./pages/WhatsAppTemplatesPage.jsx'));

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
          <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
          <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />
          <Route path="/pricing" element={<Protected><PricingPage /></Protected>} />
          <Route path="/whatsapp-templates" element={<Protected><WhatsAppTemplatesPage /></Protected>} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/refund" element={<RefundPage />} />
          <Route path="/accessibility" element={<AccessibilityPage />} />
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
