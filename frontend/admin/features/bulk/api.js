/**
 * Bulk Operations API
 * API methods for bulk operations on tracks
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useBulkApi(token) {
    const { fetchWithAuth } = useAdminApi(token);

    // Heuristic Classification (Fast)
    const reclassifyAll = async () => {
        const res = await fetchWithAuth('/api/admin/reclassify-all', {
            method: 'POST'
        });
        return res.json();
    };

    // Full Audio Re-analysis (Slow/Heavy)
    const bulkReanalyze = async (statusFilter = 'everything', limit = 5000) => {
        const res = await fetchWithAuth('/api/admin/tracks/bulk-reanalyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                status_filter: statusFilter, 
                limit: limit 
            })
        });
        return res.json();
    };

    return { reclassifyAll, bulkReanalyze };
}