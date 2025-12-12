/**
 * Ingest Tab Component
 * Interface for ingesting Spotify content (playlists, albums, artists)
 */

import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useToast } from '../../shared/composables/useToast.js';
import { useIngestApi } from './api.js';

export default {
    setup() {
        const { ref } = Vue;
        const { adminToken } = useAdminAuth();
        const { showToast } = useToast();
        const ingestApi = useIngestApi(adminToken);

        // State
        const resourceId = ref('');
        const resourceType = ref('playlist');
        const loading = ref(false);
        const message = ref('');
        const isError = ref(false);

        // Methods
        const getPlaceholder = () => {
            const placeholders = {
                'playlist': 'e.g. 37i9dQZF1DX...',
                'album': 'e.g. 6vV5UrXcfyQD1wu4Qo2I9K',
                'artist': 'e.g. 0TnOYISbd1XYRBk9myaseg'
            };
            return placeholders[resourceType.value] || '';
        };

        const getHelpText = () => {
            const helpTexts = {
                'playlist': 'Find the ID in the Spotify playlist URL',
                'album': 'Find the ID in the Spotify album URL',
                'artist': 'Find the ID in the Spotify artist URL (ingests entire discography)'
            };
            return helpTexts[resourceType.value] || '';
        };

        const runIngest = async () => {
            loading.value = true;
            message.value = '';

            try {
                const data = await ingestApi.ingest(resourceType.value, resourceId.value);
                isError.value = false;
                message.value = `Success: ${data.message}`;
                resourceId.value = '';

                // Emit event for tracks tab to refresh
                window.dispatchEvent(new CustomEvent('admin:tracks-ingested'));
                showToast(data.message);
            } catch (e) {
                isError.value = true;
                message.value = e.message;
                showToast(e.message, 'error');
            } finally {
                loading.value = false;
            }
        };

        return {
            resourceId, resourceType, loading, message, isError,
            getPlaceholder, getHelpText, runIngest
        };
    },
    template: /*html*/`
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700 max-w-md">
            <h2 class="font-bold mb-4">Ingest Spotify Content</h2>

            <div class="mb-4">
                <label class="block text-xs uppercase text-gray-500 mb-1">Resource Type</label>
                <select v-model="resourceType"
                        class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                    <option value="playlist">🎵 Playlist</option>
                    <option value="album">💿 Album</option>
                    <option value="artist">🎤 Artist (Full Discography)</option>
                </select>
            </div>

            <div class="mb-4">
                <label class="block text-xs uppercase text-gray-500 mb-1">
                    {{ resourceType === 'playlist' ? 'Playlist ID' : resourceType === 'album' ? 'Album ID' : 'Artist ID' }}
                </label>
                <input v-model="resourceId" :placeholder="getPlaceholder()"
                       class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                <p class="text-xs text-gray-500 mt-1">
                    {{ getHelpText() }}
                </p>
            </div>

            <button @click="runIngest" :disabled="loading"
                    class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2 rounded font-bold">
                {{ loading ? 'Processing...' : 'Start Pipeline' }}
            </button>

            <p v-if="message" class="mt-4 text-sm" :class="isError ? 'text-red-400' : 'text-green-400'">
                {{ message }}
            </p>
        </div>
    `
};
