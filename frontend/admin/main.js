/**
 * Admin Panel Main Application
 * Initializes Vue app with all feature modules
 */

import { useAdminAuth } from './shared/composables/useAdminAuth.js';
import TracksTab from './features/tracks/TracksTab.js';
import IngestTab from './features/ingest/IngestTab.js';
import BulkTab from './features/bulk/BulkTab.js';
import SpiderTab from './features/spider/SpiderTab.js';
import ApprovalsTab from './features/approvals/ApprovalsTab.js';
import RejectTab from './features/reject/RejectTab.js';
import Toast from './shared/components/Toast.js';

const { createApp, ref } = Vue;

const app = createApp({
    components: {
        'tracks-tab': TracksTab,
        'ingest-tab': IngestTab,
        'bulk-tab': BulkTab,
        'spider-tab': SpiderTab,
        'approvals-tab': ApprovalsTab,
        'reject-tab': RejectTab,
        'toast-container': Toast
    },
    setup() {
        const { adminToken, clearToken } = useAdminAuth();
        const activeTab = ref('tracks');

        // Check if user is authenticated
        if (!adminToken.value) {
            window.location.href = '/admin/index.html';
            return {};
        }

        const logout = () => {
            clearToken();
        };

        return {
            activeTab,
            logout
        };
    }
});

app.mount('#admin-panel');
