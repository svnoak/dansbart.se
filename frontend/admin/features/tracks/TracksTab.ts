/**
 * Tracks Tab Component (Enhanced)
 * Multi-view interface for Tracks, Albums, and Artists management
 * Features: Search, filter, collaboration tracking, and reject functionality
 */

import { showError, showToast } from '../../../js/hooks/useToast';
import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useTracksApi } from './api.js';
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';

export default {
  setup() {
    const { adminToken } = useAdminAuth();
    const tracksApi = useTracksApi(adminToken);

    // State
    const view = ref('tracks'); // tracks, albums, artists
    const tracks = ref([]);
    const albums = ref([]);
    const artists = ref([]);
    const totalItems = ref(0);
    const searchQuery = ref('');
    const statusFilter = ref('');
    const flaggedFilter = ref('');
    const limit = ref(50);
    const offset = ref(0);
    const loading = ref(false);

    // Expanded artist details
    const expandedArtist = ref(null);

    // Normalize admin track payload: backend sends artists as [{ id, name, ... }], not string[]
    const normalizeTrack = (t) => {
      const artistNames = Array.isArray(t.artists)
        ? t.artists.map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean)
        : [];
      return { ...t, artists: artistNames };
    };

    // Methods
    const loadData = async () => {
      loading.value = true;
      try {
        const params: Record<string, unknown> = {
          limit: limit.value,
          offset: offset.value,
        };

        if (searchQuery.value) params.search = searchQuery.value;

        let data;
        const toList = (d) => (d?.content ?? (/** @type {{ items?: unknown[] }} */ (d))?.items ?? []) || [];
        const toTotal = (d) => Number(d?.totalElements ?? (/** @type {{ total?: number }} */ (d))?.total ?? 0);
        if (view.value === 'tracks') {
          if (statusFilter.value) params.status = statusFilter.value;
          if (flaggedFilter.value) params.flagged = flaggedFilter.value;
          data = await tracksApi.loadTracks(params);
          tracks.value = toList(data).map((t) => ({ ...normalizeTrack(t), loading: false }));
        } else if (view.value === 'albums') {
          data = await tracksApi.loadAlbums(params);
          albums.value = toList(data);
        } else if (view.value === 'artists') {
          data = await tracksApi.loadArtists(params);
          artists.value = toList(data);
        }

        totalItems.value = toTotal(data);
      } catch {
        showError();
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

    // Track actions
    const reanalyze = async track => {
      track.loading = true;
      try {
        const id = typeof track.id === 'string' ? track.id : String(track.id);
        const data = await tracksApi.reanalyze(id);
        showToast(String(data?.message ?? 'Reanalyzing'));
        track.status = 'PENDING';
        window.dispatchEvent(new CustomEvent('admin:track-updated', { detail: { track } }));
      } catch (e) {
        showError(e.message);
      } finally {
        track.loading = false;
      }
    };

    const reclassify = async track => {
      track.loading = true;
      try {
        const id = typeof track.id === 'string' ? track.id : String(track.id);
        const data = await tracksApi.reclassify(id);
        showToast(`${track.title} → ${data?.newStyle ?? '—'}`);
        track.danceStyle = data.newStyle;
        window.dispatchEvent(new CustomEvent('admin:track-updated', { detail: { track } }));
      } catch (e) {
        showError(e.message);
      } finally {
        track.loading = false;
      }
    };

    const unflagTrack = async track => {
      track.loading = true;
      try {
        const id = typeof track.id === 'string' ? track.id : String(track.id);
        await tracksApi.unflag(id);
        showToast(`Unflagged: ${track.title}`);
        loadData();
        window.dispatchEvent(new CustomEvent('admin:track-unflagged', { detail: { track } }));
      } catch (e) {
        showError(e.message);
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
        const id = typeof track.id === 'string' ? track.id : String(track.id);
        const data = await tracksApi.rejectTrack(id, 'Rejected from admin');
        showToast(String(data?.message ?? 'Rejected'));
        loadData();
      } catch (e) {
        showError(e.message);
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

    const rejectArtist = async artist => {
      const confirmMsg = artist.isIsolated
        ? `Reject and delete artist "${artist.name}"?\n\n✅ Safe to reject: This artist has no collaborations.\n\n• ${artist.trackCount} tracks will be deleted\n• Artist will be added to blocklist`
        : `⚠️ WARNING: Reject artist "${artist.name}"?\n\nThis artist has collaborations with:\n${artist.sharedWithArtists.join(', ')}\n\n• ${artist.trackCount} tracks will be deleted\n• ${artist.sharedTracks} are collaborations\n• Shared artists will remain in database\n\nContinue?`;

      if (!confirm(confirmMsg)) {
        return;
      }

      try {
        const id = typeof artist.id === 'string' ? artist.id : String(artist.id);
        const data = await tracksApi.rejectArtist(id, 'Rejected from admin');
        showToast(String(data?.message ?? 'Rejected'));
        loadData();
      } catch {
        showToast('Failed to reject artist', 'error');
      }
    };

    // Album actions
    const rejectAlbum = async album => {
      if (
        !confirm(
          `Reject and delete album "${album.title}"?\n\n• ${album.trackCount} tracks will be deleted\n• Album will be removed from database`
        )
      ) {
        return;
      }

      try {
        const id = typeof album.id === 'string' ? album.id : String(album.id);
        const data = await tracksApi.rejectAlbum(id, 'Rejected from admin');
        showToast(String(data?.message ?? 'Rejected'));
        loadData();
      } catch (e) {
        showError(e.message);
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

    // Computed
    const pageNumber = computed(() => Math.floor(offset.value / limit.value) + 1);
    const totalPages = computed(() => Math.ceil(totalItems.value / limit.value));

    // Watchers
    watch(view, () => {
      offset.value = 0;
      searchQuery.value = '';
      statusFilter.value = '';
      flaggedFilter.value = '';
      loadData();
    });

    // Event listeners for cross-feature communication
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
      totalItems,
      searchQuery,
      statusFilter,
      flaggedFilter,
      limit,
      offset,
      loading,
      expandedArtist,
      loadData,
      debouncedSearch,
      prevPage,
      nextPage,
      reanalyze,
      reclassify,
      unflagTrack,
      rejectTrack,
      toggleArtistDetails,
      rejectArtist,
      rejectAlbum,
      statusClass,
      statusIcon,
      confidenceClass,
      pageNumber,
      totalPages,
    };
  },
  template: /*html*/ `
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700">
            <h2 class="font-bold text-xl mb-6">📚 Library Management</h2>

            <!-- View Tabs -->
            <div class="flex gap-2 mb-4 border-b border-gray-700 pb-2">
                <button @click="view = 'tracks'" :class="view === 'tracks' ? 'bg-indigo-600' : 'bg-gray-700'" class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    🎵 Tracks
                </button>
                <button @click="view = 'albums'" :class="view === 'albums' ? 'bg-indigo-600' : 'bg-gray-700'" class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    💿 Albums
                </button>
                <button @click="view = 'artists'" :class="view === 'artists' ? 'bg-indigo-600' : 'bg-gray-700'" class="px-3 py-1 rounded text-sm font-medium transition-colors">
                    👤 Artists
                </button>
            </div>

            <!-- Filters -->
            <div class="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
                <div class="flex-1">
                    <input v-model="searchQuery" @input="debouncedSearch"
                           :placeholder="'Search ' + view + '...'"
                           class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                </div>

                <select v-if="view === 'tracks'" v-model="statusFilter" @change="loadData"
                        class="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                    <option value="">All Status</option>
                    <option value="PENDING">⏳ Pending</option>
                    <option value="PROCESSING">🔄 Processing</option>
                    <option value="DONE">✅ Done</option>
                    <option value="FAILED">❌ Failed</option>
                </select>

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

            <!-- Stats -->
            <div class="flex gap-4 mb-4 text-sm text-gray-400">
                <span>Total: {{ totalItems }}</span>
                <span v-if="view === 'tracks'">Showing: {{ tracks.length }}</span>
                <span v-else-if="view === 'albums'">Showing: {{ albums.length }}</span>
                <span v-else>Showing: {{ artists.length }}</span>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="text-center py-8 text-gray-500">
                <div class="text-2xl mb-2">⏳</div>
                <p>Loading...</p>
            </div>

            <!-- TRACKS VIEW -->
            <div v-else-if="view === 'tracks'" class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="text-xs uppercase text-gray-500 border-b border-gray-700">
                        <tr>
                            <th class="py-2 px-2">Title</th>
                            <th class="py-2 px-2">Artist</th>
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
                            <td class="py-2 px-2">
                                <span :class="statusClass(track.status)" class="px-2 py-1 rounded text-xs font-medium">
                                    {{ statusIcon(track.status) }} {{ track.status }}
                                </span>
                            </td>
                            <td class="py-2 px-2">
                                {{ track.danceStyle || '-' }}
                            </td>
                            <td class="py-2 px-2 text-sm">
                                <span v-if="track.confidence" :class="confidenceClass(track.confidence)">
                                    {{ (track.confidence * 100).toFixed(0) }}%
                                </span>
                                <span v-else class="text-gray-500">-</span>
                            </td>
                            <td class="py-2 px-2">
                                <span v-if="track.isFlagged"
                                      class="px-2 py-1 rounded text-xs font-medium bg-amber-600/20 text-amber-400 border border-amber-600/30"
                                      :title="'Flagged: ' + (track.flagReason || 'not_folk_music')">
                                    🚩 Flagged
                                </span>
                                <span v-else class="text-gray-500 text-xs">-</span>
                            </td>
                            <td class="py-2 px-2">
                                <div class="flex gap-1">
                                    <button @click="reanalyze(track)"
                                            :disabled="track.loading"
                                            class="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-2 py-1 rounded text-xs"
                                            title="Full re-analysis (download + analyze)">
                                        {{ track.loading ? '...' : '🔄' }}
                                    </button>
                                    <button @click="reclassify(track)"
                                            :disabled="track.loading || track.status !== 'DONE'"
                                            class="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-2 py-1 rounded text-xs"
                                            title="Re-classify only (no re-download)">
                                        🏷️
                                    </button>
                                    <button v-if="track.isFlagged"
                                            @click="unflagTrack(track)"
                                            :disabled="track.loading"
                                            class="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-2 py-1 rounded text-xs"
                                            title="Remove flag (admin override)">
                                        {{ track.loading ? '...' : '✓' }}
                                    </button>
                                    <button @click="rejectTrack(track)"
                                            class="bg-red-600 hover:bg-red-500 px-2 py-1 rounded text-xs"
                                            title="Reject and delete track">
                                        🗑️
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- ALBUMS VIEW -->
            <div v-else-if="view === 'albums'" class="space-y-2">
                <div v-for="album in albums" :key="album.id"
                     class="p-3 bg-gray-900 rounded border border-gray-700 flex items-center gap-3">

                    <img v-if="album.coverImageUrl" :src="album.coverImageUrl" class="w-12 h-12 rounded object-cover">
                    <div v-else class="w-12 h-12 bg-gray-800 rounded flex items-center justify-center text-lg">💿</div>

                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-sm truncate">{{ album.title }}</div>
                        <div class="text-xs text-gray-400">
                            {{ album.artistName }}
                        </div>
                        <div class="text-xs text-gray-500 mt-1">
                            {{ album.trackCount }} tracks
                            <span v-if="(album.trackCount - album.pendingCount) > 0" class="text-green-400">({{ album.trackCount - album.pendingCount }} analyzed)</span>
                            <span v-if="album.pendingCount > 0" class="text-yellow-400">({{ album.pendingCount }} pending)</span>
                        </div>
                        <div v-if="album.allArtists.length > 1" class="text-xs text-blue-400 mt-1">
                            🤝 Collaboration: {{ album.allArtists.join(', ') }}
                        </div>
                    </div>

                    <button @click="rejectAlbum(album)"
                            class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded text-sm"
                            title="Reject and delete album">
                        🗑️ Reject
                    </button>
                </div>
            </div>

            <!-- ARTISTS VIEW -->
            <div v-else-if="view === 'artists'" class="space-y-2">
                <div v-for="artist in artists" :key="artist.id"
                     class="bg-gray-900 rounded border border-gray-700 overflow-hidden">

                    <div class="p-3 flex items-center gap-3 hover:bg-gray-800/50 cursor-pointer"
                         @click="toggleArtistDetails(artist)">

                        <img v-if="artist.imageUrl" :src="artist.imageUrl" class="w-12 h-12 rounded object-cover">
                        <div v-else class="w-12 h-12 bg-gray-800 rounded flex items-center justify-center text-lg">👤</div>

                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-sm truncate">{{ artist.name }}</div>
                            <div class="text-xs text-gray-400 mt-1">
                                {{ artist.trackCount }} tracks
                                <span v-if="(artist.trackCount - artist.pendingCount) > 0" class="text-green-400">({{ artist.trackCount - artist.pendingCount }} analyzed)</span>
                                <span v-if="artist.pendingCount > 0" class="text-yellow-400">({{ artist.pendingCount }} pending)</span>
                            </div>

                            <!-- Collaboration Badge -->
                            <div class="flex gap-2 mt-1">
                                <span v-if="artist.isIsolated" class="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded">
                                    ✅ Isolated (safe to reject)
                                </span>
                                <span v-else class="text-xs bg-amber-600/20 text-amber-400 px-2 py-0.5 rounded">
                                    🤝 {{ artist.sharedTracks }} collaborations
                                </span>
                            </div>
                        </div>

                        <div class="flex gap-2">
                            <button @click.stop="rejectArtist(artist)"
                                    class="bg-red-600 hover:bg-red-500 px-3 py-2 rounded text-sm"
                                    title="Reject and delete artist">
                                🗑️ Reject
                            </button>
                            <button class="text-gray-400 px-2" title="Toggle details">
                                {{ expandedArtist === artist.id ? '▲' : '▼' }}
                            </button>
                        </div>
                    </div>

                    <!-- Expanded Details -->
                    <div v-if="expandedArtist === artist.id" class="p-3 bg-gray-950 border-t border-gray-700">
                        <div v-if="artist.isIsolated" class="text-sm text-gray-400">
                            ℹ️ This artist has no collaborations with other artists in your database.
                        </div>
                        <div v-else>
                            <div class="text-xs uppercase text-gray-500 mb-2">Collaborates With:</div>
                            <div class="flex flex-wrap gap-2">
                                <span v-for="collab in artist.sharedWithArtists" :key="collab"
                                      class="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded border border-blue-600/30">
                                    👥 {{ collab }}
                                </span>
                            </div>
                            <div class="text-xs text-gray-500 mt-2">
                                {{ artist.sharedTracks }} collaborative tracks across {{ artist.sharedAlbums }} albums
                            </div>
                        </div>
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
