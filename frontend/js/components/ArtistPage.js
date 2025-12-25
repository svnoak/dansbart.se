import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { useArtist } from '../hooks/artist.js';
import TrackCard from './TrackCard.js';

export default {
  name: 'ArtistPage',
  components: {
    'track-card': TrackCard
  },
  props: {
    artistId: {
      type: String,
      required: true
    },
    currentTrack: Object,
    isPlaying: Boolean,
    isSpotifyMode: Boolean
  },
  emits: ['play', 'navigate-to-album', 'show-similar', 'add-to-queue'],
  setup(props, { emit }) {
    const artistLogic = useArtist();
    const scrollTrigger = ref(null);
    let observer = null;

    const createObserver = () => {
      if (observer) observer.disconnect();

      observer = new IntersectionObserver(
        entries => {
          const entry = entries[0];

          if (entry.isIntersecting) {
            if (!artistLogic.loadingTracks.value && artistLogic.hasMore.value) {
              artistLogic.loadMore();
            }
          }
        },
        {
          root: null,
          rootMargin: '200px',
          threshold: 0,
        }
      );

      if (scrollTrigger.value) {
        observer.observe(scrollTrigger.value);
      }
    };

    onMounted(async () => {
      await artistLogic.fetchArtist(props.artistId);
      await artistLogic.fetchArtistTracks(props.artistId);
    });

    onUnmounted(() => {
      if (observer) observer.disconnect();
    });

    watch(
      () => artistLogic.loadingTracks.value,
      async isLoading => {
        if (!isLoading) {
          await nextTick();
          createObserver();
        }
      }
    );

    watch(scrollTrigger, el => {
      if (el) createObserver();
    });

    const handleAlbumClick = (albumId) => {
      emit('navigate-to-album', albumId);
    };

    const handlePlay = (track) => {
      emit('play', track);
    };

    const isTrackPlaying = (track) => {
      return props.currentTrack?.id === track.id && props.isPlaying;
    };

    const goBack = () => {
      window.history.back();
    };

    return {
      ...artistLogic,
      scrollTrigger,
      handleAlbumClick,
      handlePlay,
      isTrackPlaying,
      goBack,
    };
  },
  template: `
    <div class="max-w-4xl mx-auto px-4 py-6">
      <!-- Back Button -->
      <button
        @click="goBack"
        class="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        <span>Tillbaka</span>
      </button>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-20">
        <p class="text-red-600 mb-4">{{ error }}</p>
        <button @click="$emit('navigate-to-page', 'discovery')" class="btn-secondary">
          Tillbaka till startsidan
        </button>
      </div>

      <!-- Artist Content -->
      <div v-else-if="artist">
        <!-- Artist Header -->
        <div class="mb-8">
          <div class="flex items-start gap-6">
            <img
              v-if="artist.image_url"
              :src="artist.image_url"
              :alt="artist.name"
              class="w-32 h-32 rounded-full object-cover shadow-lg"
            />
            <div class="flex-1">
              <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                {{ artist.name }}
              </h1>
              <p class="text-lg text-gray-600">
                {{ artist.total_tracks }} låtar
              </p>
            </div>
          </div>
        </div>

        <!-- Albums Section -->
        <div v-if="artist.albums && artist.albums.length > 0" class="mb-8">
          <h2 class="text-2xl font-bold text-gray-900 mb-4">Album</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              v-for="album in artist.albums"
              :key="album.id"
              @click="handleAlbumClick(album.id)"
              class="cursor-pointer group bg-white rounded-lg shadow-md p-4 transition-all hover:shadow-lg hover:bg-gray-50"
            >
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 text-xl">
                  🎵
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">{{ album.title }}</h3>
                  <p v-if="album.release_date" class="text-sm text-gray-500">{{ album.release_date }}</p>
                </div>
                <svg class="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Tracks Section -->
        <div>
          <h2 class="text-2xl font-bold text-gray-900 mb-4">Låtar</h2>

          <!-- Loading state for tracks -->
          <div v-if="loadingTracks && tracks.length === 0" class="flex justify-center py-10">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>

          <!-- Track List -->
          <div v-else-if="tracks.length > 0" class="space-y-4">
            <track-card
              v-for="track in tracks"
              :key="track.id"
              :track="track"
              :is-playing="isTrackPlaying(track)"
              :is-spotify-mode="isSpotifyMode"
              @play="handlePlay"
              @show-similar="$emit('show-similar', $event)"
              @add-to-queue="$emit('add-to-queue', $event)"
              @navigate-to-album="handleAlbumClick"
            ></track-card>

            <!-- Infinite scroll trigger -->
            <div ref="scrollTrigger" class="h-4"></div>

            <!-- Loading more indicator -->
            <div v-if="loadingTracks" class="flex justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
            </div>
          </div>

          <!-- No tracks state -->
          <div v-else class="text-center py-10 text-gray-500">
            Inga låtar hittades för den här artisten.
          </div>
        </div>
      </div>
    </div>
  `
};
