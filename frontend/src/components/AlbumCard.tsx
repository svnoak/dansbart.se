import { Link } from 'react-router-dom';
import { Card, ArtworkPlaceholder } from '@/ui';
import type { Album } from '@/api/models/album';

interface AlbumCardProps {
  album: Album;
  trackCount?: number;
}

export function AlbumCard({ album, trackCount }: AlbumCardProps) {
  return (
    <Link to={`/album/${album.id ?? ''}`} className="block">
      <Card className="overflow-hidden transition-colors hover:bg-[rgb(var(--color-border))]/20">
        <ArtworkPlaceholder aspect="square" className="w-full" />
        <div className="p-3">
          <h3 className="font-medium text-[rgb(var(--color-text))] truncate">
            {album.title ?? 'Okänt album'}
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
            {album.releaseDate ? new Date(album.releaseDate).getFullYear() : 'Album'}
          </p>
          {trackCount != null && (
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
              {trackCount} {trackCount === 1 ? 'lat' : 'latar'}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
