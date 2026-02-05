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
} from '../../api/generated/admin-tracks/admin-tracks.js';
import {
  getDuplicates,
  mergeDuplicates,
  analyzeDuplicates,
} from '../../api/generated/admin-duplicates/admin-duplicates.js';
import {
  getArtists1,
  rejectArtist as rejectArtistGenerated,
  bulkRejectArtists as bulkRejectArtistsGenerated,
  approveArtist as approveArtistGenerated,
  bulkApproveArtists as bulkApproveArtistsGenerated,
  getCollaborationNetwork as getCollaborationNetworkGenerated,
} from '../../api/generated/admin-artists/admin-artists.js';
import {
  getPendingArtists,
  getPendingAlbums,
} from '../../api/generated/admin-pending/admin-pending.js';
import {
  getAlbums1,
  rejectAlbum as rejectAlbumGenerated,
} from '../../api/generated/admin-albums/admin-albums.js';
import {
  getRejections,
  removeFromBlocklist as removeFromBlocklistGenerated,
  addToBlocklist as addToBlocklistGenerated,
  rejectNetwork as rejectNetworkGenerated,
} from '../../api/generated/admin-rejections/admin-rejections.js';
import {
  getArtistAlbums as getArtistAlbumsGenerated,
  getAlbumTracks1 as getAlbumTracksGenerated,
  ingestAlbum as ingestAlbumGenerated,
  ingestTrack as ingestTrackGenerated,
} from '../../api/generated/admin-spotify/admin-spotify.js';

export function useLibraryApi() {
  // ===== TRACKS =====
  const loadTracks = async params => {
    const response = await getTracks1(params);
    return response.data;
  };

  const reanalyzeTrack = async trackId => {
    const response = await reanalyzeTrackGenerated(trackId);
    return response.data;
  };

  const reclassifyTrack = async trackId => {
    const response = await reclassifyTrackGenerated(trackId);
    return response.data;
  };

  const unflagTrack = async trackId => {
    const response = await unflagTrackGenerated(trackId);
    return response.data;
  };

  const rejectTrack = async (trackId, reason) => {
    const response = await rejectTrackGenerated(trackId, { reason });
    return response.data;
  };

  const deleteTrack = async trackId => {
    const response = await deleteTrackGenerated(trackId);
    return response.data;
  };

  const loadDuplicateTracks = async (limit = 50, offset = 0) => {
    const response = await getDuplicates({ limit, offset });
    return response.data;
  };

  const mergeDuplicatesByIsrc = async (isrc, dryRun = false) => {
    const response = await mergeDuplicates(isrc, { dryRun });
    return response.data;
  };

  const analyzeDuplicateIsrc = async isrc => {
    const response = await analyzeDuplicates(isrc);
    return response.data;
  };

  // ===== ARTISTS =====
  const loadArtists = async params => {
    const response = await getArtists1(params);
    return response.data;
  };

  const loadPendingArtists = async (limit = 50, offset = 0, search = '') => {
    const params = { limit, offset };
    if (search) params.search = search;
    const response = await getPendingArtists(params);
    return response.data;
  };

  const rejectArtist = async (artistId, reason, deleteContent = true) => {
    const response = await rejectArtistGenerated(artistId, {
      reason,
      deleteContent,
    });
    return response.data;
  };

  const bulkRejectArtists = async (ids, reason = 'Bulk rejection', deleteContent = true) => {
    const response = await bulkRejectArtistsGenerated({
      ids,
      reason,
      deleteContent,
    });
    return response.data;
  };

  const approveArtist = async artistId => {
    const response = await approveArtistGenerated(artistId);
    return response.data;
  };

  const bulkApproveArtists = async ids => {
    const response = await bulkApproveArtistsGenerated({ ids });
    return response.data;
  };

  const getCollaborationNetwork = async artistId => {
    const response = await getCollaborationNetworkGenerated(artistId);
    return response.data;
  };

  const rejectNetwork = async (artistIds, albumIds, reason) => {
    const response = await rejectNetworkGenerated({
      artistIds,
      albumIds,
      reason,
    });
    return response.data;
  };

  // ===== ALBUMS =====
  const loadAlbums = async params => {
    const response = await getAlbums1(params);
    return response.data;
  };

  const loadPendingAlbums = async (limit = 50, offset = 0) => {
    const response = await getPendingAlbums({ limit, offset });
    return response.data;
  };

  const rejectAlbum = async (albumId, reason) => {
    const response = await rejectAlbumGenerated(albumId, { reason });
    return response.data;
  };

  // ===== BLOCKLIST =====
  const loadBlocklist = async (filter = '', limit = 50, offset = 0) => {
    const params = { limit, offset };
    if (filter) params.entityType = filter;
    const response = await getRejections(params);
    return response.data;
  };

  const removeFromBlocklist = async rejectionId => {
    const response = await removeFromBlocklistGenerated(rejectionId);
    return response.data;
  };

  const addToBlocklist = async data => {
    const response = await addToBlocklistGenerated(data);
    return response.data;
  };

  // ===== SPOTIFY PREVIEW =====
  const getSpotifyArtistAlbums = async spotifyId => {
    const response = await getArtistAlbumsGenerated(spotifyId);
    return response.data;
  };

  const getSpotifyAlbumTracks = async spotifyId => {
    const response = await getAlbumTracksGenerated(spotifyId);
    return response.data;
  };

  // ===== SPOTIFY INGESTION =====
  const ingestSpotifyAlbum = async spotifyAlbumId => {
    const response = await ingestAlbumGenerated({ spotify_album_id: spotifyAlbumId });
    return response.data;
  };

  const ingestSpotifyTrack = async spotifyTrackId => {
    const response = await ingestTrackGenerated({ spotify_track_id: spotifyTrackId });
    return response.data;
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
