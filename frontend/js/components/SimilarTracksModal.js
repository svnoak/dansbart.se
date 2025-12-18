import { ref, watch, onUnmounted } from 'vue';
import TrackCard from './TrackCard.js';

export default {
  props: ['trackId', 'isOpen', 'currentTrack', 'isSpotifyMode', 'isPlaying'],
  emits: ['close', 'play-track', 'stop', 'refresh', 'filter-style', 'update-tracks'],
  components: { TrackCard },

  setup(props, { emit }) {
    const similarTracks = ref([]);
    const loading = ref(false);
    const sourceTrack = ref(null);
    const error = ref(null);
    const styleFilter = ref('same'); // 'same', 'similar', 'any'

    const fetchSimilar = async () => {
      if (!props.trackId) return;

      loading.value = true;
      error.value = null;

      try {
        const res = await fetch(`/api/tracks/${props.trackId}/similar?limit=10&style_filter=${styleFilter.value}`);
        if (!res.ok) {
          throw new Error('Failed to fetch similar tracks');
        }

        const data = await res.json();
        sourceTrack.value = data.source_track;
        similarTracks.value = data.similar_tracks;

        // Emit the tracks to parent so it can update the play context
        emit('update-tracks', data.similar_tracks);
      } catch {
        error.value = 'Kunde inte hitta liknande låtar';
      } finally {
        loading.value = false;
      }
    };

    // Handle body scroll lock when modal opens/closes
    watch(() => props.isOpen, (isOpen) => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    });

    // Cleanup on unmount
    onUnmounted(() => {
      document.body.style.overflow = '';
    });

    watch(() => props.trackId, fetchSimilar, { immediate: true });
    watch(styleFilter, fetchSimilar); // Re-fetch when filter changes

    const handlePlay = (track, sourcePreference) => {
      emit('play-track', track, sourcePreference);
    };

    const formatArtists = (artists) => {
      return artists.map(a => a.name).join(', ');
    };

    return {
      similarTracks,
      loading,
      sourceTrack,
      error,
      styleFilter,
      handlePlay,
      formatArtists
    };
  },

  template: `
    <div v-if="isOpen" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" @click.self="$emit('close')">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col">

        <!-- Header -->
        <div class="p-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <h2 class="text-lg font-semibold text-gray-800">🎵 Liknande låtar</h2>
          <button
            @click="$emit('close')"
            class="p-2 hover:bg-white rounded-full transition-colors"
            title="Stäng"
          >
            ✕
          </button>
        </div>

        <!-- Source Track Info & Style Filter -->
        <div v-if="sourceTrack" class="p-4 bg-blue-50 border-b space-y-3">
          <div>
            <p class="text-sm text-gray-600 mb-1">Baserat på:</p>
            <p class="font-semibold text-gray-900">{{ sourceTrack.title }}</p>
            <p class="text-sm text-gray-600">{{ formatArtists(sourceTrack.artists) }}</p>
            <div class="flex gap-2 mt-2">
              <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{{ sourceTrack.dance_style }}</span>
              <span v-if="sourceTrack.sub_style" class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">{{ sourceTrack.sub_style }}</span>
              <span class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{{ sourceTrack.effective_bpm }} BPM</span>
            </div>
          </div>

          <!-- Style Filter Buttons -->
          <div>
            <p class="text-xs text-gray-600 mb-2">Vilka dansstilar?</p>
            <div class="flex gap-2">
              <button
                @click="styleFilter = 'same'"
                :class="styleFilter === 'same' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-50'"
                class="flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors"
                :title="'Endast ' + sourceTrack.dance_style"
              >
                Samma stil
              </button>
              <button
                @click="styleFilter = 'similar'"
                :class="styleFilter === 'similar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-50'"
                class="flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors"
                title="Mix av liknande stilar"
              >
                Liknande stilar
              </button>
              <button
                @click="styleFilter = 'any'"
                :class="styleFilter === 'any' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-50'"
                class="flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors"
                title="Alla stilar baserat på ljudanalys"
              >
                Alla stilar
              </button>
            </div>
          </div>
        </div>

        <!-- Similar Tracks List -->
        <div class="overflow-y-auto flex-1 p-4">
          <!-- Loading State -->
          <div v-if="loading" class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="text-gray-500 mt-4">Söker liknande låtar...</p>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="text-center py-12">
            <p class="text-red-600">{{ error }}</p>
          </div>

          <!-- Empty State -->
          <div v-else-if="similarTracks.length === 0" class="text-center py-12">
            <p class="text-gray-500 text-lg">😔</p>
            <p class="text-gray-500 mt-2">Inga liknande låtar hittades</p>
          </div>

          <!-- Tracks List -->
          <div v-else class="space-y-3">
            <div v-for="(track, index) in similarTracks" :key="track.id">
              <!-- Reuse TrackCard Component -->
              <track-card
                :track="track"
                :current-track="currentTrack"
                :is-spotify-mode="isSpotifyMode"
                :is-playing="isPlaying"
                @play="handlePlay"
                @stop="$emit('stop')"
                @refresh="$emit('refresh')"
                @filter-style="$emit('filter-style', $event)"
                @show-similar="() => {}"
              ></track-card>
            </div>
          </div>
        </div>

        <!-- Footer Info -->
        <div v-if="!loading && !error && similarTracks.length > 0" class="p-3 border-t bg-gray-50 text-xs text-gray-600 text-center">
          Visar {{ similarTracks.length }} liknande låtar baserat på ljudanalys och danskaraktär
        </div>
      </div>
    </div>
  `
};
