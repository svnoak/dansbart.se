import type { TrackListDto } from '@/api/models/trackListDto';
import type { PlaybackLinkDto } from '@/api/models/playbackLinkDto';

export function getEmbedUrl(track: TrackListDto | null): string | null {
  if (!track) return null;
  const links = track.playbackLinks;
  if (!links?.length) return null;

  // Prefer YouTube when multiple exist; match platform case-insensitively (API may return "youtube" / "spotify")
  const yt = links.find((l) => l.platform?.toUpperCase() === 'YOUTUBE');
  const sp = links.find((l) => l.platform?.toUpperCase() === 'SPOTIFY');
  const link = yt ?? sp ?? links[0];

  return deepLinkToEmbedUrl(link);
}

export type PlaybackSource = 'youtube' | 'spotify';

export function hasYouTube(track: TrackListDto | null): boolean {
  return !!track?.playbackLinks?.some((l) => l.platform?.toUpperCase() === 'YOUTUBE');
}

export function hasSpotify(track: TrackListDto | null): boolean {
  return !!track?.playbackLinks?.some((l) => l.platform?.toUpperCase() === 'SPOTIFY');
}

/** Embed URL for a specific source; null if that source is not available for the track. */
export function getEmbedUrlForSource(
  track: TrackListDto | null,
  source: PlaybackSource
): string | null {
  if (!track?.playbackLinks?.length) return null;
  const link =
    source === 'youtube'
      ? track.playbackLinks.find((l) => l.platform?.toUpperCase() === 'YOUTUBE')
      : track.playbackLinks.find((l) => l.platform?.toUpperCase() === 'SPOTIFY');
  return link ? deepLinkToEmbedUrl(link) : null;
}

/** YouTube video ID for the track's YouTube link, or null if none. Used by YouTube IFrame API. */
export function getYouTubeVideoId(track: TrackListDto | null): string | null {
  if (!track?.playbackLinks?.length) return null;
  const yt = track.playbackLinks.find((l) => l.platform?.toUpperCase() === 'YOUTUBE');
  if (!yt?.deepLink?.trim()) return null;
  const raw = yt.deepLink.trim();
  try {
    const u = new URL(raw);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const v = u.searchParams.get('v') ?? u.pathname.split('/').pop();
      return v && /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null;
    }
  } catch {
    // not a URL
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(raw) ? raw : null;
}

function deepLinkToEmbedUrl(link: PlaybackLinkDto): string | null {
  const raw = (link.deepLink ?? '').trim();
  if (!raw) return null;

  const platform = link.platform?.toLowerCase();

  // ----- Spotify handling -----
  if (platform === 'spotify') {
    // spotify:track:0eGsygTp906u18L0Oimnem (URI form)
    const spotifyUri = raw.match(/^spotify:(track|album|playlist|artist):([a-zA-Z0-9]+)$/);
    if (spotifyUri) {
      const base = `https://open.spotify.com/embed/${spotifyUri[1]}/${spotifyUri[2]}`;
      return `${base}?autoplay=1`;
    }

    // Bare Spotify track ID from backend (22-char base62), e.g. "09CnbDVZ5Z84pt1Sit8wUo"
    if (/^[a-zA-Z0-9]{22}$/.test(raw)) {
      const base = `https://open.spotify.com/embed/track/${raw}`;
      return `${base}?autoplay=1`;
    }
  }

  // ----- Try parsing as full URL -----
  try {
    const u = new URL(raw);

    // YouTube URL
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const v = u.searchParams.get('v') ?? u.pathname.split('/').pop();
      if (!v) return null;
      const base = `https://www.youtube.com/embed/${v}`;
      return `${base}?autoplay=1&enablejsapi=1`;
    }

    // Spotify HTTPS URL
    if (u.hostname.includes('spotify.com')) {
      const path = u.pathname.replace(/^\//, '');
      const base = `https://open.spotify.com/embed/${path}`;
      return `${base}?autoplay=1`;
    }
  } catch {
    // not a valid absolute URL - fall through to ID-based heuristics
  }

  // ----- YouTube bare video ID (11 chars) -----
  if (platform === 'youtube' || !platform) {
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
      const base = `https://www.youtube.com/embed/${raw}`;
      return `${base}?autoplay=1&enablejsapi=1`;
    }
  }

  return null;
}
