import { ref } from 'vue';
import { useAdminAuth } from './shared/composables/useAdminAuth.js';

export default {
  setup() {
    const { login, isLoading, authError, user, isAdmin, usePasswordAuth, loginWithPassword } = useAdminAuth();
    const passwordInput = ref('');

    const handlePasswordLogin = async () => {
      if (passwordInput.value) {
        await loginWithPassword(passwordInput.value);
      }
    };

    return {
      login,
      isLoading,
      authError,
      user,
      isAdmin,
      usePasswordAuth,
      passwordInput,
      handlePasswordLogin,
    };
  },
  template: `
    <div class="max-w-md mx-auto mt-10">
      <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h2 class="font-bold mb-4 text-xl">Dansbart Admin</h2>

        <!-- Loading state -->
        <div v-if="isLoading" class="text-center py-4">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
          <p class="mt-2 text-gray-400">Checking authentication...</p>
        </div>

        <!-- Password auth mode -->
        <div v-else-if="usePasswordAuth && !isAdmin">
          <p class="text-gray-400 mb-4">Enter the admin password to access the admin panel.</p>
          <form @submit.prevent="handlePasswordLogin" class="space-y-4">
            <input
              v-model="passwordInput"
              type="password"
              placeholder="Admin password"
              class="w-full bg-gray-700 border border-gray-600 rounded px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
              autocomplete="current-password"
            />
            <button
              type="submit"
              class="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded font-bold flex items-center justify-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Sign in
            </button>
          </form>
        </div>

        <!-- Not authenticated (Authentik mode) - show login button -->
        <div v-else-if="!usePasswordAuth && !user">
          <p class="text-gray-400 mb-4">Sign in with your Authentik account to access the admin panel.</p>
          <button
            @click="login"
            class="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded font-bold flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign in with Authentik
          </button>
        </div>

        <!-- Authenticated but not admin (Authentik mode only) -->
        <div v-else-if="!usePasswordAuth && user && !isAdmin">
          <div class="bg-red-900/50 border border-red-700 rounded p-4 mb-4">
            <p class="text-red-300 font-medium">Access Denied</p>
            <p class="text-red-400 text-sm mt-1">{{ authError || 'You do not have admin privileges.' }}</p>
          </div>
          <p class="text-gray-400 text-sm mb-4">
            Signed in as: <span class="text-white">{{ user.preferred_username || user.email }}</span>
          </p>
          <button
            @click="login"
            class="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded font-medium"
          >
            Try a different account
          </button>
        </div>

        <!-- Error state -->
        <p v-if="authError" class="mt-4 text-red-400 text-sm text-center">{{ authError }}</p>
      </div>
    </div>
  `,
};
