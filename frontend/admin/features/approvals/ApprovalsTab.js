/**
 * Approvals Tab Component
 * Interface for approving/rejecting pending artists
 */

import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useToast } from '../../shared/composables/useToast.js';
import { useApprovalsApi } from './api.js';

export default {
    setup() {
        const { ref, onMounted } = Vue;
        const { adminToken } = useAdminAuth();
        const { showToast } = useToast();
        const approvalsApi = useApprovalsApi(adminToken);

        // State
        const pendingApprovals = ref([]);
        const approvalMessage = ref('');
        const approvalError = ref(false);

        // Methods
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        };

        const loadPendingApprovals = async () => {
            try {
                const data = await approvalsApi.loadPending();
                pendingApprovals.value = data.items.map(item => ({ ...item, loading: false }));
                approvalMessage.value = '';
            } catch (e) {
                console.error('Failed to load pending approvals:', e);
                approvalMessage.value = 'Failed to load pending approvals';
                approvalError.value = true;
            }
        };

        const approveArtist = async (approvalId) => {
            const approval = pendingApprovals.value.find(a => a.id === approvalId);
            if (!approval) return;

            if (!confirm(`Approve and ingest artist "${approval.name}"? This will crawl their full discography.`)) {
                return;
            }

            approval.loading = true;
            try {
                const data = await approvalsApi.approve(approvalId);
                approvalMessage.value = data.message;
                approvalError.value = false;
                showToast(data.message, 'success');

                // Reload the list
                await loadPendingApprovals();

                // Emit event for tracks tab to refresh
                window.dispatchEvent(new CustomEvent('admin:artist-approved', { detail: { approvalId } }));
            } catch (e) {
                console.error('Failed to approve artist:', e);
                approvalMessage.value = 'Failed to approve artist';
                approvalError.value = true;
                showToast('Failed to approve artist', 'error');
                approval.loading = false;
            }
        };

        const rejectPendingArtist = async (approvalId) => {
            const approval = pendingApprovals.value.find(a => a.id === approvalId);
            if (!approval) return;

            if (!confirm(`Reject and blocklist artist "${approval.name}"? They will not be re-discovered by the spider.`)) {
                return;
            }

            approval.loading = true;
            try {
                const data = await approvalsApi.reject(approvalId, 'Not Swedish/Nordic folk music');
                approvalMessage.value = data.message;
                approvalError.value = false;
                showToast(data.message, 'success');

                // Reload the list
                await loadPendingApprovals();
            } catch (e) {
                console.error('Failed to reject artist:', e);
                approvalMessage.value = 'Failed to reject artist';
                approvalError.value = true;
                showToast('Failed to reject artist', 'error');
                approval.loading = false;
            }
        };

        onMounted(() => {
            loadPendingApprovals();
        });

        return {
            pendingApprovals, approvalMessage, approvalError,
            loadPendingApprovals, approveArtist, rejectPendingArtist,
            formatDate
        };
    },
    template: /*html*/`
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700">
            <h2 class="font-bold mb-4">✅ Artist Approval Queue</h2>

            <p class="text-sm text-gray-400 mb-6">
                Artists discovered by the spider that need manual approval before ingestion.
                These artists weren't clearly categorized as Swedish/Nordic folk music.
            </p>

            <div v-if="pendingApprovals.length === 0" class="text-gray-500 text-center py-8">
                No artists pending approval
            </div>

            <div v-else class="space-y-4">
                <div v-for="approval in pendingApprovals" :key="approval.id"
                     class="p-4 bg-gray-900 rounded border border-gray-700">
                    <div class="flex items-start gap-4">
                        <img v-if="approval.image_url" :src="approval.image_url"
                             class="w-16 h-16 sm:w-20 sm:h-20 rounded object-cover" :alt="approval.name">
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-base sm:text-lg mb-1">{{ approval.name }}</div>

                            <div class="flex flex-wrap gap-2 mb-2">
                                <span v-if="approval.music_genre_classification"
                                      class="px-2 py-0.5 bg-indigo-600/30 text-indigo-400 rounded text-xs">
                                    {{ approval.music_genre_classification.replace('_', ' ') }}
                                </span>
                                <span v-if="approval.genre_confidence"
                                      :class="approval.genre_confidence >= 0.7 ? 'bg-green-600/30 text-green-400' : 'bg-yellow-600/30 text-yellow-400'"
                                      class="px-2 py-0.5 rounded text-xs">
                                    {{ (approval.genre_confidence * 100).toFixed(0) }}% confidence
                                </span>
                            </div>

                            <div v-if="approval.detected_genres && approval.detected_genres.length > 0"
                                 class="text-xs text-gray-500 mb-2">
                                <strong>Spotify genres:</strong> {{ approval.detected_genres.join(', ') }}
                            </div>

                            <div class="text-xs text-gray-500">
                                Discovered: {{ formatDate(approval.discovered_at) }} via {{ approval.discovery_source }}
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-2 mt-3">
                        <button @click="approveArtist(approval.id)" :disabled="approval.loading"
                                class="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 px-4 py-2 rounded font-medium text-sm">
                            {{ approval.loading ? 'Processing...' : '✅ Approve & Ingest' }}
                        </button>
                        <button @click="rejectPendingArtist(approval.id)" :disabled="approval.loading"
                                class="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 rounded font-medium text-sm">
                            {{ approval.loading ? 'Processing...' : '❌ Reject & Blocklist' }}
                        </button>
                    </div>
                </div>
            </div>

            <div v-if="pendingApprovals.length > 0" class="mt-4 text-center">
                <button @click="loadPendingApprovals"
                        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                    🔄 Refresh
                </button>
            </div>

            <p v-if="approvalMessage" class="mt-4 text-sm" :class="approvalError ? 'text-red-400' : 'text-green-400'">
                {{ approvalMessage }}
            </p>
        </div>
    `
};
