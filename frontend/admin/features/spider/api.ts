/**
 * Spider API
 * API methods for spider crawling operations
 * Uses generated API client from OpenAPI spec
 */

import {
  triggerCrawl,
  getSpiderStats,
  getCrawlHistory,
  getTaskStatus as getTaskStatusGenerated,
} from '../../api/generated/admin-spider/admin-spider';

type SpiderSettings = {
  mode?: string;
  maxDiscoveries?: number;
  discoverFromAlbums?: boolean;
};

export function useSpiderApi() {
  const crawl = async (settings: SpiderSettings) => {
    // Map settings object to query params expected by generated API
    const params: Record<string, unknown> = {};
    if (settings.mode) params.mode = settings.mode;
    if (settings.maxDiscoveries !== undefined) params.maxDiscoveries = settings.maxDiscoveries;
    if (settings.discoverFromAlbums !== undefined) {
      params.discoverFromAlbums = settings.discoverFromAlbums;
    }

    const response = await triggerCrawl(params);
    return response.data;
  };

  const getTaskStatus = async (taskId: string) => {
    const response = await getTaskStatusGenerated(taskId);
    return response.data;
  };

  const getStats = async () => {
    const response = await getSpiderStats();
    return response.data;
  };

  const getHistory = async (limit = 50) => {
    const response = await getCrawlHistory({ limit });
    return response.data;
  };

  return { crawl, getTaskStatus, getStats, getHistory };
}

