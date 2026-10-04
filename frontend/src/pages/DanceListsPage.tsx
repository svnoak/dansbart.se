import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyDanceLists, createDanceList } from '@/api/generated/dance-lists/dance-lists';
import type { DanceList } from '@/api/models/danceList';
import { QueueListIcon, PlusIcon, ChevronRightIcon } from '@/icons';
import { Button, Card, EmptyState, InlineError, LoadError, RowSkeleton, SectionTitle } from '@/ui';
import { useAuth } from '@/auth/useAuth';

const PRIMARY_LINK_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] transition-colors hover:bg-[rgb(var(--color-accent-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';

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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            Danslistor
          </h1>
          <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
            Kvällens program: danser i ordning, med låtar till varje dans.
          </p>
        </div>
        {isAuthenticated && (
          <Button onClick={() => setShowForm((s) => !s)} aria-expanded={showForm} className="shrink-0">
            <PlusIcon className="h-4 w-4" aria-hidden />
            Ny danslista
          </Button>
        )}
      </header>

      {showForm && (
        <Card className="p-5">
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
                className="h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-4 text-[15px] text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-focus))] focus:outline-none focus-visible:ring-1 focus-visible:ring-[rgb(var(--color-focus))]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
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
          icon={<QueueListIcon className="h-7 w-7" aria-hidden />}
          title="Logga in för att se dina danslistor"
          description="Dina danslistor sparas på ditt konto så att du hittar dem på alla dina enheter."
          action={
            <Link to="/login" className={PRIMARY_LINK_CLASS}>
              Logga in
            </Link>
          }
        />
      )}

      {isAuthenticated && (
        <section className="space-y-3" aria-labelledby="my-dance-lists-title">
          <SectionTitle id="my-dance-lists-title">Mina danslistor</SectionTitle>
          {loading ? (
            <RowSkeleton rows={3} label="Laddar danslistor" />
          ) : error ? (
            <LoadError message="Det gick inte att hämta danslistorna." onRetry={load} />
          ) : danceLists.length === 0 ? (
            <EmptyState
              icon={<QueueListIcon className="h-7 w-7" aria-hidden />}
              title="Du har inga danslistor ännu"
              description="Skapa en danslista för kvällen och lägg till danserna i den ordning ni dansar dem."
              action={
                <Button
                  onClick={() => {
                    setShowForm(true);
                    setCreateError(null);
                  }}
                >
                  <PlusIcon className="h-4 w-4" aria-hidden />
                  Skapa danslista
                </Button>
              }
            />
          ) : (
            <DanceListRows danceLists={danceLists} />
          )}
        </section>
      )}
    </div>
  );
}

function formatUpdated(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `Uppdaterad ${date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}`;
}

function VisibilityBadge({ list }: { list: DanceList }) {
  if (list.shareToken) {
    return (
      <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-[rgb(var(--color-link))]/10 px-2.5 text-[13px] font-medium text-[rgb(var(--color-link))]">
        Delad med länk
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-[rgb(var(--color-accent-muted))] px-2.5 text-[13px] font-medium text-[rgb(var(--color-text-muted))]">
      {list.isPublic ? 'Offentlig' : 'Privat'}
    </span>
  );
}

function DanceListRows({ danceLists }: { danceLists: DanceList[] }) {
  return (
    <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
      {danceLists.map((list) => {
        const name = list.name ?? 'Namnlös danslista';
        const href = `/dance-lists/${list.id}`;
        const secondLine = list.description?.trim() || formatUpdated(list.updatedAt);
        return (
          <li
            key={list.id}
            className="flex items-center gap-3 border-b border-[rgb(var(--color-border))] px-3 py-2.5 last:border-b-0"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]"
              aria-hidden
            >
              <QueueListIcon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  to={href}
                  className="truncate text-[15px] font-bold text-[rgb(var(--color-text))] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
                >
                  {name}
                </Link>
                <VisibilityBadge list={list} />
              </div>
              {secondLine && (
                <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">{secondLine}</p>
              )}
            </div>
            <Link
              to={href}
              aria-label={`Öppna ${name}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-accent-muted))] hover:text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
            >
              <ChevronRightIcon className="h-5 w-5" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
