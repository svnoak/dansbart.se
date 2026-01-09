/**
 * OAuth callback page.
 *
 * Handles the redirect from Authentik after successful authentication.
 */
import { onMounted } from 'vue';
import { useAuth } from '../hooks/useAuth.js';
import { useRouter } from 'vue-router';

export default {
  name: 'AuthCallbackPage',

  setup() {
    const { handleCallback } = useAuth();
    const router = useRouter();

    onMounted(async () => {
      // Only handle callback if we have the auth code in URL
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.has('code')) {
        console.log('[AuthCallback] No auth code in URL, redirecting to home');
        router.push('/');
        return;
      }

      console.log('[AuthCallback] Processing callback with code');
      const success = await handleCallback();
      if (success) {
        // Redirect to intended page or home
        const returnUrl = sessionStorage.getItem('returnUrl') || '/';
        sessionStorage.removeItem('returnUrl');

        console.log('[AuthCallback] Success! Redirecting to:', returnUrl);

        // Use Vue Router to navigate (auth guard will skip check since coming from callback)
        router.push(returnUrl);
      } else {
        // Failed to authenticate - go home
        console.log('[AuthCallback] Failed, redirecting to home');
        router.push('/');
      }
    });

    return {};
  },

  template: `
    <div class="flex items-center justify-center min-h-screen bg-gray-50">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p class="text-gray-600 text-lg">Loggar in...</p>
      </div>
    </div>
  `,
};
