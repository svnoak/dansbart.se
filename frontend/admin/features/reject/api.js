/**
 * Reject API
 * API methods for managing rejections, blocklist, and artist review
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useRejectApi(token) {
  const { fetchWithAuth } = useAdminApi(token);

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

  const loadPendingAlbums = async (limit = 50, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const res = await fetchWithAuth(`/api/admin/pending/albums?${params.toString()}`);
    return res.json();
  };

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

  const rejectArtistPreview = async artistId => {
    const res = await fetchWithAuth(`/api/admin/artists/${artistId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Not relevant',
        dry_run: true,
      }),
    });
    return res.json();
  };

  const confirmRejectArtist = async (artistId, reason, deleteContent = true) => {
    const res = await fetchWithAuth(`/api/admin/artists/${artistId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, delete_content: deleteContent }),
    });
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

  const unblock = async rejectionId => {
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

  const bulkRejectArtists = async (ids, reason = 'Bulk rejection', deleteContent = true) => {
    const res = await fetchWithAuth('/api/admin/artists/bulk-reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, reason, delete_content: deleteContent }),
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
    unblock,
    addToBlocklist,
    bulkRejectArtists,
  };
}
