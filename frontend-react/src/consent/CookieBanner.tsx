import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useConsent } from '@/consent/useConsent';
import { SHOW_CONSENT_BANNER } from '@/consent/constants';

/**
 * Cookie banner – same behaviour as Vue legacy: show when consent not set (after delay)
 * or when user tries to play without consent (show-consent-banner event).
 */
export function CookieBanner() {
  const { consentStatus, grantConsent, denyConsent } = useConsent();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (consentStatus === null) {
      const t = setTimeout(() => setShowBanner(true), 500);
      return () => clearTimeout(t);
    }
  }, [consentStatus]);

  useEffect(() => {
    const handler = () => {
      if (consentStatus === null || consentStatus === 'denied') {
        setShowBanner(true);
      }
    };
    window.addEventListener(SHOW_CONSENT_BANNER, handler);
    return () => window.removeEventListener(SHOW_CONSENT_BANNER, handler);
  }, [consentStatus]);

  const handleAccept = () => {
    grantConsent();
    setShowBanner(false);
  };

  const handleDecline = () => {
    denyConsent();
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      className="fixed inset-0 z-100 pointer-events-none flex items-end justify-center p-4 sm:p-6"
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
    >
      <div
        className="pointer-events-auto w-full max-w-2xl rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-2xl sm:p-8"
        style={{ animation: 'cookie-banner-enter 0.3s ease-out' }}
      >
        <div className="flex items-start gap-4 mb-4">
          <span className="shrink-0 text-3xl" aria-hidden>
            🍪
          </span>
          <div className="flex-1 min-w-0">
            <h2
              id="cookie-banner-title"
              className="text-xl font-bold text-[rgb(var(--color-text))] mb-2"
            >
              Cookie-meddelande
            </h2>
            <p
              id="cookie-banner-desc"
              className="text-sm leading-relaxed text-[rgb(var(--color-text-muted))]"
            >
              Vi använder cookies från tredjepartstjänster (Spotify och YouTube)
              för att spela upp musik. Dessa tjänster kan sätta cookies och
              samla in data enligt sina egna integritetspolicyer.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <Link
            to="/privacy"
            className="text-sm font-medium text-[rgb(var(--color-accent))] hover:underline"
          >
            Läs vår integritetspolicy →
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-6 py-3 font-semibold text-white transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] focus-visible:ring-offset-2"
            aria-label="Acceptera cookies"
          >
            Acceptera
          </button>
          <button
            type="button"
            onClick={handleDecline}
            className="flex-1 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-border))]/30 px-6 py-3 font-semibold text-[rgb(var(--color-text))] transition-colors hover:bg-[rgb(var(--color-border))]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] focus-visible:ring-offset-2"
            aria-label="Avvisa cookies"
          >
            Avvisa
          </button>
        </div>
      </div>
    </div>
  );
}
