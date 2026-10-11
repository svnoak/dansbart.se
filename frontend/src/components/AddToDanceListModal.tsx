import { useState, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { getMyDanceLists, addEntry, createDanceList } from '@/api/generated/dance-lists/dance-lists';
import type { DanceList } from '@/api/models/danceList';
import { CloseIcon, PlusIcon, QueueListIcon } from '@/icons';
import { Button, IconButton, InlineError, toast } from '@/ui';

interface AddToDanceListModalProps {
  open: boolean;
  onClose: () => void;
  dance: { id?: string; name?: string };
}

/**
 * Lets a logged-in person add a dance to one of their dance lists, or create a
 * new dance list with the dance as its first entry. Mirrors AddToPlaylistModal.
 */
export function AddToDanceListModal({ open, onClose, dance }: AddToDanceListModalProps) {
  const [danceLists, setDanceLists] = useState<DanceList[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
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
    setLoadFailed(false);
    setShowNewForm(false);
    setNewName('');
    setAddError(null);
    setCreateError(null);
    getMyDanceLists()
      .then((lists) => setDanceLists(lists ?? []))
      .catch(() => {
        setDanceLists([]);
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, [open, reloadToken]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function handleAdd(danceListId: string) {
    if (!dance.id) return;
    setAdding(danceListId);
    setAddError(null);
    try {
      await addEntry(danceListId, { danceId: dance.id });
      toast('Dans tillagd i danslistan');
      onClose();
    } catch {
      setAddError('Det gick inte att lägga till dansen.');
    } finally {
      setAdding(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !dance.id) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createDanceList({ name: newName.trim() });
      if (created.id) {
        await addEntry(created.id, { danceId: dance.id });
      }
      toast('Danslista skapad och dans tillagd');
      onClose();
    } catch {
      setCreateError('Det gick inte att skapa danslistan.');
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
          Lägg till i danslista
        </h2>
        {dance.name && (
          <p className="mb-4 truncate pr-12 text-[15px] text-[rgb(var(--color-text-muted))]">{dance.name}</p>
        )}

        {loading && (
          <p className="py-3 text-[15px] text-[rgb(var(--color-text-muted))]">Laddar...</p>
        )}

        {!loading && loadFailed && (
          <div className="mb-4 space-y-2">
            <InlineError>Det gick inte att hämta dina danslistor.</InlineError>
            <Button variant="outline" onClick={() => setReloadToken((t) => t + 1)}>
              Försök igen
            </Button>
          </div>
        )}

        {!loading && !loadFailed && (
          <>
            <ul className="mb-4 max-h-72 divide-y divide-[rgb(var(--color-border))] overflow-y-auto border-y border-[rgb(var(--color-border))]">
              {danceLists.map((list) => (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => list.id && handleAdd(list.id)}
                    disabled={adding !== null}
                    aria-busy={adding === list.id}
                    className="flex w-full min-h-14 items-center gap-3 px-2 py-2 text-left hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:bg-[rgb(var(--color-accent-muted))] disabled:opacity-50"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text-muted))]"
                      aria-hidden
                    >
                      <QueueListIcon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-[rgb(var(--color-text))]">
                        {list.name}
                      </span>
                      {list.description && (
                        <span className="block truncate text-[13px] text-[rgb(var(--color-text-muted))]">
                          {list.description}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
              {danceLists.length === 0 && (
                <li>
                  <p className="px-2 py-3 text-[15px] text-[rgb(var(--color-text-muted))]">
                    Du har inga danslistor ännu.
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
                Ny danslista
              </Button>
            )}

            {showNewForm && (
              <form onSubmit={handleCreate} className="space-y-2">
                <label htmlFor={nameId} className="block text-[14px] font-semibold text-[rgb(var(--color-text))]">
                  Namn på danslistan
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
