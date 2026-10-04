import { useState, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { getEditablePlaylists, addTrack, createPlaylist } from '@/api/generated/playlists/playlists';
import type { EditablePlaylistDto } from '@/api/models/editablePlaylistDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import { CloseIcon, PlaylistIcon, PlusIcon } from '@/icons';
import { Button, IconButton, InlineError, toast } from '@/ui';

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
  const id = useId();
  const titleId = `${id}-title`;
  const nameId = `${id}-name`;

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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-[var(--color-card-shadow)]">
        <IconButton aria-label="Stäng" onClick={onClose} className="absolute right-3 top-3">
          <CloseIcon className="h-5 w-5" aria-hidden />
        </IconButton>

        <h2 id={titleId} className="mb-1 pr-12 text-[20px] font-bold leading-tight text-[rgb(var(--color-text))]">
          Lägg till i spellista
        </h2>
        {track.title && (
          <p className="mb-4 truncate pr-12 text-[15px] text-[rgb(var(--color-text-muted))]">{track.title}</p>
        )}

        {loading && (
          <p className="py-3 text-[15px] text-[rgb(var(--color-text-muted))]">Laddar...</p>
        )}

        {!loading && (
          <>
            <ul className="mb-4 max-h-72 divide-y divide-[rgb(var(--color-border))] overflow-y-auto border-y border-[rgb(var(--color-border))]">
              {playlists.map((pl) => (
                <li key={pl.id}>
                  <button
                    type="button"
                    onClick={() => pl.id && handleAdd(pl.id)}
                    disabled={adding === pl.id}
                    className="flex w-full min-h-14 items-center gap-3 px-2 py-2 text-left hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:bg-[rgb(var(--color-accent-muted))] disabled:opacity-50"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text-muted))]"
                      aria-hidden
                    >
                      <PlaylistIcon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-[rgb(var(--color-text))]">
                        {pl.name}
                      </span>
                      {pl.ownerGroupName && (
                        <span className="block truncate text-[13px] text-[rgb(var(--color-text-muted))]">
                          Grupp: {pl.ownerGroupName}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
              {playlists.length === 0 && (
                <li>
                  <p className="px-2 py-3 text-[15px] text-[rgb(var(--color-text-muted))]">
                    Inga spellistor ännu.
                  </p>
                </li>
              )}
            </ul>
            <InlineError>{addError}</InlineError>

            {!showNewForm && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowNewForm(true)}
              >
                <PlusIcon className="h-4 w-4" aria-hidden />
                Ny spellista
              </Button>
            )}

            {showNewForm && (
              <form onSubmit={handleCreate} className="space-y-2">
                <label htmlFor={nameId} className="block text-[14px] font-semibold text-[rgb(var(--color-text))]">
                  Namn på spellistan
                </label>
                <div className="flex gap-2">
                  <input
                    id={nameId}
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setCreateError(null);
                    }}
                    autoFocus
                    className="min-h-11 min-w-0 flex-1 rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
                  />
                  <Button type="submit" variant="primary" disabled={creating || !newName.trim()}>
                    Skapa
                  </Button>
                </div>
                <InlineError>{createError}</InlineError>
              </form>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
