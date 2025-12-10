import { useConsent } from '../consent.js';

export default {
    setup() {
        const { revokeConsent } = useConsent();

        const openCookieSettings = () => {
            revokeConsent();
        };

        return {
            openCookieSettings
        };
    },

    template: /*html*/`
    <footer class="bg-gray-100 border-t border-gray-200 mt-16">
        <div class="max-w-4xl mx-auto px-4 py-4">
            <!-- Desktop Layout -->
            <div class="hidden sm:flex items-center justify-center text-xs text-gray-600 space-x-1">
                <span>Copyright © 2025 Dansbart.se</span>
                <span class="text-gray-400">|</span>
                <a href="/privacy.html" class="hover:text-gray-900 hover:underline" target="_blank">
                    Integritetspolicy
                </a>
                <span class="text-gray-400">|</span>
                <a href="/terms.html" class="hover:text-gray-900 hover:underline" target="_blank">
                    Användarvillkor
                </a>
                <span class="text-gray-400">|</span>
                <button @click="openCookieSettings" class="hover:text-gray-900 hover:underline focus:outline-none focus:underline">
                    Cookie-inställningar
                </button>
            </div>

            <!-- Mobile Layout -->
            <div class="sm:hidden text-center">
                <p class="text-xs text-gray-600 mb-2">Copyright © 2025 Dansbart.se</p>
                <div class="flex items-center justify-center text-xs text-gray-600 space-x-2">
                    <a href="/privacy.html" class="hover:text-gray-900 hover:underline" target="_blank">
                        Integritetspolicy
                    </a>
                    <span class="text-gray-400">·</span>
                    <a href="/terms.html" class="hover:text-gray-900 hover:underline" target="_blank">
                        Användarvillkor
                    </a>
                    <span class="text-gray-400">·</span>
                    <button @click="openCookieSettings" class="hover:text-gray-900 hover:underline focus:outline-none focus:underline">
                        Cookies
                    </button>
                </div>
            </div>
        </div>
    </footer>
    `
};
