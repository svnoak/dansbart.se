import { Link } from 'react-router-dom';
import { Card, AvatarPlaceholder } from '@/ui';
import type { Artist } from '@/api/models/artist';

interface ArtistCardProps {
  artist: Artist;
  albumCount?: number;
  layout?: 'row' | 'tile';
}

function albumCountLabel(count: number) {
  return `${count} album`;
}

/**
 * An artist as a link. The tile (150 px wide, for rails) stacks a 56 px
 * avatar over the centred name; the row lays them side by side for lists.
 */
export function ArtistCard({ artist, albumCount, layout = 'row' }: ArtistCardProps) {
  const name = artist.name ?? 'Okänd artist';
  const focusRing =
    'block rounded-[var(--radius-lg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] focus-visible:ring-offset-2';

  if (layout === 'tile') {
    return (
      <Link to={`/artist/${artist.id ?? ''}`} className={`${focusRing} w-[150px] shrink-0`}>
        <Card className="flex h-full flex-col items-center gap-3 p-4 text-center transition-colors hover:bg-[rgb(var(--color-accent-muted))]">
          <AvatarPlaceholder size="lg" name={artist.name} />
          <div className="w-full min-w-0">
            <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-[rgb(var(--color-text))]">
              {name}
            </h3>
            {albumCount != null && (
              <p className="mt-0.5 text-[13px] text-[rgb(var(--color-text-muted))]">
                {albumCountLabel(albumCount)}
              </p>
            )}
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link to={`/artist/${artist.id ?? ''}`} className={focusRing}>
      <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-[rgb(var(--color-accent-muted))]">
        <AvatarPlaceholder size="lg" name={artist.name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-[rgb(var(--color-text))]">{name}</h3>
          {albumCount != null && (
            <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{albumCountLabel(albumCount)}</p>
          )}
        </div>
      </Card>
    </Link>
  );
}
