/**
 * Library API
 * Unified API for managing tracks, albums, artists, and blocklist
 * Uses generated API client from OpenAPI spec
 */

import {
  getTracks1,
  reanalyzeTrack as reanalyzeTrackGenerated,
  reclassifyTrack as reclassifyTrackGenerated,
  rejectTrack as rejectTrackGenerated,
  deleteTrack as deleteTrackGenerated,
  unflagTrack1 as unflagTrackGenerated,
} from '../../api/generated/admin-tracks/admin-tracks';
import {
  getDuplicates,
  mergeDuplicates,
  analyzeDuplicates,
} from '../../api/generated/admin-duplicates/admin-duplicates';
import {
  getArtists1,
  rejectArtist as rejectArtistGenerated,
  bulkRejectArtists as bulkRejectArtistsGenerated,
  approveArtist as approveArtistGenerated,
  bulkApproveArtists as bulkApproveArtistsGenerated,
  getCollaborationNetwork as getCollaborationNetworkGenerated,
} from '../../api/generated/admin-artists/admin-artists';
import {
  getPendingArtists,
  getPendingAlbums,
} from '../../api/generated/admin-pending/admin-pending';
import {
  getAlbums1,
  rejectAlbum as rejectAlbumGenerated,
} from '../../api/generated/admin-albums/admin-albums';
import {
  getRejections,
  removeFromBlocklist as removeFromBlocklistGenerated,
  addToBlocklist as addToBlocklistGenerated,
  rejectNetwork as rejectNetworkGenerated,
} from '../../api/generated/admin-rejections/admin-rejections';
import {
  getArtistAlbums as getArtistAlbumsGenerated,
  getAlbumTracks1 as getAlbumTracksGenerated,
  ingestAlbum as ingestAlbumGenerated,
  ingestTrack as ingestTrackGenerated,
} from '../../api/generated/admin-spotify/admin-spotify';

// Helper to support both generated client shape ({ data, status, headers })
// and plain JSON responses ({ items, total, message, ... }).
// This avoids runtime errors when response.data is undefined.
const unwrapResponse = (response: any) =>
  response && (response as any).data !== undefined ? (response as any).data : response;

