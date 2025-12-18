/**
 * Compact Track Card for Discovery Page
 * Simplified version showing only essential info: play button, title, artist, style
 */
export default {
  props: ['track', 'currentTrack', 'isSpotifyMode', 'isPlaying'],
  emits: ['play', 'stop', 'add-to-queue'],

  computed: {
    isCurrentTrack() {
      return this.currentTrack && this.currentTrack.id === this.track.id;
    },
    isPlayingThis() {
      return this.isCurrentTrack && this.isPlaying;
    },
    artistNames() {
      return this.track.artists?.map(a => a.name).join(', ') || 'Okänd artist';
    },
    hasValidStyle() {
      return this.track.dance_style && this.track.dance_style !== 'Unclassified';
    }
  },

  methods: {
    handleAddToQueue() {
      this.$emit('add-to-queue', this.track);
    }
  },

  template: /*html*/ `
    <div
      class="bg-white rounded-lg shadow-sm border border-gray-100 p-3 flex items-center gap-3 hover:shadow-md transition-shadow group"
      :class="{ 'ring-2 ring-indigo-500': isCurrentTrack }"
    >
      <!-- Play Button -->
      <button
        @click="isPlayingThis ? $emit('stop') : $emit('play', track)"
        class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all"
        :class="isPlayingThis
          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
          : 'bg-gray-100 hover:bg-indigo-600 text-gray-700 hover:text-white group-hover:bg-indigo-100'"
      >
        <svg v-if="isPlayingThis" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
        </svg>
        <svg v-else class="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>

      <!-- Track Info -->
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-gray-900 truncate text-sm">{{ track.title }}</h3>
        <p class="text-xs text-gray-600 truncate">{{ artistNames }}</p>
      </div>

      <!-- Style Badge (compact) -->
      <div v-if="hasValidStyle" class="flex-shrink-0">
        <span
          class="px-2 py-1 text-xs font-bold rounded-full uppercase bg-blue-50 text-blue-700 border border-blue-200"
          :title="track.sub_style ? track.dance_style + ' › ' + track.sub_style : track.dance_style"
        >
          {{ track.dance_style }}
        </span>
      </div>

      <!-- Add to Queue Button -->
      <button
        @click.stop="handleAddToQueue"
        class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-gray-100 rounded-lg"
        title="Lägg till i kö"
      >
        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
      </button>
    </div>
  `
};
