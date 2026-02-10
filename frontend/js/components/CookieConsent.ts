import { defineComponent, ref, onMounted } from 'vue';
import { useConsent } from '../consent';

export default defineComponent({
  name: 'CookieConsent',
  setup() {
    const { consentStatus, grantConsent, denyConsent } = useConsent();
    const showBanner = ref(false);

    onMounted(() => {
      // Show banner only if consent is not set
      if (consentStatus.value === null) {
        // Slight delay for better UX
        setTimeout(() => {
          showBanner.value = true;
        }, 500);
      }

      // Listen for show-consent event (triggered when user tries to play without consent)
      window.addEventListener('show-consent-banner', () => {
        if (consentStatus.value === null || consentStatus.value === 'denied') {
          showBanner.value = true;
        }
      });
    });

    const handleAccept = (): void => {
      grantConsent();
      showBanner.value = false;
    };

    const handleDecline = (): void => {
      denyConsent();
      showBanner.value = false;
    };

    return {
      consentStatus,
      showBanner,
      handleAccept,
      handleDecline,
    };
  },

  template: /*html*/ `
    <Transition name="slide-up">
        <div v-if="showBanner" class="fixed inset-0 z-[100] pointer-events-none flex items-end justify-center p-4 sm:p-6">
            <div class="pointer-events-auto bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl p-6 sm:p-8">
                <!-- Icon and Title -->
                <div class="flex items-start gap-4 mb-4">
                    <div class="flex-shrink-0 text-3xl" aria-hidden="true">🍪</div>
                    <div class="flex-1">
                        <h2 class="text-xl font-bold text-gray-900 mb-2">Cookie-meddelande</h2>
                        <p class="text-gray-700 text-sm leading-relaxed">
                            Vi använder cookies från tredjepartstjänster (Spotify och YouTube)
                            för att spela upp musik. Dessa tjänster kan sätta cookies och
                            samla in data enligt sina egna integritetspolicyer.
                        </p>
                    </div>
                </div>

                <!-- Privacy Policy Link -->
                <div class="mb-6">
                    <a href="/privacy.html"
                       class="text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                       target="_blank">
                        Läs vår integritetspolicy →
                    </a>
                </div>

                <!-- Buttons -->
                <div class="flex flex-col sm:flex-row gap-3">
                    <button
                        @click="handleAccept"
                        class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        aria-label="Acceptera cookies">
                        Acceptera
                    </button>
                    <button
                        @click="handleDecline"
                        class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                        aria-label="Avvisa cookies">
                        Avvisa
                    </button>
                </div>
            </div>
        </div>
    </Transition>

    <style scoped>
    .slide-up-enter-active,
    .slide-up-leave-active {
        transition: all 0.3s ease-out;
    }

    .slide-up-enter-from {
        opacity: 0;
        transform: translateY(20px);
    }

    .slide-up-leave-to {
        opacity: 0;
        transform: translateY(10px);
    }
    </style>
    `,
});