export function useLibraryApi() {
  // ===== TRACKS =====
  const loadTracks = async (params: Parameters<typeof getTracks1>[0]) => {
    const response = await getTracks1(params);
    return unwrapResponse(response);
  };

  const reanalyzeTrack = async (trackId: string) => {
    const response = await reanalyzeTrackGenerated(trackId);
    return unwrapResponse(response);
  };

  const reclassifyTrack = async (trackId: string) => {
    const response = await reclassifyTrackGenerated(trackId);
    return unwrapResponse(response);
  };

  const unflagTrack = async (trackId: string) => {
    const response = await unflagTrackGenerated(trackId);
    return unwrapResponse(response);
  };

  const rejectTrack = async (trackId: string, reason: string) => {
    const response = await rejectTrackGenerated(trackId, { reason });
    return unwrapResponse(response);
  };

  const deleteTrack = async (trackId: string) => {
    const response = await deleteTrackGenerated(trackId);
    return unwrapResponse(response);
  };

  const loadDuplicateTracks = async (limit = 50, offset = 0) => {
    const response = await getDuplicates({ limit, offset });
    return unwrapResponse(response);
  };

  const mergeDuplicatesByIsrc = async (isrc: string, dryRun = false) => {
    const response = await mergeDuplicates(isrc, { dryRun });
    return unwrapResponse(response);
  };

  const analyzeDuplicateIsrc = async (isrc: string) => {
    const response = await analyzeDuplicates(isrc);
    return unwrapResponse(response);
  };

  // ===== ARTISTS =====
  const loadArtists = async (params: Parameters<typeof getArtists1>[0]) => {
    const response = await getArtists1(params);
    return unwrapResponse(response);
  };

  const loadPendingArtists = async (limit = 50, offset = 0, search = '') => {
    const params: Record<string, unknown> = { limit, offset };
    if (search) params.search = search;
    const response = await getPendingArtists(params);
    return unwrapResponse(response);
  };

  const rejectArtist = async (artistId: string, reason: string, deleteContent = true) => {
    const response = await rejectArtistGenerated(artistId, {
      reason,
      deleteContent,
    });
    return unwrapResponse(response);
  };

  const bulkRejectArtists = async (
    ids: string[],
    reason = 'Bulk rejection',
    deleteContent = true,
  ) => {
    const response = await bulkRejectArtistsGenerated({
      ids,
      reason,
      deleteContent,
    });
    return unwrapResponse(response);
  };

  const approveArtist = async (artistId: string) => {
    const response = await approveArtistGenerated(artistId);
    return unwrapResponse(response);
  };

  const bulkApproveArtists = async (ids: string[]) => {
    const response = await bulkApproveArtistsGenerated({ ids });
    return unwrapResponse(response);
  };

  const getCollaborationNetwork = async (artistId: string) => {
    const response = await getCollaborationNetworkGenerated(artistId);
    return unwrapResponse(response);
  };

  const rejectNetwork = async (artistIds: string[], albumIds: string[], reason: string) => {
    const response = await rejectNetworkGenerated({
      artistIds,
      albumIds,
      reason,
    });
    return unwrapResponse(response);
  };

  // ===== ALBUMS =====
  const loadAlbums = async (params: Parameters<typeof getAlbums1>[0]) => {
    const response = await getAlbums1(params);
    return unwrapResponse(response);
  };

  const loadPendingAlbums = async (limit = 50, offset = 0) => {
    const response = await getPendingAlbums({ limit, offset });
    return unwrapResponse(response);
  };

  const rejectAlbum = async (albumId: string, reason: string) => {
    const response = await rejectAlbumGenerated(albumId, { reason });
    return unwrapResponse(response);
  };

  // ===== BLOCKLIST =====
  const loadBlocklist = async (filter = '', limit = 50, offset = 0) => {
    const params: Record<string, unknown> = { limit, offset };
    if (filter) params.entityType = filter;
    const response = await getRejections(params);
    return unwrapResponse(response);
  };

  const removeFromBlocklist = async (rejectionId: string) => {
    const response = await removeFromBlocklistGenerated(rejectionId);
    return unwrapResponse(response);
  };

  const addToBlocklist = async (data: unknown) => {
    const response = await addToBlocklistGenerated(data as any);
    return unwrapResponse(response);
  };

  // ===== SPOTIFY PREVIEW =====
  const getSpotifyArtistAlbums = async (spotifyId: string) => {
    const response = await getArtistAlbumsGenerated(spotifyId);
    return unwrapResponse(response);
  };

  const getSpotifyAlbumTracks = async (spotifyId: string) => {
    const response = await getAlbumTracksGenerated(spotifyId);
    return unwrapResponse(response);
  };

  // ===== SPOTIFY INGESTION =====
  const ingestSpotifyAlbum = async (spotifyAlbumId: string) => {
    const response = await ingestAlbumGenerated({ spotify_album_id: spotifyAlbumId });
    return unwrapResponse(response);
  };

  const ingestSpotifyTrack = async (spotifyTrackId: string) => {
    const response = await ingestTrackGenerated({ spotify_track_id: spotifyTrackId });
    return unwrapResponse(response);
  };

  return {
    // Tracks
    loadTracks,
    loadDuplicateTracks,
    reanalyzeTrack,
    reclassifyTrack,
    unflagTrack,
    rejectTrack,
    deleteTrack,
    mergeDuplicatesByIsrc,
    analyzeDuplicateIsrc,
    // Artists
    loadArtists,
    loadPendingArtists,
    rejectArtist,
    bulkRejectArtists,
    approveArtist,
    bulkApproveArtists,
    getCollaborationNetwork,
    rejectNetwork,
    // Albums
    loadAlbums,
    loadPendingAlbums,
    rejectAlbum,
    // Blocklist
    loadBlocklist,
    removeFromBlocklist,
    addToBlocklist,
    // Spotify Preview
    getSpotifyArtistAlbums,
    getSpotifyAlbumTracks,
    // Spotify Ingestion
    ingestSpotifyAlbum,
    ingestSpotifyTrack,
  };
}

