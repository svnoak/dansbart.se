/**
 * Bulk Operations API
 * API methods for bulk operations on tracks
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useBulkApi(token) {
  const { fetchWithAuth } = useAdminApi(token);

  // Heuristic Classification (Fast)
  const reclassifyAll = async () => {
    const res = await fetchWithAuth('/api/admin/reclassify-all', {
      method: 'POST',
    });
    return res.json();
  };

  // Full Audio Re-analysis (Slow/Heavy)
  const bulkReanalyze = async (statusFilter = 'everything', limit = 5000) => {
    const res = await fetchWithAuth('/api/admin/tracks/bulk-reanalyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status_filter: statusFilter,
        limit: limit,
      }),
    });
    return res.json();
  };

  // Get ISRC backfill statistics
  const getIsrcStats = async () => {
    const res = await fetchWithAuth('/api/admin/maintenance/isrc-stats', {
      method: 'GET',
    });
    return res.json();
  };

  // Backfill ISRCs from Spotify
  const backfillIsrcs = async (limit = null) => {
    const url = limit
      ? `/api/admin/maintenance/backfill-isrcs?limit=${limit}`
      : '/api/admin/maintenance/backfill-isrcs';

    const res = await fetchWithAuth(url, {
      method: 'POST',
    });
    return res.json();
  };

  return { reclassifyAll, bulkReanalyze, getIsrcStats, backfillIsrcs };
}
