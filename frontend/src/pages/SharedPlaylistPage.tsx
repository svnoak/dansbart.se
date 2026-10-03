import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getPlaylistByShareToken } from '@/api/generated/playlists/playlists';
import type { PlaylistDto } from '@/api/models/playlistDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import { TrackRow } from '@/components/TrackRow';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/auth/useAuth';
import { Badge, EmptyState, LinkButton, PageHeader } from '@/ui';

const TEMPO_LABELS: Record<string, string> = {
  Slow: 'Långsamt',
  SlowMed: 'Lugnt',
  Medium: 'Lagom',
  Fast: 'Snabbt',
  Turbo: 'Väldigt snabbt',
};

export function SharedPlaylistPage() {
  const { token } = useParams<{ token: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [playlist, setPlaylist] = useState<PlaylistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getPlaylistByShareToken(token, { signal: controller.signal })
      .then(setPlaylist)
      .catch(() => {
        if (controller.signal.aborted) return;
        setNotFound(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [token]);

  if (loading) return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;

  if (!notFound && playlist && user?.id) {
    const isOwner = playlist.owner?.id === user.id;
    const isCollaborator = playlist.collaborators?.some(
      (c) => c.userId === user.id && c.status === 'accepted',
    );
    if (isOwner || isCollaborator) {
      return <Navigate to={`/playlists/${playlist.id}`} replace />;
    }
  }

  if (notFound || !playlist) {
    return (
      <EmptyState action={<LinkButton to="/">Gå till startsidan</LinkButton>}>
        Den här länken är inte längre giltig.
      </EmptyState>
    );
  }

  const orderedTracks = [...(playlist.tracks ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const contextTracks: TrackListDto[] = orderedTracks
    .map((pt) => pt.track!)
    .filter(Boolean);

  const styleColor = playlist.danceStyle ? getStyleColor(playlist.danceStyle) : null;
  const tLabel = playlist.tempoCategory ? (TEMPO_LABELS[playlist.tempoCategory] ?? '') : '';

  return (
    <div className="space-y-6">
      <PageHeader
        title={playlist.name}
        meta={`${contextTracks.length} ${contextTracks.length === 1 ? 'låt' : 'låtar'}`}
        description={playlist.description}
      />

      {/* Owner */}
      {playlist.ownerGroup ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">
          Av gruppen {playlist.ownerGroup.name}
        </p>
      ) : (
        playlist.owner && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Av {playlist.owner.displayName ?? playlist.owner.username}
          </p>
        )
      )}

      {/* Tags */}
      {(styleColor || tLabel) && (
        <div className="flex flex-wrap gap-1.5">
          {styleColor && playlist.danceStyle && (
            <Badge
              size="md"
              style={{
                backgroundColor: theme === 'dark' ? styleColor.bgDark : styleColor.bg,
                color: theme === 'dark' ? styleColor.textDark : styleColor.text,
              }}
            >
              {playlist.danceStyle.charAt(0).toUpperCase() + playlist.danceStyle.slice(1)}
            </Badge>
          )}
          {styleColor && playlist.subStyle && (
            <Badge
              size="md"
              className="opacity-80"
              style={{
                backgroundColor: theme === 'dark' ? styleColor.bgDark : styleColor.bg,
                color: theme === 'dark' ? styleColor.textDark : styleColor.text,
              }}
            >
              {playlist.subStyle.charAt(0).toUpperCase() + playlist.subStyle.slice(1)}
            </Badge>
          )}
          {tLabel && (
            <Badge size="md" variant="muted">
              {tLabel}
            </Badge>
          )}
        </div>
      )}

      {/* Login CTA */}
      {!user && (
        <EmptyState action={<LinkButton to="/login">Logga in</LinkButton>}>
          Logga in för att spara den här spellistan till ditt konto.
        </EmptyState>
      )}

      {/* Track list */}
      {contextTracks.length === 0 ? (
        <p className="text-[rgb(var(--color-text-muted))]">Spellistan är tom.</p>
      ) : (
        <ul>
          {contextTracks.map((track) => (
            <TrackRow key={track.id} track={track} contextTracks={contextTracks} />
          ))}
        </ul>
      )}
    </div>
  );
}
