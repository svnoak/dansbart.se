import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDanceList, addEntry, removeEntry } from '@/api/generated/dance-lists/dance-lists';
import { getDances } from '@/api/generated/dances/dances';
import type { DanceListDto } from '@/api/models/danceListDto';
import type { Dance } from '@/api/models/dance';
import { Button, Card } from '@/ui';
import { PlusIcon } from '@/icons';

export default function DanceListPage() {
  const { id } = useParams<{ id: string }>();
  const [danceList, setDanceList] = useState<DanceListDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Dance[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDanceId, setSelectedDanceId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);

  const canManage = danceList?.viewerCanManage === true;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await getDanceList(id as string);
        if (!cancelled) setDanceList(data);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    async function search() {
      setSearching(true);
      try {
        const result = await getDances({ search: searchQuery.trim() });
        if (!cancelled) {
          const content = (result && typeof result === 'object' && 'content' in result ? result.content : null) ?? [];
          setSearchResults(Array.isArray(content) ? content : []);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }
    search();
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  async function handleAddDance(danceId: string | null, freeTextName: string | null) {
    if (!id || adding) return;
    setAdding(true);
    try {
      const newEntry = await addEntry(id, {
        danceId: danceId || undefined,
        freeTextName: freeTextName || undefined,
      });
      setDanceList((prev) =>
        prev
          ? {
              ...prev,
              entries: [...(prev.entries ?? []), newEntry],
            }
          : prev,
      );
      setSearchQuery('');
      setSelectedDanceId(null);
      setShowAddForm(false);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveDance(entryId: string) {
    if (!id || removing) return;
    setRemoving(entryId);
    try {
      await removeEntry(id, entryId);
      setDanceList((prev) =>
        prev
          ? {
              ...prev,
              entries: (prev.entries ?? []).filter((e) => e.id !== entryId),
            }
          : prev,
      );
      setConfirmingRemove(null);
    } finally {
      setRemoving(null);
    }
  }

  if (loading) {
    return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  }

  if (notFound || !danceList) {
    return (
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Danslistan hittades inte.
      </p>
    );
  }

  const entries = danceList.entries ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
          {danceList.name}
        </h1>
        {danceList.description && (
          <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
            {danceList.description}
          </p>
        )}
      </div>

      {canManage && !showAddForm && (
        <Button onClick={() => setShowAddForm(true)}>
          <PlusIcon className="mr-1.5 h-4 w-4" aria-hidden />
          Lägg till dans
        </Button>
      )}

      {showAddForm && canManage && (
        <Card className="p-4">
          <div className="space-y-3">
            <div>
              <label
                htmlFor="dance-search"
                className="block text-sm font-medium text-[rgb(var(--color-text))]"
              >
                Sök efter dans
              </label>
              <input
                id="dance-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök..."
                autoFocus
                className="mt-1 min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] placeholder-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
              />
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((dance) => (
                  <div key={dance.id} className="space-y-2">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setSelectedDanceId(
                          selectedDanceId === dance.id ? null : dance.id ?? null,
                        )
                      }
                      className="w-full text-left"
                    >
                      {dance.name}
                    </Button>
                    {selectedDanceId === dance.id && dance.id && (
                      <Button
                        size="sm"
                        onClick={() => handleAddDance(dance.id as string, null)}
                        disabled={adding}
                      >
                        Lägg till
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {searchQuery.trim() && searchResults.length === 0 && !searching && (
              <div className="space-y-2 border-t border-[rgb(var(--color-border))] pt-3">
                <p className="text-sm text-[rgb(var(--color-text-muted))]">
                  Dansen finns inte. Lägg till den manuellt:
                </p>
                <Button
                  onClick={() => handleAddDance(null, searchQuery)}
                  disabled={adding}
                  variant="secondary"
                >
                  Lägg till som egen dans
                </Button>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowAddForm(false);
                setSearchQuery('');
              }}
              disabled={adding}
            >
              Avbryt
            </Button>
          </div>
        </Card>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">
          Danslistan har inga danser ännu.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card className="flex items-center justify-between gap-3 p-3">
                <span className="text-sm font-medium text-[rgb(var(--color-text))]">
                  {entry.danceName ?? entry.freeTextName}
                </span>
                {canManage && (
                  <>
                    {confirmingRemove === entry.id ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRemoveDance(entry.id as string)}
                          disabled={removing === entry.id}
                        >
                          Ja, ta bort
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmingRemove(null)}
                          disabled={removing === entry.id}
                        >
                          Avbryt
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmingRemove(entry.id ?? '')}
                      >
                        Ta bort
                      </Button>
                    )}
                  </>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
