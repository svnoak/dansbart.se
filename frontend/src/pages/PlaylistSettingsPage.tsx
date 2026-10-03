import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  inviteCollaborator,
  updateCollaborator,
  removeCollaborator,
  transferOwnership,
} from '@/api/generated/playlists/playlists';
import type { PlaylistDto } from '@/api/models/playlistDto';
import type { CollaboratorDto } from '@/api/models/collaboratorDto';
import { BackArrowIcon, GroupIcon } from '@/icons';
import {
  AvatarPlaceholder,
  Badge,
  Button,
  Card,
  IconButton,
  InlineError,
  PageHeader,
  SectionTitle,
  SelectField,
  TextField,
  fieldClassName,
  fieldLabelClassName,
  toast,
} from '@/ui';
import { ConfirmDeleteByName } from '@/components';
import { useAuth } from '@/auth/useAuth';
import { usePlaylistShareLink } from '@/hooks/usePlaylistShareLink';
import { describePlaylistInviteError } from '@/utils/describePlaylistInviteError';

const PERMISSION_LABELS: Record<string, string> = {
  edit: 'Redigera',
  view: 'Se',
};

function statusLabel(status: string | undefined): string {
  if (status === 'pending') return 'Väntande';
  if (status === 'accepted') return 'Accepterad';
  return status ?? '';
}

