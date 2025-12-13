/**
 * Style Keywords Tab Component
 * Manage classification keywords and mappings
 */

import { ref, reactive, onMounted, computed } from 'vue';
import { useAdminAuth } from '../../shared/composables/useAdminAuth.js';
import { useToast } from '../../shared/composables/useToast.js';
import { useStyleKeywordsApi } from './api.js';

export default {
    name: 'StyleKeywordsTab',
    setup() {
        const { adminToken } = useAdminAuth();
        const { showToast } = useToast();
        const api = useStyleKeywordsApi(adminToken);

        // Data
        const keywords = ref([]);
        const stats = ref(null);
        const loading = ref(false);
        
        // Filters & Pagination
        const filters = reactive({
            search: '',
            mainStyle: '',
            isActive: '' // Empty string = all
        });
        const pagination = reactive({
            limit: 50,
            offset: 0,
            total: 0
        });

        // Form / Modal State
        const showModal = ref(false);
        const formMode = ref('create'); // 'create' or 'edit'
        const isSubmitting = ref(false);
        const form = reactive({
            id: null,
            keyword: '',
            main_style: '',
            sub_style: '',
            is_active: true
        });

        // --- Fetching Data ---

        const fetchStats = async () => {
            try {
                stats.value = await api.getStats();
            } catch (e) {
                console.error("Failed to load stats", e);
            }
        };

        const fetchKeywords = async () => {
            loading.value = true;
            try {
                const params = {
                    search: filters.search,
                    main_style: filters.mainStyle,
                    is_active: filters.isActive,
                    limit: pagination.limit,
                    offset: pagination.offset
                };
                
                const data = await api.getKeywords(params);
                
                // Handle different response structures if necessary, usually standard paginated response
                keywords.value = data.items || [];
                pagination.total = data.total || 0;
            } catch (e) {
                showToast(e.message || 'Failed to fetch keywords', 'error');
            } finally {
                loading.value = false;
            }
        };

        const refreshAll = () => {
            pagination.offset = 0;
            fetchKeywords();
            fetchStats();
        };

        // --- Actions ---

        const handleCacheInvalidate = async () => {
            try {
                await api.invalidateCache();
                showToast('Classifier cache invalidated', 'success');
                fetchStats(); // Refresh stats (cache hit/miss info might update)
            } catch (e) {
                showToast(e.message || 'Failed to invalidate cache', 'error');
            }
        };

        const handleDelete = async (id) => {
            if (!confirm('Are you sure you want to delete this keyword?')) return;
            try {
                await api.deleteKeyword(id);
                showToast('Keyword deleted', 'success');
                fetchKeywords();
                fetchStats();
            } catch (e) {
                showToast(e.message || 'Delete failed', 'error');
            }
        };

        const handleToggleActive = async (kw) => {
            try {
                // Optimistic UI update
                const originalState = kw.is_active;
                kw.is_active = !kw.is_active;

                await api.updateKeyword(kw.id, { is_active: kw.is_active });
                showToast(`Keyword ${kw.is_active ? 'activated' : 'deactivated'}`, 'success');
                fetchStats();
            } catch (e) {
                kw.is_active = !kw.is_active; // Revert on fail
                showToast('Status update failed', 'error');
            }
        };

        // --- Form Handling ---

        const openCreateForm = () => {
            form.id = null;
            form.keyword = '';
            form.main_style = '';
            form.sub_style = '';
            form.is_active = true;
            formMode.value = 'create';
            showModal.value = true;
        };

        const openEditForm = (kw) => {
            form.id = kw.id;
            form.keyword = kw.keyword;
            form.main_style = kw.main_style;
            form.sub_style = kw.sub_style || '';
            form.is_active = kw.is_active;
            formMode.value = 'edit';
            showModal.value = true;
        };

        const submitForm = async () => {
            isSubmitting.value = true;
            try {
                const payload = {
                    keyword: form.keyword,
                    main_style: form.main_style,
                    sub_style: form.sub_style || null,
                    is_active: form.is_active
                };

                if (formMode.value === 'create') {
                    await api.createKeyword(payload);
                    showToast('Keyword created', 'success');
                } else {
                    await api.updateKeyword(form.id, payload);
                    showToast('Keyword updated', 'success');
                }
                
                showModal.value = false;
                fetchKeywords();
                fetchStats();
            } catch (e) {
                showToast(e.detail || e.message || 'Save failed', 'error');
            } finally {
                isSubmitting.value = false;
            }
        };

        // --- Pagination ---
        
        const nextPage = () => {
            if (pagination.offset + pagination.limit < pagination.total) {
                pagination.offset += pagination.limit;
                fetchKeywords();
            }
        };

        const prevPage = () => {
            if (pagination.offset > 0) {
                pagination.offset = Math.max(0, pagination.offset - pagination.limit);
                fetchKeywords();
            }
        };

        onMounted(() => {
            fetchStats();
            fetchKeywords();
        });

        return {
            keywords, stats, loading, filters, pagination,
            showModal, formMode, form, isSubmitting,
            refreshAll, fetchKeywords,
            handleCacheInvalidate, handleDelete, handleToggleActive,
            openCreateForm, openEditForm, submitForm,
            nextPage, prevPage
        };
    },
    template: /*html*/`
        <div class="bg-gray-800 p-3 sm:p-6 rounded-lg border border-gray-700">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="font-bold text-xl">🎼 Style Keywords</h2>
                    <p class="text-sm text-gray-400">Manage keywords used for automatic genre classification.</p>
                </div>
                <div class="flex gap-2">
                    <button @click="handleCacheInvalidate" class="bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-bold py-2 px-3 rounded border border-yellow-600">
                        ⚡ Invalidate Cache
                    </button>
                    <button @click="openCreateForm" class="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded shadow">
                        + Add Keyword
                    </button>
                </div>
            </div>

            <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-gray-900 p-3 rounded border border-gray-700">
                    <div class="text-xs text-gray-500 uppercase">Total Keywords</div>
                    <div class="text-xl font-bold">{{ stats.total_keywords || 0 }}</div>
                </div>
                <div class="bg-gray-900 p-3 rounded border border-gray-700">
                    <div class="text-xs text-gray-500 uppercase">Unique Styles</div>
                    <div class="text-xl font-bold text-blue-400">{{ stats.unique_styles || 0 }}</div>
                </div>
                <div class="bg-gray-900 p-3 rounded border border-gray-700">
                    <div class="text-xs text-gray-500 uppercase">Cache Status</div>
                    <div class="text-lg font-bold" :class="stats.cache_info?.loaded ? 'text-green-400' : 'text-gray-500'">
                        {{ stats.cache_info?.loaded ? 'Loaded' : 'Empty' }}
                    </div>
                </div>
                <div class="bg-gray-900 p-3 rounded border border-gray-700">
                    <div class="text-xs text-gray-500 uppercase">Cache Entries</div>
                    <div class="text-xl font-bold">{{ stats.cache_info?.size || 0 }}</div>
                </div>
            </div>

            <div class="flex flex-wrap gap-2 mb-4 p-3 bg-gray-900 rounded border border-gray-700">
                <div class="flex-1 min-w-[150px]">
                    <input v-model="filters.search" @keyup.enter="refreshAll" placeholder="Search keyword..." 
                           class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none" />
                </div>
                <div class="w-40">
                    <input v-model="filters.mainStyle" @keyup.enter="refreshAll" placeholder="Filter Main Style" 
                           class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none" />
                </div>
                <div class="w-32">
                    <select v-model="filters.isActive" @change="refreshAll" 
                            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 outline-none">
                        <option value="">All Status</option>
                        <option :value="true">Active Only</option>
                        <option :value="false">Inactive</option>
                    </select>
                </div>
                <button @click="refreshAll" class="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5 rounded">
                    Search
                </button>
            </div>

            <div class="overflow-x-auto rounded border border-gray-700">
                <table class="w-full text-left text-sm text-gray-300">
                    <thead class="bg-gray-900 text-xs uppercase font-medium text-gray-400">
                        <tr>
                            <th class="px-4 py-3">Keyword</th>
                            <th class="px-4 py-3">Main Style</th>
                            <th class="px-4 py-3">Sub Style</th>
                            <th class="px-4 py-3">Status</th>
                            <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700 bg-gray-800">
                        <tr v-if="loading" class="animate-pulse">
                            <td colspan="5" class="px-4 py-8 text-center text-gray-500">Loading keywords...</td>
                        </tr>
                        <tr v-else-if="keywords.length === 0">
                            <td colspan="5" class="px-4 py-8 text-center text-gray-500">No keywords found.</td>
                        </tr>
                        <tr v-else v-for="kw in keywords" :key="kw.id" class="hover:bg-gray-750 transition-colors">
                            <td class="px-4 py-3 font-medium text-white">{{ kw.keyword }}</td>
                            <td class="px-4 py-3">
                                <span class="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded text-xs border border-blue-800">
                                    {{ kw.main_style }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-gray-400">{{ kw.sub_style || '-' }}</td>
                            <td class="px-4 py-3">
                                <button @click="handleToggleActive(kw)" class="flex items-center gap-2 group">
                                    <div class="w-2 h-2 rounded-full" :class="kw.is_active ? 'bg-green-500' : 'bg-red-500'"></div>
                                    <span :class="kw.is_active ? 'text-green-400' : 'text-gray-500'" class="group-hover:underline">
                                        {{ kw.is_active ? 'Active' : 'Inactive' }}
                                    </span>
                                </button>
                            </td>
                            <td class="px-4 py-3 text-right">
                                <button @click="openEditForm(kw)" class="text-blue-400 hover:text-white mr-3">Edit</button>
                                <button @click="handleDelete(kw.id)" class="text-red-400 hover:text-red-200">Delete</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="flex items-center justify-between mt-4 text-sm text-gray-400">
                <div>
                    Showing {{ pagination.offset + 1 }} - {{ Math.min(pagination.offset + pagination.limit, pagination.total) }} 
                    of {{ pagination.total }}
                </div>
                <div class="flex gap-2">
                    <button @click="prevPage" :disabled="pagination.offset === 0" 
                            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50">
                        Previous
                    </button>
                    <button @click="nextPage" :disabled="pagination.offset + pagination.limit >= pagination.total"
                            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50">
                        Next
                    </button>
                </div>
            </div>

            <div v-if="showModal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div class="bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-full max-w-md relative animate-in fade-in zoom-in duration-200">
                    <div class="p-6">
                        <h3 class="text-xl font-bold mb-4 text-white">
                            {{ formMode === 'create' ? 'Add New Keyword' : 'Edit Keyword' }}
                        </h3>
                        
                        <form @submit.prevent="submitForm">
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-xs uppercase text-gray-500 mb-1">Keyword</label>
                                    <input v-model="form.keyword" required placeholder="e.g. 'polska'"
                                           class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none" />
                                </div>
                                
                                <div>
                                    <label class="block text-xs uppercase text-gray-500 mb-1">Main Style</label>
                                    <input v-model="form.main_style" required placeholder="e.g. 'Polska'"
                                           class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none" />
                                </div>
                                
                                <div>
                                    <label class="block text-xs uppercase text-gray-500 mb-1">Sub Style (Optional)</label>
                                    <input v-model="form.sub_style" placeholder="e.g. 'Slängpolska'"
                                           class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none" />
                                </div>

                                <div v-if="formMode === 'edit'">
                                    <label class="flex items-center gap-2 cursor-pointer mt-2">
                                        <input type="checkbox" v-model="form.is_active" class="w-4 h-4 rounded bg-gray-900 border-gray-600" />
                                        <span class="text-sm">Is Active</span>
                                    </label>
                                </div>
                            </div>

                            <div class="flex justify-end gap-3 mt-8">
                                <button type="button" @click="showModal = false" 
                                        class="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" :disabled="isSubmitting"
                                        class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded shadow disabled:opacity-50">
                                    {{ isSubmitting ? 'Saving...' : (formMode === 'create' ? 'Create' : 'Save Changes') }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `
};