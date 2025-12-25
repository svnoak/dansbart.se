export default {
  name: 'AlbumCard',
  props: {
    album: {
      type: Object,
      required: true
    }
  },
  emits: ['navigate-to-album', 'navigate-to-artist'],
  template: `
    <div
      @click="$emit('navigate-to-album', album.id)"
      class="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-all cursor-pointer group"
    >
      <div class="flex items-center gap-4">
        <!-- Album Icon -->
        <div class="w-16 h-16 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 text-2xl">
          🎵
        </div>

        <!-- Album Info -->
        <div class="flex-1 min-w-0">
          <h3 class="text-xl font-bold text-gray-900 truncate group-hover:text-primary-600 transition-colors mb-1">
            {{ album.title }}
          </h3>

          <!-- Artist Names -->
          <p class="text-gray-600 text-sm mb-1 truncate">
            <template v-if="album.all_artists && album.all_artists.length > 0">
              <template v-for="(artistName, index) in album.all_artists" :key="index">
                <span>{{ artistName }}</span>
                <span v-if="index < album.all_artists.length - 1">, </span>
              </template>
            </template>
            <span v-else-if="album.artist_name">{{ album.artist_name }}</span>
          </p>

          <!-- Release Date & Track Count -->
          <div class="flex items-center gap-3 text-xs text-gray-500">
            <span v-if="album.release_date">{{ album.release_date }}</span>
            <span>{{ album.total_tracks }} {{ album.total_tracks === 1 ? 'låt' : 'låtar' }}</span>
          </div>
        </div>

        <!-- Chevron -->
        <svg class="w-6 h-6 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </div>
    </div>
  `
};
