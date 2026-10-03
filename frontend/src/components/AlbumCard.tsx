import { ListRow } from '@/ui';
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
    <ListRow
      to={`/album/${album.id ?? ''}`}
      title={album.title ?? 'Okänt album'}
      subtitle={album.artistName}
      icon={<MusicNoteIcon className="h-5 w-5" aria-hidden />}
      trailing={
        <span>
          {year ?? 'Album'}
          {trackCount != null && ` \u00b7 ${trackCount} ${trackCount === 1 ? 'låt' : 'låtar'}`}
        </span>
      }
    />
  );
}
