import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  loadConsent,
  saveConsent,
  clearConsent,
  type ConsentStatus,
} from '@/consent/consentStorage';

const CONSENT_CHANGED = 'consent-changed';
const SHOW_CONSENT_BANNER = 'show-consent-banner';

interface ConsentContextValue {
  consentStatus: ConsentStatus;
  grantConsent: () => void;
  denyConsent: () => void;
  revokeConsent: () => void;
  /** Revoke and show banner again (e.g. "Cookie settings" link) */
  openCookieSettings: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>(null);

  useEffect(() => {
    setConsentStatus(loadConsent());
  }, []);

  const grantConsent = useCallback(() => {
    saveConsent('granted');
    setConsentStatus('granted');
    window.dispatchEvent(
      new CustomEvent(CONSENT_CHANGED, { detail: { status: 'granted' as const } })
    );
  }, []);

  const denyConsent = useCallback(() => {
    saveConsent('denied');
    setConsentStatus('denied');
    window.dispatchEvent(
      new CustomEvent(CONSENT_CHANGED, { detail: { status: 'denied' as const } })
    );
  }, []);

  const revokeConsent = useCallback(() => {
    clearConsent();
    setConsentStatus(null);
    window.dispatchEvent(
      new CustomEvent(CONSENT_CHANGED, { detail: { status: null } })
    );
  }, []);

  const openCookieSettings = useCallback(() => {
    revokeConsent();
    window.dispatchEvent(new Event(SHOW_CONSENT_BANNER));
  }, [revokeConsent]);

  const value = useMemo<ConsentContextValue>(
    () => ({
      consentStatus,
      grantConsent,
      denyConsent,
      revokeConsent,
      openCookieSettings,
    }),
    [
      consentStatus,
      grantConsent,
      denyConsent,
      revokeConsent,
      openCookieSettings,
    ]
  );

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within ConsentProvider');
  return ctx;
}

export { SHOW_CONSENT_BANNER };
