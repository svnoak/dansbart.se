import { useEffect, useState } from 'react';
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
import { GroupIcon, PlusIcon } from '@/icons';
import { Badge, Button, Card, InlineError, SectionTitle, toast } from '@/ui';
import { useAuth } from '@/auth/useAuth';
import { describeGroupError } from '@/utils/describeGroupError';

export function GroupsPage() {
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
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
  const [respondError, setRespondError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const groups = await getPublicGroups();
        if (!cancelled) {
          setPublicGroups(groups ?? []);
          setErrorPublic(false);
        }
      } catch {
        if (!cancelled) {
          setPublicGroups([]);
          setErrorPublic(true);
        }
      } finally {
        if (!cancelled) setLoadingPublic(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoadingMine(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [mine, invs] = await Promise.all([getMyGroups(), getGroupInvitations()]);
        if (!cancelled) {
          setMyGroups(mine ?? []);
          setInvitations(invs ?? []);
          setErrorMine(false);
        }
      } catch {
        if (!cancelled) {
          setMyGroups([]);
          setInvitations([]);
          setErrorMine(true);
        }
      } finally {
        if (!cancelled) setLoadingMine(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  async function handleRespond(invitationId: string, accept: boolean) {
    setRespondingId(invitationId);
    setRespondError(null);
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
      setRespondError({ id: invitationId, message: 'Det gick inte att svara på inbjudan.' });
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">Grupper</h1>
        {isAuthenticated && (
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            <PlusIcon className="mr-1.5 h-4 w-4" aria-hidden />
            Ny grupp
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="p-4">
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
                className="min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-4 py-2 text-sm text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[rgb(var(--color-text))]">
              <input
                type="checkbox"
                checked={newIsPublic}
                onChange={(e) => setNewIsPublic(e.target.checked)}
                className="h-5 w-5 rounded border-[rgb(var(--color-border))]"
              />
              Offentlig grupp: alla kan se gruppen och dess offentliga spellistor
            </label>
            {createError && (
              <p className="text-sm text-[rgb(var(--color-error))]" role="alert">
                {createError}
              </p>
            )}
            <div className="flex gap-2">
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
        <section className="space-y-3">
          <SectionTitle>Inbjudningar</SectionTitle>
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <li key={inv.id} className="space-y-1">
                <Card className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">
                      {inv.groupName ?? 'Okänd grupp'}
                    </p>
                    {inv.invitedByDisplayName && (
                      <p className="text-sm text-[rgb(var(--color-text-muted))]">
                        Inbjuden av {inv.invitedByDisplayName}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      disabled={respondingId === inv.id}
                      onClick={() => handleRespond(inv.id!, true)}
                    >
                      Acceptera
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={respondingId === inv.id}
                      onClick={() => handleRespond(inv.id!, false)}
                    >
                      Avböj
                    </Button>
                  </div>
                </Card>
                {respondError && respondError.id === inv.id && (
                  <InlineError>{respondError.message}</InlineError>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAuthenticated && !loadingMine && (
        <section className="space-y-3">
          <SectionTitle>Mina grupper</SectionTitle>
          {errorMine ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Det gick inte att hämta grupperna.
            </p>
          ) : myGroups.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Du är inte med i någon grupp ännu.
            </p>
          ) : (
            <GroupList groups={myGroups} />
          )}
        </section>
      )}

      {!authLoading && !isAuthenticated && (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <GroupIcon className="h-10 w-10 text-[rgb(var(--color-text-muted))]" aria-hidden />
          <p className="max-w-xs text-sm text-[rgb(var(--color-text-muted))]">
            Logga in för att skapa och gå med i grupper.
          </p>
          <Button onClick={login}>Logga in</Button>
        </Card>
      )}

      {(!isAuthenticated || !loadingMine) && (
        <section className="space-y-3">
          <SectionTitle>Offentliga grupper</SectionTitle>
          {loadingPublic ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">Laddar...</p>
          ) : errorPublic ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Det gick inte att hämta grupperna.
            </p>
          ) : joinablePublicGroups.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Inga offentliga grupper ännu.
            </p>
          ) : (
            <GroupList groups={joinablePublicGroups} />
          )}
        </section>
      )}
    </div>
  );
}

function GroupList({ groups }: { groups: GroupSummaryDto[] }) {
  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <li key={g.id}>
          <Link to={`/groups/${g.id}`} className="block">
            <Card className="flex items-center gap-3 p-4 transition-colors hover:border-[rgb(var(--color-accent))]/50">
              <GroupIcon
                className="h-5 w-5 shrink-0 text-[rgb(var(--color-text-muted))]"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[rgb(var(--color-text))]">
                {g.name}
              </span>
              <Badge variant={g.isPublic ? 'default' : 'muted'} className="text-base">
                {g.isPublic ? 'Offentlig' : 'Privat'}
              </Badge>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
