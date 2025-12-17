/**
 * Library Tab Component (Unified)
 * Complete library management: Tracks, Albums, Artists, and Blocklist
 * Features: Search, filters, bulk operations, collaboration tracking
 */

import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useLibraryApi } from './api.js';
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import RejectionModal from './RejectionModal.js';
import { showError, showToast } from '../../../js/hooks/useToast.js';

export default {
  components: {
    RejectionModal,
  },
  setup() {
    const { adminToken } = useAdminAuth();
    const api = useLibraryApi(adminToken);

    // State
    const view = ref('artists'); // tracks, albums, artists, blocklist
    const tracks = ref([]);
    const albums = ref([]);
    const artists = ref([]);
    const blocklist = ref([]);
    const totalItems = ref(0);
    const searchQuery = ref('');
    const statusFilter = ref('all'); // all, pending, analyzed
    const trackStatusFilter = ref(''); // PENDING, PROCESSING, DONE, FAILED
    const flaggedFilter = ref('');
    const isolatedFilter = ref(''); // For filtering isolated/non-isolated entities
    const rejectedFilter = ref(''); // For filtering rejected entities
    const artistFilter = ref(''); // Filter tracks/albums by artist ID
    const albumFilter = ref(''); // Filter tracks by album ID
    const limit = ref(50);
    const offset = ref(0);
    const loading = ref(false);

    // For displaying selected artist/album name
    const selectedArtistName = ref('');
    const selectedAlbumName = ref('');

    // Bulk selection
    const selectedIds = ref(new Set());

    // Expanded artist details
    const expandedArtist = ref(null);

    // Rejection modal state
    const showRejectionModal = ref(false);
    const rejectionEntity = ref(null);
    const rejectionEntityType = ref('artist');
    const collaborationData = ref(null);

    // Computed
    const pageNumber = computed(() => Math.floor(offset.value / limit.value) + 1);
    const totalPages = computed(() => Math.ceil(totalItems.value / limit.value));

    const isAllSelected = computed(() => {
      const currentList = view.value === 'artists' ? artists.value : albums.value;
      return currentList.length > 0 && selectedIds.value.size === currentList.length;
    });

    // Methods
    const loadData = async () => {
      loading.value = true;
      selectedIds.value.clear(); // Clear selection on load

      try {
        const params = {
          limit: limit.value,
          offset: offset.value,
        };

        if (searchQuery.value) params.search = searchQuery.value;

        let data;

        if (view.value === 'tracks') {
          if (trackStatusFilter.value) params.status = trackStatusFilter.value;
          if (flaggedFilter.value) params.flagged = flaggedFilter.value;
          if (artistFilter.value) params.artist_id = artistFilter.value;
          if (albumFilter.value) params.album_id = albumFilter.value;
          data = await api.loadTracks(params);
          tracks.value = data.items.map(t => ({ ...t, loading: false }));
        } else if (view.value === 'albums') {
          if (artistFilter.value) params.artist_id = artistFilter.value;
          if (statusFilter.value === 'pending') {
            data = await api.loadPendingAlbums(limit.value, offset.value);
          } else {
            data = await api.loadAlbums(params);
          }
          albums.value = data.items;
        } else if (view.value === 'artists') {
          if (isolatedFilter.value) params.isolated = isolatedFilter.value;
          if (statusFilter.value === 'pending') {
            data = await api.loadPendingArtists(limit.value, offset.value, searchQuery.value);
          } else {
            data = await api.loadArtists(params);
          }
          artists.value = data.items;
        } else if (view.value === 'blocklist') {
          data = await api.loadBlocklist('', limit.value, offset.value);
          blocklist.value = data.items;
        }

        totalItems.value = data.total;
      } catch {
        showError(`Failed to load ${view.value}`);
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

    // Filter helpers
    const filterByArtist = (artistId, artistName) => {
      artistFilter.value = artistId;
      selectedArtistName.value = artistName;
      albumFilter.value = ''; // Clear album filter
      selectedAlbumName.value = '';
      offset.value = 0;

      // Switch to appropriate view
      if (view.value === 'artists') {
        view.value = 'albums'; // Show albums for this artist
      }

      loadData();
    };

    const filterByAlbum = (albumId, albumName) => {
      albumFilter.value = albumId;
      selectedAlbumName.value = albumName;
      offset.value = 0;
      view.value = 'tracks'; // Switch to tracks view
      loadData();
    };

    const clearFilters = () => {
      artistFilter.value = '';
      albumFilter.value = '';
      selectedArtistName.value = '';
      selectedAlbumName.value = '';
      offset.value = 0;
      loadData();
    };

    // Bulk selection
    const toggleSelection = id => {
      if (selectedIds.value.has(id)) {
        selectedIds.value.delete(id);
      } else {
        selectedIds.value.add(id);
      }
    };

    const toggleSelectAll = () => {
      const currentList = view.value === 'artists' ? artists.value : albums.value;
      if (selectedIds.value.size === currentList.length) {
        selectedIds.value.clear();
      } else {
        currentList.forEach(item => selectedIds.value.add(item.id));
      }
    };

    const bulkReject = async () => {
      const count = selectedIds.value.size;
      if (count === 0) return;

      const itemType = view.value === 'artists' ? 'artists' : 'albums';
      if (
        !confirm(
          `⚠️ Reject and delete ${count} ${itemType}?\n\nThis will:\n• Delete all their tracks\n• Add them to the blocklist\n• This cannot be undone\n\nContinue?`
        )
      ) {
        return;
      }

      loading.value = true;
      try {
        const ids = Array.from(selectedIds.value);

        if (view.value === 'artists') {
          await api.bulkRejectArtists(ids, 'Bulk rejection from library');
          showToast(`Rejected ${count} artists`, 'success');
        } else {
          // Reject albums one by one (no bulk endpoint yet)
          for (const id of ids) {
            await api.rejectAlbum(id, 'Bulk rejection from library');
          }
          showToast(`Rejected ${count} albums`, 'success');
        }

        loadData();
      } catch (e) {
        showError(e.message || 'Bulk rejection failed');
      } finally {
        loading.value = false;
      }
    };

    // Track actions
    const reanalyze = async track => {
      track.loading = true;
      try {
        const data = await api.reanalyzeTrack(track.id);
        showToast(data.message);
        track.status = 'PENDING';
        window.dispatchEvent(new CustomEvent('admin:track-updated', { detail: { track } }));
      } catch (e) {
        showError(e.message || 'Re-analysis failed');
      } finally {
        track.loading = false;
      }
    };

    const reclassify = async track => {
      track.loading = true;
      try {
        const data = await api.reclassifyTrack(track.id);
        showToast(`${track.title} → ${data.new_style}`);
        track.dance_style = data.new_style;
        window.dispatchEvent(new CustomEvent('admin:track-updated', { detail: { track } }));
      } catch (e) {
        showError(e.message || 'Reclassification failed');
      } finally {
        track.loading = false;
      }
    };

    const unflagTrack = async track => {
      track.loading = true;
      try {
        await api.unflagTrack(track.id);
        showToast(`Unflagged: ${track.title}`);
        loadData();
        window.dispatchEvent(new CustomEvent('admin:track-unflagged', { detail: { track } }));
      } catch (e) {
        showError(e.message || 'Failed to unflag track');
      } finally {
        track.loading = false;
      }
    };

    const rejectTrack = async track => {
      if (
        !confirm(
          `Reject and delete track "${track.title}"?\n\nThis will remove it from the database and add it to the blocklist.`
        )
      ) {
        return;
      }

      try {
        const data = await api.rejectTrack(track.id, 'Rejected from library');
        showToast(data.message);
        loadData();
      } catch (e) {
        showError(e.message || 'Failed to reject track');
      }
    };

    // Artist actions
    const toggleArtistDetails = artist => {
      if (expandedArtist.value === artist.id) {
        expandedArtist.value = null;
      } else {
        expandedArtist.value = artist.id;
      }
    };

    const approveArtist = async artist => {
      const confirmMsg = `Approve artist "${artist.name}"?\n\n• ${artist.pending_tracks} pending tracks will be queued for analysis`;
      if (!confirm(confirmMsg)) return;

      try {
        const data = await api.approveArtist(artist.id);
        showToast(data.message);
        loadData();
        window.dispatchEvent(new CustomEvent('admin:artist-approved'));
      } catch (e) {
        showError(e.message || 'Failed to approve artist');
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
        window.dispatchEvent(new CustomEvent('admin:artist-approved'));
      } catch (e) {
        showError(e.message || 'Bulk approval failed');
      } finally {
        loading.value = false;
      }
    };

    const rejectArtist = async artist => {
      // Open the enhanced rejection modal
      rejectionEntity.value = artist;
      rejectionEntityType.value = 'artist';

      try {
        // Fetch collaboration network data
        const networkData = await api.getCollaborationNetwork(artist.id);
        collaborationData.value = networkData;
        showRejectionModal.value = true;
      } catch (e) {
        showError(e.message || 'Failed to load collaboration data');
      }
    };

    const closeRejectionModal = () => {
      showRejectionModal.value = false;
      rejectionEntity.value = null;
      collaborationData.value = null;
    };

    const confirmRejection = async selections => {
      loading.value = true;
      showRejectionModal.value = false;

      try {
        const data = await api.rejectNetwork(
          selections.artistIds,
          selections.albumIds,
          selections.reason
        );
        showToast(data.message || 'Network rejected successfully', 'success');
        loadData();
      } catch (e) {
        showError(e.message || 'Network rejection failed');
      } finally {
        loading.value = false;
      }
    };

    // Album actions
    const rejectAlbum = async album => {
      if (
        !confirm(
          `Reject and delete album "${album.title}"?\n\n• ${album.total_tracks} tracks will be deleted\n• Album will be removed from database`
        )
      ) {
        return;
      }

      try {
        const data = await api.rejectAlbum(album.id, 'Rejected from library');
        showToast(data.message);
        loadData();
      } catch (e) {
        showError(e.message || 'Failed to reject album');
      }
    };

    // Blocklist actions
    const removeFromBlocklist = async item => {
      if (
        !confirm(
          `Remove "${item.entity_name}" from blocklist?\n\nThis will allow it to be re-ingested if discovered again.`
        )
      ) {
        return;
      }

      try {
        const data = await api.removeFromBlocklist(item.id);
        showToast(data.message);
        loadData();
      } catch (e) {
        showError(e.message || 'Failed to remove from blocklist');
      }
    };

    // Helper methods
    const statusClass = status => {
      const classes = {
        PENDING: 'bg-yellow-600/20 text-yellow-400',
        PROCESSING: 'bg-blue-600/20 text-blue-400',
        DONE: 'bg-green-600/20 text-green-400',
        FAILED: 'bg-red-600/20 text-red-400',
      };
      return classes[status] || 'bg-gray-600/20 text-gray-400';
    };

    const statusIcon = status => {
      const icons = {
        PENDING: '⏳',
        PROCESSING: '🔄',
        DONE: '✅',
        FAILED: '❌',
      };
      return icons[status] || '❓';
    };

    const confidenceClass = confidence => {
      if (confidence >= 0.9) return 'text-green-400';
      if (confidence >= 0.75) return 'text-blue-400';
      if (confidence >= 0.5) return 'text-yellow-400';
      return 'text-red-400';
    };

    // Watchers
    watch(view, (newView, oldView) => {
      // Only clear filters if manually switching tabs (not from filter functions)
      // Check if we're switching to a view that doesn't match our current filters
      if (oldView && newView !== 'tracks' && albumFilter.value) {
        // Switching away from tracks view while album filter is set - keep it
        return;
      }
      if (oldView && newView !== 'tracks' && newView !== 'albums' && artistFilter.value) {
        // Switching away from albums/tracks while artist filter is set - keep it
        return;
      }

      offset.value = 0;
      searchQuery.value = '';
      statusFilter.value = 'all';
      trackStatusFilter.value = '';
      flaggedFilter.value = '';
      isolatedFilter.value = '';
      rejectedFilter.value = '';
      selectedIds.value.clear();
      expandedArtist.value = null;
      loadData();
    });

    watch(statusFilter, () => {
      offset.value = 0;
      loadData();
    });

    // Event listeners
    const handleTracksIngested = () => loadData();
    const handleArtistApproved = () => loadData();
    const handleTracksReclassified = () => loadData();
    const handleSpiderComplete = () => loadData();

    onMounted(() => {
      loadData();
      window.addEventListener('admin:tracks-ingested', handleTracksIngested);
      window.addEventListener('admin:artist-approved', handleArtistApproved);
      window.addEventListener('admin:tracks-reclassified', handleTracksReclassified);
      window.addEventListener('admin:spider-complete', handleSpiderComplete);
    });

    onUnmounted(() => {
      window.removeEventListener('admin:tracks-ingested', handleTracksIngested);
      window.removeEventListener('admin:artist-approved', handleArtistApproved);
      window.removeEventListener('admin:tracks-reclassified', handleTracksReclassified);
      window.removeEventListener('admin:spider-complete', handleSpiderComplete);
    });

    return {
      view,
      tracks,
      albums,
      artists,
      blocklist,
      totalItems,
      searchQuery,
      statusFilter,
      trackStatusFilter,
      flaggedFilter,
      isolatedFilter,
      rejectedFilter,
      artistFilter,
      albumFilter,
      selectedArtistName,
      selectedAlbumName,
      limit,
      offset,
      loading,
      expandedArtist,
      selectedIds,
      loadData,
      debouncedSearch,
      prevPage,
      nextPage,
      filterByArtist,
      filterByAlbum,
      clearFilters,
      toggleSelection,
      toggleSelectAll,
      isAllSelected,
      bulkReject,
      bulkApprove,
      reanalyze,
      reclassify,
      unflagTrack,
      rejectTrack,
      toggleArtistDetails,
      approveArtist,
      rejectArtist,
      rejectAlbum,
      removeFromBlocklist,
      statusClass,
      statusIcon,
      confidenceClass,
      pageNumber,
      totalPages,
      // Rejection modal
      showRejectionModal,
      rejectionEntity,
      rejectionEntityType,
      collaborationData,
      closeRejectionModal,
      confirmRejection,
    };
  },
  template: /*html*/ `
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700">
            <!-- Rejection Modal -->
            <RejectionModal
                :show="showRejectionModal"
                :entity-type="rejectionEntityType"
                :entity="rejectionEntity"
                :collaboration-data="collaborationData"
                @close="closeRejectionModal"
                @confirm="confirmRejection"
            />

            <div class="flex justify-between items-center mb-6">
                <h2 class="font-bold text-xl">📚 Library Manager</h2>

                <!-- Bulk Actions Banner -->
                <div v-if="selectedIds.size > 0" class="flex items-center gap-4 bg-indigo-900/30 border border-indigo-500/30 px-4 py-2 rounded animate-fade-in">
                    <span class="text-sm font-bold text-indigo-200">{{ selectedIds.size }} selected</span>
                    <button v-if="view === 'artists'" @click="bulkApprove" :disabled="loading"
                            class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm font-bold shadow-sm">
                        ✅ Approve All
                    </button>
                    <button @click="bulkReject" :disabled="loading"
                            class="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-sm font-bold shadow-sm">
                        🗑️ Reject All
                    </button>
                </div>
            </div>

            <!-- View Tabs -->
            <div class="flex gap-2 mb-4 border-b border-gray-700 pb-2">
                <button @click="view = 'artists'" :class="view === 'artists' ? 'bg-indigo-600' : 'bg-gray-700'"
                        class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    👤 Artists
                </button>
                <button @click="view = 'albums'" :class="view === 'albums' ? 'bg-indigo-600' : 'bg-gray-700'"
                        class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    💿 Albums
                </button>
                <button @click="view = 'tracks'" :class="view === 'tracks' ? 'bg-indigo-600' : 'bg-gray-700'"
                        class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    🎵 Tracks
                </button>
                <button @click="view = 'blocklist'" :class="view === 'blocklist' ? 'bg-indigo-600' : 'bg-gray-700'"
                        class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    🚫 Blocklist
                </button>
            </div>

            <!-- Filters Row -->
            <div class="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
                <!-- Search -->
                <div class="flex-1">
                    <input v-model="searchQuery" @input="debouncedSearch"
                           :placeholder="'Search ' + view + '...'"
                           class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                </div>

                <!-- Status Filter (Artists/Albums) -->
                <select v-if="view === 'artists' || view === 'albums'" v-model="statusFilter"
                        class="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                    <option value="all">All {{ view === 'artists' ? 'Artists' : 'Albums' }}</option>
                    <option value="pending">⏳ Pending Only</option>
                    <option value="analyzed">✅ Analyzed Only</option>
                </select>

                <!-- Isolated Filter (Artists) -->
                <select v-if="view === 'artists'" v-model="isolatedFilter" @change="loadData"
                        class="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                    <option value="">All Artists</option>
                    <option value="true">✅ Isolated Only</option>
                    <option value="false">🤝 With Collaborations</option>
                </select>

                <!-- Track Status Filter -->
                <select v-if="view === 'tracks'" v-model="trackStatusFilter" @change="loadData"
                        class="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                    <option value="">All Status</option>
                    <option value="PENDING">⏳ Pending</option>
                    <option value="PROCESSING">🔄 Processing</option>
                    <option value="DONE">✅ Done</option>
                    <option value="FAILED">❌ Failed</option>
                </select>

                <!-- Track Flagged Filter -->
                <select v-if="view === 'tracks'" v-model="flaggedFilter" @change="loadData"
                        class="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                    <option value="">All Tracks</option>
                    <option value="true">🚩 Flagged Only</option>
                    <option value="false">✅ Not Flagged</option>
                </select>

                <button @click="loadData" class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm">
                    🔄 Refresh
                </button>
            </div>

            <!-- Active Filters -->
            <div v-if="artistFilter || albumFilter" class="flex items-center gap-2 mb-4 p-3 bg-indigo-900/20 border border-indigo-700/30 rounded">
                <span class="text-sm text-gray-400">Active Filters:</span>
                <span v-if="selectedArtistName" class="text-sm bg-indigo-600 text-white px-2 py-1 rounded">
                    👤 {{ selectedArtistName }}
                </span>
                <span v-if="selectedAlbumName" class="text-sm bg-indigo-600 text-white px-2 py-1 rounded">
                    💿 {{ selectedAlbumName }}
                </span>
                <button @click="clearFilters" class="text-sm bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded ml-auto">
                    ✕ Clear Filters
                </button>
            </div>

            <!-- Stats -->
            <div class="flex gap-4 mb-4 text-sm text-gray-400">
                <span>Total: {{ totalItems }}</span>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="text-center py-8 text-gray-500">
                <div class="text-2xl mb-2">⏳</div>
                <p>Loading...</p>
            </div>

            <!-- ARTISTS VIEW -->
            <div v-else-if="view === 'artists'">
                <!-- Select All Checkbox -->
                <div v-if="artists.length > 0" class="flex items-center gap-3 p-2 bg-gray-900/50 border-b border-gray-700 mb-2">
                    <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll"
                           class="w-4 h-4 rounded border-gray-600 bg-gray-700">
                    <span class="text-xs text-gray-500 uppercase font-bold">Select All (Page)</span>
                </div>

                <div v-if="artists.length === 0" class="text-center py-8 text-gray-500">
                    <div class="text-4xl mb-2">🎉</div>
                    <p>{{ searchQuery ? 'No artists found matching your search' : 'No artists found' }}</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="artist in artists" :key="artist.id"
                         class="bg-gray-900 rounded border border-gray-700 overflow-hidden">

                        <div class="p-3 flex items-center gap-3 hover:bg-gray-800/50"
                             :class="expandedArtist === artist.id ? 'cursor-pointer' : ''">

                            <input type="checkbox"
                                   :checked="selectedIds.has(artist.id)"
                                   @change="toggleSelection(artist.id)"
                                   class="w-5 h-5 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500">

                            <div @click="toggleArtistDetails(artist)" class="flex items-center gap-3 flex-1 cursor-pointer">
                                <img v-if="artist.image_url" :src="artist.image_url" class="w-12 h-12 rounded object-cover">
                                <div v-else class="w-12 h-12 bg-gray-800 rounded flex items-center justify-center text-lg">👤</div>

                                <div class="flex-1 min-w-0">
                                    <div class="font-bold text-sm truncate">{{ artist.name }}</div>
                                    <div class="text-xs text-gray-400 mt-1">
                                        {{ artist.total_tracks }} tracks
                                        <span v-if="artist.done_tracks > 0" class="text-green-400">({{ artist.done_tracks }} analyzed)</span>
                                        <span v-if="artist.pending_tracks > 0" class="text-yellow-400">({{ artist.pending_tracks }} pending)</span>
                                    </div>

                                    <div class="flex gap-2 mt-1">
                                        <span v-if="artist.is_isolated" class="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded">
                                            ✅ Isolated
                                        </span>
                                        <span v-else class="text-xs bg-amber-600/20 text-amber-400 px-2 py-0.5 rounded">
                                            🤝 {{ artist.shared_tracks }} collaborations
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div class="flex gap-2">
                                <button @click.stop="filterByArtist(artist.id, artist.name)"
                                        class="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded text-sm"
                                        title="View albums by this artist">
                                    💿 Albums
                                </button>
                                <button v-if="artist.pending_tracks > 0" @click.stop="approveArtist(artist)"
                                        class="bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm"
                                        title="Approve artist and queue tracks for analysis">
                                    ✅
                                </button>
                                <button @click.stop="rejectArtist(artist)"
                                        class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded text-sm"
                                        title="Reject artist">
                                    🗑️
                                </button>
                                <button @click="toggleArtistDetails(artist)" class="text-gray-400 px-2">
                                    {{ expandedArtist === artist.id ? '▲' : '▼' }}
                                </button>
                            </div>
                        </div>

                        <!-- Expanded Details -->
                        <div v-if="expandedArtist === artist.id" class="p-3 bg-gray-950 border-t border-gray-700">
                            <div v-if="artist.is_isolated" class="text-sm text-gray-400">
                                ℹ️ This artist has no collaborations with other artists in your database.
                            </div>
                            <div v-else>
                                <div class="text-xs uppercase text-gray-500 mb-2">Collaborates With:</div>
                                <div class="flex flex-wrap gap-2">
                                    <span v-for="collab in artist.shared_with_artists" :key="collab"
                                          class="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded border border-blue-600/30">
                                        👥 {{ collab }}
                                    </span>
                                </div>
                                <div class="text-xs text-gray-500 mt-2">
                                    {{ artist.shared_tracks }} collaborative tracks across {{ artist.shared_albums }} albums
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ALBUMS VIEW -->
            <div v-else-if="view === 'albums'">
                <!-- Select All Checkbox -->
                <div v-if="albums.length > 0" class="flex items-center gap-3 p-2 bg-gray-900/50 border-b border-gray-700 mb-2">
                    <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll"
                           class="w-4 h-4 rounded border-gray-600 bg-gray-700">
                    <span class="text-xs text-gray-500 uppercase font-bold">Select All (Page)</span>
                </div>

                <div v-if="albums.length === 0" class="text-center py-8 text-gray-500">
                    <div class="text-4xl mb-2">🎉</div>
                    <p>{{ searchQuery ? 'No albums found matching your search' : 'No albums found' }}</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="album in albums" :key="album.id"
                         class="p-3 bg-gray-900 rounded border border-gray-700 flex items-center gap-3">

                        <input type="checkbox"
                               :checked="selectedIds.has(album.id)"
                               @change="toggleSelection(album.id)"
                               class="w-5 h-5 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500">

                        <img v-if="album.cover_image_url" :src="album.cover_image_url" class="w-12 h-12 rounded object-cover">
                        <div v-else class="w-12 h-12 bg-gray-800 rounded flex items-center justify-center text-lg">💿</div>

                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-sm truncate">{{ album.title }}</div>
                            <div class="text-xs text-gray-400">{{ album.artist_name }}</div>
                            <div class="text-xs text-gray-500 mt-1">
                                {{ album.total_tracks }} tracks
                                <span v-if="album.done_tracks > 0" class="text-green-400">({{ album.done_tracks }} analyzed)</span>
                                <span v-if="album.pending_tracks > 0" class="text-yellow-400">({{ album.pending_tracks }} pending)</span>
                            </div>
                            <div v-if="album.all_artists && album.all_artists.length > 1" class="text-xs text-blue-400 mt-1">
                                🤝 Collaboration: {{ album.all_artists.join(', ') }}
                            </div>
                        </div>

                        <div class="flex gap-2">
                            <button @click="filterByAlbum(album.id, album.title)"
                                    class="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded text-sm"
                                    title="View tracks in this album">
                                🎵 Tracks
                            </button>
                            <button @click="rejectAlbum(album)"
                                    class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded text-sm"
                                    title="Reject album">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TRACKS VIEW -->
            <div v-else-if="view === 'tracks'" class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="text-xs uppercase text-gray-500 border-b border-gray-700">
                        <tr>
                            <th class="py-2 px-2">Title</th>
                            <th class="py-2 px-2">Artist</th>
                            <th class="py-2 px-2">Album</th>
                            <th class="py-2 px-2">Status</th>
                            <th class="py-2 px-2">Style</th>
                            <th class="py-2 px-2">Confidence</th>
                            <th class="py-2 px-2">Flagged</th>
                            <th class="py-2 px-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="track in tracks" :key="track.id"
                            class="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td class="py-2 px-2 max-w-xs truncate" :title="track.title">
                                {{ track.title }}
                            </td>
                            <td class="py-2 px-2 text-gray-400 text-sm max-w-xs truncate">
                                {{ track.artists?.join(', ') || '-' }}
                            </td>
                            <td class="py-2 px-2 text-sm">
                                <button v-if="track.album_id"
                                        @click="filterByAlbum(track.album_id, track.album_title)"
                                        class="text-indigo-400 hover:text-indigo-300 underline truncate max-w-xs block text-left"
                                        :title="'View all tracks from: ' + track.album_title">
                                    {{ track.album_title }}
                                </button>
                                <span v-else class="text-gray-500">-</span>
                            </td>
                            <td class="py-2 px-2">
                                <span :class="statusClass(track.status)" class="px-2 py-1 rounded text-xs font-medium">
                                    {{ statusIcon(track.status) }} {{ track.status }}
                                </span>
                            </td>
                            <td class="py-2 px-2">{{ track.dance_style || '-' }}</td>
                            <td class="py-2 px-2 text-sm">
                                <span v-if="track.confidence" :class="confidenceClass(track.confidence)">
                                    {{ (track.confidence * 100).toFixed(0) }}%
                                </span>
                                <span v-else class="text-gray-500">-</span>
                            </td>
                            <td class="py-2 px-2">
                                <span v-if="track.is_flagged"
                                      class="px-2 py-1 rounded text-xs font-medium bg-amber-600/20 text-amber-400 border border-amber-600/30"
                                      :title="'Flagged: ' + (track.flag_reason || 'not_folk_music')">
                                    🚩
                                </span>
                                <span v-else class="text-gray-500 text-xs">-</span>
                            </td>
                            <td class="py-2 px-2">
                                <div class="flex gap-1">
                                    <button @click="reanalyze(track)" :disabled="track.loading"
                                            class="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-2 py-1 rounded text-xs"
                                            title="Full re-analysis">
                                        {{ track.loading ? '...' : '🔄' }}
                                    </button>
                                    <button @click="reclassify(track)" :disabled="track.loading || track.status !== 'DONE'"
                                            class="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-2 py-1 rounded text-xs"
                                            title="Re-classify only">
                                        🏷️
                                    </button>
                                    <button v-if="track.is_flagged" @click="unflagTrack(track)" :disabled="track.loading"
                                            class="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-2 py-1 rounded text-xs"
                                            title="Remove flag">
                                        {{ track.loading ? '...' : '✓' }}
                                    </button>
                                    <button @click="rejectTrack(track)"
                                            class="bg-red-600 hover:bg-red-500 px-2 py-1 rounded text-xs"
                                            title="Reject track">
                                        🗑️
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- BLOCKLIST VIEW -->
            <div v-else-if="view === 'blocklist'">
                <div v-if="blocklist.length === 0" class="text-center py-8 text-gray-500">
                    <p>No items in blocklist</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="item in blocklist" :key="item.id"
                         class="p-3 bg-gray-900 rounded border border-gray-700 flex items-start justify-between">
                        <div class="flex-1">
                            <div class="font-bold text-sm">{{ item.entity_name }}</div>
                            <div class="text-xs text-gray-400 mt-1">
                                Type: {{ item.entity_type }} • Reason: {{ item.reason }}
                            </div>
                            <div class="text-xs text-gray-500 mt-1">
                                Blocked: {{ new Date(item.rejected_at).toLocaleDateString() }}
                            </div>
                        </div>
                        <button @click="removeFromBlocklist(item)"
                                class="bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm"
                                title="Remove from blocklist">
                            ↩️ Restore
                        </button>
                    </div>
                </div>
            </div>

            <!-- Pagination -->
            <div class="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
                <button @click="prevPage" :disabled="offset === 0 || loading"
                        class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm">
                    ← Previous
                </button>
                <span class="text-gray-400 text-sm">
                    Page {{ pageNumber }} of {{ totalPages || 1 }}
                </span>
                <button @click="nextPage" :disabled="offset + limit >= totalItems || loading"
                        class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded text-sm">
                    Next →
                </button>
            </div>
        </div>
    `,
};
