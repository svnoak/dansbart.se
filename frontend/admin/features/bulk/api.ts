/**
 * Bulk Operations API
 * API methods for bulk operations on tracks
 * Uses generated API client from OpenAPI spec
 */

import { bulkReanalyze as bulkReanalyzeGenerated } from '../../api/generated/admin-tracks/admin-tracks';
import {
  getIsrcStats as getIsrcStatsGenerated,
  reclassifyAll as reclassifyAllGenerated,
  backfillIsrcs as backfillIsrcsGenerated,
} from '../../api/generated/admin-maintenance/admin-maintenance';

/** @param _token - Optional (kept for API compatibility with tabs that pass it) */
export function useBulkApi(_token?: unknown) {
  // Heuristic Classification (Fast)
  const reclassifyAll = async () => {
    const response = await reclassifyAllGenerated();
    return response.data;
  };

  // Full Audio Re-analysis (Slow/Heavy)
  const bulkReanalyze = async (statusFilter = 'everything', limit = 5000) => {
    const response = await bulkReanalyzeGenerated({
      statusFilter,
      limit,
    });
    return response.data;
  };

  // Get ISRC backfill statistics
  const getIsrcStats = async () => {
    const response = await getIsrcStatsGenerated();
    return response.data;
  };

  // Backfill ISRCs from Spotify
  const backfillIsrcs = async (limit: number | null = null) => {
    const params = limit ? { limit } : undefined;
    const response = await backfillIsrcsGenerated(params as any);
    return response.data;
  };

  return { reclassifyAll, bulkReanalyze, getIsrcStats, backfillIsrcs };
}

