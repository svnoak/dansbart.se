/**
 * Bulk Operations API
 * API methods for bulk operations on tracks
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useBulkApi(token) {
    const { fetchWithAuth } = useAdminApi(token);

    const reclassifyAll = async () => {
        const res = await fetchWithAuth('/api/admin/reclassify-all', {
            method: 'POST'
        });
        return res.json();
    };

    return { reclassifyAll };
}
