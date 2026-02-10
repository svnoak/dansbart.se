/**
 * Reject API
 * API methods for managing rejections, blocklist, and artist review
 * Uses generated API client from OpenAPI spec
 */

import {
  getPendingArtists,
  getPendingAlbums,
} from '../../api/generated/admin-pending/admin-pending';
import {
  getRejections,
  removeFromBlocklist,
  addToBlocklist as addToBlocklistGenerated,
} from '../../api/generated/admin-rejections/admin-rejections';
import {
  rejectArtist,
  bulkRejectArtists as bulkRejectArtistsGenerated,
} from '../../api/generated/admin-artists/admin-artists';
import { rejectAlbum as rejectAlbumGenerated } from '../../api/generated/admin-albums/admin-albums';

/** @param _token - Optional (kept for API compatibility with tabs that pass it) */
export function useRejectApi(_token?: unknown) {
  const loadPendingArtists = async (limit = 50, offset = 0, search = '') => {
    const params: Record<string, unknown> = { limit, offset };
    if (search) params.search = search;
    const response = await getPendingArtists(params);
    return response.data;
  };

  const loadPendingAlbums = async (limit = 50, offset = 0) => {
    const response = await getPendingAlbums({ limit, offset });
    return response.data;
  };

  const loadBlocklist = async (filter = '', limit = 50, offset = 0) => {
    const params: Record<string, unknown> = { limit, offset };
    if (filter) params.entityType = filter;
    const response = await getRejections(params);
    return response.data;
  };

  const rejectArtistPreview = async (artistId: string) => {
    const response = await rejectArtist(artistId, {
      reason: 'Not relevant',
      dryRun: true,
    } as any);
    return response.data;
  };

  const confirmRejectArtist = async (artistId: string, reason: string, deleteContent = true) => {
    const response = await rejectArtist(artistId, {
      reason,
      deleteContent,
    } as any);
    return response.data;
  };

  const rejectAlbum = async (albumId: string, reason: string) => {
    const response = await rejectAlbumGenerated(albumId, { reason } as any);
    return response.data;
  };

  const unblock = async (rejectionId: string) => {
    const response = await removeFromBlocklist(rejectionId);
    return response.data;
  };

  const addToBlocklist = async (data: unknown) => {
    const response = await addToBlocklistGenerated(data as any);
    return response.data;
  };

  const bulkRejectArtists = async (
    ids: string[],
    reason = 'Bulk rejection',
    deleteContent = true,
  ) => {
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

