/**
 * Public shared playlist view.
 *
 * Allows anyone to view a public playlist via share token without authentication.
 */
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlaylists } from '../hooks/usePlaylists';
import { useAuth } from '../hooks/useAuth';

export default {
  name: 'SharedPlaylistPage',

  setup() {
    const route = useRoute();
    const router = useRouter();
    const { fetchPlaylistByShareToken, currentPlaylist, loading } = usePlaylists();
    const { isAuthenticated } = useAuth();

    const shareToken = computed(() => {
      const t = route.params.token;
      return (Array.isArray(t) ? t[0] : t) ?? '';
    });
    const playlist = computed(() => currentPlaylist.value);
    const error = ref(null);

    onMounted(async () => {
      error.value = null;
      const token = shareToken.value;
      if (!token) {
        error.value = 'Spellistan kunde inte hittas eller är inte längre offentlig.';
        return;
      }
      const result = await fetchPlaylistByShareToken(token);
      if (!result) {
        error.value = 'Spellistan kunde inte hittas eller är inte längre offentlig.';
      }
    });

    const formatDuration = (ms) => {
      if (!ms) return '0 min';
      const minutes = Math.floor(ms / 60000);
      if (minutes < 60) return `${minutes} min`;
      const hours = Math.floor(minutes / 60);
      const remainingMins = minutes % 60;
      return `${hours}h ${remainingMins}m`;
    };

    const goToLogin = () => {
      sessionStorage.setItem('returnUrl', route.fullPath);
      router.push({ name: 'discovery' });
    };

    return {
      playlist,
      loading,
      error,
      isAuthenticated,
      formatDuration,
      goToLogin,
    };
  },

  template: `
    <div class="max-w-4xl mx-auto px-4 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p class="text-gray-600 mt-4">Laddar spellista...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <p class="text-gray-500 text-lg mb-4">{{ error }}</p>
        <router-link to="/" class="text-indigo-600 hover:underline font-medium">
          Gå till startsidan
        </router-link>
      </div>

      <!-- Playlist Content -->
      <div v-else-if="playlist">
        <!-- Header -->
        <div class="mb-8">
          <div class="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Offentlig spellista
          </div>
          <h1 class="text-3xl font-bold text-gray-900">{{ playlist.name }}</h1>
          <p v-if="playlist.description" class="text-gray-600 mt-2">{{ playlist.description }}</p>

          <!-- Owner info -->
          <div class="flex items-center gap-3 mt-4">
            <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
              {{ playlist.owner?.display_name?.[0] || playlist.owner?.username?.[0] || '?' }}
            </div>
            <div>
              <span class="text-gray-700 font-medium">{{ playlist.owner?.display_name || playlist.owner?.username }}</span>
              <span class="text-gray-400 ml-1">@{{ playlist.owner?.username }}</span>
            </div>
          </div>

          <div class="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span>{{ playlist.track_count || 0 }} låtar</span>
            <span>{{ formatDuration(playlist.total_duration_ms) }}</span>
          </div>
        </div>

        <!-- CTA for non-authenticated users -->
        <div v-if="!isAuthenticated" class="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
          <p class="text-indigo-800">
            Vill du skapa egna spellistor och spara dina favoritlåtar?
          </p>
          <button
            @click="goToLogin"
            class="mt-2 text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
          >
            Logga in eller skapa konto
          </button>
        </div>

        <!-- Tracks List -->
        <div v-if="playlist.tracks && playlist.tracks.length > 0" class="space-y-2">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Låtar</h2>
          <div
            v-for="(item, index) in playlist.tracks"
            :key="item.track?.id || index"
            class="flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition"
          >
            <!-- Track number -->
            <span class="text-gray-400 w-6 text-right text-sm">{{ index + 1 }}</span>

            <!-- Track info -->
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-900 truncate">{{ item.track?.title || 'Okänd låt' }}</p>
              <p class="text-sm text-gray-500 truncate">
                {{ item.track?.artist?.name || 'Okänd artist' }}
                <span v-if="item.track?.album?.name"> &bull; {{ item.track.album.name }}</span>
              </p>
            </div>

            <!-- Duration -->
            <span class="text-sm text-gray-400">
              {{ item.track?.duration_ms ? formatDuration(item.track.duration_ms) : '--' }}
            </span>
          </div>
        </div>

        <!-- Empty playlist -->
        <div v-else class="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
          </svg>
          <p class="text-gray-500">Denna spellista är tom</p>
        </div>
      </div>
    </div>
  `,
};
