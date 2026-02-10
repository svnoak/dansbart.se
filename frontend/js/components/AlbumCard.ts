import { defineComponent, type PropType } from 'vue';
import type { AlbumCardProps } from './types';

type AlbumWithDisplay = AlbumCardProps['album'];

export default defineComponent({
  name: 'AlbumCard',
  props: {
    album: {
      type: Object as PropType<AlbumWithDisplay>,
      required: true,
    },
  },
  emits: ['navigate-to-album', 'navigate-to-artist'],
  setup(props, { emit }) {
    const navigateToAlbum = (): void => {
      emit('navigate-to-album', props.album.id);
    };
    return { navigateToAlbum };
  },
  template: `
    <div
      @click="navigateToAlbum"
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
            <template v-if="album.allArtists && album.allArtists.length > 0">
              <template v-for="(artistName, index) in album.allArtists" :key="index">
                <span>{{ artistName }}</span>
                <span v-if="index < album.allArtists.length - 1">, </span>
              </template>
            </template>
            <span v-else-if="album.artistName">{{ album.artistName }}</span>
          </p>

          <!-- Release Date & Track Count -->
          <div class="flex items-center gap-3 text-xs text-gray-500">
            <span v-if="album.releaseDate">{{ album.releaseDate }}</span>
            <span>{{ album.trackCount ?? 0 }} {{ (album.trackCount === 1) ? 'låt' : 'låtar' }}</span>
          </div>
        </div>

        <!-- Chevron -->
        <svg class="w-6 h-6 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </div>
    </div>
  `,
});
