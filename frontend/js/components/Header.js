import { ref } from 'vue';
import { useConsent } from '../consent.js';
import { useAuth } from '../hooks/useAuth.js';
import { useAuthConfig } from '../hooks/useAuthConfig.js';

export default {
  props: {
    currentPage: {
      type: String,
      default: 'discovery'
    }
  },

  emits: ['navigate'],

  setup() {
    const { consentStatus, revokeConsent } = useConsent();
    const { user, isAuthenticated, login, logout } = useAuth();
    const { authEnabled } = useAuthConfig();
    const showAccountMenu = ref(false);

    const openCookieSettings = () => {
      revokeConsent();
    };

    return {
      consentStatus,
      openCookieSettings,
      user,
      isAuthenticated,
      login,
      logout,
      showAccountMenu,
      authFeaturesEnabled: authEnabled,
    };
  },

  template: /*html*/ `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <a href="/" class="flex items-center space-x-2">
                        <span class="text-2xl">🎻</span>
                        <span class="text-xl font-bold text-gray-900">Dansbart.se</span>
                    </a>
                </div>

                <nav class="hidden md:flex items-center space-x-8">
                    <a href="/" 
                       @click.prevent="$emit('navigate', 'discovery')"
                       class="font-medium transition-colors"
                       :class="currentPage === 'discovery' ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'">
                        Hem
                    </a>

                    <button 
                       @click="$emit('navigate', 'classify')"
                       class="font-medium transition-colors focus:outline-none"
                       :class="currentPage === 'classify' ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'">
                        Hjälp till
                    </button>

                    <a href="/help.html" class="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
                        FAQ
                    </a>

                    <a href="/dataset-info.html"
                       class="text-gray-700 hover:text-indigo-600 font-medium transition-colors">
                        Open Data
                    </a>

                    <div class="relative desktop-menu-container" @keydown="handleMenuKeydown">
                        <button
                            @click="toggleDesktopMenu"
                            class="text-gray-700 hover:text-indigo-600 font-medium transition-colors flex items-center space-x-1"
                            :aria-expanded="desktopMenuOpen"
                            aria-haspopup="true"
                            aria-label="Öppna mer-menyn">
                            <span>Mer</span>
                            <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': desktopMenuOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                        <div
                            v-show="desktopMenuOpen"
                            class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 transition-all duration-200"
                            role="menu"
                            aria-label="Mer-meny">
                            <a href="/privacy.html"
                               class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                               role="menuitem">
                                Integritetspolicy
                            </a>
                            <a href="/terms.html"
                               class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                               :class="{ 'rounded-b-lg': !consentStatus }"
                               role="menuitem">
                                Användarvillkor
                            </a>
                            <button
                                v-if="consentStatus"
                                @click="openCookieSettings"
                                class="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
                                role="menuitem">
                                Cookie-inställningar
                            </button>
                        </div>
                    </div>

                    <!-- Auth UI (Desktop): only when backend has auth enabled -->
                    <div v-if="authFeaturesEnabled && !isAuthenticated" class="flex items-center gap-2 ml-4">
                        <button
                            @click="login"
                            class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 font-medium transition"
                        >
                            Logga in
                        </button>
                    </div>

                    <div v-else-if="authFeaturesEnabled && isAuthenticated" class="relative ml-4" data-testid="account-menu">
                        <button
                            @click="showAccountMenu = !showAccountMenu"
                            class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
                        >
                            <div v-if="user.picture" class="w-8 h-8 rounded-full overflow-hidden">
                                <img :src="user.picture" :alt="user.name" class="w-full h-full object-cover">
                            </div>
                            <div v-else class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                                {{ (user.name || user.email)?.[0]?.toUpperCase() }}
                            </div>
                            <span class="font-medium text-gray-900">{{ user.name || user.email }}</span>
                        </button>

                        <!-- Account Dropdown -->
                        <div
                            v-if="showAccountMenu"
                            class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50 border border-gray-200"
                        >
                            <router-link
                                to="/playlists"
                                class="block px-4 py-2 hover:bg-gray-100 text-gray-700"
                                @click="showAccountMenu = false"
                            >
                                Mina spellistor
                            </router-link>
                            <button
                                @click="logout(); showAccountMenu = false"
                                class="w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
                            >
                                Logga ut
                            </button>
                        </div>
                    </div>
                </nav>

                <button
                    @click="mobileMenuOpen = !mobileMenuOpen"
                    class="md:hidden text-gray-700 hover:text-indigo-600"
                    :aria-expanded="mobileMenuOpen"
                    :aria-label="mobileMenuOpen ? 'Stäng mobilmeny' : 'Öppna mobilmeny'">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <Transition name="slide-down">
                <div v-if="mobileMenuOpen" class="md:hidden py-4 border-t border-gray-200">
                    <div class="flex flex-col space-y-3">
                        <a href="/" 
                           @click.prevent="$emit('navigate', 'discovery'); mobileMenuOpen = false"
                           class="font-medium py-2"
                           :class="currentPage === 'discovery' ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'">
                            Hem
                        </a>
                        
                        <button 
                           @click="$emit('navigate', 'classify'); mobileMenuOpen = false"
                           class="text-left font-medium py-2 focus:outline-none"
                           :class="currentPage === 'classify' ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'">
                            Hjälp till
                        </button>

                        <a href="/help.html" class="text-gray-700 hover:text-indigo-600 font-medium py-2">
                            Hjälp
                        </a>

                        <a href="/dataset-info.html"
                           class="text-gray-700 hover:text-indigo-600 font-medium py-2">
                            Open Data
                        </a>

                        <!-- Auth UI (Mobile) -->
                        <div v-if="authFeaturesEnabled" class="border-t border-gray-200 pt-3 mt-3">
                            <div v-if="!isAuthenticated">
                                <button
                                    @click="login(); mobileMenuOpen = false"
                                    class="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 font-medium transition mb-3"
                                >
                                    Logga in
                                </button>
                            </div>
                            <div v-else class="mb-3 pb-3 border-b border-gray-200">
                                <div class="flex items-center gap-2 px-2 py-2 mb-2">
                                    <div v-if="user.picture" class="w-8 h-8 rounded-full overflow-hidden">
                                        <img :src="user.picture" :alt="user.name" class="w-full h-full object-cover">
                                    </div>
                                    <div v-else class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                                        {{ (user.name || user.email)?.[0]?.toUpperCase() }}
                                    </div>
                                    <span class="font-medium text-gray-900">{{ user.name || user.email }}</span>
                                </div>
                                <router-link
                                    to="/playlists"
                                    class="block px-2 py-2 text-gray-700 hover:text-indigo-600 font-medium"
                                    @click="mobileMenuOpen = false"
                                >
                                    Mina spellistor
                                </router-link>
                                <button
                                    @click="logout(); mobileMenuOpen = false"
                                    class="w-full text-left px-2 py-2 text-red-600 hover:text-red-700 font-medium"
                                >
                                    Logga ut
                                </button>
                            </div>
                        </div>

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
      desktopMenuOpen: false,
    };
  },

  methods: {
    toggleDesktopMenu() {
      this.desktopMenuOpen = !this.desktopMenuOpen;
    },
    closeDesktopMenu() {
      this.desktopMenuOpen = false;
    },
    handleMenuKeydown(e) {
      if (e.key === 'Escape') {
        this.closeDesktopMenu();
      }
    },
  },

  mounted() {
    document.addEventListener('click', (e) => {
      if (this.desktopMenuOpen && !e.target.closest('.desktop-menu-container')) {
        this.closeDesktopMenu();
      }
    });
  },
};