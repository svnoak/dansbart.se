/**
 * Reject Tab Component
 * Interface for reviewing and rejecting pending artists/albums and managing blocklist
 */

import { ref, watch } from 'vue';
import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useToast } from '../../shared/composables/useToast.js';
import { useRejectApi } from './api.js';
import RejectionModal from './RejectionModal.js';

export default {
    components: {
        RejectionModal
    },
    setup() {
        const { adminToken } = useAdminAuth();
        const { showToast } = useToast();
        const rejectApi = useRejectApi(adminToken);

        // State
        const rejectView = ref('artists'); // 'artists', 'albums', 'blocklist'
        const pendingArtists = ref([]);
        const pendingAlbums = ref([]);
        const blocklist = ref([]);
        const blocklistFilter = ref('');
        const rejectMessage = ref('');
        const rejectError = ref(false);

        // Rejection Modal State
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

        // Methods
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        };

        const loadPendingArtists = async () => {
            try {
                const data = await rejectApi.loadPendingArtists();
                pendingArtists.value = data.items;
                rejectMessage.value = '';
            } catch (e) {
                console.error('Failed to load pending artists:', e);
                rejectMessage.value = 'Failed to load pending artists';
                rejectError.value = true;
            }
        };

        const loadPendingAlbums = async () => {
            try {
                const data = await rejectApi.loadPendingAlbums();
                pendingAlbums.value = data.items;
                rejectMessage.value = '';
            } catch (e) {
                console.error('Failed to load pending albums:', e);
                rejectMessage.value = 'Failed to load pending albums';
                rejectError.value = true;
            }
        };

        const loadBlocklist = async () => {
            try {
                const data = await rejectApi.loadBlocklist(blocklistFilter.value);
                blocklist.value = data.items;
                rejectMessage.value = '';
            } catch (e) {
                console.error('Failed to load blocklist:', e);
                rejectMessage.value = 'Failed to load blocklist';
                rejectError.value = true;
            }
        };

        const rejectArtist = async (artistId) => {
            try {
                // First check isolation status (dry run)
                const dryRunData = await rejectApi.rejectArtistPreview(artistId);

                // Handle both possible response structures
                const preview = dryRunData.preview || dryRunData;
                const isolation = preview.isolation_info || {};

                // Show modal with rejection details
                rejectionModal.value = {
                    show: true,
                    artistId: artistId,
                    artistName: preview.artist_name || 'Unknown Artist',
                    pendingTracks: preview.would_delete_pending_tracks || 0,
                    analyzedTracks: preview.would_keep_analyzed_tracks || 0,
                    isIsolated: isolation.is_isolated !== false,
                    sharedWith: isolation.shared_with_artists || [],
                    sharedTracks: isolation.shared_tracks || 0,
                    confirming: false
                };
            } catch (e) {
                console.error('Failed to check artist isolation:', e);
                rejectMessage.value = `Failed to check artist isolation: ${e.message}`;
                rejectError.value = true;
                showToast(`Failed to check artist isolation: ${e.message}`, 'error');
            }
        };

        const confirmRejection = async () => {
            rejectionModal.value.confirming = true;
            try {
                const data = await rejectApi.confirmRejectArtist(rejectionModal.value.artistId, 'Not relevant');
                rejectMessage.value = data.message;
                rejectError.value = false;
                showToast(data.message, 'success');

                // Close modal
                rejectionModal.value.show = false;

                // Reload the list
                await loadPendingArtists();

                // Emit event
                window.dispatchEvent(new CustomEvent('admin:artist-rejected'));
            } catch (e) {
                console.error('Failed to reject artist:', e);
                rejectMessage.value = 'Failed to reject artist';
                rejectError.value = true;
                showToast('Failed to reject artist', 'error');
            } finally {
                rejectionModal.value.confirming = false;
            }
        };

        const cancelRejection = () => {
            rejectionModal.value.show = false;
        };

        const rejectAlbum = async (albumId) => {
            if (!confirm('Are you sure you want to reject this album? This will delete all pending tracks.')) {
                return;
            }

            try {
                const data = await rejectApi.rejectAlbum(albumId, 'Not relevant');
                rejectMessage.value = data.message;
                rejectError.value = false;
                showToast(data.message, 'success');

                // Reload the list
                await loadPendingAlbums();
            } catch (e) {
                console.error('Failed to reject album:', e);
                rejectMessage.value = 'Failed to reject album';
                rejectError.value = true;
                showToast('Failed to reject album', 'error');
            }
        };

        const removeFromBlocklist = async (rejectionId) => {
            if (!confirm('Remove this item from the blocklist? It can be re-ingested in the future.')) {
                return;
            }

            try {
                const data = await rejectApi.unblock(rejectionId);
                rejectMessage.value = data.message;
                rejectError.value = false;
                showToast(data.message, 'success');

                // Reload the list
                await loadBlocklist();
            } catch (e) {
                console.error('Failed to remove from blocklist:', e);
                rejectMessage.value = 'Failed to remove from blocklist';
                rejectError.value = true;
                showToast('Failed to remove from blocklist', 'error');
            }
        };

        // Watch for view changes to load appropriate data
        watch(rejectView, (newView) => {
            if (newView === 'artists') {
                loadPendingArtists();
            } else if (newView === 'albums') {
                loadPendingAlbums();
            } else if (newView === 'blocklist') {
                loadBlocklist();
            }
        }, { immediate: true });

        return {
            rejectView, pendingArtists, pendingAlbums, blocklist, blocklistFilter,
            rejectMessage, rejectError, rejectionModal,
            loadPendingArtists, loadPendingAlbums, loadBlocklist,
            rejectArtist, confirmRejection, cancelRejection, rejectAlbum, removeFromBlocklist,
            formatDate
        };
    },
    template: /*html*/`
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700">
            <h2 class="font-bold mb-6">🗑️ Review & Reject Pending Items</h2>

            <!-- Sub-tabs for Artists, Albums, and Blocklist -->
            <div class="flex gap-2 mb-4 border-b border-gray-700 pb-2">
                <button @click="rejectView = 'artists'"
                        :class="rejectView === 'artists' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-3 py-1 rounded text-sm font-medium">
                    👤 Pending Artists
                </button>
                <button @click="rejectView = 'albums'"
                        :class="rejectView === 'albums' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-3 py-1 rounded text-sm font-medium">
                    💿 Pending Albums
                </button>
                <button @click="rejectView = 'blocklist'"
                        :class="rejectView === 'blocklist' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-3 py-1 rounded text-sm font-medium">
                    🚫 Rejection Blocklist
                </button>
            </div>

            <!-- Pending Artists View -->
            <div v-if="rejectView === 'artists'">
                <p class="text-sm text-gray-400 mb-4">
                    Artists with pending tracks. Rejecting an artist will delete their pending tracks and blocklist them.
                    Already analyzed tracks will be kept.
                </p>

                <div v-if="pendingArtists.length === 0" class="text-gray-500 text-center py-8">
                    No pending artists found
                </div>

                <div v-else class="space-y-3">
                    <div v-for="artist in pendingArtists" :key="artist.id"
                         class="p-3 sm:p-4 bg-gray-900 rounded border border-gray-700 flex items-center gap-3 sm:gap-4">
                        <img v-if="artist.image_url" :src="artist.image_url"
                             class="w-12 h-12 sm:w-16 sm:h-16 rounded object-cover" :alt="artist.name">
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-sm sm:text-base truncate">{{ artist.name }}</div>
                            <div class="text-xs sm:text-sm text-gray-400">
                                {{ artist.pending_tracks }} pending
                                <span v-if="artist.analyzed_tracks > 0" class="text-yellow-400 block sm:inline">
                                    ({{ artist.analyzed_tracks }} analyzed kept)
                                </span>
                            </div>
                        </div>
                        <button @click="rejectArtist(artist.id)"
                                class="px-2 sm:px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs sm:text-sm whitespace-nowrap">
                            🗑️ <span class="hidden sm:inline">Reject</span>
                        </button>
                    </div>
                </div>

                <div v-if="pendingArtists.length > 0" class="mt-4 text-center">
                    <button @click="loadPendingArtists"
                            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Pending Albums View -->
            <div v-if="rejectView === 'albums'">
                <p class="text-sm text-gray-400 mb-4">
                    Albums with pending tracks. Rejecting an album will delete its pending tracks.
                </p>

                <div v-if="pendingAlbums.length === 0" class="text-gray-500 text-center py-8">
                    No pending albums found
                </div>

                <div v-else class="space-y-3">
                    <div v-for="album in pendingAlbums" :key="album.id"
                         class="p-3 sm:p-4 bg-gray-900 rounded border border-gray-700 flex items-center gap-3 sm:gap-4">
                        <img v-if="album.cover_image_url" :src="album.cover_image_url"
                             class="w-12 h-12 sm:w-16 sm:h-16 rounded object-cover" :alt="album.title">
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-sm sm:text-base truncate">{{ album.title }}</div>
                            <div class="text-xs sm:text-sm text-gray-400 truncate">
                                {{ album.artist_name }}
                                <span v-if="album.all_artists && album.all_artists.length > 1">
                                    & {{ album.all_artists.length - 1 }} more
                                </span>
                            </div>
                            <div class="text-xs text-gray-500">
                                {{ album.pending_tracks }} pending / {{ album.total_tracks }} total
                            </div>
                        </div>
                        <button @click="rejectAlbum(album.id)"
                                class="px-2 sm:px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs sm:text-sm whitespace-nowrap">
                            🗑️ <span class="hidden sm:inline">Reject</span>
                        </button>
                    </div>
                </div>

                <div v-if="pendingAlbums.length > 0" class="mt-4 text-center">
                    <button @click="loadPendingAlbums"
                            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Rejection Blocklist View -->
            <div v-if="rejectView === 'blocklist'">
                <p class="text-sm text-gray-400 mb-4">
                    Items that have been rejected and blocklisted from re-ingestion.
                </p>

                <div class="mb-3">
                    <select v-model="blocklistFilter" @change="loadBlocklist"
                            class="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                        <option value="">All Types</option>
                        <option value="artist">👤 Artists</option>
                        <option value="track">🎵 Tracks</option>
                        <option value="album">💿 Albums</option>
                    </select>
                </div>

                <div v-if="blocklist.length === 0" class="text-gray-500 text-center py-8">
                    No rejected items
                </div>

                <div v-else class="space-y-2">
                    <div v-for="item in blocklist" :key="item.id"
                         class="p-3 bg-gray-900 rounded border border-gray-700 flex items-center justify-between">
                        <div class="flex-1">
                            <div class="flex items-center gap-2">
                                <span class="text-xs bg-gray-700 px-2 py-0.5 rounded">{{ item.entity_type }}</span>
                                <span class="font-medium">{{ item.entity_name }}</span>
                            </div>
                            <div class="text-xs text-gray-500 mt-1">
                                Reason: {{ item.reason || 'Not specified' }} •
                                {{ formatDate(item.rejected_at) }}
                            </div>
                        </div>
                        <button @click="removeFromBlocklist(item.id)"
                                class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                            ✓ Unblock
                        </button>
                    </div>
                </div>

                <div v-if="blocklist.length > 0" class="mt-4 text-center">
                    <button @click="loadBlocklist"
                            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                        Refresh
                    </button>
                </div>
            </div>

            <p v-if="rejectMessage" class="mt-4 text-sm" :class="rejectError ? 'text-red-400' : 'text-green-400'">
                {{ rejectMessage }}
            </p>

            <!-- Rejection Confirmation Modal -->
            <rejection-modal v-if="rejectionModal.show"
                           :modal-data="rejectionModal"
                           @confirm="confirmRejection"
                           @cancel="cancelRejection" />
        </div>
    `
};
