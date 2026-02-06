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
  main_style?: string;
  is_active?: string | boolean | null;
};

export function useStyleKeywordsApi() {
  const getKeywords = async (params: GetKeywordsParams) => {
    // Map snake_case params to camelCase for generated API
    const apiParams: Record<string, unknown> = {
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

