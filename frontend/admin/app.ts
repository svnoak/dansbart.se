import LoginView from './LoginView.js';
import AdminPanel from './AdminPanel.js';
import { useAdminAuth } from './shared/composables/useAdminAuth.js';

export default {
  components: {
    LoginView,
    AdminPanel,
  },
  setup() {
    const { isAuthenticated, accessToken, logout, isLoading } = useAdminAuth();

    return {
      isAuthenticated,
      accessToken,
      logout,
      isLoading,
    };
  },
  template: `
    <div>
      <!-- Loading state while checking auth -->
      <div v-if="isLoading" class="flex items-center justify-center min-h-screen">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p class="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>

      <!-- Authenticated admin user -->
      <AdminPanel
        v-else-if="isAuthenticated"
        @logout="logout"
      />

      <!-- Not authenticated or not admin -->
      <LoginView v-else />
    </div>
  `,
};
