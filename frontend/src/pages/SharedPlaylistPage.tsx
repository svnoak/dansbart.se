import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { getPlaylistByShareToken } from '@/api/generated/playlists/playlists';
import type { PlaylistDto } from '@/api/models/playlistDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import { TrackRow } from '@/components/TrackRow';
import { StylePill } from '@/components/TrackRow/StylePill';
import { PlaylistIcon, StarMarkIcon } from '@/icons';
import { Card, EmptyState, RowSkeleton } from '@/ui';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/auth/useAuth';

const TEMPO_LABELS: Record<string, string> = {
  Slow: 'Långsamt',
  SlowMed: 'Lugnt',
  Medium: 'Lagom',
  Fast: 'Snabbt',
  Turbo: 'Väldigt snabbt',
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "1 h 32 min" or "32 min"; empty when there is nothing to sum. */
function formatTotalDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes <= 0) return '';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

const primaryLinkClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] transition-colors hover:bg-[rgb(var(--color-accent-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';

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

  if (loading) return <RowSkeleton rows={5} label="Laddar spellistan" />;

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
      <EmptyState
        icon={<PlaylistIcon className="h-7 w-7" aria-hidden />}
        title="Länken är inte längre giltig"
        description="Den som delade spellistan kan ha tagit bort länken."
        action={
          <Link to="/" className={primaryLinkClass}>
            Gå till startsidan
          </Link>
        }
      />
    );
  }

  const orderedTracks = [...(playlist.tracks ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const contextTracks: TrackListDto[] = orderedTracks
    .map((pt) => pt.track!)
    .filter(Boolean);

  const isDark = theme === 'dark';
  const styleColor = playlist.danceStyle ? getStyleColor(playlist.danceStyle) : null;
  const tileStyle: React.CSSProperties | undefined = styleColor
    ? {
        backgroundColor: isDark ? styleColor.bgDark : styleColor.bg,
        color: isDark ? styleColor.textDark : styleColor.text,
      }
    : undefined;
  const tLabel = playlist.tempoCategory ? (TEMPO_LABELS[playlist.tempoCategory] ?? '') : '';
  const totalDuration = formatTotalDuration(
    contextTracks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0),
  );

  const metaParts: string[] = [];
  if (playlist.ownerGroup) metaParts.push(`Av gruppen ${playlist.ownerGroup.name}`);
  else if (playlist.owner) metaParts.push(`Av ${playlist.owner.displayName ?? playlist.owner.username}`);
  metaParts.push(`${contextTracks.length} ${contextTracks.length === 1 ? 'låt' : 'låtar'}`);
  if (totalDuration) metaParts.push(totalDuration);

  const chipClass =
    'inline-flex h-7 items-center rounded-[var(--radius-full)] bg-[rgb(var(--color-accent-muted))] px-2.5 text-[13px] font-semibold whitespace-nowrap text-[rgb(var(--color-text))]';

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="flex flex-col gap-6 p-7 sm:flex-row">
        <div
          className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-[var(--radius-lg)] ${
            styleColor ? '' : 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text-muted))]'
          }`}
          style={tileStyle}
          aria-hidden
        >
          <StarMarkIcon className="h-[60px] w-[60px]" aria-hidden />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <h1 className="break-words text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
              {playlist.name}
            </h1>

            {playlist.description && (
              <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text))]">{playlist.description}</p>
            )}

            <p className="text-[15px] text-[rgb(var(--color-text-muted))]">{metaParts.join(' · ')}</p>
          </div>

          {/* Tags */}
          {(playlist.danceStyle || tLabel) && (
            <div className="flex flex-wrap items-center gap-2">
              {playlist.danceStyle && (
                <StylePill style={capitalize(playlist.danceStyle)} state="confirmed" />
              )}
              {playlist.danceStyle && playlist.subStyle && (
                <span className={chipClass} style={tileStyle}>
                  {capitalize(playlist.subStyle)}
                </span>
              )}
              {tLabel && <span className={chipClass}>{tLabel}</span>}
            </div>
          )}

          {/* Login CTA */}
          {!user && (
            <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
              <Link to="/login" className="font-medium text-[rgb(var(--color-link))] hover:underline">
                Logga in
              </Link>{' '}
              för att spara den här spellistan till ditt konto.
            </p>
          )}
        </div>
      </Card>

      {/* Track list */}
      {contextTracks.length === 0 ? (
        <EmptyState
          icon={<PlaylistIcon className="h-7 w-7" aria-hidden />}
          title="Spellistan är tom"
          description="Den som äger spellistan har inte lagt till några låtar ännu."
        />
      ) : (
        <ol className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
          {contextTracks.map((track, i) => (
            <li key={track.id} className="flex items-center">
              <span
                className="w-10 shrink-0 text-center text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]"
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <TrackRow track={track} contextTracks={contextTracks} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
