/**
 * Style Keywords API
 * API methods for managing genre classification keywords
 * Uses generated API client from OpenAPI spec
 */

import {
  getKeywords1,
  getStats1,
  createKeyword as createKeywordGenerated,
  updateKeyword as updateKeywordGenerated,
  deleteKeyword as deleteKeywordGenerated,
  invalidateCache as invalidateCacheGenerated,
} from '../../api/generated/admin-style-keywords/admin-style-keywords.js';

export function useStyleKeywordsApi() {
  const getKeywords = async params => {
    // Map snake_case params to camelCase for generated API
    const apiParams = {
      limit: params.limit || 50,
      offset: params.offset || 0,
    };
    if (params.search) apiParams.search = params.search;
    if (params.main_style) apiParams.mainStyle = params.main_style;
    if (params.is_active !== null && params.is_active !== '') {
      apiParams.isActive = params.is_active === 'true' || params.is_active === true;
    }

    const response = await getKeywords1(apiParams);
    return response.data;
  };

  const getStats = async () => {
    const response = await getStats1();
    return response.data;
  };

  const createKeyword = async data => {
    const response = await createKeywordGenerated(data);
    return response.data;
  };

  const updateKeyword = async (id, data) => {
    const response = await updateKeywordGenerated(id, data);
    return response.data;
  };

  const deleteKeyword = async id => {
    const response = await deleteKeywordGenerated(id);
    return response.data;
  };

  const invalidateCache = async () => {
    const response = await invalidateCacheGenerated();
    return response.data;
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