export function PlaylistSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [playlist, setPlaylist] = useState<PlaylistDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteType, setInviteType] = useState<'user' | 'group'>('user');
  const [inviteValue, setInviteValue] = useState('');
  const [invitePermission, setInvitePermission] = useState<'edit' | 'view'>('view');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Transfer ownership
  const [transferTarget, setTransferTarget] = useState('');
  const [transferConfirm, setTransferConfirm] = useState(false);

  const {
    shareToken,
    shareUrl,
    createLink,
    removeLink,
    copyLink,
    createLinkError,
    copyLinkError,
    removeLinkError,
  } = usePlaylistShareLink(id, playlist?.shareToken);

  // Description
  const [description, setDescription] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  // Visibility
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  // Collaborator row errors, keyed by collaborator id
  const [collaboratorErrors, setCollaboratorErrors] = useState<Record<string, string>>({});

  // Transfer ownership error
  const [transferError, setTransferError] = useState<string | null>(null);

  // Delete error
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getPlaylist(id, { signal: controller.signal })
      .then((pl) => {
        setPlaylist(pl);
        setDescription(pl.description ?? '');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPlaylist(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  if (loading) return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  if (!playlist) return <p className="text-[rgb(var(--color-text-muted))]">Spellistan hittades inte.</p>;

  const isOwner = playlist.viewerCanManage === true;
  const myCollaborator = playlist.collaborators?.find((c) => c.userId === user?.id);
  const canManageShare = isOwner || myCollaborator?.permission === 'edit';

  const acceptedCollaborators: CollaboratorDto[] = (playlist.collaborators ?? []).filter(
    (c) => c.status === 'accepted',
  );

  // ── Description ────────────────────────────────────────────────────────────

  async function handleSaveDescription() {
    if (!id) return;
    setSavingDescription(true);
    setDescriptionError(null);
    try {
      await updatePlaylist(id, { description });
      toast('Beskrivningen är sparad.');
    } catch {
      setDescriptionError('Det gick inte att spara beskrivningen.');
    } finally {
      setSavingDescription(false);
    }
  }

  // ── Visibility ─────────────────────────────────────────────────────────────

  async function handleTogglePublic() {
    if (!id) return;
    setVisibilityError(null);
    try {
      await updatePlaylist(id, { isPublic: !playlist!.isPublic });
      setPlaylist((prev) => (prev ? { ...prev, isPublic: !prev.isPublic } : prev));
      toast(playlist!.isPublic ? 'Spellistan är nu privat' : 'Spellistan är nu offentlig');
    } catch {
      setVisibilityError('Kunde inte ändra synlighet');
    }
  }

  // ── Collaborators ───────────────────────────────────────────────────────────

  function handleInviteTypeChange(type: 'user' | 'group') {
    setInviteType(type);
    setInviteValue('');
    setInviteError(null);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !inviteValue.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      const request =
        inviteType === 'group'
          ? { groupName: inviteValue.trim(), permission: invitePermission }
          : { username: inviteValue.trim(), permission: invitePermission };
      await inviteCollaborator(id, request);
      const updated = await getPlaylist(id);
      setPlaylist(updated);
      setInviteValue('');
      setShowInviteForm(false);
      toast('Inbjudan skickad');
    } catch (error) {
      setInviteError(describePlaylistInviteError(error, inviteType));
    } finally {
      setInviting(false);
    }
  }

  async function handleChangePermission(collaboratorId: string, permission: string) {
    if (!id) return;
    setCollaboratorErrors((prev) => {
      const next = { ...prev };
      delete next[collaboratorId];
      return next;
    });
    try {
      await updateCollaborator(id, collaboratorId, { permission });
      setPlaylist((prev) =>
        prev
          ? {
              ...prev,
              collaborators: prev.collaborators?.map((c) =>
                c.id === collaboratorId ? { ...c, permission } : c,
              ),
            }
          : prev,
      );
    } catch {
      setCollaboratorErrors((prev) => ({ ...prev, [collaboratorId]: 'Kunde inte ändra behörighet' }));
    }
  }

  async function handleRemoveCollaborator(collaboratorId: string) {
    if (!id) return;
    setCollaboratorErrors((prev) => {
      const next = { ...prev };
      delete next[collaboratorId];
      return next;
    });
    try {
      await removeCollaborator(id, collaboratorId);
      setPlaylist((prev) =>
        prev
          ? { ...prev, collaborators: prev.collaborators?.filter((c) => c.id !== collaboratorId) }
          : prev,
      );
      toast('Användare borttagen');
    } catch {
      setCollaboratorErrors((prev) => ({ ...prev, [collaboratorId]: 'Kunde inte ta bort samarbetare' }));
    }
  }

  // ── Transfer ownership ──────────────────────────────────────────────────────

  async function handleTransferOwnership() {
    if (!id || !transferTarget) return;
    setTransferError(null);
    try {
      await transferOwnership(id, { newOwnerId: transferTarget });
      toast('Ägarskap överlåtet');
      navigate(`/playlists/${id}`);
    } catch {
      setTransferError('Kunde inte överlåta ägarskap');
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!id) return;
    setDeleteError(null);
    try {
      await deletePlaylist(id);
      toast('Spellista raderad');
      navigate('/playlists');
    } catch {
      setDeleteError('Kunde inte radera spellista');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Back */}
      <div className="space-y-6">
        <IconButton aria-label="Tillbaka" onClick={() => navigate(`/playlists/${id}`)}>
          <BackArrowIcon className="h-5 w-5" aria-hidden />
        </IconButton>
        <PageHeader title="Inställningar" meta={playlist.name} />
      </div>

      {/* Om spellistan */}
      {canManageShare && (
        <section className="space-y-3">
          <SectionTitle>Om spellistan</SectionTitle>
          <Card className="space-y-3 p-4">
            <div className="space-y-1">
              <label htmlFor="playlist-description" className={fieldLabelClassName}>
                Beskrivning
              </label>
              <textarea
                id="playlist-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescriptionError(null);
                }}
                rows={4}
                className={fieldClassName}
              />
            </div>
            <Button onClick={handleSaveDescription} disabled={savingDescription}>
              Spara
            </Button>
            <InlineError>{descriptionError}</InlineError>
          </Card>
        </section>
      )}

      {/* Synlighet */}
      {isOwner && (
        <section className="space-y-3">
          <SectionTitle>Synlighet</SectionTitle>
          <Card className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--color-text))]">
                {playlist.isPublic ? 'Offentlig' : 'Privat'}
              </p>
              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                {playlist.isPublic
                  ? 'Alla kan se den här spellistan'
                  : 'Bara du och samarbetare ser den'}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleTogglePublic}>
              {playlist.isPublic ? 'Gör privat' : 'Gör offentlig'}
            </Button>
          </Card>
          <InlineError>{visibilityError}</InlineError>
        </section>
      )}

      {/* Delningslänk */}
      {canManageShare && (
        <section className="space-y-3">
          <SectionTitle>Delningslänk</SectionTitle>
          <Card className="space-y-3 p-4">
            {shareToken ? (
              <>
                <p className="text-sm text-[rgb(var(--color-text-muted))]">
                  Alla med länken kan se och spela den här spellistan.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    aria-label="Delningslänk"
                    value={shareUrl ?? ''}
                    className={`${fieldClassName} flex-1 text-sm text-[rgb(var(--color-text-muted))]`}
                  />
                  <Button onClick={copyLink}>Kopiera</Button>
                </div>
                <InlineError>{copyLinkError}</InlineError>
                <Button variant="ghost" size="sm" onClick={removeLink}>
                  Ogiltigförklara länk
                </Button>
                <InlineError>{removeLinkError}</InlineError>
              </>
            ) : (
              <>
                <p className="text-sm text-[rgb(var(--color-text-muted))]">
                  Ingen delningslänk är aktiv.
                </p>
                <Button variant="secondary" onClick={createLink}>
                  Skapa delningslänk
                </Button>
                <InlineError>{createLinkError}</InlineError>
              </>
            )}
          </Card>
        </section>
      )}

      {/* Delad med */}
      <section className="space-y-3">
        <SectionTitle>Delad med</SectionTitle>

        <Card className="divide-y divide-[rgb(var(--color-border))]">
          {/* Owner row */}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {playlist.ownerGroup ? (
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-pill-bg))] text-[rgb(var(--color-text-muted))]"
                  aria-hidden
                >
                  <GroupIcon className="h-5 w-5" />
                </span>
              ) : (
                <AvatarPlaceholder size="md" />
              )}
              <div className="min-w-0">
                {playlist.ownerGroup ? (
                  <p className="text-sm font-semibold text-[rgb(var(--color-text))]">
                    Ägs av gruppen{' '}
                    <Link
                      to={`/groups/${playlist.ownerGroup.id}`}
                      className="text-[rgb(var(--color-accent))] underline decoration-[rgb(var(--color-accent))]/40 underline-offset-4 hover:decoration-[rgb(var(--color-accent))]"
                    >
                      {playlist.ownerGroup.name}
                    </Link>
                  </p>
                ) : (
                  <>
                    <p className="truncate text-sm font-semibold text-[rgb(var(--color-text))]">
                      {playlist.owner?.displayName ?? playlist.owner?.username ?? 'Okänd'}
                    </p>
                    <p className="truncate text-sm text-[rgb(var(--color-text-muted))]">
                      {playlist.owner?.username}
                    </p>
                  </>
                )}
              </div>
            </div>
            <Badge>Ägare</Badge>
          </div>

          {(playlist.collaborators ?? []).map((collab) => {
            const collabName = collab.groupId
              ? collab.groupName
              : (collab.displayName ?? collab.username ?? collab.userId);
            return (
              <div key={collab.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {collab.groupId ? (
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-pill-bg))] text-[rgb(var(--color-text-muted))]"
                        aria-hidden
                      >
                        <GroupIcon className="h-5 w-5" />
                      </span>
                    ) : (
                      <AvatarPlaceholder size="md" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[rgb(var(--color-text))]">{collabName}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-sm text-[rgb(var(--color-text-muted))]">
                        {collab.username}
                        {collab.status === 'pending' && (
                          <Badge variant="muted">{statusLabel(collab.status)}</Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <SelectField
                        id={`collab-permission-${collab.id}`}
                        label={`Behörighet för ${collabName}`}
                        hideLabel
                        value={collab.permission ?? 'view'}
                        onChange={(value) => handleChangePermission(collab.id!, value)}
                        className="w-32"
                      >
                        <option value="edit">Redigera</option>
                        <option value="view">Se</option>
                      </SelectField>
                    ) : (
                      <span className="text-sm text-[rgb(var(--color-text-muted))]">
                        {PERMISSION_LABELS[collab.permission ?? ''] ?? collab.permission}
                      </span>
                    )}
                    {isOwner && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveCollaborator(collab.id!)}>
                        Ta bort
                      </Button>
                    )}
                  </div>
                </div>
                <InlineError>{collaboratorErrors[collab.id!]}</InlineError>
              </div>
            );
          })}
        </Card>

        {/* Invite form — owner only */}
        {isOwner && !showInviteForm && (
          <Button variant="secondary" onClick={() => setShowInviteForm(true)}>
            + Bjud in till spellista
          </Button>
        )}
        {isOwner && showInviteForm && (
          <form onSubmit={handleInvite} className="space-y-3">
            <fieldset className="space-y-1">
              <legend className={fieldLabelClassName}>Bjud in</legend>
              <div className="flex gap-4">
                <label
                  htmlFor="invite-type-user"
                  className="flex min-h-11 items-center gap-2 text-sm text-[rgb(var(--color-text))]"
                >
                  <input
                    type="radio"
                    id="invite-type-user"
                    name="invite-type"
                    checked={inviteType === 'user'}
                    onChange={() => handleInviteTypeChange('user')}
                  />
                  Person
                </label>
                <label
                  htmlFor="invite-type-group"
                  className="flex min-h-11 items-center gap-2 text-sm text-[rgb(var(--color-text))]"
                >
                  <input
                    type="radio"
                    id="invite-type-group"
                    name="invite-type"
                    checked={inviteType === 'group'}
                    onChange={() => handleInviteTypeChange('group')}
                  />
                  Grupp
                </label>
              </div>
            </fieldset>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  id="invite-value"
                  label={inviteType === 'group' ? 'Gruppnamn' : 'Användarnamn'}
                  value={inviteValue}
                  onChange={setInviteValue}
                  autoComplete="off"
                />
              </div>
              <SelectField
                id="invite-permission"
                label="Behörighet"
                value={invitePermission}
                onChange={(value) => setInvitePermission(value as 'edit' | 'view')}
                className="w-32"
              >
                <option value="view">Se</option>
                <option value="edit">Redigera</option>
              </SelectField>
              <Button type="submit" disabled={inviting || !inviteValue.trim()}>
                Bjud in
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteValue('');
                  setInviteError(null);
                }}
              >
                Avbryt
              </Button>
            </div>
          </form>
        )}
        {isOwner && showInviteForm && <InlineError>{inviteError}</InlineError>}
      </section>

      {/* Överlåt ägarskap — owner only */}
      {isOwner && acceptedCollaborators.length > 0 && !playlist.ownerGroup && (
        <section className="space-y-3">
          <SectionTitle>Överlåt ägarskap</SectionTitle>
          <Card className="space-y-3 p-4">
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Du blir redaktör och den valda användaren blir ny ägare.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <SelectField
                id="transfer-target"
                label="Ny ägare"
                value={transferTarget}
                onChange={(value) => {
                  setTransferTarget(value);
                  setTransferConfirm(false);
                  setTransferError(null);
                }}
                className="min-w-48 flex-1"
              >
                <option value="">Välj samarbetare</option>
                {acceptedCollaborators.map((c) => (
                  <option key={c.id} value={c.userId ?? ''}>
                    {c.displayName ?? c.username ?? c.userId}
                  </option>
                ))}
              </SelectField>
              {!transferConfirm ? (
                <Button variant="secondary" disabled={!transferTarget} onClick={() => setTransferConfirm(true)}>
                  Överlåt
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="danger" onClick={handleTransferOwnership}>
                    Bekräfta
                  </Button>
                  <Button variant="ghost" onClick={() => setTransferConfirm(false)}>
                    Avbryt
                  </Button>
                </div>
              )}
            </div>
            <InlineError>{transferError}</InlineError>
          </Card>
        </section>
      )}

      {/* Radera spellista — owner only */}
      {isOwner && (
        <section className="space-y-3">
          <SectionTitle>Farlig zon</SectionTitle>
          <Card className="space-y-3 border-[rgb(var(--color-error))] p-4">
            <p className="text-sm font-semibold text-[rgb(var(--color-text))]">Radera spellista</p>
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Det här går inte att ångra. Skriv in spellistans namn för att bekräfta.
            </p>
            <ConfirmDeleteByName
              name={playlist.name ?? ''}
              buttonLabel="Radera spellista"
              onConfirm={handleDelete}
            />
            <InlineError>{deleteError}</InlineError>
          </Card>
        </section>
      )}
    </div>
  );
}
