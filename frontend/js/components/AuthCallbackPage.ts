/**
 * OAuth callback page. Handles redirect from Authentik after successful authentication.
 */
import { defineComponent, onMounted } from 'vue';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'vue-router';

export default defineComponent({
  name: 'AuthCallbackPage',
  setup() {
    const { handleCallback } = useAuth();
    const router = useRouter();

    onMounted(async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.has('code')) {
        router.push('/');
        return;
      }
      const success = await handleCallback();
      if (success) {
        const returnUrl = sessionStorage.getItem('returnUrl') || '/';
        sessionStorage.removeItem('returnUrl');
        router.push(returnUrl);
      } else {
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
});
