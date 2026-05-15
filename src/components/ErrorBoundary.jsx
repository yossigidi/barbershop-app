import { Component } from 'react';

// Top-level error boundary. Without it, ANY uncaught render error blanks
// the screen on iOS PWA — the user has no way to recover except force-
// closing the app. This catches the throw, shows a friendly RTL recovery
// card, and offers a reload (which usually fixes transient state issues
// like a stale chunk after a deploy).
//
// Class component because React still requires it for componentDidCatch.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info?.componentStack);
  }

  reset = () => {
    // Hard reload — recovers from stale chunks and from any in-memory
    // corrupted state the boundary couldn't reset on its own.
    try { window.location.reload(); } catch { this.setState({ error: null }); }
  };

  goHome = () => {
    try { window.location.href = '/dashboard'; } catch { this.setState({ error: null }); }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-shell" dir="rtl" role="alert">
        <div className="error-card">
          <div className="error-emoji" aria-hidden="true">😬</div>
          <h1>משהו השתבש</h1>
          <p>נתקלנו בתקלה לא צפויה. ברוב המקרים רענון פותר את זה.</p>
          <div className="error-actions">
            <button type="button" className="btn-gold" onClick={this.reset}>רענן עכשיו</button>
            <button type="button" className="btn-secondary" onClick={this.goHome}>חזרה לדשבורד</button>
          </div>
          <details className="error-details">
            <summary>פרטים טכניים</summary>
            <code>{String(this.state.error?.message || this.state.error)}</code>
          </details>
        </div>
      </div>
    );
  }
}
