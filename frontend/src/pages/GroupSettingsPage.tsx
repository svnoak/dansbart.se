import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getGroup,
  updateGroup,
  deleteGroup,
  inviteMember,
  updateMember,
  removeMember,
} from '@/api/generated/groups/groups';
import { searchUsers } from '@/api/generated/users/users';
import type { GroupDto } from '@/api/models/groupDto';
import type { GroupMemberDto } from '@/api/models/groupMemberDto';
import type { UserSummaryDto } from '@/api/models/userSummaryDto';
import { BackArrowIcon } from '@/icons';
import { IconButton, toast } from '@/ui';
import { useAuth } from '@/auth/useAuth';

function statusLabel(status: string | undefined): string {
  if (status === 'pending') return 'Väntande';
  if (status === 'accepted') return 'Accepterad';
  return status ?? '';
}

export function GroupSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Info form
  const [name, setName] = useState('');
  const [aboutUs, setAboutUs] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  // Invite
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<UserSummaryDto[]>([]);
  const [inviteSelected, setInviteSelected] = useState<UserSummaryDto | null>(null);
  const [inviting, setInviting] = useState(false);
  const inviteSearchRef = useRef<HTMLDivElement>(null);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const [deleteText, setDeleteText] = useState('');

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getGroup(id, { signal: controller.signal })
      .then((g) => {
        setGroup(g);
        setName(g.name ?? '');
        setAboutUs(g.aboutUs ?? '');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setGroup(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (inviteSelected || inviteQuery.trim().length < 2) {
      setInviteResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchUsers({ q: inviteQuery.trim(), limit: 8 })
        .then(setInviteResults)
        .catch(() => setInviteResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [inviteQuery, inviteSelected]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (inviteSearchRef.current && !inviteSearchRef.current.contains(e.target as Node)) {
        setInviteResults([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (loading) return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  if (!group) return <p className="text-[rgb(var(--color-text-muted))]">Gruppen hittades inte.</p>;

  const myMembership = group.members?.find((m) => m.userId === user?.id);
  const isAdmin = !!myMembership?.isAdmin;
  const canEditInfo = isAdmin || !!myMembership?.canEditInfo;
  const canInviteMembers = isAdmin || !!myMembership?.canInviteMembers;
  const canRemoveMembers = isAdmin || !!myMembership?.canRemoveMembers;
  const members = group.members ?? [];

  function canRemove(member: GroupMemberDto): boolean {
    if (member.userId === user?.id) return true;
    if (isAdmin) return true;
    return canRemoveMembers && !member.isAdmin;
  }

  // ── Info ─────────────────────────────────────────────────────────────────

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingInfo(true);
    try {
      await updateGroup(id, { name: name.trim(), aboutUs: aboutUs.trim() });
      setGroup((prev) => (prev ? { ...prev, name: name.trim(), aboutUs: aboutUs.trim() } : prev));
      toast('Gruppen uppdaterad');
    } catch {
      toast('Kunde inte spara ändringar', 'error');
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleToggleVisibility() {
    if (!id || !group) return;
    try {
      const updated = await updateGroup(id, { isPublic: !group.isPublic });
      setGroup((prev) => (prev ? { ...prev, isPublic: updated.isPublic } : prev));
      toast(updated.isPublic ? 'Gruppen är nu offentlig' : 'Gruppen är nu privat');
    } catch {
      toast('Kunde inte ändra synlighet', 'error');
    }
  }

  // ── Members ──────────────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !inviteSelected?.id) return;
    setInviting(true);
    try {
      await inviteMember(id, { userId: inviteSelected.id });
      const updated = await getGroup(id);
      setGroup(updated);
      setInviteSelected(null);
      setInviteQuery('');
      setShowInviteForm(false);
      toast('Inbjudan skickad');
    } catch {
      toast('Kunde inte bjuda in', 'error');
    } finally {
      setInviting(false);
    }
  }

  async function handleTogglePermission(member: GroupMemberDto, field: keyof GroupMemberDto) {
    if (!id || !member.id) return;
    const value = !member[field];
    try {
      const updated = await updateMember(id, member.id, { [field]: value });
      setGroup((prev) =>
        prev
          ? { ...prev, members: prev.members?.map((m) => (m.id === member.id ? { ...m, ...updated } : m)) }
          : prev,
      );
    } catch {
      toast('Kunde inte ändra behörighet', 'error');
    }
  }

  async function handleRemoveMember(member: GroupMemberDto) {
    if (!id || !member.id) return;
    const isSelf = member.userId === user?.id;
    if (isSelf && !window.confirm('Lämna gruppen?')) return;
    try {
      await removeMember(id, member.id);
      setGroup((prev) => (prev ? { ...prev, members: prev.members?.filter((m) => m.id !== member.id) } : prev));
      toast(isSelf ? 'Du har lämnat gruppen' : 'Medlem borttagen');
      if (isSelf) navigate('/groups');
    } catch {
      toast('Kunde inte ta bort medlem — en grupp måste ha minst en administratör', 'error');
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!id) return;
    try {
      await deleteGroup(id);
      toast('Grupp raderad');
      navigate('/groups');
    } catch {
      toast('Kunde inte radera grupp', 'error');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <IconButton aria-label="Tillbaka" onClick={() => navigate(`/groups/${id}`)}>
          <BackArrowIcon className="h-5 w-5" aria-hidden />
        </IconButton>
        <h1 className="text-xl font-bold text-[rgb(var(--color-text))]">
          Inställningar — {group.name}
        </h1>
      </div>

      {canEditInfo && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            Om gruppen
          </h2>
          <form onSubmit={handleSaveInfo} className="space-y-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3">
            <div className="space-y-1">
              <label htmlFor="group-name" className="text-xs font-medium text-[rgb(var(--color-text-muted))]">
                Namn
              </label>
              <input
                id="group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="group-about" className="text-xs font-medium text-[rgb(var(--color-text-muted))]">
                Om oss
              </label>
              <textarea
                id="group-about"
                value={aboutUs}
                onChange={(e) => setAboutUs(e.target.value)}
                rows={4}
                placeholder="Berätta om er grupp..."
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={savingInfo || !name.trim()}
              className="rounded-lg bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Spara
            </button>
          </form>
        </section>
      )}

      {canEditInfo && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            Synlighet
          </h2>
          <div className="flex items-center justify-between rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[rgb(var(--color-text))]">
                {group.isPublic ? 'Offentlig' : 'Privat'}
              </p>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {group.isPublic
                  ? 'Alla kan se medlemmar och spellistor'
                  : 'Bara medlemmar ser gruppen'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleVisibility}
              className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50"
            >
              {group.isPublic ? 'Gör privat' : 'Gör offentlig'}
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
          Medlemmar
        </h2>

        <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] divide-y divide-[rgb(var(--color-border))]">
          {members.map((m) => (
            <div key={m.id} className="space-y-2 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">
                    {m.displayName ?? m.username ?? m.userId}
                  </p>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    {m.username}
                    {m.status === 'pending' && (
                      <span className="ml-1.5 rounded-full bg-[rgb(var(--color-border))] px-1.5 py-0.5 text-[10px]">
                        {statusLabel(m.status)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {m.isAdmin && (
                    <span className="rounded-full bg-[rgb(var(--color-accent))]/10 px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--color-accent))]">
                      Administratör
                    </span>
                  )}
                  {canRemove(m) && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m)}
                      className="text-xs text-[rgb(var(--color-text-muted))] hover:text-red-500"
                    >
                      {m.userId === user?.id ? 'Lämna' : 'Ta bort'}
                    </button>
                  )}
                </div>
              </div>

              {isAdmin && m.status === 'accepted' && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[rgb(var(--color-text-muted))]">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!m.isAdmin}
                      onChange={() => handleTogglePermission(m, 'isAdmin')}
                      className="h-3.5 w-3.5 rounded border-[rgb(var(--color-border))]"
                    />
                    Administratör
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!m.canEditInfo}
                      disabled={!!m.isAdmin}
                      onChange={() => handleTogglePermission(m, 'canEditInfo')}
                      className="h-3.5 w-3.5 rounded border-[rgb(var(--color-border))]"
                    />
                    Ändra namn/beskrivning
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!m.canManagePlaylists}
                      disabled={!!m.isAdmin}
                      onChange={() => handleTogglePermission(m, 'canManagePlaylists')}
                      className="h-3.5 w-3.5 rounded border-[rgb(var(--color-border))]"
                    />
                    Hantera spellistor
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!m.canInviteMembers}
                      disabled={!!m.isAdmin}
                      onChange={() => handleTogglePermission(m, 'canInviteMembers')}
                      className="h-3.5 w-3.5 rounded border-[rgb(var(--color-border))]"
                    />
                    Bjuda in medlemmar
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!m.canRemoveMembers}
                      disabled={!!m.isAdmin}
                      onChange={() => handleTogglePermission(m, 'canRemoveMembers')}
                      className="h-3.5 w-3.5 rounded border-[rgb(var(--color-border))]"
                    />
                    Ta bort medlemmar
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        {canInviteMembers && !showInviteForm && (
          <button
            type="button"
            onClick={() => setShowInviteForm(true)}
            className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))]"
          >
            + Bjud in medlem
          </button>
        )}
        {canInviteMembers && showInviteForm && (
          <form onSubmit={handleInvite} className="flex gap-2">
            <div ref={inviteSearchRef} className="relative flex-1">
              <input
                type="text"
                value={inviteQuery}
                onChange={(e) => {
                  setInviteQuery(e.target.value);
                  setInviteSelected(null);
                }}
                placeholder="Sök efter användare..."
                autoComplete="off"
                className={`w-full rounded-lg border bg-[rgb(var(--color-bg-elevated))] px-3 py-1.5 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none ${
                  inviteSelected
                    ? 'border-[rgb(var(--color-accent))]'
                    : 'border-[rgb(var(--color-border))] focus:border-[rgb(var(--color-accent))]'
                }`}
              />
              {inviteResults.length > 0 && (
                <ul className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-lg">
                  {inviteResults.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setInviteSelected(u);
                          setInviteQuery(u.displayName ?? u.username ?? '');
                          setInviteResults([]);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[rgb(var(--color-border))]/40"
                      >
                        <span className="font-medium text-[rgb(var(--color-text))]">
                          {u.displayName ?? u.username}
                        </span>
                        {u.username && u.displayName && (
                          <span className="ml-1.5 text-xs text-[rgb(var(--color-text-muted))]">
                            @{u.username}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteSelected}
              className="rounded-lg bg-[rgb(var(--color-accent))] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Bjud in
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInviteForm(false);
                setInviteQuery('');
                setInviteSelected(null);
                setInviteResults([]);
              }}
              className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-sm text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50"
            >
              Avbryt
            </button>
          </form>
        )}
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-500">Farlig zon</h2>
          <div className="rounded-lg border border-red-500/30 bg-[rgb(var(--color-bg-elevated))] px-4 py-3 space-y-3">
            <p className="text-sm font-medium text-[rgb(var(--color-text))]">Radera grupp</p>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
              Det här går inte att ångra. Gruppens spellistor raderas också. Skriv in gruppens namn för att bekräfta.
            </p>
            {!deleteConfirm ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirm(true);
                  setTimeout(() => deleteInputRef.current?.focus(), 50);
                }}
                className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10"
              >
                Radera grupp
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  ref={deleteInputRef}
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder={group.name}
                  className="w-full rounded-lg border border-red-500/50 bg-[rgb(var(--color-bg))] px-3 py-1.5 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-red-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={deleteText !== group.name}
                    onClick={handleDelete}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90"
                  >
                    Radera permanent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirm(false);
                      setDeleteText('');
                    }}
                    className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-sm text-[rgb(var(--color-text-muted))]"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
