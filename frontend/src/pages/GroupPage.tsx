import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGroup, removeMember, createGroupPlaylist } from '@/api/generated/groups/groups';
import type { GroupDto } from '@/api/models/groupDto';
import { useAuth } from '@/auth/useAuth';
import { canOpenGroupSettings, hasGroupPermission } from '@/utils/groupPermissions';
import { describeGroupError } from '@/utils/describeGroupError';
import {
  AvatarPlaceholder,
  Badge,
  Button,
  EmptyState,
  IconButton,
  InlineError,
  LinkButton,
  ListRow,
  PageHeader,
  SectionTitle,
  fieldClassName,
  fieldLabelClassName,
  toast,
} from '@/ui';
import { BackArrowIcon, PlaylistIcon } from '@/icons';

export function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

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
    return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  }

  if (notFound || !group) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[rgb(var(--color-error))]" role="alert">
          Gruppen hittades inte.
        </p>
        <LinkButton to="/groups" variant="secondary">
          Tillbaka till grupper
        </LinkButton>
      </div>
    );
  }

  const members = (group.members ?? []).filter((m) => m.status === 'accepted');
  const myMembership = members.find((m) => m.userId === user?.id);
  const canSeeSettings = canOpenGroupSettings(myMembership);

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

  return (
    <div className="space-y-6">
      <IconButton aria-label="Tillbaka till grupper" onClick={() => navigate('/groups')}>
        <BackArrowIcon className="h-5 w-5" aria-hidden />
      </IconButton>

      <PageHeader
        title={group.name}
        meta={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant={group.isPublic ? 'default' : 'muted'} size="md">
              {group.isPublic ? 'Offentlig' : 'Privat'}
            </Badge>
            {group.memberCount != null && (
              <span>
                {group.memberCount} {group.memberCount === 1 ? 'medlem' : 'medlemmar'}
              </span>
            )}
          </span>
        }
        action={
          canSeeSettings && (
            <LinkButton to={`/groups/${id}/settings`} variant="secondary" size="sm">
              Inställningar för gruppen
            </LinkButton>
          )
        }
      />

      {group.aboutUs && (
        <section>
          <SectionTitle>Om oss</SectionTitle>
          <p className="mt-2 text-base text-[rgb(var(--color-text-muted))]">{group.aboutUs}</p>
        </section>
      )}

      {group.members && (
        <section>
          <SectionTitle>Medlemmar</SectionTitle>
          <ul className="mt-2 space-y-2">
            {members.map((member) => (
              <li key={member.id}>
                <ListRow
                  leading={<AvatarPlaceholder size="md" />}
                  title={member.displayName ?? member.username}
                >
                  {member.isAdmin && <Badge>Administratör</Badge>}
                </ListRow>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle>Gruppens spellistor</SectionTitle>
        {group.playlists && group.playlists.length > 0 ? (
          <ul className="space-y-2">
            {group.playlists.map((playlist) => (
              <li key={playlist.id}>
                <ListRow
                  to={`/playlists/${playlist.id}`}
                  icon={<PlaylistIcon className="h-5 w-5" aria-hidden />}
                  title={playlist.name}
                  subtitle={playlist.description}
                  trailing={
                    <span>
                      {playlist.trackCount ?? 0} {playlist.trackCount === 1 ? 'låt' : 'låtar'}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Gruppen har inga spellistor ännu.</EmptyState>
        )}

        {hasGroupPermission(myMembership, 'canManagePlaylists') &&
          (!creatingPlaylist ? (
            <Button variant="secondary" onClick={() => setCreatingPlaylist(true)}>
              Ny spellista
            </Button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreatePlaylist();
              }}
              className="space-y-2"
            >
              <div className="space-y-1">
                <label htmlFor="group-playlist-name" className={fieldLabelClassName}>
                  Spellistans namn
                </label>
                <input
                  id="group-playlist-name"
                  value={playlistName}
                  onChange={(e) => {
                    setPlaylistName(e.target.value);
                    setCreatePlaylistError(null);
                  }}
                  className={fieldClassName}
                />
              </div>
              <InlineError>{createPlaylistError}</InlineError>
              <div className="flex gap-2">
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
          ))}
      </section>

      {myMembership ? (
        <section className="space-y-2">
          {!confirmingLeave ? (
            <Button variant="secondary" onClick={() => setConfirmingLeave(true)}>
              Lämna gruppen
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[rgb(var(--color-text))]">Vill du lämna gruppen?</span>
              <Button variant="danger" disabled={leaving} onClick={handleLeave}>
                Ja, lämna gruppen
              </Button>
              <Button variant="ghost" disabled={leaving} onClick={() => setConfirmingLeave(false)}>
                Avbryt
              </Button>
            </div>
          )}
          {leaveError && (
            <p className="text-sm text-[rgb(var(--color-error))]" role="alert">
              {leaveError}
            </p>
          )}
        </section>
      ) : authLoading ? null : !isAuthenticated ? (
        <EmptyState action={<LinkButton to="/login">Logga in</LinkButton>}>
          Logga in för att gå med i grupper.
        </EmptyState>
      ) : (
        <EmptyState>Du är inte medlem i gruppen. Be en administratör att bjuda in dig.</EmptyState>
      )}
    </div>
  );
}
