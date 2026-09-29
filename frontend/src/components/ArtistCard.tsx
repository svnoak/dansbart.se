import { Link } from 'react-router-dom';
import { Card, AvatarPlaceholder } from '@/ui';
import type { Artist } from '@/api/models/artist';

interface ArtistCardProps {
  artist: Artist;
  albumCount?: number;
  layout?: 'row' | 'tile';
}

export function ArtistCard({ artist, albumCount, layout = 'row' }: ArtistCardProps) {
  if (layout === 'tile') {
    return (
      <Link to={`/artist/${artist.id ?? ''}`}>
        <Card className="flex h-full flex-col items-center gap-2 p-3 text-center transition-colors hover:bg-[rgb(var(--color-border))]/20">
          <AvatarPlaceholder size="lg" />
          <div className="min-w-0">
            <h3 className="font-medium text-[rgb(var(--color-text))] truncate">
              {artist.name ?? 'Okänd artist'}
            </h3>
            {albumCount != null && (
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                {albumCount} {albumCount === 1 ? 'album' : 'album'}
              </p>
            )}
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link to={`/artist/${artist.id ?? ''}`}>
      <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-[rgb(var(--color-border))]/20">
        <AvatarPlaceholder size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-[rgb(var(--color-text))] truncate">
            {artist.name ?? 'Okänd artist'}
          </h3>
          {albumCount != null && (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              {albumCount} {albumCount === 1 ? 'album' : 'album'}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
