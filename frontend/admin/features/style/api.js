/**
 * Style Keywords API
 * API methods for managing genre classification keywords
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useStyleKeywordsApi(token) {
  const { fetchWithAuth } = useAdminApi(token);

  const getKeywords = async params => {
    // Convert null/undefined to empty strings or filter out
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.main_style) query.append('main_style', params.main_style);
    if (params.is_active !== null && params.is_active !== '')
      query.append('is_active', params.is_active);
    query.append('limit', params.limit || 50);
    query.append('offset', params.offset || 0);

    const res = await fetchWithAuth(`/api/admin/style-keywords?${query.toString()}`);
    return res.json();
  };

  const getStats = async () => {
    const res = await fetchWithAuth('/api/admin/style-keywords/stats');
    return res.json();
  };

  const createKeyword = async data => {
    const res = await fetchWithAuth('/api/admin/style-keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  };

  const updateKeyword = async (id, data) => {
    const res = await fetchWithAuth(`/api/admin/style-keywords/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  };

  const deleteKeyword = async id => {
    const res = await fetchWithAuth(`/api/admin/style-keywords/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  };

  const invalidateCache = async () => {
    const res = await fetchWithAuth('/api/admin/style-keywords/invalidate-cache', {
      method: 'POST',
    });
    return res.json();
  };

  return {
    getKeywords,
    getStats,
    createKeyword,
    updateKeyword,
    deleteKeyword,
    invalidateCache,
  };
}
