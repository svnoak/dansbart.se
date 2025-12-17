/**
 * Bulk Operations Tab Component
 * Interface for bulk operations on tracks
 */

import { ref } from 'vue';
import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { showToast } from '../../../js/hooks/useToast.js';
import { useBulkApi } from './api.js';

export default {
  setup() {
    const { adminToken } = useAdminAuth();
    const bulkApi = useBulkApi(adminToken);

    // State
    const bulkLoading = ref(false);
    const reanalyzeLoading = ref(false);
    const bulkMessage = ref('');
    const bulkError = ref(false);

    // 1. Reclassify Logic
    const reclassifyAll = async () => {
      bulkLoading.value = true;
      bulkMessage.value = '';
      try {
        const data = await bulkApi.reclassifyAll();
        bulkError.value = false;
        bulkMessage.value = data.message;
        showToast(data.message);
        window.dispatchEvent(new CustomEvent('admin:tracks-reclassified'));
      } catch (e) {
        bulkError.value = true;
        bulkMessage.value = e.message;
        showToast(e.message, 'error');
      } finally {
        bulkLoading.value = false;
      }
    };

    // 2. Re-analyze Logic (Using the new API method)
    const runBulkReanalysis = async () => {
      if (
        !confirm(
          '⚠️ Warning: This will reset all tracks to PENDING and re-download/analyze audio.\n\nThis is a heavy CPU/Network operation. Are you sure?'
        )
      )
        return;

      reanalyzeLoading.value = true;
      bulkMessage.value = '';

      try {
        // Call the new API function
        const data = await bulkApi.bulkReanalyze('everything', 5000);

        showToast(data.message);
        bulkMessage.value = `Queued ${data.queued} tracks for analysis.`;
        bulkError.value = false;
      } catch (e) {
        showToast(e.message, 'error');
        bulkMessage.value = e.message;
        bulkError.value = true;
      } finally {
        reanalyzeLoading.value = false;
      }
    };

    return {
      bulkLoading,
      reanalyzeLoading,
      bulkMessage,
      bulkError,
      reclassifyAll,
      runBulkReanalysis,
    };
  },
  template: /*html*/ `
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700 max-w-md">
            <h2 class="font-bold mb-4">⚡ Bulk Actions</h2>

            <div class="space-y-6">
                <div class="p-4 bg-gray-900 rounded border border-gray-700">
                    <h3 class="font-medium mb-2">🏷️ Reclassify All Tracks</h3>
                    <p class="text-sm text-gray-400 mb-3">
                        Re-runs classification logic on existing analysis data.
                        Fast & safe. Use after updating heuristics.
                    </p>
                    <button @click="reclassifyAll" :disabled="bulkLoading || reanalyzeLoading"
                            class="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2 rounded font-medium transition-colors">
                        {{ bulkLoading ? 'Running...' : 'Reclassify Library' }}
                    </button>
                </div>

                <div class="p-4 bg-gray-900 rounded border border-red-900/30">
                    <h3 class="font-medium mb-2 text-red-400">⚠️ Re-analyze Audio</h3>
                    <p class="text-sm text-gray-400 mb-3">
                        Resets ALL tracks to 'PENDING' and re-downloads audio.
                        <b>Warning:</b> Very CPU & Network intensive.
                    </p>
                    <button @click="runBulkReanalysis" :disabled="reanalyzeLoading || bulkLoading"
                            class="bg-red-900/50 hover:bg-red-800 border border-red-700/50 text-red-200 disabled:opacity-50 px-4 py-2 rounded font-medium transition-colors">
                        {{ reanalyzeLoading ? 'Queueing...' : 'Reset & Re-analyze Library' }}
                    </button>
                </div>
            </div>

            <p v-if="bulkMessage" class="mt-4 text-sm font-mono bg-black/30 p-2 rounded" 
               :class="bulkError ? 'text-red-400' : 'text-green-400'">
                > {{ bulkMessage }}
            </p>
        </div>
    `,
};
