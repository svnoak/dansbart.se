/**
 * Ingest API
 * API methods for ingesting content from Spotify
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useIngestApi(token) {
    const { fetchWithAuth } = useAdminApi(token);

    const ingest = async (resourceType, resourceId) => {
        const res = await fetchWithAuth('/api/admin/ingest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                resource_id: resourceId,
                resource_type: resourceType
            })
        });
        return res.json();
    };

    return { ingest };
}
