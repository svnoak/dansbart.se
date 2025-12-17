import { useConsent } from '../consent.js';

export default {
  setup() {
    const { consentStatus, revokeConsent } = useConsent();

    const openCookieSettings = () => {
      revokeConsent();
    };

    return {
      consentStatus,
      openCookieSettings,
    };
  },

  template: /*html*/ `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <!-- Logo/Brand -->
                <div class="flex items-center">
                    <a href="/" class="flex items-center space-x-2">
                        <span class="text-2xl">🎻</span>
                        <span class="text-xl font-bold text-gray-900">Dansbart.se</span>
                    </a>
                </div>

                <!-- Desktop Navigation -->
                <nav class="hidden md:flex items-center space-x-8">
                    <a href="/" class="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
                        Hem
                    </a>
                    <a href="/help.html" class="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
                        Hjälp
                    </a>
                    <!-- Placeholder for future pages -->
                    <!-- <a href="/feedback" class="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
                        Feedback
                    </a>
                    <a href="/login" class="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
                        Logga in
                    </a> -->

                    <!-- Dropdown menu for legal/settings -->
                    <div class="relative group">
                        <button class="text-gray-700 hover:text-indigo-600 font-medium transition-colors flex items-center space-x-1">
                            <span>Mer</span>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                        <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                            <a href="/privacy.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg">
                                Integritetspolicy
                            </a>
                            <a href="/terms.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" :class="{ 'rounded-b-lg': !consentStatus }">
                                Användarvillkor
                            </a>
                            <button v-if="consentStatus" @click="openCookieSettings" class="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg">
                                Cookie-inställningar
                            </button>
                        </div>
                    </div>
                </nav>

                <!-- Mobile menu button -->
                <button @click="mobileMenuOpen = !mobileMenuOpen" class="md:hidden text-gray-700 hover:text-indigo-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <!-- Mobile Navigation -->
            <Transition name="slide-down">
                <div v-if="mobileMenuOpen" class="md:hidden py-4 border-t border-gray-200">
                    <div class="flex flex-col space-y-3">
                        <a href="/" class="text-gray-700 hover:text-indigo-600 font-medium py-2">
                            Hem
                        </a>
                        <a href="/help.html" class="text-gray-700 hover:text-indigo-600 font-medium py-2">
                            Hjälp
                        </a>
                        <!-- Placeholder for future pages -->
                        <!-- <a href="/feedback" class="text-gray-700 hover:text-indigo-600 font-medium py-2">
                            Feedback
                        </a>
                        <a href="/login" class="text-gray-700 hover:text-indigo-600 font-medium py-2">
                            Logga in
                        </a> -->

                        <div class="border-t border-gray-200 pt-3 mt-3">
                            <a href="/privacy.html" class="block text-sm text-gray-600 hover:text-indigo-600 py-2">
                                Integritetspolicy
                            </a>
                            <a href="/terms.html" class="block text-sm text-gray-600 hover:text-indigo-600 py-2">
                                Användarvillkor
                            </a>
                            <button v-if="consentStatus" @click="openCookieSettings" class="w-full text-left block text-sm text-gray-600 hover:text-indigo-600 py-2">
                                Cookie-inställningar
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </div>
    </header>

    <style scoped>
    .slide-down-enter-active,
    .slide-down-leave-active {
        transition: all 0.3s ease-out;
    }

    .slide-down-enter-from {
        opacity: 0;
        transform: translateY(-10px);
    }

    .slide-down-leave-to {
        opacity: 0;
        transform: translateY(-10px);
    }
    </style>
    `,

  data() {
    return {
      mobileMenuOpen: false,
    };
  },
};
