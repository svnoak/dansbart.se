import { ref, watch } from 'vue';

// Consent state management for GDPR compliance
const CONSENT_KEY = 'cookie_consent_v1';
const CONSENT_VERSION = '1.0';
const CONSENT_EXPIRY_MS = 33696000000; // 13 months in milliseconds

// Reactive consent status: null (unset), 'granted', or 'denied'
const consentStatus = ref(null);

// Check if localStorage is available (handles private browsing)
function isStorageAvailable() {
    try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
    } catch {
        return false;
    }
}

// Load consent from localStorage
function loadConsent() {
    if (!isStorageAvailable()) {
        return null;
    }

    try {
        const stored = localStorage.getItem(CONSENT_KEY);
        if (!stored) return null;

        const data = JSON.parse(stored);

        // Validate structure
        if (!data.status || !data.timestamp || !data.version) {
            localStorage.removeItem(CONSENT_KEY);
            return null;
        }

        // Check expiry (13 months)
        const age = Date.now() - data.timestamp;
        if (age > CONSENT_EXPIRY_MS) {
            localStorage.removeItem(CONSENT_KEY);
            return null;
        }

        // Check version match
        if (data.version !== CONSENT_VERSION) {
            localStorage.removeItem(CONSENT_KEY);
            return null;
        }

        return data.status;
    } catch (error) {
        console.warn('Failed to load consent:', error);
        localStorage.removeItem(CONSENT_KEY);
        return null;
    }
}

// Save consent to localStorage
function saveConsent(status) {
    if (!isStorageAvailable()) {
        console.warn('localStorage not available, consent will not persist');
        return false;
    }

    try {
        const data = {
            status,
            timestamp: Date.now(),
            version: CONSENT_VERSION
        };
        localStorage.setItem(CONSENT_KEY, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Failed to save consent:', error);
        return false;
    }
}

// Initialize consent status from localStorage
consentStatus.value = loadConsent();

// Composable for consent management
export function useConsent() {
    const grantConsent = () => {
        consentStatus.value = 'granted';
        saveConsent('granted');

        // Emit event for other components
        window.dispatchEvent(new CustomEvent('consent-changed', {
            detail: { status: 'granted' }
        }));
    };

    const denyConsent = () => {
        consentStatus.value = 'denied';
        saveConsent('denied');

        // Emit event for other components
        window.dispatchEvent(new CustomEvent('consent-changed', {
            detail: { status: 'denied' }
        }));
    };

    const revokeConsent = () => {
        consentStatus.value = null;
        if (isStorageAvailable()) {
            localStorage.removeItem(CONSENT_KEY);
        }

        // Emit event for other components
        window.dispatchEvent(new CustomEvent('consent-changed', {
            detail: { status: null }
        }));
    };

    return {
        consentStatus,
        grantConsent,
        denyConsent,
        revokeConsent
    };
}

// Helper function for checking consent (non-reactive)
export function hasConsent() {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return false;

    try {
        const data = JSON.parse(stored);

        // Check expiry
        const age = Date.now() - data.timestamp;
        if (age > CONSENT_EXPIRY_MS) {
            localStorage.removeItem(CONSENT_KEY);
            return false;
        }

        // Check version
        if (data.version !== CONSENT_VERSION) {
            localStorage.removeItem(CONSENT_KEY);
            return false;
        }

        return data.status === 'granted';
    } catch {
        return false;
    }
}
