/**
 * Spider History Component
 * Displays recent spider crawl history with blocking capability
 */

export default {
    props: {
        history: {
            type: Array,
            default: () => []
        }
    },
    // Add 'block-artist' here so Vue knows it's a custom event
    emits: ['refresh', 'block-artist'], 
    setup(props, { emit }) {
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        };

        const handleRefresh = () => {
            emit('refresh');
        };

        return { formatDate, handleRefresh };
    },
    template: /*html*/`
        <div class="bg-gray-900 rounded border border-gray-700">
            <div class="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 class="font-medium">Recent Crawls</h3>
                <button @click="handleRefresh" class="text-sm text-gray-400 hover:text-white">
                    🔄 Refresh
                </button>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="text-xs uppercase text-gray-500 border-b border-gray-700">
                        <tr>
                            <th class="py-2 px-4">Artist</th>
                            <th class="py-2 px-4">Tracks</th>
                            <th class="py-2 px-4">Genre</th>
                            <th class="py-2 px-4">Spotify Genres</th>
                            <th class="py-2 px-4">Crawled</th>
                            <th class="py-2 px-4">Actions</th> </tr>
                    </thead>
                    <tbody>
                        <tr v-for="log in history" :key="log.id"
                            class="border-b border-gray-700/50 hover:bg-gray-700/30 group transition-colors">
                            
                            <td class="py-2 px-4 max-w-xs truncate" :title="log.artist_name">
                                {{ log.artist_name }}
                            </td>
                            
                            <td class="py-2 px-4 text-gray-400">
                                {{ log.tracks_found }}
                            </td>
                            
                            <td class="py-2 px-4">
                                <span v-if="log.music_genre"
                                      class="px-2 py-1 bg-indigo-600/30 text-indigo-400 rounded text-xs">
                                    {{ log.music_genre.replace('_', ' ') }}
                                </span>
                            </td>
                            
                            <td class="py-2 px-4 text-xs text-gray-500 max-w-xs truncate" :title="log.detected_genres?.join(', ')">
                                {{ log.detected_genres?.join(', ') || '-' }}
                            </td>
                            
                            <td class="py-2 px-4 text-xs text-gray-500">
                                {{ formatDate(log.crawled_at) }}
                            </td>

                            <td class="py-2 px-4">
                                <button v-if="log.status === 'success'" 
                                        @click="$emit('block-artist', log)"
                                        class="opacity-0 group-hover:opacity-100 bg-red-900/30 hover:bg-red-600 text-red-300 hover:text-white border border-red-800 hover:border-transparent text-xs px-2 py-1 rounded transition-all">
                                    🚫 Block
                                </button>
                            </td>
                        </tr>
                        <tr v-if="history.length === 0">
                            <td colspan="6" class="py-8 text-center text-gray-500">
                                No crawl history yet. Run your first spider crawl above!
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `
};