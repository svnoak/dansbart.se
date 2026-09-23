import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyDanceLists, createDanceList } from '@/api/generated/dance-lists/dance-lists';
import type { DanceList } from '@/api/models/danceList';
import { QueueListIcon, PlusIcon } from '@/icons';
import { Button, Card, SectionTitle, toast } from '@/ui';
import { useAuth } from '@/auth/useAuth';

export function DanceListsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [danceLists, setDanceLists] = useState<DanceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const lists = await getMyDanceLists();
        if (!cancelled) {
          setDanceLists(lists ?? []);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setDanceLists([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createDanceList({ name });
      setDanceLists((prev) => [created, ...prev]);
      setNewName('');
      setShowForm(false);
    } catch {
      toast('Det gick inte att skapa danslistan.', 'error');
    } finally {
      setCreating(false);
    }
  }

  function handleCancelForm() {
    setShowForm(false);
    setNewName('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">Danslistor</h1>
        {isAuthenticated && (
          <Button onClick={() => setShowForm((s) => !s)}>
            <PlusIcon className="mr-1.5 h-4 w-4" aria-hidden />
            Ny danslista
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="new-dance-list-name"
                className="block text-sm font-medium text-[rgb(var(--color-text))]"
              >
                Danslistans namn
              </label>
              <input
                id="new-dance-list-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                className="min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-4 py-2 text-sm text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={creating || !newName.trim()}>
                Skapa danslista
              </Button>
              <Button type="button" variant="ghost" onClick={handleCancelForm}>
                Avbryt
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!authLoading && !isAuthenticated && (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <QueueListIcon className="h-10 w-10 text-[rgb(var(--color-text-muted))]" aria-hidden />
          <p className="max-w-xs text-sm text-[rgb(var(--color-text-muted))]">
            Logga in för att skapa och se dina danslistor.
          </p>
          <Link
            to="/login"
            className="mt-1 rounded-lg bg-[rgb(var(--color-accent))] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Logga in
          </Link>
        </Card>
      )}

      {isAuthenticated && !loading && (
        <section className="space-y-3">
          <SectionTitle>Mina danslistor</SectionTitle>
          {error ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Det gick inte att hämta danslistorna.
            </p>
          ) : danceLists.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Du har inga danslistor ännu.
            </p>
          ) : (
            <DanceListCards danceLists={danceLists} />
          )}
        </section>
      )}
    </div>
  );
}

function DanceListCards({ danceLists }: { danceLists: DanceList[] }) {
  return (
    <ul className="space-y-2">
      {danceLists.map((list) => (
        <li key={list.id}>
          <Link to={`/dance-lists/${list.id}`} className="block">
            <Card className="flex items-center gap-3 p-4 transition-colors hover:border-[rgb(var(--color-accent))]/50">
              <QueueListIcon
                className="h-5 w-5 shrink-0 text-[rgb(var(--color-text-muted))]"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[rgb(var(--color-text))]">
                {list.name}
              </span>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
