/**
 * Spider Tab Component
 * Interface for spider discovery crawling with task status polling
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useToast } from '../../shared/composables/useToast.js';
import { useSpiderApi } from './api.js';
import { useRejectApi } from '../reject/api.js';
import SpiderStats from './SpiderStats.js';
import SpiderHistory from './SpiderHistory.js';

export default {
    components: {
        SpiderStats,
        SpiderHistory
    },
    setup() {
        const { adminToken } = useAdminAuth();
        const { showToast } = useToast();
        const spiderApi = useSpiderApi(adminToken);
        const rejectApi = useRejectApi(adminToken);

        const spiderSettings = ref({
            max_discoveries: 10,
            mode: 'backfill',
            discover_from_albums: true
        });
        const spiderLoading = ref(false);
        const spiderMessage = ref('');
        const spiderError = ref(false);
        const spiderStats = ref(null);
        const crawlHistory = ref([]);
        const currentTaskId = ref(null);
        const taskStatus = ref(null);

        let pollInterval = null;

        const loadSpiderStats = async () => {
            try {
                spiderStats.value = await spiderApi.getStats();
            } catch (e) {
                console.error('Failed to load spider stats:', e);
            }
        };

        const loadSpiderHistory = async () => {
            try {
                const data = await spiderApi.getHistory(50);
                crawlHistory.value = data.items;
            } catch (e) {
                console.error('Failed to load spider history:', e);
            }
        };

        const pollTaskStatus = async (taskId) => {
            if (pollInterval) clearInterval(pollInterval);

            const checkStatus = async () => {
                try {
                    const data = await spiderApi.getTaskStatus(taskId);
                    taskStatus.value = data;

                    if (data.state === 'PENDING') {
                        spiderMessage.value = `Task queued (ID: ${taskId})...`;
                    } else if (data.state === 'STARTED') {
                        spiderMessage.value = `🕷️ Spider is crawling... (ID: ${taskId})`;
                    } else if (data.state === 'SUCCESS') {
                        clearInterval(pollInterval);
                        spiderLoading.value = false;
                        const stats = data.result;
                        spiderMessage.value = `✅ Crawl complete! Found ${stats.artists_crawled} new artists, ${stats.tracks_found} tracks.`;

                        loadSpiderStats();
                        loadSpiderHistory();

                        window.dispatchEvent(new CustomEvent('admin:spider-complete'));
                        showToast(`Spider complete! ${stats.artists_crawled} artists, ${stats.tracks_found} tracks`);
                    } else if (data.state === 'FAILURE') {
                        clearInterval(pollInterval);
                        spiderLoading.value = false;
                        spiderError.value = true;
                        spiderMessage.value = `❌ Crawl failed: ${data.error}`;
                        showToast('Spider crawl failed', 'error');
                    }
                } catch (e) {
                    console.error('Polling error:', e);
                }
            };

            await checkStatus();
            pollInterval = setInterval(checkStatus, 2000);
        };

        const runSpider = async () => {
            spiderLoading.value = true;
            spiderMessage.value = '';
            taskStatus.value = null;

            try {
                const data = await spiderApi.crawl(spiderSettings.value);
                spiderError.value = false;
                currentTaskId.value = data.task_id;
                spiderMessage.value = `${data.message} - Task ID: ${data.task_id}`;
                pollTaskStatus(data.task_id);
            } catch (e) {
                spiderError.value = true;
                spiderMessage.value = e.message;
                spiderLoading.value = false;
                showToast(e.message, 'error');
            }
        };

        const handleBlockArtist = async (log) => {
            if (!confirm(`Block "${log.artist_name}"?\n\nThis will add their Spotify ID to the blocklist so the spider ignores them in the future.`)) {
                return;
            }

            try {
                await rejectApi.addToBlocklist({
                    spotify_id: log.spotify_artist_id,
                    entity_name: log.artist_name,
                    entity_type: 'artist',
                    reason: 'Blocked via Spider History'
                });
                
                showToast(`🚫 Blocked ${log.artist_name}`, 'success');
            } catch (e) {
                console.error(e);
                showToast('Failed to block artist', 'error');
            }
        };

        onMounted(() => {
            loadSpiderStats();
            loadSpiderHistory();
        });

        onUnmounted(() => {
            if (pollInterval) clearInterval(pollInterval);
        });

        return {
            spiderSettings, spiderLoading, spiderMessage, spiderError,
            spiderStats, crawlHistory, currentTaskId, taskStatus,
            runSpider, loadSpiderStats, loadSpiderHistory, handleBlockArtist
        };
    },
    template: /*html*/`
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700">
            <h2 class="font-bold mb-6">🕸️ Discovery Spider</h2>

            <div class="mb-6 p-4 bg-gray-900 rounded border border-gray-700 max-w-2xl">
                <h3 class="font-medium mb-3">Swedish/Nordic Folk Discovery</h3>
                <p class="text-sm text-gray-400 mb-4">
                    The spider discovers Swedish and Nordic folk music from Spotify automatically.
                    It applies strict filtering to reject non-Nordic folk (Irish, American, indie folk, etc.),
                    tracks crawled artists to avoid duplicates, and classifies music as traditional/modern folk.
                </p>

                <div class="mb-4">
                    <label class="block text-xs uppercase text-gray-500 mb-1">Discovery Mode</label>
                    <select v-model="spiderSettings.mode"
                            class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white">
                        <option value="backfill">🔄 Backfill Mode (RECOMMENDED)</option>
                        <option value="search">🔍 Search Mode (Discover New Artists)</option>
                    </select>
                    <p class="text-xs text-gray-500 mt-1">
                        {{ spiderSettings.mode === 'backfill'
                            ? '✅ RECOMMENDED: Gets complete discographies for Swedish/Nordic artists already in your library'
                            : 'Searches Spotify for Swedish folk artists using targeted keywords (spelmanslag, svensk folkmusik, etc.)' }}
                    </p>
                </div>

                <div class="mb-4">
                    <label class="block text-xs uppercase text-gray-500 mb-1">Max Discoveries</label>
                    <input v-model.number="spiderSettings.max_discoveries" type="number" min="1" max="50"
                           class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white">
                    <p class="text-xs text-gray-500 mt-1">Maximum new artists per crawl</p>
                </div>

                <div v-if="spiderSettings.mode === 'backfill'" class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input v-model="spiderSettings.discover_from_albums" type="checkbox"
                               class="w-4 h-4 bg-gray-800 border border-gray-600 rounded">
                        <span class="text-sm font-medium">
                            📀 Discover artists from compilation/collaborative albums
                        </span>
                    </label>
                    <p class="text-xs text-gray-500 mt-1 ml-6">
                        Also finds new Swedish/Nordic folk artists from albums featuring existing artists
                    </p>
                </div>

                <button @click="runSpider" :disabled="spiderLoading"
                        class="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 py-3 rounded font-bold">
                    {{ spiderLoading ? '🕷️ Crawling...' : '🚀 Start Discovery Crawl' }}
                </button>

                <div v-if="taskStatus && spiderLoading" class="mt-3 p-3 bg-gray-800 rounded border border-gray-600">
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-gray-400">Task Status:</span>
                        <span :class="{
                            'text-yellow-400': taskStatus.state === 'PENDING',
                            'text-blue-400': taskStatus.state === 'STARTED',
                            'text-green-400': taskStatus.state === 'SUCCESS',
                            'text-red-400': taskStatus.state === 'FAILURE'
                        }" class="font-medium">
                            {{ taskStatus.state }}
                        </span>
                    </div>
                    <div v-if="currentTaskId" class="text-xs text-gray-500 mt-1">
                        Task ID: {{ currentTaskId }}
                    </div>
                </div>

                <p v-if="spiderMessage" class="mt-4 text-sm" :class="spiderError ? 'text-red-400' : 'text-green-400'">
                    {{ spiderMessage }}
                </p>
            </div>

            <spider-stats :stats="spiderStats" />

            <spider-history 
                :history="crawlHistory" 
                @refresh="loadSpiderHistory" 
                @block-artist="handleBlockArtist" 
            />
        </div>
    `
};
