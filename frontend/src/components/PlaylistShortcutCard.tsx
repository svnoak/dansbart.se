import { Link } from 'react-router-dom';
import { Card } from '@/ui';
import { PlaylistIcon } from '@/icons';
import type { PlaylistSummaryDto } from '@/api/models/playlistSummaryDto';

interface PlaylistShortcutCardProps {
  playlist: PlaylistSummaryDto;
}

export function PlaylistShortcutCard({ playlist }: PlaylistShortcutCardProps) {
  const trackCount = playlist.trackCount ?? 0;

  return (
    <Link to={`/playlists/${playlist.id}`}>
      <Card className="flex h-full flex-col justify-end gap-2 p-3 transition-colors hover:bg-[rgb(var(--color-border))]/20">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]"
          aria-hidden
        >
          <PlaylistIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-medium text-[rgb(var(--color-text))] truncate">
            {playlist.name ?? 'Okänd spellista'}
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            {trackCount === 1 ? '1 låt' : `${trackCount} låtar`}
          </p>
        </div>
      </Card>
    </Link>
  );
}