/**
 * Quick Review Tab (formerly Approvals)
 * Shows isolated pending artists for quick bulk rejection
 */

import { ref, onMounted, computed } from 'vue';
import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useToast } from '../../shared/composables/useToast.js';
import { useApprovalsApi } from './api.js';
import { showError } from '../../../js/hooks/useToast.js';

export default {
  setup() {
    const { adminToken } = useAdminAuth();
    const { showToast } = useToast();
    const api = useApprovalsApi(adminToken);

    // State
    const view = ref('isolated'); // isolated or blocklist
    const artists = ref([]);
    const blocklist = ref([]);
    const totalArtists = ref(0);
    const totalBlocklist = ref(0);
    const searchQuery = ref('');
    const limit = ref(50);
    const offset = ref(0);
    const loading = ref(false);
    const selectedIds = ref(new Set());

    // Computed
    const isolatedArtists = computed(() => {
      return artists.value.filter(a => a.is_isolated);
    });

    const nonIsolatedArtists = computed(() => {
      return artists.value.filter(a => !a.is_isolated);
    });

    const isAllIsolatedSelected = computed(() => {
      const isolated = isolatedArtists.value;
      if (isolated.length === 0) return false;
      return isolated.every(a => selectedIds.value.has(a.id));
    });

    const pageNumber = computed(() => Math.floor(offset.value / limit.value) + 1);
    const totalPages = computed(() => Math.ceil(totalArtists.value / limit.value));

    // Methods
    const loadData = async () => {
      loading.value = true;
      selectedIds.value.clear();

      try {
        if (view.value === 'isolated') {
          const data = await api.loadIsolatedArtists(limit.value, offset.value, searchQuery.value);
          artists.value = data.items;
          totalArtists.value = data.total;
        } else {
          const data = await api.loadBlocklist('artist', limit.value, offset.value);
          blocklist.value = data.items;
          totalBlocklist.value = data.total;
        }
      } catch (e) {
        showError(e.message || 'Failed to load data');
      } finally {
        loading.value = false;
      }
    };

    let searchTimeout;
    const debouncedSearch = () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        offset.value = 0;
        loadData();
      }, 300);
    };

    const prevPage = () => {
      offset.value = Math.max(0, offset.value - limit.value);
      loadData();
    };

    const nextPage = () => {
      offset.value += limit.value;
      loadData();
    };

    // Selection
    const toggleSelection = id => {
      if (selectedIds.value.has(id)) {
        selectedIds.value.delete(id);
      } else {
        selectedIds.value.add(id);
      }
    };

    const selectAllIsolated = () => {
      if (isAllIsolatedSelected.value) {
        // Deselect all isolated
        isolatedArtists.value.forEach(a => selectedIds.value.delete(a.id));
      } else {
        // Select all isolated
        isolatedArtists.value.forEach(a => selectedIds.value.add(a.id));
      }
    };

    // Actions
    const approveArtist = async artist => {
      const confirmMsg = `Approve artist "${artist.name}"?\n\n• ${artist.pending_tracks} pending tracks will be queued for analysis`;

      if (!confirm(confirmMsg)) return;

      try {
        const data = await api.approveArtist(artist.id);
        showToast(data.message);
        loadData();
      } catch (e) {
        showError(e.message || 'Failed to approve artist');
      }
    };

    const rejectArtist = async artist => {
      const confirmMsg = `Reject and delete artist "${artist.name}"?\n\n• ${artist.total_tracks || artist.pending_tracks} tracks will be deleted\n• Artist will be added to blocklist`;

      if (!confirm(confirmMsg)) return;

      try {
        const data = await api.rejectArtist(artist.id, 'Rejected from quick review');
        showToast(data.message);
        loadData();
      } catch (e) {
        showToast(e.message || 'Failed to reject artist');
      }
    };

    const restoreFromBlocklist = async item => {
      if (
        !confirm(
          `Remove "${item.entity_name}" from blocklist?\n\nThis will allow them to be re-ingested if discovered again.`
        )
      ) {
        return;
      }

      try {
        const data = await api.removeFromBlocklist(item.id);
        showToast(data.message);
        loadData();
      } catch (e) {
        showToast(e.message || 'Failed to remove from blocklist');
      }
    };

    const bulkApprove = async () => {
      const count = selectedIds.value.size;
      if (count === 0) return;

      if (
        !confirm(
          `✅ Approve ${count} artists?\n\nThis will:\n• Queue all their pending tracks for analysis\n• They will be processed by the analysis system\n\nContinue?`
        )
      ) {
        return;
      }

      loading.value = true;
      try {
        const ids = Array.from(selectedIds.value);
        await api.bulkApproveArtists(ids);
        showToast(`Approved ${count} artists`, 'success');
        selectedIds.value.clear();
        loadData();
      } catch (e) {
        showError(e.message || 'Bulk approval failed');
      } finally {
        loading.value = false;
      }
    };

    const bulkReject = async () => {
      const count = selectedIds.value.size;
      if (count === 0) return;

      if (
        !confirm(
          `⚠️ Reject and delete ${count} artists?\n\nThis will:\n• Delete all their tracks\n• Add them to the blocklist\n• This cannot be undone\n\nContinue?`
        )
      ) {
        return;
      }

      loading.value = true;
      try {
        const ids = Array.from(selectedIds.value);
        await api.bulkRejectArtists(ids, 'Bulk rejection from quick review');
        showToast(`Rejected ${count} artists`, 'success');
        selectedIds.value.clear();
        loadData();
      } catch (e) {
        showError(e.message || 'Bulk rejection failed');
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      loadData();
    });

    return {
      view,
      artists,
      blocklist,
      isolatedArtists,
      nonIsolatedArtists,
      totalArtists,
      totalBlocklist,
      searchQuery,
      limit,
      offset,
      loading,
      selectedIds,
      isAllIsolatedSelected,
      pageNumber,
      totalPages,
      loadData,
      debouncedSearch,
      prevPage,
      nextPage,
      toggleSelection,
      selectAllIsolated,
      approveArtist,
      rejectArtist,
      bulkApprove,
      bulkReject,
      restoreFromBlocklist,
    };
  },
  template: /*html*/ `
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="font-bold text-xl">⚡ Quick Review Queue</h2>
                    <p class="text-sm text-gray-400 mt-1">
                        {{ view === 'isolated' ? 'Isolated artists - safe to bulk delete (no collaborations)' : 'Blocklist - restore artists that were rejected by mistake' }}
                    </p>
                </div>

                <!-- Bulk Actions Banner -->
                <div v-if="selectedIds.size > 0 && view === 'isolated'" class="flex items-center gap-3 bg-indigo-900/30 border border-indigo-500/30 px-4 py-2 rounded animate-fade-in">
                    <span class="text-sm font-bold text-indigo-200">{{ selectedIds.size }} selected</span>
                    <button @click="bulkApprove" :disabled="loading"
                            class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm font-bold shadow-sm">
                        ✅ Approve All
                    </button>
                    <button @click="bulkReject" :disabled="loading"
                            class="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm font-bold shadow-sm">
                        🗑️ Reject All
                    </button>
                </div>
            </div>

            <!-- View Toggle -->
            <div class="flex gap-2 mb-4">
                <button @click="view = 'isolated'; loadData();"
                        :class="view === 'isolated' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-4 py-2 rounded text-sm font-medium transition-colors">
                    ✅ Isolated Artists
                </button>
                <button @click="view = 'blocklist'; loadData();"
                        :class="view === 'blocklist' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-4 py-2 rounded text-sm font-medium transition-colors">
                    🚫 Blocklist
                </button>
            </div>

            <!-- Search (only for isolated view) -->
            <div v-if="view === 'isolated'" class="flex gap-2 mb-4">
                <input v-model="searchQuery" @input="debouncedSearch"
                       placeholder="Search artists..."
                       class="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                <button @click="loadData" class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm">
                    🔄 Refresh
                </button>
            </div>

            <!-- Refresh for blocklist view -->
            <div v-if="view === 'blocklist'" class="flex gap-2 mb-4">
                <button @click="loadData" class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm">
                    🔄 Refresh
                </button>
            </div>

            <!-- Stats - Isolated View -->
            <div v-if="view === 'isolated'" class="flex gap-4 mb-4 text-sm">
                <span class="text-green-400">✅ {{ isolatedArtists.length }} Isolated</span>
                <span class="text-amber-400" v-if="nonIsolatedArtists.length > 0">🤝 {{ nonIsolatedArtists.length }} With Collaborations</span>
                <span class="text-gray-400">Total: {{ totalArtists }}</span>
            </div>

            <!-- Stats - Blocklist View -->
            <div v-if="view === 'blocklist'" class="flex gap-4 mb-4 text-sm">
                <span class="text-red-400">🚫 {{ totalBlocklist }} blocked artists</span>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="text-center py-8 text-gray-500">
                <div class="text-2xl mb-2">⏳</div>
                <p>Loading...</p>
            </div>

            <!-- Empty State - Isolated View -->
            <div v-else-if="view === 'isolated' && artists.length === 0" class="text-center py-8 text-gray-500">
                <div class="text-4xl mb-2">🎉</div>
                <p>{{ searchQuery ? 'No artists found matching your search' : 'No artists to review' }}</p>
            </div>

            <!-- Empty State - Blocklist View -->
            <div v-else-if="view === 'blocklist' && blocklist.length === 0" class="text-center py-8 text-gray-500">
                <div class="text-4xl mb-2">✅</div>
                <p>No artists in blocklist</p>
            </div>

            <!-- Artists List - Isolated View -->
            <div v-else-if="view === 'isolated'">
                <!-- Isolated Artists Section -->
                <div v-if="isolatedArtists.length > 0" class="mb-6">
                    <div class="flex items-center gap-3 p-2 bg-green-900/20 border border-green-700/30 rounded-t mb-2">
                        <input type="checkbox" :checked="isAllIsolatedSelected" @change="selectAllIsolated"
                               class="w-4 h-4 rounded border-gray-600 bg-gray-700">
                        <span class="text-xs text-green-400 uppercase font-bold">✅ Select All Isolated ({{ isolatedArtists.length }})</span>
                        <span class="text-xs text-gray-500">Safe to bulk delete - no collaborations</span>
                    </div>

                    <div class="space-y-2">
                        <div v-for="artist in isolatedArtists" :key="artist.id"
                             class="p-3 bg-gray-900 rounded border border-green-700/30 flex items-center gap-3 hover:bg-gray-800/50">

                            <input type="checkbox"
                                   :checked="selectedIds.has(artist.id)"
                                   @change="toggleSelection(artist.id)"
                                   class="w-5 h-5 rounded border-gray-600 bg-gray-800 text-green-600 focus:ring-green-500">

                            <img v-if="artist.image_url" :src="artist.image_url" class="w-10 h-10 rounded object-cover">
                            <div v-else class="w-10 h-10 bg-gray-800 rounded flex items-center justify-center text-lg">👤</div>

                            <div class="flex-1 min-w-0">
                                <div class="font-bold text-sm truncate">{{ artist.name }}</div>
                                <div class="text-xs text-gray-400">
                                    {{ artist.total_tracks || artist.pending_tracks }} tracks
                                    <span v-if="artist.pending_tracks" class="text-yellow-400">({{ artist.pending_tracks }} pending)</span>
                                </div>
                                <span class="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded inline-block mt-1">
                                    ✅ Isolated - Safe to approve or delete
                                </span>
                            </div>

                            <button @click="approveArtist(artist)"
                                    class="bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm"
                                    title="Approve artist - queue tracks for analysis">
                                ✅
                            </button>
                            <button @click="rejectArtist(artist)"
                                    class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded text-sm"
                                    title="Reject artist">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Non-Isolated Artists Section -->
                <div v-if="nonIsolatedArtists.length > 0">
                    <div class="p-2 bg-amber-900/20 border border-amber-700/30 rounded-t mb-2">
                        <span class="text-xs text-amber-400 uppercase font-bold">⚠️ Artists With Collaborations ({{ nonIsolatedArtists.length }})</span>
                        <span class="text-xs text-gray-500 ml-2">Review carefully - may affect other artists</span>
                    </div>

                    <div class="space-y-2">
                        <div v-for="artist in nonIsolatedArtists" :key="artist.id"
                             class="p-3 bg-gray-900 rounded border border-amber-700/30 flex items-center gap-3">

                            <img v-if="artist.image_url" :src="artist.image_url" class="w-10 h-10 rounded object-cover">
                            <div v-else class="w-10 h-10 bg-gray-800 rounded flex items-center justify-center text-lg">👤</div>

                            <div class="flex-1 min-w-0">
                                <div class="font-bold text-sm truncate">{{ artist.name }}</div>
                                <div class="text-xs text-gray-400">
                                    {{ artist.total_tracks || artist.pending_tracks }} tracks
                                    <span v-if="artist.pending_tracks" class="text-yellow-400">({{ artist.pending_tracks }} pending)</span>
                                </div>
                                <div class="flex gap-2 mt-1">
                                    <span class="text-xs bg-amber-600/20 text-amber-400 px-2 py-0.5 rounded">
                                        🤝 {{ artist.shared_tracks }} collaborations
                                    </span>
                                </div>
                                <div v-if="artist.shared_with_artists && artist.shared_with_artists.length > 0" class="text-xs text-gray-500 mt-1">
                                    With: {{ artist.shared_with_artists.slice(0, 3).join(', ') }}{{ artist.shared_with_artists.length > 3 ? '...' : '' }}
                                </div>
                            </div>

                            <button @click="approveArtist(artist)"
                                    class="bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm"
                                    title="Approve artist - queue tracks for analysis">
                                ✅
                            </button>
                            <button @click="rejectArtist(artist)"
                                    class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded text-sm"
                                    title="Reject artist">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Blocklist View -->
            <div v-else-if="view === 'blocklist' && blocklist.length > 0">
                <div class="space-y-2">
                    <div v-for="item in blocklist" :key="item.id"
                         class="p-3 bg-gray-900 rounded border border-red-700/30 flex items-center gap-3">

                        <div class="w-10 h-10 bg-gray-800 rounded flex items-center justify-center text-lg">🚫</div>

                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-sm truncate">{{ item.entity_name }}</div>
                            <div class="text-xs text-gray-400">
                                Blocked on {{ new Date(item.created_at).toLocaleDateString() }}
                            </div>
                            <div v-if="item.reason" class="text-xs text-gray-500 mt-1">
                                Reason: {{ item.reason }}
                            </div>
                        </div>

                        <button @click="restoreFromBlocklist(item)"
                                class="bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm"
                                title="Restore from blocklist">
                            ✅ Restore
                        </button>
                    </div>
                </div>
            </div>

            <!-- Pagination -->
            <div v-if="(view === 'isolated' && totalArtists > limit) || (view === 'blocklist' && totalBlocklist > limit)" class="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
                <button @click="prevPage" :disabled="offset === 0 || loading"
                        class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm">
                    ← Previous
                </button>
                <span class="text-gray-400 text-sm">
                    Page {{ pageNumber }} of {{ view === 'isolated' ? totalPages : Math.ceil(totalBlocklist / limit) || 1 }}
                </span>
                <button @click="nextPage" :disabled="(view === 'isolated' && offset + limit >= totalArtists) || (view === 'blocklist' && offset + limit >= totalBlocklist) || loading"
                        class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm">
                    Next →
                </button>
            </div>
        </div>
    `,
};
