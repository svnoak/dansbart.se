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
} from '../../api/generated/admin-tracks/admin-tracks.js';
import { getArtists1, rejectArtist as rejectArtistGenerated } from '../../api/generated/admin-artists/admin-artists.js';
import { getAlbums1, rejectAlbum as rejectAlbumGenerated } from '../../api/generated/admin-albums/admin-albums.js';
import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useTracksApi(token) {
  // Keep fetchWithAuth for endpoints that need admin auth but are tagged as public
  const { fetchWithAuth } = useAdminApi(token);

  const loadTracks = async params => {
    const response = await getTracks1(params);
    return response.data;
  };

  const reanalyze = async trackId => {
    const response = await reanalyzeTrack(trackId);
    return response.data;
  };

  const reclassify = async trackId => {
    const response = await reclassifyTrack(trackId);
    return response.data;
  };

  // unflagTrack is tagged as public in the spec but requires admin auth
  // Keep manual implementation until backend tags it correctly
  const unflag = async trackId => {
    const res = await fetchWithAuth(`/api/tracks/${trackId}/flag`, {
      method: 'DELETE',
    });
    return res.json();
  };

  const loadArtists = async params => {
    const response = await getArtists1(params);
    return response.data;
  };

  const loadAlbums = async params => {
    const response = await getAlbums1(params);
    return response.data;
  };

  const rejectArtist = async (artistId, reason) => {
    const response = await rejectArtistGenerated(artistId, { reason });
    return response.data;
  };

  const rejectAlbum = async (albumId, reason) => {
    const response = await rejectAlbumGenerated(albumId, { reason });
    return response.data;
  };

  const rejectTrack = async (trackId, reason) => {
    const response = await rejectTrackGenerated(trackId, { reason });
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
