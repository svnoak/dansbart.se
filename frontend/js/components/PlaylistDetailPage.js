/**
 * Individual playlist detail page.
 *
 * Shows a single playlist with its tracks and allows editing.
 */
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlaylists } from '../hooks/usePlaylists.js';

export default {
  name: 'PlaylistDetailPage',

  setup() {
    const route = useRoute();
    const router = useRouter();
    const { playlists, loading, fetchUserPlaylists } = usePlaylists();

    const playlistId = computed(() => route.params.id);
    const playlist = computed(() =>
      playlists.value.find(p => p.id === playlistId.value)
    );

    onMounted(() => {
      fetchUserPlaylists();
    });

    const goBack = () => {
      router.push({ name: 'playlists' });
    };

    return {
      playlist,
      loading,
      goBack,
    };
  },

  template: `
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
          <h1 class="text-3xl font-bold text-gray-900">{{ playlist.name }}</h1>
          <p v-if="playlist.description" class="text-gray-600 mt-2">{{ playlist.description }}</p>
          <div class="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span>{{ playlist.track_count }} låtar</span>
            <span v-if="playlist.is_public" class="flex items-center gap-1 text-green-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Publik
            </span>
          </div>
        </div>

        <!-- Empty playlist -->
        <div v-if="playlist.track_count === 0" class="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
          </svg>
          <p class="text-gray-500">Denna spellista är tom</p>
          <p class="text-sm text-gray-400 mt-1">Lägg till låtar från sökresultaten</p>
        </div>

        <!-- TODO: Track list will go here when we implement add-to-playlist functionality -->
      </div>
    </div>
  `,
};
