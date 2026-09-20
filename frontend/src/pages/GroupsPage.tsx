import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getMyGroups,
  getPublicGroups,
  createGroup,
  getGroupInvitations,
  respondToGroupInvitation,
} from '@/api/generated/groups/groups';
import type { GroupSummaryDto } from '@/api/models/groupSummaryDto';
import type { GroupInvitationDto } from '@/api/models/groupInvitationDto';
import { GroupIcon, PlusIcon } from '@/icons';
import { toast } from '@/ui';
import { useAuth } from '@/auth/useAuth';

export function GroupsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [myGroups, setMyGroups] = useState<GroupSummaryDto[]>([]);
  const [publicGroups, setPublicGroups] = useState<GroupSummaryDto[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPublic, setNewPublic] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    Promise.all([
      getPublicGroups({ signal: controller.signal }),
      getMyGroups({ signal: controller.signal }),
      getGroupInvitations({ signal: controller.signal }),
    ])
      .then(([pub, mine, invs]) => {
        setPublicGroups(pub);
        setMyGroups(mine);
        setInvitations(invs);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPublicGroups([]);
        setMyGroups([]);
        setInvitations([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [authLoading, isAuthenticated]);

  async function handleRespond(invitationId: string, accept: boolean) {
    setRespondingId(invitationId);
    try {
      await respondToGroupInvitation(invitationId, { accept });
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      if (accept) {
        const updated = await getMyGroups();
        setMyGroups(updated);
        toast('Inbjudan accepterad');
      } else {
        toast('Inbjudan avböjd');
      }
    } catch {
      toast('Kunde inte svara på inbjudan', 'error');
    } finally {
      setRespondingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createGroup({ name: newName.trim(), isPublic: newPublic });
      setMyGroups((prev) => [
        { id: created.id, name: created.name, isPublic: created.isPublic, memberCount: 1 },
        ...prev,
      ]);
      setNewName('');
      setNewPublic(false);
      setShowForm(false);
      toast('Grupp skapad');
    } catch {
      toast('Kunde inte skapa grupp', 'error');
    } finally {
      setCreating(false);
    }
  }

  const myGroupIds = new Set(myGroups.map((g) => g.id));
  const joinablePublicGroups = publicGroups.filter((g) => !myGroupIds.has(g.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">Grupper</h1>
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-accent))] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" aria-hidden />
            Ny grupp
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Namn på gruppen"
            autoFocus
            className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-4 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-muted))]">
            <input
              type="checkbox"
              checked={newPublic}
              onChange={(e) => setNewPublic(e.target.checked)}
              className="h-4 w-4 rounded border-[rgb(var(--color-border))]"
            />
            Offentlig grupp — alla kan se medlemmar och spellistor
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="rounded-lg bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Skapa
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setNewName('');
                setNewPublic(false);
              }}
              className="rounded-lg border border-[rgb(var(--color-border))] px-4 py-2 text-sm text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50"
            >
              Avbryt
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>}

      {!loading && invitations.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            Inbjudningar
          </h2>
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">
                    {inv.groupName ?? 'Okänd grupp'}
                  </p>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    Inbjuden av {inv.invitedByDisplayName ?? inv.invitedByUserId}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={respondingId === inv.id}
                    onClick={() => handleRespond(inv.id!, true)}
                    className="rounded-lg bg-[rgb(var(--color-accent))] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:opacity-90"
                  >
                    Acceptera
                  </button>
                  <button
                    type="button"
                    disabled={respondingId === inv.id}
                    onClick={() => handleRespond(inv.id!, false)}
                    className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-xs text-[rgb(var(--color-text-muted))] disabled:opacity-50 hover:bg-[rgb(var(--color-border))]/50"
                  >
                    Avböj
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && isAuthenticated && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            Mina grupper
          </h2>
          {myGroups.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">Du är inte med i någon grupp ännu.</p>
          ) : (
            <GroupList groups={myGroups} />
          )}
        </div>
      )}

      {!loading && !isAuthenticated && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <GroupIcon className="h-10 w-10 text-[rgb(var(--color-text-muted))]" aria-hidden />
          <p className="max-w-xs text-sm text-[rgb(var(--color-text-muted))]">
            Logga in för att skapa och gå med i grupper.
          </p>
          <Link
            to="/login"
            className="mt-1 rounded-lg bg-[rgb(var(--color-accent))] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Logga in
          </Link>
        </div>
      )}

      {!loading && joinablePublicGroups.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            Offentliga grupper
          </h2>
          <GroupList groups={joinablePublicGroups} />
        </div>
      )}
    </div>
  );
}

function GroupList({ groups }: { groups: GroupSummaryDto[] }) {
  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <li key={g.id}>
          <Link
            to={`/groups/${g.id}`}
            className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3 hover:border-[rgb(var(--color-accent))]/50 hover:bg-[rgb(var(--color-accent-muted))]/20 transition-colors"
          >
            <GroupIcon className="h-5 w-5 shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">{g.name}</p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {g.memberCount} {g.memberCount === 1 ? 'medlem' : 'medlemmar'}
                {g.isPublic ? ' · Offentlig' : ' · Privat'}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
