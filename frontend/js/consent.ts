import { ref, type Ref } from 'vue';

export type ConsentStatus = 'granted' | 'denied' | null;

const CONSENT_KEY = 'cookie_consent_v1';
const CONSENT_VERSION = '1.0';
const CONSENT_EXPIRY_MS = 33696000000; // 13 months in milliseconds

const consentStatus: Ref<ConsentStatus> = ref<ConsentStatus>(null);

function isStorageAvailable(): boolean {
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    return true;
  } catch {
    return false;
  }
}

function loadConsent(): ConsentStatus {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored) as { status?: string; timestamp?: number; version?: string };

    if (!data.status || !data.timestamp || !data.version) {
      localStorage.removeItem(CONSENT_KEY);
      return null;
    }

    const age = Date.now() - data.timestamp;
    if (age > CONSENT_EXPIRY_MS) {
      localStorage.removeItem(CONSENT_KEY);
      return null;
    }

    if (data.version !== CONSENT_VERSION) {
      localStorage.removeItem(CONSENT_KEY);
      return null;
    }

    return data.status as ConsentStatus;
  } catch {
    localStorage.removeItem(CONSENT_KEY);
    return null;
  }
}

function saveConsent(status: 'granted' | 'denied'): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    const data = {
      status,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

consentStatus.value = loadConsent();

export function useConsent() {
  const grantConsent = () => {
    consentStatus.value = 'granted';
    saveConsent('granted');
    window.dispatchEvent(
      new CustomEvent('consent-changed', {
        detail: { status: 'granted' as const },
      }),
    );
  };

  const denyConsent = () => {
    consentStatus.value = 'denied';
    saveConsent('denied');
    window.dispatchEvent(
      new CustomEvent('consent-changed', {
        detail: { status: 'denied' as const },
      }),
    );
  };

  const revokeConsent = () => {
    consentStatus.value = null;
    if (isStorageAvailable()) {
      localStorage.removeItem(CONSENT_KEY);
    }
    window.dispatchEvent(
      new CustomEvent('consent-changed', {
        detail: { status: null },
      }),
    );
  };

  return {
    consentStatus,
    grantConsent,
    denyConsent,
    revokeConsent,
  };
}

export function hasConsent(): boolean {
  const stored = localStorage.getItem(CONSENT_KEY);
  if (!stored) return false;

  try {
    const data = JSON.parse(stored) as { status?: string; timestamp?: number; version?: string };
    const age = Date.now() - (data.timestamp ?? 0);
    if (age > CONSENT_EXPIRY_MS) {
      localStorage.removeItem(CONSENT_KEY);
      return false;
    }
    if (data.version !== CONSENT_VERSION) {
      localStorage.removeItem(CONSENT_KEY);
      return false;
    }
    return data.status === 'granted';
  } catch {
    return false;
  }
}
