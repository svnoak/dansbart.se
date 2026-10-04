import { useEffect, useState, type ReactNode } from 'react';
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
import { ChevronLeftIcon, CloseIcon, PlaylistIcon, StarMarkIcon } from '@/icons';
import { Button, Card, EmptyState, IconButton, InlineError, RowSkeleton, TextField, toast } from '@/ui';
import { ConfirmDeleteByName } from '@/components';
import { useAuth } from '@/auth/useAuth';
import { usePlaylistShareLink } from '@/hooks/usePlaylistShareLink';
import { describePlaylistInviteError } from '@/utils/describePlaylistInviteError';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';

const PERMISSION_LABELS: Record<string, string> = {
  edit: 'Redigera',
  view: 'Se',
};

const selectClass =
  'min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';

const inputClass =
  'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

function collaboratorStatus(collab: CollaboratorDto): string {
  if (collab.status === 'pending') return 'Inbjuden · väntar på svar';
  if (collab.acceptedAt) {
    const date = formatDate(collab.acceptedAt);
    if (date) return `Samarbetare sedan ${date}`;
  }
  return 'Samarbetare';
}

function initialOf(name: string | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

// ── Layout pieces ─────────────────────────────────────────────────────────────

interface SettingsSectionProps {
  title: string;
  description: string;
  danger?: boolean;
  children: ReactNode;
}

/** One settings section: heading and explanation on the left, the controls in a card on the right. */
function SettingsSection({ title, description, danger = false, children }: SettingsSectionProps) {
  return (
    <section className="grid gap-4 border-t border-[rgb(var(--color-border))] pt-6 md:grid-cols-[260px_minmax(0,1fr)] md:gap-8">
      <div className="space-y-1">
        <h2
          className={`text-lg font-bold ${
            danger ? 'text-[rgb(var(--color-error))]' : 'text-[rgb(var(--color-text))]'
          }`}
        >
          {title}
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{description}</p>
      </div>
      <Card className={`p-5 ${danger ? 'border-[rgb(var(--color-error))]' : ''}`}>{children}</Card>
    </section>
  );
}

interface AvatarProps {
  name: string | undefined;
}

function Avatar({ name }: AvatarProps) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent-muted))] text-[15px] font-bold text-[rgb(var(--color-text))]"
      aria-hidden
    >
      {initialOf(name)}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PlaylistSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const [playlist, setPlaylist] = useState<PlaylistDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite form
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

  // About
  const [name, setName] = useState('');
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
        setName(pl.name ?? '');
        setDescription(pl.description ?? '');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPlaylist(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  if (loading) return <RowSkeleton rows={4} label="Laddar inställningarna" />;
  if (!playlist) {
    return (
      <EmptyState
        icon={<PlaylistIcon className="h-7 w-7" aria-hidden />}
        title="Spellistan hittades inte"
        description="Den kan ha tagits bort, eller så har du inte tillgång till den."
        action={
          <Link
            to="/playlists"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))]"
          >
            Till spellistor
          </Link>
        }
      />
    );
  }

  const isOwner = playlist.viewerCanManage === true;
  const myCollaborator = playlist.collaborators?.find((c) => c.userId === user?.id);
  const canManageShare = isOwner || myCollaborator?.permission === 'edit';

  const acceptedCollaborators: CollaboratorDto[] = (playlist.collaborators ?? []).filter(
    (c) => c.status === 'accepted',
  );

  const isDark = theme === 'dark';
  const styleColor = playlist.danceStyle ? getStyleColor(playlist.danceStyle) : null;
  const tileStyle: React.CSSProperties | undefined = styleColor
    ? {
        backgroundColor: isDark ? styleColor.bgDark : styleColor.bg,
        color: isDark ? styleColor.textDark : styleColor.text,
      }
    : undefined;

  // ── About ───────────────────────────────────────────────────────────────────

  async function handleSaveDescription() {
    if (!id) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSavingDescription(true);
    setDescriptionError(null);
    const patch: { name?: string; description: string } = { description };
    if (trimmedName !== (playlist!.name ?? '')) patch.name = trimmedName;
    try {
      await updatePlaylist(id, patch);
      if (patch.name) setPlaylist((prev) => (prev ? { ...prev, name: patch.name } : prev));
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

  const ownerName = playlist.owner?.displayName ?? playlist.owner?.username ?? 'Okänd';
  const segmentClass = (active: boolean) =>
    `inline-flex min-h-10 items-center rounded-[var(--radius-full)] px-3.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] ${
      active
        ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))]'
        : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
    }`;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        to={`/playlists/${id}`}
        className="inline-flex min-h-11 max-w-full items-center gap-1 pr-2 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
      >
        <ChevronLeftIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{playlist.name}</span>
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-lg)] ${
            styleColor ? '' : 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text-muted))]'
          }`}
          style={tileStyle}
          aria-hidden
        >
          <StarMarkIcon className="h-7 w-7" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[rgb(var(--color-text-muted))]">Inställningar</p>
          <h1 className="truncate text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            {playlist.name}
          </h1>
        </div>
      </div>

      {/* Om spellistan */}
      {canManageShare && (
        <SettingsSection
          title="Om spellistan"
          description="Namnet och beskrivningen syns för alla som kan se spellistan."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveDescription();
            }}
            className="space-y-4"
          >
            <TextField id="playlist-name" label="Namn" value={name} onChange={setName} />
            <div className="space-y-1">
              <label
                htmlFor="playlist-description"
                className="block text-sm font-medium text-[rgb(var(--color-text))]"
              >
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
                className={inputClass}
              />
            </div>
            <Button type="submit" disabled={savingDescription || !name.trim()}>
              Spara
            </Button>
            <InlineError>{descriptionError}</InlineError>
          </form>
        </SettingsSection>
      )}

      {/* Synlighet och delning */}
      {canManageShare && (
        <SettingsSection
          title="Synlighet och delning"
          description="Välj vem som kan hitta spellistan och skapa en länk att skicka vidare."
        >
          <div className="space-y-5">
            {isOwner && (
              <div className="space-y-2">
                <label
                  htmlFor="playlist-public"
                  className="flex min-h-11 cursor-pointer items-center justify-between gap-4"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-[rgb(var(--color-text))]">
                      Offentlig spellista
                    </span>
                    <span className="block text-[13px] text-[rgb(var(--color-text-muted))]">
                      {playlist.isPublic
                        ? 'Alla kan hitta och spela den här spellistan.'
                        : 'Bara du och de du delar med ser den.'}
                    </span>
                  </span>
                  <input
                    id="playlist-public"
                    type="checkbox"
                    checked={playlist.isPublic === true}
                    onChange={handleTogglePublic}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgb(var(--color-focus))] ${
                      playlist.isPublic ? 'bg-[rgb(var(--color-selected))]' : 'bg-[rgb(var(--color-border-strong))]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        playlist.isPublic ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </label>
                <InlineError>{visibilityError}</InlineError>
              </div>
            )}

            {isOwner && <div className="border-t border-[rgb(var(--color-border))]" />}

            <div className="space-y-3">
              <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">Delningslänk</p>
              {shareToken ? (
                <>
                  <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                    Alla med länken kan se och spela den här spellistan, även utan konto.
                  </p>
                  <label htmlFor="playlist-share-url" className="sr-only">
                    Delningslänk
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id="playlist-share-url"
                      readOnly
                      value={shareUrl ?? ''}
                      onFocus={(e) => e.currentTarget.select()}
                      className={`${inputClass} min-w-0 flex-1`}
                    />
                    <Button variant="secondary" onClick={copyLink}>
                      Kopiera
                    </Button>
                  </div>
                  <InlineError>{copyLinkError}</InlineError>
                  <div className="space-y-2">
                    <Button variant="outline" onClick={removeLink}>
                      Ta bort länk
                    </Button>
                    <InlineError>{removeLinkError}</InlineError>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                    Ingen delningslänk är aktiv.
                  </p>
                  <div className="space-y-2">
                    <Button variant="outline" onClick={createLink}>
                      Skapa länk
                    </Button>
                    <InlineError>{createLinkError}</InlineError>
                  </div>
                </>
              )}
            </div>
          </div>
        </SettingsSection>
      )}

      {/* Delad med */}
      <SettingsSection
        title="Delad med"
        description="Personer och grupper som kan se eller redigera spellistan."
      >
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {/* Owner row */}
          <li className="flex items-center gap-3 py-3 first:pt-0">
            <Avatar name={playlist.ownerGroup ? playlist.ownerGroup.name : ownerName} />
            <div className="min-w-0 flex-1">
              {playlist.ownerGroup ? (
                <p className="truncate text-[15px] font-bold text-[rgb(var(--color-text))]">
                  Ägs av gruppen{' '}
                  <Link
                    to={`/groups/${playlist.ownerGroup.id}`}
                    className="text-[rgb(var(--color-link))] hover:underline"
                  >
                    {playlist.ownerGroup.name}
                  </Link>
                </p>
              ) : (
                <p className="truncate text-[15px] font-bold text-[rgb(var(--color-text))]">{ownerName}</p>
              )}
              <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">
                {playlist.ownerGroup ? 'Ägare' : (playlist.owner?.username ? `${playlist.owner.username} · Ägare` : 'Ägare')}
              </p>
            </div>
            <span className="inline-flex h-7 shrink-0 items-center rounded-[var(--radius-full)] border border-[rgb(var(--color-border))] px-2.5 text-[13px] font-medium text-[rgb(var(--color-text-muted))]">
              Ägare
            </span>
          </li>

          {(playlist.collaborators ?? []).map((collab) => {
            const collabName = collab.groupId
              ? collab.groupName
              : (collab.displayName ?? collab.username ?? collab.userId);
            return (
              <li key={collab.id} className="space-y-2 py-3 last:pb-0">
                <div className="flex items-center gap-3">
                  <Avatar name={collabName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-[rgb(var(--color-text))]">{collabName}</p>
                    <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">
                      {collaboratorStatus(collab)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isOwner ? (
                      <>
                        <label htmlFor={`permission-${collab.id}`} className="sr-only">
                          Behörighet för {collabName}
                        </label>
                        <select
                          id={`permission-${collab.id}`}
                          value={collab.permission ?? 'view'}
                          onChange={(e) => handleChangePermission(collab.id!, e.target.value)}
                          className={selectClass}
                        >
                          <option value="edit">Redigera</option>
                          <option value="view">Se</option>
                        </select>
                        <IconButton
                          aria-label={`Ta bort ${collabName}`}
                          onClick={() => handleRemoveCollaborator(collab.id!)}
                          className="text-[rgb(var(--color-text-muted))]"
                        >
                          <CloseIcon className="h-5 w-5" aria-hidden />
                        </IconButton>
                      </>
                    ) : (
                      <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                        {PERMISSION_LABELS[collab.permission ?? ''] ?? collab.permission}
                      </span>
                    )}
                  </div>
                </div>
                <InlineError>{collaboratorErrors[collab.id!]}</InlineError>
              </li>
            );
          })}
        </ul>

        {/* Invite form — owner only */}
        {isOwner && (
          <form onSubmit={handleInvite} className="mt-4 space-y-3 border-t border-[rgb(var(--color-border))] pt-4">
            <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">Bjud in</p>
            <div
              role="group"
              aria-label="Bjud in en användare eller en grupp"
              className="inline-flex rounded-[var(--radius-full)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] p-0.5"
            >
              <button
                type="button"
                aria-pressed={inviteType === 'user'}
                onClick={() => handleInviteTypeChange('user')}
                className={segmentClass(inviteType === 'user')}
              >
                Användare
              </button>
              <button
                type="button"
                aria-pressed={inviteType === 'group'}
                onClick={() => handleInviteTypeChange('group')}
                className={segmentClass(inviteType === 'group')}
              >
                Grupp
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 basis-48">
                <TextField
                  id="invite-value"
                  label={inviteType === 'group' ? 'Gruppnamn' : 'Användarnamn'}
                  value={inviteValue}
                  onChange={(value) => {
                    setInviteValue(value);
                    setInviteError(null);
                  }}
                  autoComplete="off"
                />
              </div>
              <label htmlFor="invite-permission" className="sr-only">
                Behörighet
              </label>
              <select
                id="invite-permission"
                value={invitePermission}
                onChange={(e) => setInvitePermission(e.target.value as 'edit' | 'view')}
                className={selectClass}
              >
                <option value="view">Se</option>
                <option value="edit">Redigera</option>
              </select>
              <Button type="submit" disabled={inviting || !inviteValue.trim()}>
                Bjud in
              </Button>
            </div>
            <InlineError>{inviteError}</InlineError>
          </form>
        )}
      </SettingsSection>

      {/* Överlåt ägarskap — owner only */}
      {isOwner && acceptedCollaborators.length > 0 && !playlist.ownerGroup && (
        <SettingsSection
          title="Överlåt ägarskap"
          description="Du blir redaktör och den valda användaren blir ny ägare."
        >
          <div className="space-y-3">
            <label htmlFor="transfer-target" className="sr-only">
              Ny ägare
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                id="transfer-target"
                value={transferTarget}
                onChange={(e) => {
                  setTransferTarget(e.target.value);
                  setTransferConfirm(false);
                  setTransferError(null);
                }}
                className={`${selectClass} min-w-0 flex-1`}
              >
                <option value="">Välj samarbetare</option>
                {acceptedCollaborators.map((c) => (
                  <option key={c.id} value={c.userId ?? ''}>
                    {c.displayName ?? c.username ?? c.userId}
                  </option>
                ))}
              </select>
              {!transferConfirm ? (
                <Button variant="outline" disabled={!transferTarget} onClick={() => setTransferConfirm(true)}>
                  Överlåt
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="danger" onClick={handleTransferOwnership}>
                    Bekräfta
                  </Button>
                  <Button variant="outline" onClick={() => setTransferConfirm(false)}>
                    Avbryt
                  </Button>
                </div>
              )}
            </div>
            {transferConfirm && (
              <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                Du kan inte ta tillbaka ägarskapet själv efteråt.
              </p>
            )}
            <InlineError>{transferError}</InlineError>
          </div>
        </SettingsSection>
      )}

      {/* Radera spellista — owner only */}
      {isOwner && (
        <SettingsSection
          title="Radera spellista"
          description="Det här går inte att ångra. Skriv in spellistans namn för att bekräfta."
          danger
        >
          <div className="space-y-3">
            <ConfirmDeleteByName
              name={playlist.name ?? ''}
              buttonLabel="Radera spellista"
              onConfirm={handleDelete}
            />
            <InlineError>{deleteError}</InlineError>
          </div>
        </SettingsSection>
      )}
    </div>
  );
}
