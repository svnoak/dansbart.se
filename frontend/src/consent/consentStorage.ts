/**
 * Cookie consent storage – same logic as Vue legacy app.
 * Key, version and expiry must match for consistent behaviour.
 */

export type ConsentStatus = 'granted' | 'denied' | null;

const CONSENT_KEY = 'cookie_consent_v1';
const CONSENT_VERSION = '1.0';
const CONSENT_EXPIRY_MS = 33696000000; // 13 months

function isStorageAvailable(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    return true;
  } catch {
    return false;
  }
}

export function loadConsent(): ConsentStatus {
  if (!isStorageAvailable()) return null;

  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored) as {
      status?: string;
      timestamp?: number;
      version?: string;
    };

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

export function saveConsent(status: 'granted' | 'denied'): boolean {
  if (!isStorageAvailable()) return false;

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

export function clearConsent(): void {
  if (isStorageAvailable()) {
    localStorage.removeItem(CONSENT_KEY);
  }
}

export function hasConsent(): boolean {
  const stored = localStorage.getItem(CONSENT_KEY);
  if (!stored) return false;

  try {
    const data = JSON.parse(stored) as {
      status?: string;
      timestamp?: number;
      version?: string;
    };
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
