import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getEditablePlaylists, addTrack, createPlaylist } from '@/api/generated/playlists/playlists';
import type { EditablePlaylistDto } from '@/api/models/editablePlaylistDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import { CloseIcon, PlaylistIcon, PlusIcon } from '@/icons';
import { Button, InlineError, fieldClassName, toast } from '@/ui';

interface AddToPlaylistModalProps {
  open: boolean;
  onClose: () => void;
  track: TrackListDto;
}

export function AddToPlaylistModal({ open, onClose, track }: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<EditablePlaylistDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setShowNewForm(false);
    setNewName('');
    setAddError(null);
    setCreateError(null);
    getEditablePlaylists()
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
    setAddError(null);
    try {
      await addTrack(playlistId, { trackId: track.id });
      toast('Låt tillagd i spellista');
      onClose();
    } catch {
      setAddError('Kunde inte lägga till låt');
    } finally {
      setAdding(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !track.id) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createPlaylist({ name: newName.trim() });
      if (created.id) {
        await addTrack(created.id, { trackId: track.id });
      }
      toast('Spellista skapad och låt tillagd');
      onClose();
    } catch {
      setCreateError('Kunde inte skapa spellista');
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
      <div className="absolute inset-0 bg-[rgb(var(--color-text))]/55" />
      <div className="relative w-full max-w-sm rounded-[var(--radius-lg)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-[var(--color-card-shadow)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-[var(--radius)] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-text))]/6 hover:text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
        >
          <CloseIcon className="h-5 w-5" aria-hidden />
        </button>

        <h2 className="mb-5 flex items-center gap-2 border-b border-[rgb(var(--color-border))] pb-3 pr-8 text-xl font-semibold text-[rgb(var(--color-text))]">
          <PlaylistIcon className="h-5 w-5 text-[rgb(var(--color-accent))]" aria-hidden />
          Lägg till i spellista
        </h2>

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
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left hover:bg-[rgb(var(--color-border))]/50 disabled:opacity-50"
                  >
                    <PlaylistIcon
                      className="h-5 w-5 shrink-0 text-[rgb(var(--color-text-muted))] mt-0.5"
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-[rgb(var(--color-text))]">
                        {pl.name}
                      </div>
                      {pl.ownerGroupName && (
                        <div className="text-sm text-[rgb(var(--color-text-muted))]">
                          Grupp: {pl.ownerGroupName}
                        </div>
                      )}
                    </div>
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
            <InlineError>{addError}</InlineError>

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
              <>
                <form onSubmit={handleCreate} className="flex gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setCreateError(null);
                    }}
                    placeholder="Namn på spellistan"
                    autoFocus
                    className={`${fieldClassName} flex-1`}
                  />
                  <Button type="submit" disabled={creating || !newName.trim()}>
                    Skapa
                  </Button>
                </form>
                <InlineError>{createError}</InlineError>
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
