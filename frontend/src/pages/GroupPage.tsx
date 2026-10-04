import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getGroup, removeMember, createGroupPlaylist } from '@/api/generated/groups/groups';
import type { GroupDto } from '@/api/models/groupDto';
import { useAuth } from '@/auth/useAuth';
import { useTheme } from '@/theme/useTheme';
import { getStyleColor } from '@/styles/danceStyleColors';
import { canOpenGroupSettings, hasGroupPermission } from '@/utils/groupPermissions';
import { describeGroupError } from '@/utils/describeGroupError';
import { Badge, Button, Card, EmptyState, InlineError, RowSkeleton, toast } from '@/ui';
import { ChevronLeftIcon, ChevronRightIcon, PlaylistIcon, PlusIcon, SettingsIcon, StarMarkIcon } from '@/icons';

const LIST_CLASS =
  'overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]';
const ROW_CLASS =
  'flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--color-border))] last:border-b-0';
const INPUT_CLASS =
  'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';
const OUTLINE_LINK_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-transparent px-4 py-2 text-sm font-semibold text-[rgb(var(--color-text))] transition-colors hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';

function initialOf(name: string | undefined): string {
  return (name ?? '').trim().charAt(0).toUpperCase() || '?';
}

export function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [group, setGroup] = useState<GroupDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [createPlaylistError, setCreatePlaylistError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getGroup(id)
      .then((data) => {
        if (!cancelled) setGroup(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <RowSkeleton rows={3} label="Laddar gruppen" />;
  }

  if (notFound || !group) {
    return (
      <div className="space-y-4">
        <p className="text-[15px] font-medium text-[rgb(var(--color-error))]" role="alert">
          Gruppen hittades inte.
        </p>
        <Link
          to="/groups"
          className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-[rgb(var(--color-link))] hover:underline"
        >
          <ChevronLeftIcon className="h-5 w-5" aria-hidden />
          Tillbaka till grupper
        </Link>
      </div>
    );
  }

  const members = (group.members ?? []).filter((m) => m.status === 'accepted');
  const myMembership = members.find((m) => m.userId === user?.id);
  const canSeeSettings = canOpenGroupSettings(myMembership);
  const canManagePlaylists = hasGroupPermission(myMembership, 'canManagePlaylists');

  async function handleLeave() {
    if (!group?.id || !myMembership?.id) return;
    setLeaving(true);
    try {
      await removeMember(group.id, myMembership.id);
      toast('Du har lämnat gruppen.');
      navigate('/groups');
    } catch (error) {
      setLeaveError(describeGroupError(error, 'leave'));
      setConfirmingLeave(false);
      setLeaving(false);
    }
  }

  async function handleCreatePlaylist() {
    if (!group?.id || !playlistName.trim()) return;
    setSavingPlaylist(true);
    setCreatePlaylistError(null);
    try {
      const created = await createGroupPlaylist(group.id, { name: playlistName.trim() });
      setGroup((prev) =>
        prev ? { ...prev, playlists: [...(prev.playlists ?? []), created] } : prev,
      );
      setPlaylistName('');
      setCreatingPlaylist(false);
    } catch {
      setCreatePlaylistError('Det gick inte att skapa spellistan.');
    } finally {
      setSavingPlaylist(false);
    }
  }

  const metaParts: string[] = [];
  if (group.memberCount != null) {
    metaParts.push(`${group.memberCount} ${group.memberCount === 1 ? 'medlem' : 'medlemmar'}`);
  }
  metaParts.push(group.isPublic ? 'Offentlig' : 'Privat');

  const hasPlaylists = !!group.playlists && group.playlists.length > 0;

  return (
    <div className="space-y-8">
      <Link
        to="/groups"
        className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
      >
        <ChevronLeftIcon className="h-5 w-5" aria-hidden />
        Grupper
      </Link>

      <Card className="p-7">
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <span
            className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent-muted))] text-[44px] font-bold text-[rgb(var(--color-text))]"
            aria-hidden
          >
            {initialOf(group.name)}
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
              {group.name}
            </h1>
            {group.aboutUs && (
              <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text))]">{group.aboutUs}</p>
            )}
            <p className="text-[15px] text-[rgb(var(--color-text-muted))]">{metaParts.join(' · ')}</p>

            {(canManagePlaylists || canSeeSettings || myMembership) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {canManagePlaylists && !creatingPlaylist && (
                  <Button onClick={() => setCreatingPlaylist(true)}>
                    <PlusIcon className="h-4 w-4" aria-hidden />
                    Ny spellista
                  </Button>
                )}
                {canSeeSettings && (
                  <Link to={`/groups/${id}/settings`} className={OUTLINE_LINK_CLASS}>
                    <SettingsIcon className="h-4 w-4" aria-hidden />
                    Inställningar
                  </Link>
                )}
                {myMembership && !confirmingLeave && (
                  <Button variant="outline" onClick={() => setConfirmingLeave(true)}>
                    Lämna gruppen
                  </Button>
                )}
              </div>
            )}

            {myMembership && confirmingLeave && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[15px] text-[rgb(var(--color-text))]">Vill du lämna gruppen?</span>
                <Button variant="danger" disabled={leaving} onClick={handleLeave}>
                  Ja, lämna gruppen
                </Button>
                <Button variant="ghost" disabled={leaving} onClick={() => setConfirmingLeave(false)}>
                  Avbryt
                </Button>
              </div>
            )}
            <InlineError>{leaveError}</InlineError>
          </div>
        </div>
      </Card>

      <section className="space-y-3" aria-labelledby="group-playlists-title">
        <h2 id="group-playlists-title" className="text-xl font-bold text-[rgb(var(--color-text))]">
          Gruppens spellistor
        </h2>

        {canManagePlaylists && creatingPlaylist && (
          <Card className="p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreatePlaylist();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="group-playlist-name"
                  className="block text-sm font-medium text-[rgb(var(--color-text))]"
                >
                  Spellistans namn
                </label>
                <input
                  id="group-playlist-name"
                  value={playlistName}
                  autoFocus
                  onChange={(e) => {
                    setPlaylistName(e.target.value);
                    setCreatePlaylistError(null);
                  }}
                  className={INPUT_CLASS}
                />
              </div>
              <InlineError>{createPlaylistError}</InlineError>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={savingPlaylist || !playlistName.trim()}>
                  Skapa spellista
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={savingPlaylist}
                  onClick={() => {
                    setCreatingPlaylist(false);
                    setPlaylistName('');
                    setCreatePlaylistError(null);
                  }}
                >
                  Avbryt
                </Button>
              </div>
            </form>
          </Card>
        )}

        {hasPlaylists ? (
          <ul className={LIST_CLASS}>
            {group.playlists!.map((playlist) => {
              const color = getStyleColor(null);
              const trackCount = playlist.trackCount ?? 0;
              const second = [
                `${trackCount} ${trackCount === 1 ? 'låt' : 'låtar'}`,
                playlist.description,
              ].filter(Boolean);
              return (
                <li key={playlist.id} className={ROW_CLASS}>
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)]"
                    style={{
                      backgroundColor: isDark ? color.bgDark : color.bg,
                      color: isDark ? color.textDark : color.text,
                    }}
                    aria-hidden
                  >
                    <StarMarkIcon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/playlists/${playlist.id}`}
                      className="block truncate text-[15px] font-bold text-[rgb(var(--color-text))] hover:underline"
                    >
                      {playlist.name}
                    </Link>
                    <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">
                      {second.join(' · ')}
                    </p>
                  </div>
                  <Link
                    to={`/playlists/${playlist.id}`}
                    aria-label={`Öppna ${playlist.name ?? 'spellistan'}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-accent-muted))] hover:text-[rgb(var(--color-text))]"
                  >
                    <ChevronRightIcon className="h-5 w-5" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<PlaylistIcon className="h-7 w-7" aria-hidden />}
            title="Gruppen har inga spellistor ännu."
            description={
              canManagePlaylists ? 'Skapa den första med Ny spellista här ovanför.' : undefined
            }
          />
        )}
      </section>

      {group.members && (
        <section className="space-y-3" aria-labelledby="group-members-title">
          <h2 id="group-members-title" className="text-xl font-bold text-[rgb(var(--color-text))]">
            Medlemmar
          </h2>
          <ul className={LIST_CLASS}>
            {members.map((member) => {
              const memberName = member.displayName ?? member.username;
              return (
                <li key={member.id} className={ROW_CLASS}>
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent-muted))] text-base font-bold text-[rgb(var(--color-text))]"
                    aria-hidden
                  >
                    {initialOf(memberName)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-[rgb(var(--color-text))]">
                    {memberName}
                  </span>
                  {member.isAdmin && <Badge>Administratör</Badge>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!myMembership &&
        (authLoading ? null : !isAuthenticated ? (
          <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
            <Link to="/login" className="font-medium text-[rgb(var(--color-link))] hover:underline">
              Logga in
            </Link>{' '}
            för att gå med i grupper.
          </p>
        ) : (
          <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
            Du är inte medlem i gruppen. Be en administratör att bjuda in dig.
          </p>
        ))}
    </div>
  );
}
