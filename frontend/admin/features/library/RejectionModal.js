/**
 * Rejection Modal Component
 * Enhanced modal for rejecting artists/albums with collaboration network selection
 */

import { ref, computed, watch } from 'vue';

export default {
  props: {
    show: Boolean,
    entityType: String, // 'artist' or 'album'
    entity: Object, // The main entity being rejected
    collaborationData: Object, // Data about collaborations
  },
  emits: ['close', 'confirm'],
  setup(props, { emit }) {
    // Selected items for rejection
    const selectedArtists = ref(new Set());
    const selectedAlbums = ref(new Set());
    const reason = ref('');

    // Reset selections when modal opens with new data
    watch(
      () => props.show,
      newVal => {
        if (newVal) {
          // Pre-select the main entity
          if (props.entityType === 'artist' && props.entity) {
            selectedArtists.value = new Set([props.entity.id]);
          } else if (props.entityType === 'album' && props.entity) {
            selectedAlbums.value = new Set([props.entity.id]);
          }
          reason.value = 'Rejected from library';
        } else {
          selectedArtists.value.clear();
          selectedAlbums.value.clear();
          reason.value = '';
        }
      }
    );

    // Computed properties
    const collaboratingArtists = computed(() => {
      if (!props.collaborationData || !props.collaborationData.artists) return [];
      return props.collaborationData.artists;
    });

    const collaboratingAlbums = computed(() => {
      if (!props.collaborationData || !props.collaborationData.albums) return [];
      return props.collaborationData.albums;
    });

    const totalTracksToDelete = computed(() => {
      let total = 0;

      // Add tracks from selected artists
      collaboratingArtists.value.forEach(artist => {
        if (selectedArtists.value.has(artist.id)) {
          total += artist.track_count || 0;
        }
      });

      // Note: tracks from albums are typically already counted in artist tracks
      // Only add if album rejection is separate from artist
      if (props.entityType === 'album') {
        collaboratingAlbums.value.forEach(album => {
          if (selectedAlbums.value.has(album.id)) {
            total += album.track_count || 0;
          }
        });
      }

      return total;
    });

    const hasSelections = computed(() => {
      return selectedArtists.value.size > 0 || selectedAlbums.value.size > 0;
    });

    // Methods
    const toggleArtist = artistId => {
      // Prevent deselecting the main entity
      if (props.entityType === 'artist' && artistId === props.entity.id) {
        return;
      }

      if (selectedArtists.value.has(artistId)) {
        selectedArtists.value.delete(artistId);
      } else {
        selectedArtists.value.add(artistId);
      }
    };

    const toggleAlbum = albumId => {
      // Prevent deselecting the main entity
      if (props.entityType === 'album' && albumId === props.entity.id) {
        return;
      }

      if (selectedAlbums.value.has(albumId)) {
        selectedAlbums.value.delete(albumId);
      } else {
        selectedAlbums.value.add(albumId);
      }
    };

    const selectAllArtists = () => {
      collaboratingArtists.value.forEach(artist => {
        selectedArtists.value.add(artist.id);
      });
    };

    const selectAllAlbums = () => {
      collaboratingAlbums.value.forEach(album => {
        selectedAlbums.value.add(album.id);
      });
    };

    const close = () => {
      emit('close');
    };

    const confirm = () => {
      emit('confirm', {
        artistIds: Array.from(selectedArtists.value),
        albumIds: Array.from(selectedAlbums.value),
        reason: reason.value || 'Rejected from library',
      });
    };

    return {
      selectedArtists,
      selectedAlbums,
      reason,
      collaboratingArtists,
      collaboratingAlbums,
      totalTracksToDelete,
      hasSelections,
      toggleArtist,
      toggleAlbum,
      selectAllArtists,
      selectAllAlbums,
      close,
      confirm,
    };
  },
  template: /*html*/ `
        <div v-if="show" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" @click.self="close">
            <div class="bg-gray-800 rounded-lg border border-gray-700 max-w-4xl w-full max-h-[90vh] flex flex-col">
                <!-- Header -->
                <div class="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h3 class="text-xl font-bold">🗑️ Reject {{ entityType === 'artist' ? 'Artist' : 'Album' }} Network</h3>
                    <button @click="close" class="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>

                <!-- Content -->
                <div class="p-4 overflow-y-auto flex-1">
                    <!-- Main Entity Info -->
                    <div class="bg-red-900/20 border border-red-700/30 rounded p-4 mb-4">
                        <div class="flex items-center gap-3">
                            <div class="text-3xl">⚠️</div>
                            <div class="flex-1">
                                <div class="font-bold text-lg">{{ entity?.name || entity?.title }}</div>
                                <div class="text-sm text-gray-400 mt-1">
                                    This {{ entityType }} will be deleted and added to the blocklist
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Warning if no collaborations -->
                    <div v-if="collaboratingArtists.length === 0 && collaboratingAlbums.length === 0"
                         class="bg-green-900/20 border border-green-700/30 rounded p-4 mb-4">
                        <div class="flex items-center gap-3">
                            <div class="text-2xl">✅</div>
                            <div>
                                <div class="font-bold">Safe to Reject</div>
                                <div class="text-sm text-gray-400">This {{ entityType }} has no collaborations with other artists.</div>
                            </div>
                        </div>
                    </div>

                    <!-- Collaborating Artists Section -->
                    <div v-if="collaboratingArtists.length > 0" class="mb-6">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-bold text-lg">👥 Collaborating Artists ({{ collaboratingArtists.length }})</h4>
                            <button @click="selectAllArtists" class="text-sm bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded">
                                Select All
                            </button>
                        </div>
                        <div class="space-y-2">
                            <div v-for="artist in collaboratingArtists" :key="artist.id"
                                 class="bg-gray-900 rounded border border-gray-700 p-3 flex items-center gap-3 hover:bg-gray-800/50 transition-colors"
                                 :class="artist.id === entity?.id ? 'ring-2 ring-red-500' : ''">

                                <input type="checkbox"
                                       :checked="selectedArtists.has(artist.id)"
                                       @change="toggleArtist(artist.id)"
                                       :disabled="entityType === 'artist' && artist.id === entity?.id"
                                       class="w-5 h-5 rounded border-gray-600 bg-gray-800 text-red-600 focus:ring-red-500 disabled:opacity-50">

                                <img v-if="artist.image_url" :src="artist.image_url" class="w-12 h-12 rounded object-cover">
                                <div v-else class="w-12 h-12 bg-gray-800 rounded flex items-center justify-center text-lg">👤</div>

                                <div class="flex-1 min-w-0">
                                    <div class="font-bold text-sm truncate flex items-center gap-2">
                                        {{ artist.name }}
                                        <span v-if="entityType === 'artist' && artist.id === entity?.id"
                                              class="text-xs bg-red-600 px-2 py-0.5 rounded">
                                            PRIMARY
                                        </span>
                                    </div>
                                    <div class="text-xs text-gray-400 mt-1">
                                        {{ artist.track_count }} tracks
                                        <span v-if="artist.shared_track_count" class="text-amber-400">
                                            ({{ artist.shared_track_count }} collaborations)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Collaborating Albums Section -->
                    <div v-if="collaboratingAlbums.length > 0" class="mb-6">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-bold text-lg">💿 Collaborative Albums ({{ collaboratingAlbums.length }})</h4>
                            <button @click="selectAllAlbums" class="text-sm bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded">
                                Select All
                            </button>
                        </div>
                        <div class="space-y-2">
                            <div v-for="album in collaboratingAlbums" :key="album.id"
                                 class="bg-gray-900 rounded border border-gray-700 p-3 flex items-center gap-3 hover:bg-gray-800/50 transition-colors"
                                 :class="album.id === entity?.id ? 'ring-2 ring-red-500' : ''">

                                <input type="checkbox"
                                       :checked="selectedAlbums.has(album.id)"
                                       @change="toggleAlbum(album.id)"
                                       :disabled="entityType === 'album' && album.id === entity?.id"
                                       class="w-5 h-5 rounded border-gray-600 bg-gray-800 text-red-600 focus:ring-red-500 disabled:opacity-50">

                                <img v-if="album.cover_image_url" :src="album.cover_image_url" class="w-12 h-12 rounded object-cover">
                                <div v-else class="w-12 h-12 bg-gray-800 rounded flex items-center justify-center text-lg">💿</div>

                                <div class="flex-1 min-w-0">
                                    <div class="font-bold text-sm truncate flex items-center gap-2">
                                        {{ album.title }}
                                        <span v-if="entityType === 'album' && album.id === entity?.id"
                                              class="text-xs bg-red-600 px-2 py-0.5 rounded">
                                            PRIMARY
                                        </span>
                                    </div>
                                    <div class="text-xs text-gray-400 mt-1">
                                        {{ album.artists?.join(', ') || album.artist_name }}
                                    </div>
                                    <div class="text-xs text-gray-500">
                                        {{ album.track_count }} tracks
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Reason Input -->
                    <div class="mb-4">
                        <label class="block text-sm font-bold mb-2">Rejection Reason (Optional)</label>
                        <input v-model="reason"
                               type="text"
                               placeholder="e.g., Not folk music, wrong genre, etc."
                               class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                    </div>

                    <!-- Summary -->
                    <div class="bg-amber-900/20 border border-amber-700/30 rounded p-4">
                        <div class="font-bold mb-2">Summary:</div>
                        <ul class="text-sm text-gray-300 space-y-1">
                            <li>• <span class="font-bold">{{ selectedArtists.size }}</span> artist(s) will be rejected and blocklisted</li>
                            <li>• <span class="font-bold">{{ selectedAlbums.size }}</span> album(s) will be deleted</li>
                            <li>• Approximately <span class="font-bold">{{ totalTracksToDelete }}</span> track(s) will be deleted</li>
                            <li class="text-red-400">• This action cannot be undone</li>
                        </ul>
                    </div>
                </div>

                <!-- Footer -->
                <div class="p-4 border-t border-gray-700 flex gap-3 justify-end">
                    <button @click="close"
                            class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-bold">
                        Cancel
                    </button>
                    <button @click="confirm"
                            :disabled="!hasSelections"
                            class="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded font-bold">
                        🗑️ Reject Selected ({{ selectedArtists.size + selectedAlbums.size }})
                    </button>
                </div>
            </div>
        </div>
    `,
};
