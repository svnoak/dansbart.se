/**
 * Library API
 * Unified API for managing tracks, albums, artists, and blocklist
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useLibraryApi(token) {
  const { fetchWithAuth } = useAdminApi(token);

  // ===== TRACKS =====
  const loadTracks = async params => {
    const queryString = new URLSearchParams(params).toString();
    const res = await fetchWithAuth(`/api/admin/tracks?${queryString}`);
    return res.json();
  };

  const reanalyzeTrack = async trackId => {
    const res = await fetchWithAuth(`/api/admin/tracks/${trackId}/reanalyze`, {
      method: 'POST',
    });
    return res.json();
  };

  const reclassifyTrack = async trackId => {
    const res = await fetchWithAuth(`/api/admin/tracks/${trackId}/reclassify`, {
      method: 'POST',
    });
    return res.json();
  };

  const unflagTrack = async trackId => {
    const res = await fetchWithAuth(`/api/tracks/${trackId}/flag`, {
      method: 'DELETE',
    });
    return res.json();
  };

  const rejectTrack = async (trackId, reason) => {
    const res = await fetchWithAuth(`/api/admin/tracks/${trackId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return res.json();
  };

  const deleteTrack = async trackId => {
    const res = await fetchWithAuth(`/api/admin/tracks/${trackId}`, {
      method: 'DELETE',
    });
    return res.json();
  };

  const loadDuplicateTracks = async (limit = 50, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const res = await fetchWithAuth(`/api/admin/tracks/duplicates?${params.toString()}`);
    return res.json();
  };

  // ===== ARTISTS =====
  const loadArtists = async params => {
    const queryString = new URLSearchParams(params).toString();
    const res = await fetchWithAuth(`/api/admin/artists?${queryString}`);
    return res.json();
  };

  const loadPendingArtists = async (limit = 50, offset = 0, search = '') => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    if (search) {
      params.append('search', search);
    }

    const res = await fetchWithAuth(`/api/admin/pending/artists?${params.toString()}`);
    return res.json();
  };

  const rejectArtist = async (artistId, reason, deleteContent = true) => {
    const res = await fetchWithAuth(`/api/admin/artists/${artistId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, delete_content: deleteContent }),
    });
    return res.json();
  };

  const bulkRejectArtists = async (ids, reason = 'Bulk rejection', deleteContent = true) => {
    const res = await fetchWithAuth('/api/admin/artists/bulk-reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, reason, delete_content: deleteContent }),
    });
    return res.json();
  };

  const approveArtist = async artistId => {
    const res = await fetchWithAuth(`/api/admin/artists/${artistId}/approve`, {
      method: 'POST',
    });
    return res.json();
  };

  const bulkApproveArtists = async ids => {
    const res = await fetchWithAuth('/api/admin/artists/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return res.json();
  };

  const getCollaborationNetwork = async artistId => {
    const res = await fetchWithAuth(`/api/admin/artists/${artistId}/collaboration-network`);
    return res.json();
  };

  const rejectNetwork = async (artistIds, albumIds, reason) => {
    const res = await fetchWithAuth('/api/admin/reject-network', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_ids: artistIds, album_ids: albumIds, reason }),
    });
    return res.json();
  };

  // ===== ALBUMS =====
  const loadAlbums = async params => {
    const queryString = new URLSearchParams(params).toString();
    const res = await fetchWithAuth(`/api/admin/albums?${queryString}`);
    return res.json();
  };

  const loadPendingAlbums = async (limit = 50, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const res = await fetchWithAuth(`/api/admin/pending/albums?${params.toString()}`);
    return res.json();
  };

  const rejectAlbum = async (albumId, reason) => {
    const res = await fetchWithAuth(`/api/admin/albums/${albumId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return res.json();
  };

  // ===== BLOCKLIST =====
  const loadBlocklist = async (filter = '', limit = 50, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    if (filter) {
      params.append('entity_type', filter);
    }

    const res = await fetchWithAuth(`/api/admin/rejections?${params.toString()}`);
    return res.json();
  };

  const removeFromBlocklist = async rejectionId => {
    const res = await fetchWithAuth(`/api/admin/rejections/${rejectionId}`, {
      method: 'DELETE',
    });
    return res.json();
  };

  const addToBlocklist = async data => {
    const res = await fetchWithAuth('/api/admin/blocklist/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  };

  return {
    // Tracks
    loadTracks,
    loadDuplicateTracks,
    reanalyzeTrack,
    reclassifyTrack,
    unflagTrack,
    rejectTrack,
    deleteTrack,
    // Artists
    loadArtists,
    loadPendingArtists,
    rejectArtist,
    bulkRejectArtists,
    approveArtist,
    bulkApproveArtists,
    getCollaborationNetwork,
    rejectNetwork,
    // Albums
    loadAlbums,
    loadPendingAlbums,
    rejectAlbum,
    // Blocklist
    loadBlocklist,
    removeFromBlocklist,
    addToBlocklist,
  };
}
