/**
 * Reject API
 * API methods for managing rejections, blocklist, and artist review
 * Uses generated API client from OpenAPI spec
 */

import {
  getPendingArtists,
  getPendingAlbums,
} from '../../api/generated/admin-pending/admin-pending.js';
import {
  getRejections,
  removeFromBlocklist,
  addToBlocklist as addToBlocklistGenerated,
} from '../../api/generated/admin-rejections/admin-rejections.js';
import {
  rejectArtist,
  bulkRejectArtists as bulkRejectArtistsGenerated,
} from '../../api/generated/admin-artists/admin-artists.js';
import { rejectAlbum as rejectAlbumGenerated } from '../../api/generated/admin-albums/admin-albums.js';

export function useRejectApi() {
  const loadPendingArtists = async (limit = 50, offset = 0, search = '') => {
    const params = { limit, offset };
    if (search) params.search = search;
    const response = await getPendingArtists(params);
    return response.data;
  };

  const loadPendingAlbums = async (limit = 50, offset = 0) => {
    const response = await getPendingAlbums({ limit, offset });
    return response.data;
  };

  const loadBlocklist = async (filter = '', limit = 50, offset = 0) => {
    const params = { limit, offset };
    if (filter) params.entityType = filter;
    const response = await getRejections(params);
    return response.data;
  };

  const rejectArtistPreview = async artistId => {
    const response = await rejectArtist(artistId, {
      reason: 'Not relevant',
      dryRun: true,
    });
    return response.data;
  };

  const confirmRejectArtist = async (artistId, reason, deleteContent = true) => {
    const response = await rejectArtist(artistId, {
      reason,
      deleteContent,
    });
    return response.data;
  };

  const rejectAlbum = async (albumId, reason) => {
    const response = await rejectAlbumGenerated(albumId, { reason });
    return response.data;
  };

  const unblock = async rejectionId => {
    const response = await removeFromBlocklist(rejectionId);
    return response.data;
  };

  const addToBlocklist = async data => {
    const response = await addToBlocklistGenerated(data);
    return response.data;
  };

  const bulkRejectArtists = async (ids, reason = 'Bulk rejection', deleteContent = true) => {
    const response = await bulkRejectArtistsGenerated({
      ids,
      reason,
      deleteContent,
    });
    return response.data;
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
