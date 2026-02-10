/**
 * Bulk Operations Tab Component
 * Interface for bulk operations on tracks
 */

import { ref } from 'vue';
import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { showToast } from '../../../js/hooks/useToast';
import { useBulkApi } from './api.js';

export default {
  setup() {
    const { adminToken } = useAdminAuth();
    const bulkApi = useBulkApi(adminToken);

    // State
    const bulkLoading = ref(false);
    const reanalyzeLoading = ref(false);
    const isrcLoading = ref(false);
    const isrcStats = ref(null);
    const bulkMessage = ref('');
    const bulkError = ref(false);

    // 1. Reclassify Logic
    const reclassifyAll = async () => {
      bulkLoading.value = true;
      bulkMessage.value = '';
      try {
        const data = await bulkApi.reclassifyAll();
        bulkError.value = false;
        const msg = String(data?.message ?? 'Done');
        bulkMessage.value = msg;
        showToast(msg);
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

        const msg = String(data?.message ?? 'Queued');
        showToast(msg);
        bulkMessage.value = `Queued ${data?.queued ?? 0} tracks for analysis.`;
        bulkError.value = false;
      } catch (e) {
        showToast(e.message, 'error');
        bulkMessage.value = e.message;
        bulkError.value = true;
      } finally {
        reanalyzeLoading.value = false;
      }
    };

    // 3. ISRC Backfill Logic
    const loadIsrcStats = async () => {
      try {
        const data = await bulkApi.getIsrcStats();
        isrcStats.value = data;
      } catch (e) {
        console.error('Failed to load ISRC stats:', e);
      }
    };

    const backfillIsrcs = async () => {
      if (!confirm('Backfill ISRCs from Spotify for all tracks with missing or fallback ISRCs?\n\nThis will fetch track details from Spotify API.')) {
        return;
      }

      isrcLoading.value = true;
      bulkMessage.value = '';

      try {
        const data = await bulkApi.backfillIsrcs();
        const msg = String(data?.message ?? 'Done');
        showToast(msg);
        bulkMessage.value = `Updated ${data?.isrcs_updated ?? 0} ISRCs (${data?.total_processed ?? 0} tracks processed)`;
        bulkError.value = false;

        // Reload stats after backfill
        await loadIsrcStats();
      } catch (e) {
        showToast(e.message, 'error');
        bulkMessage.value = e.message;
        bulkError.value = true;
      } finally {
        isrcLoading.value = false;
      }
    };

    // Load ISRC stats on mount
    loadIsrcStats();

    return {
      bulkLoading,
      reanalyzeLoading,
      isrcLoading,
      isrcStats,
      bulkMessage,
      bulkError,
      reclassifyAll,
      runBulkReanalysis,
      backfillIsrcs,
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

                <div class="p-4 bg-gray-900 rounded border border-blue-900/30">
                    <h3 class="font-medium mb-2 text-blue-400">🔖 Backfill ISRCs</h3>
                    <p class="text-sm text-gray-400 mb-3">
                        Fetch ISRCs from Spotify for tracks with missing or fallback ISRCs.
                        Improves data export quality.
                    </p>
                    <div v-if="isrcStats" class="text-xs text-gray-500 mb-3 space-y-1">
                        <div>📊 Real ISRCs: {{ isrcStats.tracks_with_real_isrc }}</div>
                        <div>⚠️ Fallback ISRCs: {{ isrcStats.tracks_with_fallback_isrc }}</div>
                        <div>❌ Missing ISRCs: {{ isrcStats.tracks_without_isrc }}</div>
                        <div class="font-medium text-yellow-400">🔄 Need backfill: {{ isrcStats.tracks_needing_backfill }}</div>
                    </div>
                    <button @click="backfillIsrcs" :disabled="isrcLoading || bulkLoading || reanalyzeLoading || (isrcStats && isrcStats.tracks_needing_backfill === 0)"
                            class="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded font-medium transition-colors">
                        {{ isrcLoading ? 'Backfilling...' : 'Backfill ISRCs' }}
                    </button>
                </div>

                <div class="p-4 bg-gray-900 rounded border border-red-900/30">
                    <h3 class="font-medium mb-2 text-red-400">⚠️ Re-analyze Audio</h3>
                    <p class="text-sm text-gray-400 mb-3">
                        Resets ALL tracks to 'PENDING' and re-downloads audio.
                        <b>Warning:</b> Very CPU & Network intensive.
                    </p>
                    <button @click="runBulkReanalysis" :disabled="reanalyzeLoading || bulkLoading || isrcLoading"
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
