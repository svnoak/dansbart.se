/**
 * Approvals API
 * API methods for artist approval management
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useApprovalsApi(token) {
    const { fetchWithAuth } = useAdminApi(token);

    const loadIsolatedArtists = async (limit = 100, offset = 0, search = '') => {
        const params = new URLSearchParams({
            limit: String(limit),
            offset: String(offset)
        });

        if (search) {
            params.append('search', search);
        }

        // Load ALL artists, then we'll filter isolated on client side
        const res = await fetchWithAuth(`/api/admin/artists?${params.toString()}`);
        return res.json();
    };

    const rejectArtist = async (artistId, reason) => {
        const res = await fetchWithAuth(`/api/admin/artists/${artistId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        return res.json();
    };

    const approveArtist = async (artistId) => {
        const res = await fetchWithAuth(`/api/admin/artists/${artistId}/approve`, {
            method: 'POST'
        });
        return res.json();
    };

    const bulkApproveArtists = async (ids) => {
        const res = await fetchWithAuth('/api/admin/artists/bulk-approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        return res.json();
    };

    const bulkRejectArtists = async (ids, reason = 'Bulk rejection') => {
        const res = await fetchWithAuth('/api/admin/artists/bulk-reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, reason })
        });
        return res.json();
    };

    const removeFromBlocklist = async (rejectionId) => {
        const res = await fetchWithAuth(`/api/admin/rejections/${rejectionId}`, {
            method: 'DELETE'
        });
        return res.json();
    };

    const loadBlocklist = async (entityType = 'artist', limit = 100, offset = 0) => {
        const params = new URLSearchParams({
            limit: String(limit),
            offset: String(offset)
        });

        if (entityType) {
            params.append('entity_type', entityType);
        }

        const res = await fetchWithAuth(`/api/admin/rejections?${params.toString()}`);
        return res.json();
    };

    return { loadIsolatedArtists, rejectArtist, approveArtist, bulkApproveArtists, bulkRejectArtists, removeFromBlocklist, loadBlocklist };
}
