import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getGroup, createGroupPlaylist, removeMember } from '@/api/generated/groups/groups';
import type { GroupDto } from '@/api/models/groupDto';
import { BackArrowIcon, GroupIcon, PlaylistIcon, PlusIcon, SettingsIcon } from '@/icons';
import { IconButton, toast } from '@/ui';
import { useAuth } from '@/auth/useAuth';

export function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getGroup(id, { signal: controller.signal })
      .then(setGroup)
      .catch(() => {
        if (controller.signal.aborted) return;
        setGroup(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  if (loading) return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  if (!group) return <p className="text-[rgb(var(--color-text-muted))]">Gruppen hittades inte.</p>;

  const myMembership = group.members?.find((m) => m.userId === user?.id);
  const isAdmin = !!myMembership?.isAdmin;
  const canEditInfo = isAdmin || !!myMembership?.canEditInfo;
  const canManagePlaylists = isAdmin || !!myMembership?.canManagePlaylists;
  const acceptedMembers = (group.members ?? []).filter((m) => m.status === 'accepted');

  async function handleCreatePlaylist(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !newPlaylistName.trim()) return;
    setCreatingPlaylist(true);
    try {
      const created = await createGroupPlaylist(id, { name: newPlaylistName.trim() });
      setGroup((prev) =>
        prev
          ? {
              ...prev,
              playlists: [
                { id: created.id, name: created.name, description: created.description, isPublic: created.isPublic, trackCount: 0 },
                ...(prev.playlists ?? []),
              ],
            }
          : prev,
      );
      setNewPlaylistName('');
      setShowPlaylistForm(false);
      toast('Spellista skapad');
    } catch {
      toast('Kunde inte skapa spellista', 'error');
    } finally {
      setCreatingPlaylist(false);
    }
  }

  async function handleLeave() {
    if (!id || !myMembership?.id) return;
    if (!window.confirm('Lämna gruppen?')) return;
    try {
      await removeMember(id, myMembership.id);
      toast('Du har lämnat gruppen');
      navigate('/groups');
    } catch {
      toast('Kunde inte lämna gruppen — en grupp måste ha minst en administratör', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconButton aria-label="Tillbaka" onClick={() => navigate('/groups')}>
            <BackArrowIcon className="h-5 w-5" aria-hidden />
          </IconButton>
          <div>
            <h1 className="text-xl font-bold text-[rgb(var(--color-text))]">{group.name}</h1>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
              {acceptedMembers.length} {acceptedMembers.length === 1 ? 'medlem' : 'medlemmar'}
              {group.isPublic ? ' · Offentlig' : ' · Privat'}
            </p>
          </div>
        </div>
        {canEditInfo && (
          <IconButton aria-label="Gruppinställningar" onClick={() => navigate(`/groups/${id}/settings`)}>
            <SettingsIcon className="h-5 w-5" aria-hidden />
          </IconButton>
        )}
      </div>

      {group.aboutUs && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            Om oss
          </h2>
          <p className="whitespace-pre-wrap rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3 text-sm text-[rgb(var(--color-text))]">
            {group.aboutUs}
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
          Medlemmar
        </h2>
        <ul className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] divide-y divide-[rgb(var(--color-border))]">
          {acceptedMembers.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">
                  {m.displayName ?? m.username ?? 'Okänd'}
                </p>
                {m.username && (
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">@{m.username}</p>
                )}
              </div>
              {m.isAdmin && (
                <span className="shrink-0 rounded-full bg-[rgb(var(--color-accent))]/10 px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--color-accent))]">
                  Administratör
                </span>
              )}
            </li>
          ))}
        </ul>
        {myMembership && (
          <button
            type="button"
            onClick={handleLeave}
            className="text-xs text-[rgb(var(--color-text-muted))] hover:text-red-500 underline"
          >
            Lämna gruppen
          </button>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            Gruppens spellistor
          </h2>
          {canManagePlaylists && !showPlaylistForm && (
            <button
              type="button"
              onClick={() => setShowPlaylistForm(true)}
              className="flex items-center gap-1 text-xs font-medium text-[rgb(var(--color-accent))] hover:opacity-80"
            >
              <PlusIcon className="h-3.5 w-3.5" aria-hidden />
              Ny spellista
            </button>
          )}
        </div>

        {showPlaylistForm && (
          <form onSubmit={handleCreatePlaylist} className="flex gap-2">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Namn på spellistan"
              autoFocus
              className="flex-1 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-3 py-1.5 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
            />
            <button
              type="submit"
              disabled={creatingPlaylist || !newPlaylistName.trim()}
              className="rounded-lg bg-[rgb(var(--color-accent))] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Skapa
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPlaylistForm(false);
                setNewPlaylistName('');
              }}
              className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-sm text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50"
            >
              Avbryt
            </button>
          </form>
        )}

        {(group.playlists ?? []).length === 0 ? (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">Gruppen har inga spellistor ännu.</p>
        ) : (
          <ul className="space-y-2">
            {(group.playlists ?? []).map((pl) => (
              <li key={pl.id}>
                <Link
                  to={`/playlists/${pl.id}`}
                  className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3 hover:border-[rgb(var(--color-accent))]/50 hover:bg-[rgb(var(--color-accent-muted))]/20 transition-colors"
                >
                  <PlaylistIcon className="h-5 w-5 shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">{pl.name}</p>
                    {pl.description && (
                      <p className="truncate text-xs text-[rgb(var(--color-text-muted))]">{pl.description}</p>
                    )}
                  </div>
                  {(pl.trackCount ?? 0) > 0 && (
                    <span className="shrink-0 text-xs text-[rgb(var(--color-text-muted))]">
                      {pl.trackCount} {pl.trackCount === 1 ? 'låt' : 'låtar'}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!myMembership && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <GroupIcon className="h-8 w-8 text-[rgb(var(--color-text-muted))]" aria-hidden />
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Du är inte medlem i den här gruppen. Be en administratör bjuda in dig.
          </p>
        </div>
      )}
    </div>
  );
}
