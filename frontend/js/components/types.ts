/**
 * Shared types for Vue components.
 * List/card views use the generated TrackListDto so API changes are caught by the type checker.
 */
import type { TrackListDto, Track, PlaybackLink } from '../api/models';
import type { Artist } from '../api/models';
import type { Album } from '../api/models';

/** Artist shape as used in track lists (may include id, name, role from API or DTO) */
export interface TrackArtistDisplay {
  id?: string;
  name?: string;
  role?: string;
}

/** Album shape as used in track cards */
export interface TrackAlbumDisplay {
  id?: string;
  title?: string;
}

/** Tempo/tempo category as shown in UI */
export interface TempoDisplay {
  label?: string;
}

/**
 * Track shape for list/card views. Based on the generated TrackListDto so that
 * renames or removal of API fields cause build failures. Extended with optional
 * fields present when a full Track is loaded (e.g. track by ID).
 */
export type TrackDisplay = TrackListDto & {
  /** Alias for durationMs used in some views */
  duration?: number;
  /** Present when full Track is loaded (e.g. getTrack by id) */
  artists?: TrackArtistDisplay[];
  albums?: TrackAlbumDisplay[];
  album?: TrackAlbumDisplay;
  tempo?: TempoDisplay;
  tempoCategory?: string;
  playbackLinks?: PlaybackLink[];
};

/** Props for components that display an artist (e.g. ArtistCard) */
export interface ArtistCardProps {
  artist: Artist & { totalTracks?: number; isVerified?: boolean };
}

/** Props for components that display an album (e.g. AlbumCard) */
export interface AlbumCardProps {
  album: Album & {
    totalTracks?: number;
    releaseDate?: string;
    artistName?: string;
    allArtists?: string[];
  };
}
