/**
 * Reject API
 * API methods for managing rejections and blocklist
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useRejectApi(token) {
    const { fetchWithAuth } = useAdminApi(token);

    const loadPendingArtists = async (limit = 100) => {
        const res = await fetchWithAuth(`/api/admin/pending/artists?limit=${limit}`);
        return res.json();
    };

    const loadPendingAlbums = async (limit = 100) => {
        const res = await fetchWithAuth(`/api/admin/pending/albums?limit=${limit}`);
        return res.json();
    };

    const loadBlocklist = async (filter = '', limit = 100) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (filter) {
            params.append('entity_type', filter);
        }
        const res = await fetchWithAuth(`/api/admin/rejections?${params}`);
        return res.json();
    };

    const rejectArtistPreview = async (artistId) => {
        const res = await fetchWithAuth(`/api/admin/artists/${artistId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reason: 'Not relevant',
                dry_run: true
            })
        });
        return res.json();
    };

    const confirmRejectArtist = async (artistId, reason) => {
        const res = await fetchWithAuth(`/api/admin/artists/${artistId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        return res.json();
    };

    const rejectAlbum = async (albumId, reason) => {
        const res = await fetchWithAuth(`/api/admin/albums/${albumId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        return res.json();
    };

    const unblock = async (rejectionId) => {
        const res = await fetchWithAuth(`/api/admin/rejections/${rejectionId}`, {
            method: 'DELETE'
        });
        return res.json();
    };

    return {
        loadPendingArtists,
        loadPendingAlbums,
        loadBlocklist,
        rejectArtistPreview,
        confirmRejectArtist,
        rejectAlbum,
        unblock
    };
}
