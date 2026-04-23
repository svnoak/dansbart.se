import type { PlaybackLinkDto } from '@/api/models/playbackLinkDto';

export function deepLinkToEmbedUrl(link: PlaybackLinkDto): string | null {
  const raw = (link.deepLink ?? '').trim();
  if (!raw) return null;
  const platform = link.platform?.toLowerCase();

  if (platform === 'spotify') {
    const spotifyUri = raw.match(/^spotify:(track|album|playlist|artist):([a-zA-Z0-9]+)$/);
    if (spotifyUri) return `https://open.spotify.com/embed/${spotifyUri[1]}/${spotifyUri[2]}?autoplay=0`;
    if (/^[a-zA-Z0-9]{22}$/.test(raw)) return `https://open.spotify.com/embed/track/${raw}?autoplay=0`;
  }

  try {
    const u = new URL(raw);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const v = u.searchParams.get('v') ?? u.pathname.split('/').pop();
      if (!v) return null;
      return `https://www.youtube.com/embed/${v}?autoplay=0&enablejsapi=1`;
    }
    if (u.hostname.includes('spotify.com')) {
      return `https://open.spotify.com/embed/${u.pathname.replace(/^\//, '')}?autoplay=0`;
    }
  } catch {
    // not a URL
  }

  if (platform === 'youtube' || !platform) {
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
      return `https://www.youtube.com/embed/${raw}?autoplay=0&enablejsapi=1`;
    }
  }
  return null;
}
