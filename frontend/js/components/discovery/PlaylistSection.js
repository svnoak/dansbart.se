import EmptyState from './EmptyState.js';

export default {
  name: 'PlaylistSection',
  components: {
    'empty-state': EmptyState
  },
  props: {
    playlists: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    currentTrack: Object,
    isPlaying: Boolean,
    isSpotifyMode: Boolean
  },
  emits: ['play', 'stop', 'view-all'],
  setup() {
    const formatDuration = (ms) => {
      if (!ms) return '';
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getMainStyle = (track) => {
      if (!track.dance_styles || track.dance_styles.length === 0) return '';
      const mainStyle = track.dance_styles.find(ds => ds.is_primary) || track.dance_styles[0];
      return mainStyle.dance_style;
    };

    return {
      formatDuration,
      getMainStyle
    };
  },
  template: `
    <section class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Kurerade spellistor</h2>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-6">
        <div v-for="i in 3" :key="i" class="bg-white rounded-lg shadow-sm p-5 animate-pulse">
          <div class="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div class="space-y-2">
            <div v-for="j in 3" :key="j" class="h-12 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <empty-state v-else-if="playlists.length === 0" type="playlists" />

      <!-- Playlist Cards -->
      <div v-else class="space-y-6">
        <div
          v-for="playlist in playlists"
          :key="playlist.id"
          class="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
        >
          <!-- Playlist Header -->
          <div class="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 border-b border-gray-100">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="font-bold text-gray-900 text-lg mb-1">{{ playlist.name }}</h3>
                <p class="text-sm text-gray-600">{{ playlist.description }}</p>
              </div>
              <div class="text-sm text-gray-500 ml-4">
                {{ playlist.track_count }} låtar
              </div>
            </div>
          </div>

          <!-- Playlist Tracks -->
          <div class="divide-y divide-gray-100">
            <div
              v-for="(track, index) in playlist.tracks"
              :key="track.id"
              class="p-3 hover:bg-gray-50 transition-colors group"
            >
              <div class="flex items-center gap-3">
                <!-- Track Number -->
                <div class="text-xs text-gray-400 w-6 text-center flex-shrink-0">
                  {{ index + 1 }}
                </div>

                <!-- Album Art Placeholder -->
                <div
                  class="w-10 h-10 rounded bg-gradient-to-br from-indigo-100 to-purple-100 flex-shrink-0 flex items-center justify-center overflow-hidden"
                  :class="{ 'ring-2 ring-indigo-500': currentTrack?.id === track.id && isPlaying }"
                >
                  <img
                    v-if="track.album?.cover_image_url"
                    :src="track.album.cover_image_url"
                    :alt="track.album?.name"
                    class="w-full h-full object-cover"
                  />
                  <span v-else class="text-xs text-gray-400">♪</span>
                </div>

                <!-- Track Info -->
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm text-gray-900 truncate">{{ track.title }}</div>
                  <div class="text-xs text-gray-500 truncate">
                    {{ track.artists?.[0]?.name || 'Okänd artist' }}
                    <span v-if="getMainStyle(track)" class="mx-1">•</span>
                    <span v-if="getMainStyle(track)" class="text-indigo-600">{{ getMainStyle(track) }}</span>
                  </div>
                </div>

                <!-- Duration -->
                <div class="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                  {{ formatDuration(track.duration_ms) }}
                </div>

                <!-- Play Buttons -->
                <div class="flex items-center gap-1 flex-shrink-0">
                  <!-- Spotify Play Button -->
                  <button
                    v-if="track.playback_links?.spotify_id"
                    @click="$emit(currentTrack?.id === track.id && isPlaying ? 'stop' : 'play', track, 'spotify')"
                    class="p-2 rounded-lg transition-all"
                    :class="currentTrack?.id === track.id && isPlaying && isSpotifyMode
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-green-50 text-green-600 hover:bg-green-100 opacity-0 group-hover:opacity-100'"
                    :title="currentTrack?.id === track.id && isPlaying && isSpotifyMode ? 'Pausa' : 'Spela från Spotify'"
                  >
                    <svg v-if="currentTrack?.id === track.id && isPlaying && isSpotifyMode" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                    <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </button>

                  <!-- YouTube Play Button -->
                  <button
                    v-if="track.playback_links?.youtube_id"
                    @click="$emit(currentTrack?.id === track.id && isPlaying ? 'stop' : 'play', track, 'youtube')"
                    class="p-2 rounded-lg transition-all"
                    :class="currentTrack?.id === track.id && isPlaying && !isSpotifyMode
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-red-50 text-red-600 hover:bg-red-100 opacity-0 group-hover:opacity-100'"
                    :title="currentTrack?.id === track.id && isPlaying && !isSpotifyMode ? 'Pausa' : 'Spela från YouTube'"
                  >
                    <svg v-if="currentTrack?.id === track.id && isPlaying && !isSpotifyMode" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                    <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- View All Button -->
          <div class="p-3 bg-gray-50 border-t border-gray-100">
            <button
              @click="$emit('view-all', playlist)"
              class="w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Visa alla {{ playlist.track_count }} låtar
            </button>
          </div>
        </div>
      </div>
    </section>
  `
};
