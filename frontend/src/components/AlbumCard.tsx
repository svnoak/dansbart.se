import { Link } from 'react-router-dom';
import { Card } from '@/ui';
import { AlbumIcon } from '@/icons';
import type { Album } from '@/api/models/album';

interface AlbumCardProps {
  album: Album;
  trackCount?: number;
}

export function AlbumCard({ album, trackCount }: AlbumCardProps) {
  const year = album.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : null;
  const meta = [
    year ?? 'Album',
    trackCount != null ? (trackCount === 1 ? '1 låt' : `${trackCount} låtar`) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      to={`/album/${album.id ?? ''}`}
      className="block rounded-[var(--radius-lg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] focus-visible:ring-offset-2"
    >
      <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-[rgb(var(--color-accent-muted))]">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]"
          aria-hidden
        >
          <AlbumIcon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-[rgb(var(--color-text))]">
            {album.title ?? 'Okänt album'}
          </h3>
          {album.artistName && (
            <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">
              {album.artistName}
            </p>
          )}
          <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">{meta}</p>
        </div>
      </Card>
    </Link>
  );
}
