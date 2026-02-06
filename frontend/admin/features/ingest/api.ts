/**
 * Ingest API
 * API methods for ingesting content from Spotify
 * Uses generated API client from OpenAPI spec
 */

import { ingest as ingestGenerated } from '../../api/generated/admin-maintenance/admin-maintenance';

export function useIngestApi() {
  const ingest = async (resourceType: string, resourceId: string) => {
    const response = await ingestGenerated({
      resourceId,
      resourceType,
    });
    // The generated client expects the backend to return an object shaped like:
    // { data: Ingest200, status: 200, headers: ... }
    // but the actual API may just return a plain payload like { message: '...' }.
    //
    // To support both, prefer response.data when present, otherwise fall back
    // to the raw response object. This avoids runtime errors like
    // "can't access property 'message', d is undefined" when response.data is missing.
    return (response as any)?.data ?? response;
  };

  return { ingest };
}

