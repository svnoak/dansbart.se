/**
 * Reject Tab Component (Updated)
 * Features: Pagination, Bulk Selection, Mass Rejection
 */

import { ref, watch, computed } from 'vue';
import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useToast } from '../../shared/composables/useToast.js';
import { useRejectApi } from './api.js';
import RejectionModal from './RejectionModal.js';

export default {
    components: { RejectionModal },
    setup() {
        const { adminToken } = useAdminAuth();
        const { showToast } = useToast();
        const rejectApi = useRejectApi(adminToken);

        // State
        const rejectView = ref('artists'); 
        const pendingArtists = ref([]);
        const pendingAlbums = ref([]);
        const blocklist = ref([]);
        const rejectMessage = ref('');
        const rejectError = ref(false);
        const loading = ref(false);

        // Pagination State
        const limit = ref(50);
        const offset = ref(0);
        const totalItems = ref(0);

        // Search State
        const searchQuery = ref('');

        // Bulk Selection State
        const selectedIds = ref(new Set());

        // Rejection Modal (kept same as your code)
        const rejectionModal = ref({
            show: false,
            artistId: null,
            artistName: '',
            pendingTracks: 0,
            analyzedTracks: 0,
            isIsolated: true,
            sharedWith: [],
            sharedTracks: 0,
            confirming: false
        });

        const loadData = async () => {
            loading.value = true;
            selectedIds.value.clear(); // Clear selection on page load
            try {
                let data;
                if (rejectView.value === 'artists') {
                    data = await rejectApi.loadPendingArtists(limit.value, offset.value, searchQuery.value);
                    pendingArtists.value = data.items;
                } else if (rejectView.value === 'albums') {
                    data = await rejectApi.loadPendingAlbums(limit.value, offset.value);
                    pendingAlbums.value = data.items;
                } else {
                    data = await rejectApi.loadBlocklist('', limit.value, offset.value);
                    blocklist.value = data.items;
                }
                totalItems.value = data.total;
                rejectMessage.value = '';
            } catch (e) {
                console.error(e);
                rejectMessage.value = 'Failed to load data';
            } finally {
                loading.value = false;
            }
        };

        // Pagination Methods
        const nextPage = () => {
            if (offset.value + limit.value < totalItems.value) {
                offset.value += limit.value;
                loadData();
            }
        };

        const prevPage = () => {
            if (offset.value > 0) {
                offset.value = Math.max(0, offset.value - limit.value);
                loadData();
            }
        };

        // Bulk Selection Methods
        const toggleSelection = (id) => {
            if (selectedIds.value.has(id)) {
                selectedIds.value.delete(id);
            } else {
                selectedIds.value.add(id);
            }
        };

        const toggleSelectAll = () => {
            const list = rejectView.value === 'artists' ? pendingArtists.value : pendingAlbums.value;
            if (selectedIds.value.size === list.length) {
                selectedIds.value.clear();
            } else {
                list.forEach(item => selectedIds.value.add(item.id));
            }
        };

        const isAllSelected = computed(() => {
            const list = rejectView.value === 'artists' ? pendingArtists.value : pendingAlbums.value;
            return list.length > 0 && selectedIds.value.size === list.length;
        });

        // Bulk Action
        const rejectSelected = async () => {
            const count = selectedIds.value.size;
            if (count === 0) return;

            if (!confirm(`Are you sure you want to reject and blocklist ${count} items? This cannot be undone.`)) {
                return;
            }

            loading.value = true;
            try {
                const ids = Array.from(selectedIds.value);
                
                // You need to add this method to your api.js
                await fetch('/api/admin/artists/bulk-reject', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-admin-token': adminToken.value 
                    },
                    body: JSON.stringify({ ids: ids, reason: 'Bulk rejection' })
                });

                showToast(`Rejected ${count} items`, 'success');
                loadData();
            } catch (e) {
                showToast('Bulk rejection failed', 'error');
                console.error(e);
            } finally {
                loading.value = false;
            }
        };

        // Single Rejection (Your existing logic)
        const rejectArtist = async (artistId) => {
            // ... your existing code ...
            // (Just ensure you call loadData() instead of loadPendingArtists() at the end)
        };

        // Search functionality
        const handleSearch = () => {
            offset.value = 0; // Reset to first page when searching
            loadData();
        };

        // Watch for view changes
        watch(rejectView, () => {
            offset.value = 0;
            searchQuery.value = ''; // Clear search when switching views
            loadData();
        });

        // Initial Load
        loadData();

        return {
            rejectView, pendingArtists, pendingAlbums, blocklist,
            rejectMessage, rejectError, rejectionModal, loading,
            // Pagination
            limit, offset, totalItems, nextPage, prevPage,
            // Search
            searchQuery, handleSearch,
            // Bulk
            selectedIds, toggleSelection, toggleSelectAll, isAllSelected, rejectSelected,
            // Actions
            loadData, rejectArtist
        };
    },
    template: /*html*/`
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700">
            <div class="flex justify-between items-center mb-6">
                <h2 class="font-bold text-xl">🗑️ Review & Reject</h2>
                
                <div v-if="selectedIds.size > 0" class="flex items-center gap-4 bg-red-900/30 border border-red-500/30 px-4 py-2 rounded animate-fade-in">
                    <span class="text-sm font-bold text-red-200">{{ selectedIds.size }} selected</span>
                    <button @click="rejectSelected" :disabled="loading"
                            class="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm font-bold shadow-sm">
                        🗑️ Reject All Selected
                    </button>
                </div>
            </div>

            <div class="flex gap-2 mb-4 border-b border-gray-700 pb-2">
                <button @click="rejectView = 'artists'" :class="rejectView === 'artists' ? 'bg-indigo-600' : 'bg-gray-700'" class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    👤 Artists
                </button>
                <button @click="rejectView = 'albums'" :class="rejectView === 'albums' ? 'bg-indigo-600' : 'bg-gray-700'" class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    💿 Albums
                </button>
                <button @click="rejectView = 'blocklist'" :class="rejectView === 'blocklist' ? 'bg-indigo-600' : 'bg-gray-700'" class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    🚫 Blocklist
                </button>
            </div>

            <div v-if="rejectView === 'artists'">

                <!-- Search Bar -->
                <div class="mb-4 flex gap-2">
                    <input
                        v-model="searchQuery"
                        @keyup.enter="handleSearch"
                        type="text"
                        placeholder="Search artists by name..."
                        class="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    >
                    <button
                        @click="handleSearch"
                        class="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded text-sm font-medium"
                    >
                        🔍 Search
                    </button>
                    <button
                        v-if="searchQuery"
                        @click="searchQuery = ''; handleSearch()"
                        class="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm"
                    >
                        ✕ Clear
                    </button>
                </div>

                <div v-if="pendingArtists.length > 0" class="flex items-center gap-3 p-2 bg-gray-900/50 border-b border-gray-700 mb-2">
                    <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" class="w-4 h-4 rounded border-gray-600 bg-gray-700">
                    <span class="text-xs text-gray-500 uppercase font-bold">Select All (Page)</span>
                </div>

                <div v-if="pendingArtists.length === 0 && !loading" class="text-center py-8 text-gray-500">
                    <div class="text-4xl mb-2">🎉</div>
                    <p>{{ searchQuery ? 'No artists found matching your search' : 'No pending artists to review' }}</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="artist in pendingArtists" :key="artist.id"
                         class="p-3 bg-gray-900 rounded border border-gray-700 flex items-center gap-3 hover:border-gray-500 transition-colors">

                        <input type="checkbox"
                               :checked="selectedIds.has(artist.id)"
                               @change="toggleSelection(artist.id)"
                               class="w-5 h-5 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500">

                        <img v-if="artist.image_url" :src="artist.image_url" class="w-10 h-10 rounded object-cover opacity-80">
                        <div v-else class="w-10 h-10 bg-gray-800 rounded flex items-center justify-center text-lg">👤</div>

                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-sm truncate">{{ artist.name }}</div>
                            <div class="text-xs text-gray-400">
                                {{ artist.pending_tracks }} pending
                            </div>
                        </div>

                        <button @click="rejectArtist(artist.id)" class="text-gray-500 hover:text-red-400 p-2" title="Reject individual">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>

            <!-- Albums View -->
            <div v-if="rejectView === 'albums'">
                <div v-if="pendingAlbums.length === 0 && !loading" class="text-center py-8 text-gray-500">
                    <div class="text-4xl mb-2">🎉</div>
                    <p>No pending albums to review</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="album in pendingAlbums" :key="album.id"
                         class="p-3 bg-gray-900 rounded border border-gray-700 flex items-center gap-3">

                        <img v-if="album.cover_image_url" :src="album.cover_image_url" class="w-10 h-10 rounded object-cover">
                        <div v-else class="w-10 h-10 bg-gray-800 rounded flex items-center justify-center text-lg">💿</div>

                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-sm truncate">{{ album.title }}</div>
                            <div class="text-xs text-gray-400">
                                {{ album.artist_name }} • {{ album.pending_tracks }} pending
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Blocklist View -->
            <div v-if="rejectView === 'blocklist'">
                <div v-if="blocklist.length === 0 && !loading" class="text-center py-8 text-gray-500">
                    <p>No items in blocklist</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="item in blocklist" :key="item.id"
                         class="p-3 bg-gray-900 rounded border border-gray-700">

                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <div class="font-bold text-sm">{{ item.entity_name }}</div>
                                <div class="text-xs text-gray-400 mt-1">
                                    Type: {{ item.entity_type }} • Reason: {{ item.reason }}
                                </div>
                                <div class="text-xs text-gray-500 mt-1">
                                    Blocked: {{ new Date(item.rejected_at).toLocaleDateString() }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
                <div class="text-sm text-gray-400">
                    Showing {{ offset + 1 }}-{{ Math.min(offset + limit, totalItems) }} of {{ totalItems }}
                </div>
                <div class="flex gap-2">
                    <button @click="prevPage" :disabled="offset === 0" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 text-sm">
                        Previous
                    </button>
                    <button @click="nextPage" :disabled="offset + limit >= totalItems" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 text-sm">
                        Next
                    </button>
                </div>
            </div>
        </div>
    `
};