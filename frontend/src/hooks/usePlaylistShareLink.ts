import { generateShareToken, invalidateShareToken } from '@/api/generated/playlists/playlists';
import { useShareLink, type ShareLinkApi, type UseShareLinkResult } from './useShareLink';

export type UsePlaylistShareLinkResult = UseShareLinkResult;

const PLAYLIST_SHARE_API: ShareLinkApi = {
  generate: (id) => generateShareToken(id),
  invalidate: (id) => invalidateShareToken(id),
  pathPrefix: '/shared/',
};

/** Owns the share token for a playlist and the actions that create, remove, and copy its link. */
export function usePlaylistShareLink(
  playlistId: string | undefined,
  initialShareToken: string | undefined,
): UsePlaylistShareLinkResult {
  return useShareLink(playlistId, initialShareToken, PLAYLIST_SHARE_API);
}
