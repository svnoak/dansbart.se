import EmptyState from './EmptyState.js';

export default {
  name: 'StyleExplorer',
  components: {
    'empty-state': EmptyState
  },
  props: {
    styles: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['style-click'],
  setup() {
    // Style descriptions and emojis
    const styleInfo = {
      'Polska': { emoji: '🎻', description: 'Asymmetrisk och varierad' },
      'Hambo': { emoji: '💃', description: 'Svängig och flytande' },
      'Vals': { emoji: '🌟', description: 'Snabb och elegant' },
      'Schottis': { emoji: '⚡', description: 'Studsig och energisk' },
      'Slängpolska': { emoji: '🎵', description: 'Lekfull och rytmisk' },
      'Mazurka': { emoji: '✨', description: 'Elegant tresteg' },
      'Gånglåt': { emoji: '🚶', description: 'Lugn gångtakt' },
      'Polka': { emoji: '🎉', description: 'Glad och hoppig' },
      'Engelska': { emoji: '🎭', description: 'Traditionell kontradans' },
      'Snoa': { emoji: '🌊', description: 'Flytande svängdans' }
    };

    const getStyleInfo = (styleName) => {
      return styleInfo[styleName] || { emoji: '🎶', description: 'Traditionell folkdans' };
    };

    return {
      getStyleInfo
    };
  },
  template: `
    <section class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Utforska dansstilar</h2>

      <!-- Loading State -->
      <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <div v-for="i in 6" :key="i" class="bg-white rounded-lg shadow-sm p-4 animate-pulse">
          <div class="h-8 w-8 bg-gray-200 rounded mb-2"></div>
          <div class="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>

      <!-- Empty State -->
      <empty-state v-else-if="styles.length === 0" type="styles" />

      <!-- Style Cards -->
      <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <button
          v-for="styleData in styles"
          :key="styleData.style"
          @click="$emit('style-click', styleData.style)"
          class="bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-4 text-left group hover:scale-105"
        >
          <div class="text-3xl mb-2">{{ getStyleInfo(styleData.style).emoji }}</div>
          <h3 class="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors text-sm">
            {{ styleData.style }}
          </h3>
          <p class="text-xs text-gray-500 mt-1">{{ styleData.track_count }} låtar</p>
        </button>
      </div>
    </section>
  `
};
