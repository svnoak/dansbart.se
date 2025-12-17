/**
 * Spider API
 * API methods for spider crawling operations
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useSpiderApi(token) {
  const { fetchWithAuth } = useAdminApi(token);

  const crawl = async settings => {
    const res = await fetchWithAuth('/api/admin/spider/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    return res.json();
  };

  const getTaskStatus = async taskId => {
    const res = await fetchWithAuth(`/api/admin/spider/task/${taskId}`);
    return res.json();
  };

  const getStats = async () => {
    const res = await fetchWithAuth('/api/admin/spider/stats');
    return res.json();
  };

  const getHistory = async (limit = 50) => {
    const res = await fetchWithAuth(`/api/admin/spider/history?limit=${limit}`);
    return res.json();
  };

  return { crawl, getTaskStatus, getStats, getHistory };
}
