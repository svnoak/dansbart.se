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

    const loadArtists = async (params) => {
        const queryString = new URLSearchParams(params).toString();
        const res = await fetchWithAuth(`/api/admin/artists?${queryString}`);
        return res.json();
    };

    const loadAlbums = async (params) => {
        const queryString = new URLSearchParams(params).toString();
        const res = await fetchWithAuth(`/api/admin/albums?${queryString}`);
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

    const rejectAlbum = async (albumId, reason) => {
        const res = await fetchWithAuth(`/api/admin/albums/${albumId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        return res.json();
    };

    const rejectTrack = async (trackId, reason) => {
        const res = await fetchWithAuth(`/api/admin/tracks/${trackId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        return res.json();
    };

    return {
        loadTracks,
        loadArtists,
        loadAlbums,
        reanalyze,
        reclassify,
        unflag,
        rejectArtist,
        rejectAlbum,
        rejectTrack
    };
}
