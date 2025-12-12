/**
 * Bulk Operations Tab Component
 * Interface for bulk operations on tracks
 */

import { ref } from 'vue';
import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useToast } from '../../shared/composables/useToast.js';
import { useBulkApi } from './api.js';

export default {
    setup() {
        const { adminToken } = useAdminAuth();
        const { showToast } = useToast();
        const bulkApi = useBulkApi(adminToken);

        // State
        const bulkLoading = ref(false);
        const bulkMessage = ref('');
        const bulkError = ref(false);

        // Methods
        const reclassifyAll = async () => {
            bulkLoading.value = true;
            bulkMessage.value = '';

            try {
                const data = await bulkApi.reclassifyAll();
                bulkError.value = false;
                bulkMessage.value = data.message;
                showToast(data.message);

                // Emit event for tracks tab to refresh
                window.dispatchEvent(new CustomEvent('admin:tracks-reclassified'));
            } catch (e) {
                bulkError.value = true;
                bulkMessage.value = e.message;
                showToast(e.message, 'error');
            } finally {
                bulkLoading.value = false;
            }
        };

        return {
            bulkLoading, bulkMessage, bulkError,
            reclassifyAll
        };
    },
    template: /*html*/`
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700 max-w-md">
            <h2 class="font-bold mb-4">⚡ Bulk Actions</h2>

            <div class="space-y-4">
                <div class="p-4 bg-gray-900 rounded border border-gray-700">
                    <h3 class="font-medium mb-2">🏷️ Reclassify All Tracks</h3>
                    <p class="text-sm text-gray-400 mb-3">
                        Re-runs classification logic on all analyzed tracks.
                        Useful after updating the classifier.
                    </p>
                    <button @click="reclassifyAll" :disabled="bulkLoading"
                            class="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2 rounded font-medium">
                        {{ bulkLoading ? 'Running...' : 'Reclassify Library' }}
                    </button>
                </div>
            </div>

            <p v-if="bulkMessage" class="mt-4 text-sm" :class="bulkError ? 'text-red-400' : 'text-green-400'">
                {{ bulkMessage }}
            </p>
        </div>
    `
};
