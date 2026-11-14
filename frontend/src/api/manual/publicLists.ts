import { httpClient } from '@/api/http-client';
import type { PlaylistDto } from '@/api/models/playlistDto';
import type { DanceListDto } from '@/api/models/danceListDto';

/**
 * Hand-written calls for GET /api/public/playlists/{id} and GET /api/public/dance-lists/{id}.
 * They are not Orval-generated because the backend could not be run to export a fresh OpenAPI
 * spec. Once `npm run api:update` has been run, replace them with the generated functions.
 *
 * A public list leaves out what only a person who manages the list needs, so the types below
 * are the full DTOs without those fields. Both are assignable to the full DTOs.
 */

export type PublicPlaylistDto = Omit<
  PlaylistDto,
  'shareToken' | 'guestCode' | 'viewerCanManage' | 'collaborators' | 'isPublic'
>;

export type PublicDanceListDto = Omit<
  DanceListDto,
  'shareToken' | 'guestCode' | 'viewerCanManage' | 'viewerHasFullControl' | 'collaborators' | 'isPublic'
>;

export function getPublicPlaylist(id: string, options?: RequestInit): Promise<PublicPlaylistDto> {
  return httpClient<PublicPlaylistDto>(`/api/public/playlists/${encodeURIComponent(id)}`, options);
}

export function getPublicDanceList(id: string, options?: RequestInit): Promise<PublicDanceListDto> {
  return httpClient<PublicDanceListDto>(`/api/public/dance-lists/${encodeURIComponent(id)}`, options);
}
