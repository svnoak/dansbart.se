/**
 * Tracks API
 * API methods for track management
 * Uses generated API client from OpenAPI spec
 */

import {
  getTracks1,
  reanalyzeTrack,
  reclassifyTrack,
  rejectTrack as rejectTrackGenerated,
} from '../../api/generated/admin-tracks/admin-tracks';
import { getArtists1, rejectArtist as rejectArtistGenerated } from '../../api/generated/admin-artists/admin-artists';
import { getAlbums1, rejectAlbum as rejectAlbumGenerated } from '../../api/generated/admin-albums/admin-albums';
import type { RejectRequest } from '../../api/models/rejectRequest';
import { useAdminApi } from '../../shared/composables/useAdminApi';
import type { Ref } from 'vue';

type MaybeRef<T> = T | Ref<T>;

export function useTracksApi(token: MaybeRef<string | null | undefined>) {
  const { fetchWithAuth } = useAdminApi(token);

  const loadTracks = async (params: Parameters<typeof getTracks1>[0]) => {
    const response = await getTracks1(params);
    return response.data;
  };

  const reanalyze = async (trackId: string) => {
    const response = await reanalyzeTrack(trackId);
    return response.data;
  };

  const reclassify = async (trackId: string) => {
    const response = await reclassifyTrack(trackId);
    return response.data;
  };

  // unflagTrack is tagged as public in the spec but requires admin auth
  // Keep manual implementation until backend tags it correctly
  const unflag = async (trackId: string) => {
    const res = await fetchWithAuth(`/api/tracks/${trackId}/flag`, {
      method: 'DELETE',
    });
    return res.json();
  };

  const loadArtists = async (params: Parameters<typeof getArtists1>[0]) => {
    const response = await getArtists1(params);
    return response.data;
  };

  const loadAlbums = async (params: Parameters<typeof getAlbums1>[0]) => {
    const response = await getAlbums1(params);
    return response.data;
  };

  const rejectArtist = async (artistId: string, reason: string) => {
    const body: RejectRequest = { reason };
    const response = await rejectArtistGenerated(artistId, body);
    return response.data;
  };

  const rejectAlbum = async (albumId: string, reason: string) => {
    const body: RejectRequest = { reason };
    const response = await rejectAlbumGenerated(albumId, body);
    return response.data;
  };

  const rejectTrack = async (trackId: string, reason: string) => {
    const body: RejectRequest = { reason };
    const response = await rejectTrackGenerated(trackId, body);
    return response.data;
  };

  return {
    loadTracks,
    loadArtists,
    loadAlbums,
    reanalyze,
    reclassify,
    unflag,
    rejectArtist,
    rejectAlbum,
    rejectTrack,
  };
}

