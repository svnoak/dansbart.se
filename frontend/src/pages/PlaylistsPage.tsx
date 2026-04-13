import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyPlaylists1, createPlaylist } from '@/api/generated/playlists/playlists';
import type { Playlist } from '@/api/models/playlist';
import { PlaylistIcon, PlusIcon } from '@/icons';
import { toast } from '@/ui';

export function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getMyPlaylists1({ signal: controller.signal })
      .then(setPlaylists)
      .catch(() => {
        if (controller.signal.aborted) return;
        setPlaylists([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createPlaylist({ name: newName.trim() });
      setPlaylists((prev) => [created, ...prev]);
      setNewName('');
      setShowForm(false);
      toast('Spellista skapad');
    } catch {
      toast('Kunde inte skapa spellista', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">Spellistor</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-accent))] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" aria-hidden />
          Ny spellista
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Namn på spellistan"
            autoFocus
            className="flex-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-4 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="rounded-lg bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Skapa
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setNewName('');
            }}
            className="rounded-lg border border-[rgb(var(--color-border))] px-4 py-2 text-sm text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50"
          >
            Avbryt
          </button>
        </form>
      )}

      {loading && <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>}

      {!loading && playlists.length === 0 && (
        <p className="text-[rgb(var(--color-text-muted))]">Du har inga spellistor ännu.</p>
      )}

      <ul className="space-y-2">
        {playlists.map((pl) => (
          <li key={pl.id}>
            <Link
              to={`/playlists/${pl.id}`}
              className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-4 py-3 hover:border-[rgb(var(--color-accent))]/50 hover:bg-[rgb(var(--color-accent-muted))]/20 transition-colors"
            >
              <PlaylistIcon className="h-5 w-5 shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">{pl.name}</p>
                {pl.description && (
                  <p className="truncate text-xs text-[rgb(var(--color-text-muted))]">{pl.description}</p>
                )}
              </div>
              {(pl.tracks?.length ?? 0) > 0 && (
                <span className="shrink-0 text-xs text-[rgb(var(--color-text-muted))]">
                  {pl.tracks!.length} {pl.tracks!.length === 1 ? 'låt' : 'låtar'}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
