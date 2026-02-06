/**
 * Approvals API
 * API methods for artist approval management
 * Uses generated API client from OpenAPI spec
 */

import {
  getArtists1,
  rejectArtist as rejectArtistGenerated,
  approveArtist as approveArtistGenerated,
  bulkApproveArtists as bulkApproveArtistsGenerated,
  bulkRejectArtists as bulkRejectArtistsGenerated,
} from '../../api/generated/admin-artists/admin-artists';
import {
  removeFromBlocklist as removeFromBlocklistGenerated,
  getRejections,
} from '../../api/generated/admin-rejections/admin-rejections';

export function useApprovalsApi() {
  const loadIsolatedArtists = async (limit = 100, offset = 0, search = '') => {
    const params: Record<string, unknown> = { limit, offset };
    if (search) {
      params.search = search;
    }
    // Load ALL artists, then we'll filter isolated on client side
    const response = await getArtists1(params);
    return response.data;
  };

  const rejectArtist = async (artistId: string, reason: string) => {
    const response = await rejectArtistGenerated(artistId, { reason } as any);
    return response.data;
  };

  const approveArtist = async (artistId: string) => {
    const response = await approveArtistGenerated(artistId);
    return response.data;
  };

  const bulkApproveArtists = async (ids: string[]) => {
    const response = await bulkApproveArtistsGenerated({ ids });
    return response.data;
  };

  const bulkRejectArtists = async (ids: string[], reason = 'Bulk rejection') => {
    const response = await bulkRejectArtistsGenerated({ ids, reason });
    return response.data;
  };

  const removeFromBlocklist = async (rejectionId: string) => {
    const response = await removeFromBlocklistGenerated(rejectionId);
    return response.data;
  };

  const loadBlocklist = async (entityType = 'artist', limit = 100, offset = 0) => {
    const response = await getRejections({ entityType, limit, offset });
    return response.data;
  };

  return {
    loadIsolatedArtists,
    rejectArtist,
    approveArtist,
    bulkApproveArtists,
    bulkRejectArtists,
    removeFromBlocklist,
    loadBlocklist,
  };
}

