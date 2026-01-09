/**
 * Playlist modal for adding tracks to playlists.
 *
 * Shows user's playlists and allows creating new ones.
 */
import { ref, onMounted, watch } from 'vue';
import { usePlaylists } from '../../hooks/usePlaylists.js';
import { useAuth } from '../../hooks/useAuth.js';

export default {
  name: 'PlaylistModal',

  props: {
    trackId: {
      type: String,
      required: true,
    },
    isOpen: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['close'],

  setup(props, { emit }) {
    const { playlists, fetchUserPlaylists, createPlaylist, addTrackToPlaylist } = usePlaylists();
    const { isAuthenticated } = useAuth();

    const showCreateForm = ref(false);
    const newPlaylistName = ref('');
    const adding = ref(false);

    onMounted(() => {
      if (isAuthenticated.value) {
        fetchUserPlaylists();
      }
    });

    // Lock body scroll when modal is open
    watch(() => props.isOpen, (isOpen) => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    });

    const handleAddToPlaylist = async (playlistId) => {
      adding.value = true;
      const success = await addTrackToPlaylist(playlistId, props.trackId);
      adding.value = false;

      if (success) {
        emit('close');
      }
    };

    const handleCreateAndAdd = async () => {
      if (!newPlaylistName.value.trim()) return;

      adding.value = true;
      const playlist = await createPlaylist(newPlaylistName.value.trim());
      if (playlist) {
        await addTrackToPlaylist(playlist.id, props.trackId);
        emit('close');
      }
      adding.value = false;
    };

    return {
      playlists,
      showCreateForm,
      newPlaylistName,
      adding,
      handleAddToPlaylist,
      handleCreateAndAdd,
    };
  },

  template: `
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4"
      @click.self="$emit('close')"
    >
      <div class="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold">Lägg till i spellista</h3>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Create New Playlist -->
        <div v-if="!showCreateForm" class="mb-4">
          <button
            @click="showCreateForm = true"
            class="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 hover:border-indigo-500 hover:bg-indigo-50 text-gray-700 font-medium transition"
          >
            + Skapa ny spellista
          </button>
        </div>

        <div v-else class="mb-4 p-4 border border-gray-200 rounded-lg">
          <input
            v-model="newPlaylistName"
            type="text"
            placeholder="Namn på spellista"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            @keyup.enter="handleCreateAndAdd"
          >
          <div class="flex gap-2">
            <button
              @click="handleCreateAndAdd"
              :disabled="!newPlaylistName.trim() || adding"
              class="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {{ adding ? 'Skapar...' : 'Skapa' }}
            </button>
            <button
              @click="showCreateForm = false"
              :disabled="adding"
              class="flex-1 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              Avbryt
            </button>
          </div>
        </div>

        <!-- Existing Playlists -->
        <div v-if="playlists.length > 0" class="space-y-2">
          <button
            v-for="playlist in playlists"
            :key="playlist.id"
            @click="handleAddToPlaylist(playlist.id)"
            :disabled="adding"
            class="w-full text-left border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50 flex items-center justify-between group transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div>
              <div class="font-medium text-gray-900">{{ playlist.name }}</div>
              <div class="text-sm text-gray-500">{{ playlist.track_count }} låtar</div>
            </div>
            <svg class="w-5 h-5 text-gray-400 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <div v-else-if="!showCreateForm" class="text-center text-gray-500 py-8">
          <p class="mb-2">Du har inga spellistor ännu</p>
          <button
            @click="showCreateForm = true"
            class="text-indigo-600 hover:underline font-medium"
          >
            Skapa din första spellista
          </button>
        </div>
      </div>
    </div>
  `,
};
