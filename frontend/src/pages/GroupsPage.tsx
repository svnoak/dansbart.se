import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMyGroups,
  getPublicGroups,
  createGroup,
  getGroupInvitations,
  respondToGroupInvitation,
} from '@/api/generated/groups/groups';
import { ApiError } from '@/api/http-client';
import type { GroupSummaryDto } from '@/api/models/groupSummaryDto';
import type { GroupInvitationDto } from '@/api/models/groupInvitationDto';
import { ChevronRightIcon, GroupIcon, PlusIcon } from '@/icons';
import { Button, Card, EmptyState, InlineError, LoadError, RowSkeleton, toast } from '@/ui';
import { useAuth } from '@/auth/useAuth';
import { describeGroupError } from '@/utils/describeGroupError';

const LIST_CLASS =
  'overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]';
const ROW_CLASS =
  'flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--color-border))] last:border-b-0';
const INPUT_CLASS =
  'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';

function groupInitial(name: string | undefined): string {
  return (name ?? '').trim().charAt(0).toUpperCase() || '?';
}

export function GroupsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [myGroups, setMyGroups] = useState<GroupSummaryDto[]>([]);
  const [publicGroups, setPublicGroups] = useState<GroupSummaryDto[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitationDto[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);
  const [errorPublic, setErrorPublic] = useState(false);
  const [errorMine, setErrorMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondErrors, setRespondErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);

  const loadPublicGroups = useCallback(async () => {
    try {
      const result = await getPublicGroups({ page: 0, size: 50 });
      setPublicGroups(result.items ?? []);
      setHasMore(result.hasMore ?? false);
      setErrorPublic(false);
    } catch {
      setPublicGroups([]);
      setHasMore(false);
      setErrorPublic(true);
    } finally {
      setLoadingPublic(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    isLoadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const result = await getPublicGroups({ page: page + 1, size: 50 });
      setPublicGroups((prev) => {
        const seen = new Set(prev.map((g) => g.id));
        return [...prev, ...(result.items ?? []).filter((g) => !seen.has(g.id))];
      });
      setPage(result.page ?? page + 1);
      setHasMore(result.hasMore ?? false);
    } catch {
      setHasMore(false);
    } finally {
      isLoadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [page]);

  const loadMine = useCallback(async () => {
    try {
      const [mine, invs] = await Promise.all([getMyGroups(), getGroupInvitations()]);
      setMyGroups(mine ?? []);
      setInvitations(invs ?? []);
      setErrorMine(false);
    } catch {
      setMyGroups([]);
      setInvitations([]);
      setErrorMine(true);
    } finally {
      setLoadingMine(false);
    }
  }, []);

  useEffect(() => {
    loadPublicGroups();
  }, [loadPublicGroups]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoadingMine(false);
      return;
    }
    loadMine();
  }, [authLoading, isAuthenticated, loadMine]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isLoadingMoreRef.current) {
        loadMore();
      }
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  async function handleRespond(invitationId: string, accept: boolean) {
    setRespondingId(invitationId);
    setRespondErrors((prev) => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
    try {
      await respondToGroupInvitation(invitationId, { accept });
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      if (accept) {
        try {
          const updated = await getMyGroups();
          setMyGroups(updated ?? []);
        } catch {
          toast('Det gick inte att uppdatera listan. Ladda om sidan.', 'error');
        }
      }
    } catch {
      setRespondErrors((prev) => ({ ...prev, [invitationId]: 'Det gick inte att svara på inbjudan.' }));
    } finally {
      setRespondingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createGroup({ name, isPublic: newIsPublic });
      setMyGroups((prev) => [
        { id: created.id, name: created.name, isPublic: created.isPublic },
        ...prev,
      ]);
      setNewGroupName('');
      setNewIsPublic(false);
      setShowForm(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setCreateError(describeGroupError(error, 'saveName'));
      } else {
        setCreateError('Det gick inte att skapa gruppen.');
      }
    } finally {
      setCreating(false);
    }
  }

  function handleCancelForm() {
    setShowForm(false);
    setNewGroupName('');
    setNewIsPublic(false);
    setCreateError(null);
  }

  const myGroupIds = new Set(myGroups.map((g) => g.id));
  const joinablePublicGroups = publicGroups.filter((g) => !myGroupIds.has(g.id));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            Grupper
          </h1>
          <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
            Dela spellistor med dansvänner, kursdeltagare och spelmanslag.
          </p>
        </div>
        {isAuthenticated && (
          <Button onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            Ny grupp
          </Button>
        )}
      </header>

      {showForm && (
        <Card className="p-5">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="new-group-name"
                className="block text-sm font-medium text-[rgb(var(--color-text))]"
              >
                Gruppens namn
              </label>
              <input
                id="new-group-name"
                type="text"
                value={newGroupName}
                onChange={(e) => {
                  setNewGroupName(e.target.value);
                  setCreateError(null);
                }}
                autoFocus
                className={INPUT_CLASS}
              />
            </div>
            <label className="flex min-h-11 items-center gap-3 text-[15px] text-[rgb(var(--color-text))]">
              <input
                type="checkbox"
                checked={newIsPublic}
                onChange={(e) => setNewIsPublic(e.target.checked)}
                className="h-5 w-5 shrink-0 rounded-[4px] border-[rgb(var(--color-border-strong))] accent-[rgb(var(--color-accent))]"
              />
              Offentlig grupp: alla kan se gruppen och dess offentliga spellistor
            </label>
            <InlineError>{createError}</InlineError>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={creating || !newGroupName.trim()}>
                Skapa grupp
              </Button>
              <Button type="button" variant="ghost" onClick={handleCancelForm}>
                Avbryt
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!loadingMine && invitations.length > 0 && (
        <section className="space-y-3" aria-labelledby="groups-invitations-title">
          <h2 id="groups-invitations-title" className="text-xl font-bold text-[rgb(var(--color-text))]">
            Inbjudningar
          </h2>
          <ul className={LIST_CLASS}>
            {invitations.map((inv) => (
              <li key={inv.id} className={`${ROW_CLASS} flex-wrap`}>
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]"
                  aria-hidden
                >
                  <GroupIcon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-[rgb(var(--color-text))]">
                    {inv.groupName ?? 'Okänd grupp'}
                  </p>
                  {inv.invitedByDisplayName && (
                    <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                      Inbjuden av {inv.invitedByDisplayName}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    className="h-10 min-h-10"
                    disabled={respondingId === inv.id}
                    onClick={() => handleRespond(inv.id!, true)}
                  >
                    Acceptera
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 min-h-10"
                    disabled={respondingId === inv.id}
                    onClick={() => handleRespond(inv.id!, false)}
                  >
                    Avböj
                  </Button>
                </div>
                {respondErrors[inv.id!] && (
                  <div className="basis-full pl-14">
                    <InlineError>{respondErrors[inv.id!]}</InlineError>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAuthenticated && (
        <section className="space-y-3" aria-labelledby="groups-mine-title">
          <h2 id="groups-mine-title" className="text-xl font-bold text-[rgb(var(--color-text))]">
            Mina grupper
          </h2>
          {loadingMine ? (
            <RowSkeleton rows={2} label="Laddar dina grupper" />
          ) : errorMine ? (
            <LoadError message="Det gick inte att hämta grupperna." onRetry={loadMine} />
          ) : myGroups.length === 0 ? (
            <EmptyState
              icon={<GroupIcon className="h-7 w-7" aria-hidden />}
              title="Du är inte med i någon grupp ännu."
              description="Skapa en grupp eller gå med i en offentlig grupp nedan."
            />
          ) : (
            <GroupList groups={myGroups} />
          )}
        </section>
      )}

      {!authLoading && !isAuthenticated && (
        <EmptyState
          icon={<GroupIcon className="h-7 w-7" aria-hidden />}
          title="Logga in för att skapa och gå med i grupper."
          description="I en grupp delar ni spellistor och bjuder in varandra."
          action={
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-5 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))]"
            >
              Logga in
            </Link>
          }
        />
      )}

      {(!isAuthenticated || !loadingMine) && (
        <section className="space-y-3" aria-labelledby="groups-public-title">
          <h2 id="groups-public-title" className="text-xl font-bold text-[rgb(var(--color-text))]">
            Offentliga grupper
          </h2>
          {loadingPublic ? (
            <RowSkeleton rows={3} label="Laddar offentliga grupper" />
          ) : errorPublic ? (
            <LoadError message="Det gick inte att hämta grupperna." onRetry={loadPublicGroups} />
          ) : joinablePublicGroups.length === 0 ? (
            <EmptyState
              icon={<GroupIcon className="h-7 w-7" aria-hidden />}
              title="Inga offentliga grupper ännu."
            />
          ) : (
            <GroupList groups={joinablePublicGroups} />
          )}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {loadingMore && (
                <p className="text-sm text-[rgb(var(--color-text-muted))]" role="status">
                  Laddar fler…
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function GroupList({ groups }: { groups: GroupSummaryDto[] }) {
  return (
    <ul className={LIST_CLASS}>
      {groups.map((g) => (
        <li key={g.id} className={ROW_CLASS}>
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent-muted))] text-base font-bold text-[rgb(var(--color-text))]"
            aria-hidden
          >
            {groupInitial(g.name)}
          </span>
          <div className="min-w-0 flex-1">
            <Link
              to={`/groups/${g.id}`}
              className="block truncate text-[15px] font-bold text-[rgb(var(--color-text))] hover:underline"
            >
              {g.name}
            </Link>
            <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
              {g.isPublic ? 'Offentlig' : 'Privat'}
            </p>
          </div>
          <Link
            to={`/groups/${g.id}`}
            aria-label={`Öppna ${g.name ?? 'gruppen'}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-accent-muted))] hover:text-[rgb(var(--color-text))]"
          >
            <ChevronRightIcon className="h-5 w-5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
