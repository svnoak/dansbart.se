import {
  useCallback,
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
import { SHOW_CONSENT_BANNER } from './constants';
import { ConsentContext } from './context';

const CONSENT_CHANGED = 'consent-changed';

export interface ConsentContextValue {
  consentStatus: ConsentStatus;
  grantConsent: () => void;
  denyConsent: () => void;
  revokeConsent: () => void;
  /** Revoke and show banner again (e.g. "Cookie settings" link) */
  openCookieSettings: () => void;
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>(loadConsent);

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

