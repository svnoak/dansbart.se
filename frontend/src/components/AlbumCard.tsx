import { Link } from 'react-router-dom';
import { Card } from '@/ui';
import { MusicNoteIcon } from '@/icons';
import type { Album } from '@/api/models/album';

interface AlbumCardProps {
  album: Album;
  trackCount?: number;
}

export function AlbumCard({ album, trackCount }: AlbumCardProps) {
  const year = album.releaseDate
    ? new Date(album.releaseDate).getFullYear()
    : null;

  return (
    <Link to={`/album/${album.id ?? ''}`}>
      <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-[rgb(var(--color-border))]/20">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--color-border))]/60 text-[rgb(var(--color-text-muted))]"
          aria-hidden
        >
          <MusicNoteIcon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-[rgb(var(--color-text))] truncate">
            {album.title ?? 'Okänt album'}
          </h3>
          {album.artistName && (
            <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
              {album.artistName}
            </p>
          )}
          <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
            {year ?? 'Album'}
            {trackCount != null && ` \u00b7 ${trackCount} ${trackCount === 1 ? 'lat' : 'latar'}`}
          </p>
        </div>
      </Card>
    </Link>
  );
}
