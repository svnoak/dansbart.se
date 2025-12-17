/**
 * Spider Stats Component
 * Displays spider crawling statistics
 */

export default {
  props: {
    stats: {
      type: Object,
      default: null,
    },
  },
  template: /*html*/ `
        <div v-if="stats" class="mb-6 p-4 bg-gray-900 rounded border border-gray-700 max-w-2xl">
            <h3 class="font-medium mb-3">Overall Statistics</h3>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="text-gray-400">Total Artists Crawled:</span>
                    <span class="ml-2 font-bold">{{ stats.total_artists_crawled }}</span>
                </div>
                <div>
                    <span class="text-gray-400">Total Tracks Found:</span>
                    <span class="ml-2 font-bold">{{ stats.total_tracks_found }}</span>
                </div>
            </div>
            <div v-if="stats.by_genre && Object.keys(stats.by_genre).length > 0" class="mt-3">
                <span class="text-gray-400 text-sm">By Genre:</span>
                <div class="flex flex-wrap gap-2 mt-2">
                    <span v-for="(count, genre) in stats.by_genre" :key="genre"
                          class="px-2 py-1 bg-gray-800 rounded text-xs">
                        {{ genre }}: {{ count }}
                    </span>
                </div>
            </div>
        </div>
    `,
};
