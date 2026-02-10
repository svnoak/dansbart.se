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
} from '../../api/generated/admin-style-keywords/admin-style-keywords';

type GetKeywordsParams = {
  limit?: number;
  offset?: number;
  search?: string;
  mainStyle?: string;
  isActive?: string | boolean | null;
};

/** @param _token - Optional (kept for API compatibility with tabs that pass it) */
export function useStyleKeywordsApi(_token?: unknown) {
  const getKeywords = async (params: GetKeywordsParams) => {
    const apiParams: Record<string, unknown> = {
      limit: params.limit || 50,
      offset: params.offset || 0,
    };
    if (params.search) apiParams.search = params.search;
    if (params.mainStyle) apiParams.mainStyle = params.mainStyle;
    if (params.isActive !== null && params.isActive !== '') {
      apiParams.isActive = params.isActive === 'true' || params.isActive === true;
    }

    const response = await getKeywords1(apiParams);
    return response.data;
  };

  const getStats = async () => {
    const response = await getStats1();
    return response.data;
  };

  const createKeyword = async (data: unknown) => {
    const response = await createKeywordGenerated(data as any);
    return response.data;
  };

  const updateKeyword = async (id: string, data: unknown) => {
    const response = await updateKeywordGenerated(id, data as any);
    return response.data;
  };

  const deleteKeyword = async (id: string) => {
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

