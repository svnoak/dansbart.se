import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlaylist, removeTrack } from '@/api/generated/playlists/playlists';
import type { PlaylistDto } from '@/api/models/playlistDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import { TrackRow } from '@/components/TrackRow';
import { BackArrowIcon } from '@/icons';
import { IconButton, toast } from '@/ui';

export function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<PlaylistDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getPlaylist(id, { signal: controller.signal })
      .then(setPlaylist)
      .catch(() => {
        if (controller.signal.aborted) return;
        setPlaylist(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  async function handleRemoveTrack(playlistTrackId: string) {
    if (!id) return;
    try {
      await removeTrack(id, playlistTrackId);
      setPlaylist((prev) =>
        prev
          ? { ...prev, tracks: prev.tracks?.filter((t) => t.id !== playlistTrackId) }
          : prev,
      );
      toast('Låt borttagen från spellista');
    } catch {
      toast('Kunde inte ta bort låt', 'error');
    }
  }

  if (loading) {
    return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  }

  if (!playlist) {
    return <p className="text-[rgb(var(--color-text-muted))]">Spellistan hittades inte.</p>;
  }

  const tracks = playlist.tracks ?? [];
  const contextTracks: TrackListDto[] = tracks.map((t) => t.track!).filter(Boolean);

  return (
    <div className="space-y-6">
      <IconButton aria-label="Tillbaka" onClick={() => navigate('/playlists')}>
        <BackArrowIcon className="h-5 w-5" aria-hidden />
      </IconButton>

      <div>
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">{playlist.name}</h1>
        {playlist.description && (
          <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">{playlist.description}</p>
        )}
        <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">
          {tracks.length} {tracks.length === 1 ? 'låt' : 'låtar'}
        </p>
      </div>

      {tracks.length === 0 && (
        <p className="text-[rgb(var(--color-text-muted))]">Spellistan är tom.</p>
      )}

      <ul>
        {tracks.map((pt) =>
          pt.track ? (
            <li key={pt.id ?? pt.track.id} className="group relative">
              <TrackRow track={pt.track} contextTracks={contextTracks} />
              {pt.id && (
                <button
                  type="button"
                  onClick={() => handleRemoveTrack(pt.id!)}
                  className="absolute right-10 top-1/2 -translate-y-1/2 hidden rounded px-2 py-1 text-xs text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))] group-hover:block"
                  aria-label="Ta bort från spellista"
                >
                  Ta bort
                </button>
              )}
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}
