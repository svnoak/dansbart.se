/**
 * Tracks Tab Component
 * Track management interface with search, filter, and actions
 */

import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useToast } from '../../shared/composables/useToast.js';
import { useTracksApi } from './api.js';
import { ref, onMounted, onUnmounted } from 'vue';

export default {
    setup() {
        const { adminToken } = useAdminAuth();
        const { showToast } = useToast();
        const tracksApi = useTracksApi(adminToken);

        // State
        const tracks = ref([]);
        const totalTracks = ref(0);
        const searchQuery = ref('');
        const statusFilter = ref('');
        const flaggedFilter = ref('');
        const limit = ref(50);
        const offset = ref(0);

        // Methods
        const loadTracks = async () => {
            try {
                const params = {};
                if (limit.value) params.limit = limit.value;
                if (offset.value) params.offset = offset.value;
                if (searchQuery.value) params.search = searchQuery.value;
                if (statusFilter.value) params.status = statusFilter.value;
                if (flaggedFilter.value) params.flagged = flaggedFilter.value;

                const data = await tracksApi.loadTracks(params);
                tracks.value = data.items.map(t => ({ ...t, loading: false }));
                totalTracks.value = data.total;
            } catch (e) {
                showToast('Failed to load tracks', 'error');
            }
        };

        let searchTimeout;
        const debouncedSearch = () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                offset.value = 0;
                loadTracks();
            }, 300);
        };

        const prevPage = () => {
            offset.value = Math.max(0, offset.value - limit.value);
            loadTracks();
        };

        const nextPage = () => {
            offset.value += limit.value;
            loadTracks();
        };

        const reanalyze = async (track) => {
            track.loading = true;
            try {
                const data = await tracksApi.reanalyze(track.id);
                showToast(data.message);
                track.status = 'PENDING';
                window.dispatchEvent(new CustomEvent('admin:track-updated', { detail: { track } }));
            } catch (e) {
                showToast('Re-analysis failed', 'error');
            } finally {
                track.loading = false;
            }
        };

        const reclassify = async (track) => {
            track.loading = true;
            try {
                const data = await tracksApi.reclassify(track.id);
                showToast(`${track.title} → ${data.new_style}`);
                track.dance_style = data.new_style;
                window.dispatchEvent(new CustomEvent('admin:track-updated', { detail: { track } }));
            } catch (e) {
                showToast(e.message, 'error');
            } finally {
                track.loading = false;
            }
        };

        const unflagTrack = async (track) => {
            track.loading = true;
            try {
                await tracksApi.unflag(track.id);
                showToast(`Unflagged: ${track.title}`);
                loadTracks();
                window.dispatchEvent(new CustomEvent('admin:track-unflagged', { detail: { track } }));
            } catch (e) {
                showToast('Failed to unflag track', 'error');
            } finally {
                track.loading = false;
            }
        };

        // Helper methods
        const statusClass = (status) => {
            const classes = {
                'PENDING': 'bg-yellow-600/20 text-yellow-400',
                'PROCESSING': 'bg-blue-600/20 text-blue-400',
                'DONE': 'bg-green-600/20 text-green-400',
                'FAILED': 'bg-red-600/20 text-red-400'
            };
            return classes[status] || 'bg-gray-600/20 text-gray-400';
        };

        const statusIcon = (status) => {
            const icons = {
                'PENDING': '⏳',
                'PROCESSING': '🔄',
                'DONE': '✅',
                'FAILED': '❌'
            };
            return icons[status] || '❓';
        };

        const confidenceClass = (confidence) => {
            if (confidence >= 0.9) return 'text-green-400';
            if (confidence >= 0.75) return 'text-blue-400';
            if (confidence >= 0.5) return 'text-yellow-400';
            return 'text-red-400';
        };

        // Event listeners for cross-feature communication
        const handleTracksIngested = () => loadTracks();
        const handleArtistApproved = () => loadTracks();
        const handleTracksReclassified = () => loadTracks();
        const handleSpiderComplete = () => loadTracks();

        onMounted(() => {
            loadTracks();
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
            tracks, totalTracks, searchQuery, statusFilter, flaggedFilter, limit, offset,
            loadTracks, debouncedSearch, prevPage, nextPage,
            reanalyze, reclassify, unflagTrack,
            statusClass, statusIcon, confidenceClass
        };
    },
    template: /*html*/`
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700">
            <div class="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
                <div class="flex-1">
                    <input v-model="searchQuery" @input="debouncedSearch" placeholder="Search tracks..."
                           class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                </div>
                <select v-model="statusFilter" @change="loadTracks"
                        class="bg-gray-900 border border-gray-600 rounded p-2 text-white">
                    <option value="">All Status</option>
                    <option value="PENDING">⏳ Pending</option>
                    <option value="PROCESSING">🔄 Processing</option>
                    <option value="DONE">✅ Done</option>
                    <option value="FAILED">❌ Failed</option>
                </select>
                <select v-model="flaggedFilter" @change="loadTracks"
                        class="bg-gray-900 border border-gray-600 rounded p-2 text-white">
                    <option value="">All Tracks</option>
                    <option value="true">🚩 Flagged Only</option>
                    <option value="false">✅ Not Flagged</option>
                </select>
                <button @click="loadTracks" class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded">
                    🔄 Refresh
                </button>
            </div>

            <!-- Stats -->
            <div class="flex gap-4 mb-4 text-sm text-gray-400">
                <span>Total: {{ totalTracks }}</span>
                <span>Showing: {{ tracks.length }}</span>
            </div>

            <!-- Track Table -->
            <div class="overflow-x-auto">
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
                                {{ track.dance_style || '-' }}
                            </td>
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
                                    <button v-if="track.is_flagged"
                                            @click="unflagTrack(track)"
                                            :disabled="track.loading"
                                            class="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-2 py-1 rounded text-xs"
                                            title="Remove flag (admin override)">
                                        {{ track.loading ? '...' : '✓' }}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <div class="flex justify-between items-center mt-4">
                <button @click="prevPage" :disabled="offset === 0"
                        class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded">
                    ← Previous
                </button>
                <span class="text-gray-400">
                    Page {{ Math.floor(offset / limit) + 1 }} of {{ Math.ceil(totalTracks / limit) }}
                </span>
                <button @click="nextPage" :disabled="offset + limit >= totalTracks"
                        class="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded">
                    Next →
                </button>
            </div>
        </div>
    `
};
