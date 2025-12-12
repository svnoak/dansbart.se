import { ref, onMounted } from 'vue';

export default {
    emits: ['login-success'],
    setup(props, { emit }) {
        const token = ref('');
        const authError = ref('');
        const loading = ref(false);

        const authenticate = async () => {
            loading.value = true;
            authError.value = '';

            try {
                // Adjust this API endpoint if needed
                const res = await fetch('/api/admin/tracks?limit=1', {
                    headers: { 'x-admin-token': token.value }
                });

                if (!res.ok) throw new Error('Invalid token');

                localStorage.setItem('admin_token', token.value);
                
                // CRITICAL: Emit event instead of window.location.href
                emit('login-success', token.value);
            } catch (e) {
                authError.value = 'Authentication failed. Check your token.';
            } finally {
                loading.value = false;
            }
        };

        onMounted(() => {
            // Optional: Auto-submit if the input is pre-filled by browser
            if (token.value) authenticate();
        });

        return {
            token,
            authError,
            loading,
            authenticate
        };
    },
    template: `
        <div class="max-w-md mx-auto mt-10">
            <div class="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h2 class="font-bold mb-4">🔐 Authentication</h2>
                <div class="mb-4">
                    <label class="block text-xs uppercase text-gray-500 mb-1">Admin Token</label>
                    <input 
                        v-model="token" 
                        type="password" 
                        @keyup.enter="authenticate"
                        class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                    >
                </div>
                <button 
                    @click="authenticate" 
                    :disabled="loading"
                    class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2 rounded font-bold"
                >
                    {{ loading ? 'Verifying...' : 'Login' }}
                </button>
                <p v-if="authError" class="mt-2 text-red-400 text-sm">{{ authError }}</p>
            </div>
        </div>
    `
};