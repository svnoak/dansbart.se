/**
 * Tracks API
 * API methods for track management
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useTracksApi(token) {
    const { fetchWithAuth } = useAdminApi(token);

    const loadTracks = async (params) => {
        const queryString = new URLSearchParams(params).toString();
        const res = await fetchWithAuth(`/api/admin/tracks?${queryString}`);
        return res.json();
    };

    const reanalyze = async (trackId) => {
        const res = await fetchWithAuth(`/api/admin/tracks/${trackId}/reanalyze`, {
            method: 'POST'
        });
        return res.json();
    };

    const reclassify = async (trackId) => {
        const res = await fetchWithAuth(`/api/admin/tracks/${trackId}/reclassify`, {
            method: 'POST'
        });
        return res.json();
    };

    const unflag = async (trackId) => {
        const res = await fetchWithAuth(`/api/tracks/${trackId}/flag`, {
            method: 'DELETE'
        });
        return res.json();
    };

    return { loadTracks, reanalyze, reclassify, unflag };
}
