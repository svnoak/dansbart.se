/**
 * Ingest API
 * API methods for ingesting content from Spotify
 * Uses generated API client from OpenAPI spec
 */

import { ingest as ingestGenerated } from '../../api/generated/admin-maintenance/admin-maintenance.js';

export function useIngestApi() {
  const ingest = async (resourceType, resourceId) => {
    const response = await ingestGenerated({
      resourceId,
      resourceType,
    });
    return response.data;
  };

  return { ingest };
}
