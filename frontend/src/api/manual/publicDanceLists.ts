import { httpClient } from '@/api/http-client';

/**
 * Hand-written call for GET /api/dance-lists/public. It is not Orval-generated because the
 * backend could not be run to export a fresh OpenAPI spec. Once `npm run api:update` has been
 * run, replace this with the generated client function.
 */

export interface DanceListListItemDto {
  id: string;
  name: string;
  description?: string | null;
  isPublic?: boolean;
  entryCount?: number;
  ownerGroup?: { id?: string; name?: string } | null;
  ownerDisplayName?: string | null;
}

export interface PageResponseDanceListListItemDto {
  items?: DanceListListItemDto[];
  total?: number;
  page?: number;
  size?: number;
  hasMore?: boolean;
}

export function getPublicDanceLists(params?: {
  page?: number;
  size?: number;
}): Promise<PageResponseDanceListListItemDto> {
  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.size !== undefined) query.set('size', String(params.size));
  const qs = query.toString();
  return httpClient<PageResponseDanceListListItemDto>(
    qs ? `/api/dance-lists/public?${qs}` : '/api/dance-lists/public',
  );
}
