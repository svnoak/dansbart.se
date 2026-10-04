import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useConsent } from '@/consent/useConsent';
import { SHOW_CONSENT_BANNER } from '@/consent/constants';
import { Button } from '@/ui';

/**
 * Cookie banner. It shows when consent is not set (after a short delay) and
 * when the person tries to play without consent (the show-consent-banner event).
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
      className="pointer-events-none fixed inset-0 z-[130] flex items-end justify-center p-4 sm:p-6"
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
    >
      <div
        className="pointer-events-auto w-full max-w-2xl rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-5 shadow-[var(--color-card-shadow)] sm:p-6"
        style={{ animation: 'cookie-banner-enter 0.3s ease-out' }}
      >
        <h2 id="cookie-banner-title" className="text-xl font-bold text-[rgb(var(--color-text))]">
          Cookies för uppspelning
        </h2>
        <p id="cookie-banner-desc" className="mt-2 text-[15px] leading-relaxed text-[rgb(var(--color-text-muted))]">
          Vi använder cookies från Spotify och YouTube för att spela upp musik. De tjänsterna kan
          sätta egna cookies och samla in data enligt sina integritetspolicyer.
        </p>
        <p className="mt-3">
          <Link to="/privacy" className="text-sm font-semibold text-[rgb(var(--color-link))] hover:underline">
            Läs vår integritetspolicy
          </Link>
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" onClick={handleAccept} className="flex-1" aria-label="Acceptera cookies">
            Acceptera
          </Button>
          <Button variant="outline" onClick={handleDecline} className="flex-1" aria-label="Avvisa cookies">
            Avvisa
          </Button>
        </div>
      </div>
    </div>
  );
}
