import { useCallback, useEffect, useState } from 'react';
import { getMyDanceLists, createDanceList } from '@/api/generated/dance-lists/dance-lists';
import type { DanceList } from '@/api/models/danceList';
import { QueueListIcon, PlusIcon } from '@/icons';
import { Button, Card, InlineError, LoadError, SectionTitle, PageHeader, EmptyState, LinkButton, ListRow, fieldClassName } from '@/ui';
import { useAuth } from '@/auth/useAuth';

export function DanceListsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [danceLists, setDanceLists] = useState<DanceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const lists = await getMyDanceLists();
      setDanceLists(lists ?? []);
      setError(false);
    } catch {
      setDanceLists([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, isAuthenticated, load]);

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
      setCreateError('Det gick inte att skapa danslistan.');
    } finally {
      setCreating(false);
    }
  }

  function handleCancelForm() {
    setShowForm(false);
    setNewName('');
    setCreateError(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Danslistor"
        action={
          isAuthenticated && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)}>
              <PlusIcon className="mr-1.5 h-4 w-4" aria-hidden />
              Ny danslista
            </Button>
          )
        }
      />

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
                onChange={(e) => {
                  setNewName(e.target.value);
                  setCreateError(null);
                }}
                autoFocus
                className={fieldClassName}
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
            <InlineError>{createError}</InlineError>
          </form>
        </Card>
      )}

      {!authLoading && !isAuthenticated && (
        <EmptyState
          icon={<QueueListIcon className="h-10 w-10" aria-hidden />}
          action={<LinkButton to="/login">Logga in</LinkButton>}
        >
          Logga in för att skapa och se dina danslistor.
        </EmptyState>
      )}

      {isAuthenticated && !loading && (
        <section className="space-y-3">
          <SectionTitle>Mina danslistor</SectionTitle>
          {error ? (
            <LoadError message="Det gick inte att hämta danslistorna." onRetry={load} />
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
          <ListRow
            to={`/dance-lists/${list.id}`}
            title={list.name}
            subtitle={list.description}
            icon={<QueueListIcon className="h-5 w-5" aria-hidden />}
          />
        </li>
      ))}
    </ul>
  );
}
