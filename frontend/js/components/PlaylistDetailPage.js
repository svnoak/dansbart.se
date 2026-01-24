/**
 * Individual playlist detail page.
 *
 * Shows a single playlist with its tracks and allows editing.
 * Includes sharing functionality for playlist owners.
 */
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlaylists } from '../hooks/usePlaylists.js';
import { useAuth } from '../hooks/useAuth.js';
import SharePlaylistModal from './modals/SharePlaylistModal.js';
import TrackCard from './TrackCard.js';

export default {
  name: 'PlaylistDetailPage',

  components: {
    SharePlaylistModal,
    TrackCard
  },

  setup() {
    const route = useRoute();
    const router = useRouter();
    const {
      currentPlaylist,
      loading,
      fetchPlaylist,
      updatePlaylist,
      removeTrackFromPlaylist,
      copyShareLink,
    } = usePlaylists();
    const { user: currentUser } = useAuth();

    const playlistId = computed(() => route.params.id);
    const playlist = computed(() => currentPlaylist.value);
    const showShareModal = ref(false);
    const editingName = ref(false);
    const editingDescription = ref(false);
    const editName = ref('');
    const editDescription = ref('');

    const isOwner = computed(() => {
      if (!playlist.value || !currentUser.value) return false;
      return playlist.value.owner?.id === currentUser.value.id ||
             playlist.value.user_id === currentUser.value.id;
    });

    const canEdit = computed(() => {
      // Owner can always edit
      if (isOwner.value) return true;
      // Check if user is a collaborator with edit permission
      if (!playlist.value || !currentUser.value) return false;
      const collaborators = playlist.value.collaborators || [];
      const userCollab = collaborators.find(c =>
        c.user_id === currentUser.value.id && c.status === 'accepted'
      );
      return userCollab?.permission === 'edit';
    });

    // Fetch playlist when route changes
    watch(playlistId, async (newId) => {
      if (newId) {
        await fetchPlaylist(newId);
      }
    }, { immediate: true });

    onMounted(async () => {
      if (playlistId.value) {
        await fetchPlaylist(playlistId.value);
      }
    });

    const goBack = () => {
      router.push({ name: 'playlists' });
    };

    const formatDuration = (ms) => {
      if (!ms) return '0:00';
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const formatTotalDuration = (ms) => {
      if (!ms) return '0 min';
      const minutes = Math.floor(ms / 60000);
      if (minutes < 60) return `${minutes} min`;
      const hours = Math.floor(minutes / 60);
      const remainingMins = minutes % 60;
      return `${hours}h ${remainingMins}m`;
    };

    const startEditingName = () => {
      editName.value = playlist.value.name;
      editingName.value = true;
    };

    const saveName = async () => {
      if (editName.value.trim() && editName.value !== playlist.value.name) {
        await updatePlaylist(playlist.value.id, { name: editName.value.trim() });
        await fetchPlaylist(playlistId.value);
      }
      editingName.value = false;
    };

    const startEditingDescription = () => {
      editDescription.value = playlist.value.description || '';
      editingDescription.value = true;
    };

    const saveDescription = async () => {
      if (editDescription.value !== playlist.value.description) {
        await updatePlaylist(playlist.value.id, { description: editDescription.value.trim() || null });
        await fetchPlaylist(playlistId.value);
      }
      editingDescription.value = false;
    };

    const handleRemoveTrack = async (trackId) => {
      if (confirm('Ta bort låten från spellistan?')) {
        await removeTrackFromPlaylist(playlist.value.id, trackId);
      }
    };

    const handleCopyShareLink = async () => {
      await copyShareLink(playlist.value);
    };

    const handlePlaylistUpdated = async () => {
      // Refresh playlist data after sharing modal updates
      await fetchPlaylist(playlistId.value);
    };

    return {
      playlist,
      loading,
      isOwner,
      canEdit,
      showShareModal,
      editingName,
      editingDescription,
      editName,
      editDescription,
      goBack,
      formatDuration,
      formatTotalDuration,
      startEditingName,
      saveName,
      startEditingDescription,
      saveDescription,
      handleRemoveTrack,
      handleCopyShareLink,
      handlePlaylistUpdated,
    };
  },

  template: /*html*/`
    <div class="max-w-4xl mx-auto px-4 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p class="text-gray-600 mt-4">Laddar spellista...</p>
      </div>

      <!-- Not Found -->
      <div v-else-if="!playlist" class="text-center py-12">
        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-gray-500 text-lg mb-4">Spellista hittades inte</p>
        <button
          @click="goBack"
          class="text-indigo-600 hover:underline font-medium"
        >
          Tillbaka till spellistor
        </button>
      </div>

      <!-- Playlist Content -->
      <div v-else>
        <!-- Header -->
        <div class="mb-6">
          <button
            @click="goBack"
            class="text-indigo-600 hover:underline mb-4 flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
            Tillbaka till spellistor
          </button>

          <!-- Title (editable) -->
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div v-if="editingName && canEdit" class="flex items-center gap-2">
                <input
                  v-model="editName"
                  @keyup.enter="saveName"
                  @keyup.escape="editingName = false"
                  class="text-3xl font-bold text-gray-900 border border-indigo-300 rounded px-2 py-1 w-full"
                  autofocus
                >
                <button @click="saveName" class="text-green-600 hover:text-green-800">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                </button>
                <button @click="editingName = false" class="text-gray-400 hover:text-gray-600">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <h1
                v-else
                class="text-3xl font-bold text-gray-900 group cursor-pointer"
                :class="{ 'hover:text-indigo-600': canEdit }"
                @click="canEdit && startEditingName()"
              >
                {{ playlist.name }}
                <svg v-if="canEdit" class="w-5 h-5 inline opacity-0 group-hover:opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                </svg>
              </h1>

              <!-- Description (editable) -->
              <div v-if="editingDescription && canEdit" class="mt-2">
                <textarea
                  v-model="editDescription"
                  @keyup.escape="editingDescription = false"
                  class="w-full border border-indigo-300 rounded px-2 py-1 text-gray-600"
                  rows="2"
                  placeholder="Lägg till en beskrivning..."
                ></textarea>
                <div class="flex gap-2 mt-1">
                  <button @click="saveDescription" class="text-sm text-indigo-600 hover:underline">Spara</button>
                  <button @click="editingDescription = false" class="text-sm text-gray-400 hover:underline">Avbryt</button>
                </div>
              </div>
              <p
                v-else-if="playlist.description || canEdit"
                class="text-gray-600 mt-2 cursor-pointer"
                :class="{ 'hover:text-indigo-600 italic': canEdit && !playlist.description }"
                @click="canEdit && startEditingDescription()"
              >
                {{ playlist.description || (canEdit ? 'Klicka för att lägga till beskrivning...' : '') }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <!-- Share button -->
              <button
                v-if="isOwner"
                @click="showShareModal = true"
                class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-medium"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                </svg>
                Dela
              </button>

              <!-- Copy link (if public) -->
              <button
                v-if="playlist.is_public"
                @click="handleCopyShareLink"
                class="flex items-center gap-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                title="Kopiera länk"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Meta info -->
          <div class="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span>{{ playlist.track_count || 0 }} låtar</span>
            <span>{{ formatTotalDuration(playlist.total_duration_ms) }}</span>
            <span v-if="playlist.is_public" class="flex items-center gap-1 text-green-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Publik
            </span>
            <!-- Owner badge if not owner -->
            <span v-if="!isOwner && playlist.owner" class="flex items-center gap-1">
              <span class="text-gray-400">av</span>
              <span class="font-medium">@{{ playlist.owner.username }}</span>
            </span>
          </div>
        </div>

        <!-- Tracks List -->
        <div v-if="playlist.tracks && playlist.tracks.length > 0" class="space-y-1">
          <!--- <div
            v-for="(item, index) in playlist.tracks"
            :key="item.track?.id || index"
            class="flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition group"
          >
            <span class="text-gray-400 w-6 text-right text-sm">{{ index + 1 }}</span>

            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-900 truncate">{{ item.track?.title || 'Okänd låt' }}</p>
              <p class="text-sm text-gray-500 truncate">
                {{ item.track?.artist?.name || 'Okänd artist' }}
                <span v-if="item.track?.album?.name"> &bull; {{ item.track.album.name }}</span>
              </p>
            </div>
            <span class="text-sm text-gray-400">
              {{ item.track?.duration_ms ? formatDuration(item.track.duration_ms) : '--:--' }}
            </span>
            <button
              v-if="canEdit"
              @click="handleRemoveTrack(item.track?.id)"
              class="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition"
              title="Ta bort från spellista"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
          -->

          <track-card
            v-for="track in playlist.tracks"
            :key="track.id"
            :track="track"
            :current-track="currentTrack"
            :is-spotify-mode="activeSource === 'youtube'"
            :is-playing="isPlaying"
            @play="$emit('play', $event)"
            @stop="$emit('stop')"
            @refresh="$emit('refresh')"
            @filter-style="$emit('filter-style', $event)"
            @show-similar="$emit('show-similar', $event)"
            @add-to-queue="$emit('add-to-queue', $event)"
            @navigate-to-artist="$emit('navigate-to-artist', $event)"
            @navigate-to-album="$emit('navigate-to-album', $event)"
          ></track-card>
        </div>

        <!-- Empty playlist -->
        <div v-else class="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
          </svg>
          <p class="text-gray-500">Denna spellista är tom</p>
          <p class="text-sm text-gray-400 mt-1">Lägg till låtar från sökresultaten</p>
        </div>
      </div>

      <!-- Share Modal -->
      <SharePlaylistModal
        v-if="playlist"
        :playlist="playlist"
        :show="showShareModal"
        @close="showShareModal = false"
        @updated="handlePlaylistUpdated"
      />
    </div>
  `,
};
