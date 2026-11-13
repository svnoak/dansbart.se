import {
  generateDanceListShareToken,
  invalidateDanceListShareToken,
} from '@/api/generated/dance-lists/dance-lists';
import { useShareLink, type ShareLinkApi, type UseShareLinkResult } from './useShareLink';

const DANCE_LIST_SHARE_API: ShareLinkApi = {
  generate: (id) => generateDanceListShareToken(id),
  invalidate: (id) => invalidateDanceListShareToken(id),
  pathPrefix: '/dance-lists/shared/',
};

/** Owns the share token for a dance list and the actions that create, remove, and copy its link. */
export function useDanceListShareLink(
  danceListId: string | undefined,
  initialShareToken: string | undefined,
): UseShareLinkResult {
  return useShareLink(danceListId, initialShareToken, DANCE_LIST_SHARE_API);
}
