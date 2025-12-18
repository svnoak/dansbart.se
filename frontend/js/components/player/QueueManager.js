/**
 * QueueManager Component
 * Slide-out panel showing the current play queue with management controls
 */
export default {
  name: 'QueueManager',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    queue: {
      type: Array,
      default: () => []
    },
    currentIndex: {
      type: Number,
      default: -1
    }
  },
  emits: ['close', 'jump-to', 'remove', 'move', 'clear'],

  data() {
    return {
      draggedIndex: null,
      dragOverIndex: null,
    };
  },

  computed: {
    hasQueue() {
      return this.queue.length > 0;
    },
    queueCount() {
      return this.queue.length;
    }
  },

  methods: {
    getArtistNames(track) {
      return track.artists?.map(a => a.name).join(', ') || 'Okänd artist';
    },
    formatDuration(seconds) {
      if (!seconds) return '';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    handleClose() {
      this.$emit('close');
    },
    handleJumpTo(index) {
      this.$emit('jump-to', index);
    },
    handleRemove(index) {
      this.$emit('remove', index);
    },
    handleClear() {
      if (confirm('Rensa hela kön? Detta kan inte ångras.')) {
        this.$emit('clear');
      }
    },

    // Drag and drop handlers
    handleDragStart(index, event) {
      this.draggedIndex = index;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', event.target.innerHTML);
      // Add a slight opacity to the dragged item
      event.target.style.opacity = '0.5';
    },

    handleDragEnd(event) {
      event.target.style.opacity = '1';
      this.draggedIndex = null;
      this.dragOverIndex = null;
    },

    handleDragOver(index, event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';

      if (this.draggedIndex !== null && this.draggedIndex !== index) {
        this.dragOverIndex = index;
      }
    },

    handleDragLeave() {
      this.dragOverIndex = null;
    },

    handleDrop(index, event) {
      event.preventDefault();
      event.stopPropagation();

      if (this.draggedIndex !== null && this.draggedIndex !== index) {
        this.$emit('move', this.draggedIndex, index);
      }

      this.draggedIndex = null;
      this.dragOverIndex = null;
    }
  },

  template: `
    <!-- Backdrop -->
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/50 z-[150] transition-opacity"
      @click="handleClose"
    ></div>

    <!-- Slide-out Panel -->
    <div
      class="fixed top-0 right-0 h-full w-full md:w-96 bg-white shadow-2xl z-[151] transform transition-transform duration-300 ease-in-out flex flex-col"
      :class="isOpen ? 'translate-x-0' : 'translate-x-full'"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div>
          <h2 class="text-lg font-bold text-gray-900">Kö</h2>
          <p class="text-sm text-gray-600">{{ queueCount }} låt{{ queueCount !== 1 ? 'ar' : '' }}</p>
        </div>
        <button
          @click="handleClose"
          class="p-2 hover:bg-gray-200 rounded-full transition-colors"
          aria-label="Stäng"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Queue List -->
      <div class="flex-1 overflow-y-auto">
        <!-- Empty State -->
        <div v-if="!hasQueue" class="flex flex-col items-center justify-center h-full text-center p-8">
          <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
          </svg>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Kön är tom</h3>
          <p class="text-sm text-gray-500">Lägg till låtar från sökresultaten eller upptäckningssidan</p>
        </div>

        <!-- Queue Items -->
        <div v-else class="py-2">
          <div
            v-for="(track, index) in queue"
            :key="track.id + '_' + index"
            draggable="true"
            @dragstart="handleDragStart(index, $event)"
            @dragend="handleDragEnd($event)"
            @dragover="handleDragOver(index, $event)"
            @dragleave="handleDragLeave()"
            @drop="handleDrop(index, $event)"
            class="group relative flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all cursor-move"
            :class="{
              'bg-indigo-50': index === currentIndex,
              'border-t-2 border-indigo-500': dragOverIndex === index && draggedIndex !== null && draggedIndex < index,
              'border-b-2 border-indigo-500': dragOverIndex === index && draggedIndex !== null && draggedIndex > index,
              'opacity-50': draggedIndex === index
            }"
          >
            <!-- Drag Handle -->
            <div class="flex-shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 3h2v2H9V3zm0 4h2v2H9V7zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm4-16h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
              </svg>
            </div>

            <!-- Current Playing Indicator / Number -->
            <div class="flex-shrink-0 w-6 flex items-center justify-center">
              <div
                v-if="index === currentIndex"
                class="w-1 h-8 bg-indigo-600 rounded-full"
              ></div>
              <span
                v-else
                class="text-sm text-gray-400 font-medium"
              >{{ index + 1 }}</span>
            </div>

            <!-- Track Info (clickable) -->
            <div
              @click="handleJumpTo(index)"
              class="flex-1 min-w-0 cursor-pointer"
            >
              <h3 class="font-medium text-gray-900 truncate text-sm">
                {{ track.title }}
              </h3>
              <div class="flex items-center gap-2 text-xs text-gray-600">
                <span class="truncate">{{ getArtistNames(track) }}</span>
                <span v-if="track.duration" class="flex-shrink-0">
                  {{ formatDuration(track.duration) }}
                </span>
              </div>
            </div>

            <!-- Remove Button (visible on hover) -->
            <button
              @click.stop="handleRemove(index)"
              class="flex-shrink-0 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded transition-all"
              aria-label="Ta bort"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div v-if="hasQueue" class="border-t border-gray-200 p-4 bg-gray-50">
        <button
          @click="handleClear"
          class="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          Rensa kö
        </button>
      </div>
    </div>
  `
};
