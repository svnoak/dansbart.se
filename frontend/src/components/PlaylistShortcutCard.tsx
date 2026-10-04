import { Link } from 'react-router-dom';
import { Card } from '@/ui';
import { StarMarkIcon } from '@/icons';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';
import type { PlaylistSummaryDto } from '@/api/models/playlistSummaryDto';

interface PlaylistShortcutCardProps {
  /** A summary; the main style, when the DTO carries one, colours the tile. */
  playlist: PlaylistSummaryDto & { danceStyle?: string };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** A shortcut on the home page rail: style tile, name and a one-line summary. */
export function PlaylistShortcutCard({ playlist }: PlaylistShortcutCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const trackCount = playlist.trackCount ?? 0;
  const color = playlist.danceStyle ? getStyleColor(playlist.danceStyle) : null;
  const tileStyle: React.CSSProperties | undefined = color
    ? {
        backgroundColor: isDark ? color.bgDark : color.bg,
        color: isDark ? color.textDark : color.text,
      }
    : undefined;
  const summary = `${trackCount === 1 ? '1 låt' : `${trackCount} låtar`} · ${
    playlist.danceStyle ? capitalize(playlist.danceStyle) : 'Blandat'
  }`;

  return (
    <Link
      to={`/playlists/${playlist.id}`}
      className="block w-full rounded-[var(--radius-lg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
    >
      <Card className="flex h-full w-full flex-col gap-3 p-4 transition-colors hover:bg-[rgb(var(--color-accent-muted))]">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] ${
            color ? '' : 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text-muted))]'
          }`}
          style={tileStyle}
          aria-hidden
        >
          <StarMarkIcon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold text-[rgb(var(--color-text))]">
            {playlist.name ?? 'Okänd spellista'}
          </h3>
          <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">{summary}</p>
        </div>
      </Card>
    </Link>
  );
}
