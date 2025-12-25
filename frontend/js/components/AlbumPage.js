import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { useAlbum } from '../hooks/album.js';
import TrackCard from './TrackCard.js';

export default {
  name: 'AlbumPage',
  components: {
    'track-card': TrackCard
  },
  props: {
    albumId: {
      type: String,
      required: true
    },
    currentTrack: Object,
    isPlaying: Boolean,
    isSpotifyMode: Boolean
  },
  emits: ['play', 'navigate-to-artist', 'show-similar', 'add-to-queue'],
  setup(props, { emit }) {
    const albumLogic = useAlbum();
    const scrollTrigger = ref(null);
    let observer = null;

    const createObserver = () => {
      if (observer) observer.disconnect();

      observer = new IntersectionObserver(
        entries => {
          const entry = entries[0];

          if (entry.isIntersecting) {
            if (!albumLogic.loadingTracks.value && albumLogic.hasMore.value) {
              albumLogic.loadMore();
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
      await albumLogic.fetchAlbum(props.albumId);
      await albumLogic.fetchAlbumTracks(props.albumId);
    });

    onUnmounted(() => {
      if (observer) observer.disconnect();
    });

    watch(
      () => albumLogic.loadingTracks.value,
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

    const handleArtistClick = (artistId) => {
      emit('navigate-to-artist', artistId);
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
      ...albumLogic,
      scrollTrigger,
      handleArtistClick,
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

      <!-- Album Content -->
      <div v-else-if="album">
        <!-- Album Header -->
        <div class="mb-8">
          <div class="bg-white rounded-lg shadow-md p-6">
            <p class="text-sm text-gray-500 uppercase tracking-wide mb-1">Album</p>
            <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {{ album.title }}
            </h1>

            <!-- Artists -->
            <div class="mb-3">
              <span
                v-for="(artist, index) in album.all_artists"
                :key="artist.id"
                class="text-lg"
              >
                <a
                  @click.prevent="handleArtistClick(artist.id)"
                  href="#"
                  class="text-gray-900 hover:text-primary-600 hover:underline font-semibold"
                >
                  {{ artist.name }}
                </a>
                <span v-if="index < album.all_artists.length - 1" class="text-gray-500">, </span>
              </span>
            </div>

            <div class="flex items-center gap-4 text-gray-600">
              <!-- Release Date -->
              <p v-if="album.release_date" class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                {{ album.release_date }}
              </p>

              <!-- Track Count -->
              <p class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                </svg>
                {{ album.total_tracks }} låtar
              </p>
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
              @navigate-to-artist="handleArtistClick"
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
            Inga låtar hittades för det här albumet.
          </div>
        </div>
      </div>
    </div>
  `
};
