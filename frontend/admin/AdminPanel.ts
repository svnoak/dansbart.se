import { ref } from 'vue';
import { useAdminAuth } from './shared/composables/useAdminAuth.js';

// Import your existing feature tabs
import LibraryTab from './features/library/LibraryTab.js';
import IngestTab from './features/ingest/IngestTab.js';
import BulkTab from './features/bulk/BulkTab.js';
import SpiderTab from './features/spider/SpiderTab.js';
import ApprovalsTab from './features/approvals/ApprovalsTab.js';
import AnalyticsTab from './features/analytics/AnalyticsTab.js';
import Toast from '../js/components/toasts/Toast';
import StyleKeywordsTab from './features/style/StyleKeywordsTab.js';

export default {
  components: {
    'library-tab': LibraryTab,
    'ingest-tab': IngestTab,
    'bulk-tab': BulkTab,
    'spider-tab': SpiderTab,
    'approvals-tab': ApprovalsTab,
    'analytics-tab': AnalyticsTab,
    'style-keywords-tab': StyleKeywordsTab,
    'toast-container': Toast,
  },
  emits: ['logout'],
  setup(props, { emit }) {
    const { logout: authLogout, user } = useAdminAuth();
    const activeTab = ref('library');

    const logout = () => {
      authLogout();
      emit('logout');
    };

    return {
      activeTab,
      logout,
      user,
    };
  },
  template: `
        <div id="admin-panel" class="max-w-6xl mx-auto">
            <h1 class="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">🤖 Dansbart Admin Console</h1>

            <div class="flex flex-wrap gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-gray-700 pb-2">
                <button @click="activeTab = 'library'"
                        :class="activeTab === 'library' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-2 sm:px-4 py-1.5 sm:py-2 rounded-t text-xs sm:text-sm font-medium transition-colors">
                    <span class="hidden sm:inline">📚 Library</span>
                    <span class="sm:hidden">📚</span>
                </button>
                <button @click="activeTab = 'ingest'"
                        :class="activeTab === 'ingest' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-2 sm:px-4 py-1.5 sm:py-2 rounded-t text-xs sm:text-sm font-medium transition-colors">
                    <span class="hidden sm:inline">➕ Ingest</span>
                    <span class="sm:hidden">➕</span>
                </button>
                <button @click="activeTab = 'bulk'"
                        :class="activeTab === 'bulk' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-2 sm:px-4 py-1.5 sm:py-2 rounded-t text-xs sm:text-sm font-medium transition-colors">
                    <span class="hidden sm:inline">⚡ Bulk</span>
                    <span class="sm:hidden">⚡</span>
                </button>
                <button @click="activeTab = 'spider'"
                        :class="activeTab === 'spider' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-2 sm:px-4 py-1.5 sm:py-2 rounded-t text-xs sm:text-sm font-medium transition-colors">
                    <span class="hidden sm:inline">🕸️ Spider</span>
                    <span class="sm:hidden">🕸️</span>
                </button>
                <button @click="activeTab = 'approvals'"
                        :class="activeTab === 'approvals' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-2 sm:px-4 py-1.5 sm:py-2 rounded-t text-xs sm:text-sm font-medium transition-colors">
                    <span class="hidden sm:inline">✅ Approvals</span>
                    <span class="sm:hidden">✅</span>
                </button>
                <button @click="activeTab = 'analytics'"
                        :class="activeTab === 'analytics' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-2 sm:px-4 py-1.5 sm:py-2 rounded-t text-xs sm:text-sm font-medium transition-colors">
                    <span class="hidden sm:inline">📊 Analytics</span>
                    <span class="sm:hidden">📊</span>
                </button>

                <button @click="activeTab = 'style-keywords'"
                        :class="activeTab === 'style-keywords' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'"
                        class="px-2 sm:px-4 py-1.5 sm:py-2 rounded-t text-xs sm:text-sm font-medium transition-colors">
                    <span class="hidden sm:inline">🎼 Style Keywords</span>
                    <span class="sm:hidden">🎼</span>
                </button>

                <button @click="logout" class="ml-auto text-gray-400 hover:text-white text-xs sm:text-sm px-2 sm:px-3 transition-colors">
                    🚪 <span class="hidden sm:inline">Logout</span>
                </button>
            </div>

            <transition name="fade" mode="out-in">
                <keep-alive>
                    <component :is="activeTab + '-tab'" />
                </keep-alive>
            </transition>

            <toast-container />
        </div>
    `,
};
