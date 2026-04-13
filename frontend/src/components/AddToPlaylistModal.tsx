import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getMyPlaylists1, addTrack, createPlaylist } from '@/api/generated/playlists/playlists';
import type { Playlist } from '@/api/models/playlist';
import type { TrackListDto } from '@/api/models/trackListDto';
import { CloseIcon, PlaylistIcon, PlusIcon } from '@/icons';
import { toast } from '@/ui';

interface AddToPlaylistModalProps {
  open: boolean;
  onClose: () => void;
  track: TrackListDto;
}

export function AddToPlaylistModal({ open, onClose, track }: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setShowNewForm(false);
    setNewName('');
    getMyPlaylists1()
      .then(setPlaylists)
      .catch(() => setPlaylists([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleAdd(playlistId: string) {
    if (!track.id) return;
    setAdding(playlistId);
    try {
      await addTrack(playlistId, { trackId: track.id });
      toast('Låt tillagd i spellista');
      onClose();
    } catch {
      toast('Kunde inte lägga till låt', 'error');
    } finally {
      setAdding(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !track.id) return;
    setCreating(true);
    try {
      const created = await createPlaylist({ name: newName.trim() });
      if (created.id) {
        await addTrack(created.id, { trackId: track.id });
      }
      toast('Spellista skapad och låt tillagd');
      onClose();
    } catch {
      toast('Kunde inte skapa spellista', 'error');
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))]"
        >
          <CloseIcon className="h-5 w-5" aria-hidden />
        </button>

        <h3 className="mb-5 flex items-center gap-2 border-b border-[rgb(var(--color-border))] pb-3 pr-8 text-lg font-bold text-[rgb(var(--color-text))]">
          <PlaylistIcon className="h-5 w-5 text-[rgb(var(--color-accent))]" aria-hidden />
          Lägg till i spellista
        </h3>

        {loading && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">Laddar...</p>
        )}

        {!loading && (
          <>
            <ul className="mb-4 max-h-64 space-y-1 overflow-y-auto">
              {playlists.map((pl) => (
                <li key={pl.id}>
                  <button
                    type="button"
                    onClick={() => pl.id && handleAdd(pl.id)}
                    disabled={adding === pl.id}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-[rgb(var(--color-border))]/50 disabled:opacity-50"
                  >
                    <PlaylistIcon
                      className="h-4 w-4 shrink-0 text-[rgb(var(--color-text-muted))]"
                      aria-hidden
                    />
                    <span className="flex-1 truncate font-medium text-[rgb(var(--color-text))]">
                      {pl.name}
                    </span>
                  </button>
                </li>
              ))}
              {playlists.length === 0 && (
                <li>
                  <p className="px-3 py-2 text-sm text-[rgb(var(--color-text-muted))]">
                    Inga spellistor ännu.
                  </p>
                </li>
              )}
            </ul>

            {!showNewForm && (
              <button
                type="button"
                onClick={() => setShowNewForm(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[rgb(var(--color-border))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-muted))] hover:border-[rgb(var(--color-accent))]/50 hover:text-[rgb(var(--color-accent))] transition-colors"
              >
                <PlusIcon className="h-4 w-4" aria-hidden />
                Ny spellista
              </button>
            )}

            {showNewForm && (
              <form onSubmit={handleCreate} className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Namn på spellistan"
                  autoFocus
                  className="flex-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="rounded-lg bg-[rgb(var(--color-accent))] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Skapa
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
