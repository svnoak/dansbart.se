import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteDanceList,
  getDanceList,
  inviteDanceListCollaborator,
  removeDanceListCollaborator,
  transferDanceListOwnership,
  updateDanceList,
  updateDanceListCollaborator,
} from '@/api/generated/dance-lists/dance-lists';
import type { CollaboratorDto } from '@/api/models/collaboratorDto';
import type { DanceListDto } from '@/api/models/danceListDto';
import { ChevronLeftIcon, CloseIcon, QueueListIcon } from '@/icons';
import { Button, EmptyState, IconButton, InlineError, RowSkeleton, TextField, toast } from '@/ui';
import { ConfirmDeleteByName, GuestCodePanel, SettingsSection } from '@/components';
import { useDanceListShareLink } from '@/hooks/useDanceListShareLink';
import { describePlaylistInviteError } from '@/utils/describePlaylistInviteError';

const PERMISSION_LABELS: Record<string, string> = {
  edit: 'Redigera',
  view: 'Se',
};

const selectClass =
  'min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';

const inputClass =
  'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';

const linkButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';

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

function Avatar({ name }: { name: string | undefined }) {
  const trimmed = (name ?? '').trim();
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent-muted))] text-[15px] font-bold text-[rgb(var(--color-text))]"
      aria-hidden
    >
      {trimmed ? trimmed.charAt(0).toUpperCase() : '?'}
    </span>
  );
}

export function DanceListSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [danceList, setDanceList] = useState<DanceListDto | null>(null);
  const [loading, setLoading] = useState(true);

  // About
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [savingAbout, setSavingAbout] = useState(false);
  const [aboutError, setAboutError] = useState<string | null>(null);

  // Visibility
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  // Invite form
  const [inviteType, setInviteType] = useState<'user' | 'group'>('user');
  const [inviteValue, setInviteValue] = useState('');
  const [invitePermission, setInvitePermission] = useState<'edit' | 'view'>('view');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [collaboratorErrors, setCollaboratorErrors] = useState<Record<string, string>>({});

  // Transfer ownership
  const [transferTarget, setTransferTarget] = useState('');
  const [transferConfirm, setTransferConfirm] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Delete
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    shareToken,
    shareUrl,
    createLink,
    removeLink,
    copyLink,
    createLinkError,
    copyLinkError,
    removeLinkError,
  } = useDanceListShareLink(id, danceList?.shareToken);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getDanceList(id, { signal: controller.signal })
      .then((list) => {
        setDanceList(list);
        setName(list.name ?? '');
        setDescription(list.description ?? '');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setDanceList(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  if (loading) return <RowSkeleton rows={4} label="Laddar inställningarna" />;

  if (!danceList || danceList.viewerCanManage !== true) {
    return (
      <EmptyState
        icon={<QueueListIcon className="h-7 w-7" aria-hidden />}
        title={danceList ? 'Du kan inte ändra inställningarna' : 'Danslistan hittades inte'}
        description={
          danceList
            ? 'Bara de som får redigera danslistan kan ändra dess inställningar.'
            : 'Den kan ha tagits bort, eller så har du inte tillgång till den.'
        }
        action={
          <Link to={danceList && id ? `/dance-lists/${id}` : '/dance-lists'} className={linkButtonClass}>
            {danceList ? 'Till danslistan' : 'Till danslistorna'}
          </Link>
        }
      />
    );
  }

  const isOwner = danceList.viewerHasFullControl === true;
  const ownerGroup = danceList.ownerGroup;
  const ownerName = danceList.owner?.displayName ?? danceList.owner?.username ?? 'Okänd';
  const acceptedUserCollaborators = (danceList.collaborators ?? []).filter(
    (c) => c.status === 'accepted' && c.userId,
  );

  async function reload() {
    if (!id) return;
    const updated = await getDanceList(id);
    setDanceList(updated);
  }

  // ── About ───────────────────────────────────────────────────────────────────

  async function handleSaveAbout() {
    if (!id) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSavingAbout(true);
    setAboutError(null);
    const patch = isOwner ? { name: trimmedName, description } : { name: trimmedName };
    try {
      await updateDanceList(id, patch);
      setDanceList((prev) => (prev ? { ...prev, ...patch } : prev));
      toast('Ändringarna är sparade.');
    } catch {
      setAboutError('Det gick inte att spara ändringarna.');
    } finally {
      setSavingAbout(false);
    }
  }

  // ── Visibility ──────────────────────────────────────────────────────────────

  async function handleTogglePublic() {
    if (!id || !danceList) return;
    const nextPublic = danceList.isPublic !== true;
    setVisibilityError(null);
    try {
      await updateDanceList(id, { isPublic: nextPublic });
      setDanceList((prev) => (prev ? { ...prev, isPublic: nextPublic } : prev));
      toast(nextPublic ? 'Danslistan är nu offentlig' : 'Danslistan är nu privat');
    } catch {
      setVisibilityError('Det gick inte att ändra synligheten.');
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
      await inviteDanceListCollaborator(id, request);
      await reload();
      setInviteValue('');
      toast('Inbjudan skickad');
    } catch (error) {
      setInviteError(describePlaylistInviteError(error, inviteType, 'danceList'));
    } finally {
      setInviting(false);
    }
  }

  function clearCollaboratorError(collaboratorId: string) {
    setCollaboratorErrors((prev) => {
      const next = { ...prev };
      delete next[collaboratorId];
      return next;
    });
  }

  async function handleChangePermission(collaboratorId: string, permission: string) {
    if (!id) return;
    clearCollaboratorError(collaboratorId);
    try {
      await updateDanceListCollaborator(id, collaboratorId, { permission });
      setDanceList((prev) =>
        prev
          ? {
              ...prev,
              collaborators: prev.collaborators?.map((c) => (c.id === collaboratorId ? { ...c, permission } : c)),
            }
          : prev,
      );
    } catch {
      setCollaboratorErrors((prev) => ({ ...prev, [collaboratorId]: 'Det gick inte att ändra behörigheten.' }));
    }
  }

  async function handleRemoveCollaborator(collaboratorId: string) {
    if (!id) return;
    clearCollaboratorError(collaboratorId);
    try {
      await removeDanceListCollaborator(id, collaboratorId);
      setDanceList((prev) =>
        prev ? { ...prev, collaborators: prev.collaborators?.filter((c) => c.id !== collaboratorId) } : prev,
      );
      toast('Borttagen från danslistan');
    } catch {
      setCollaboratorErrors((prev) => ({ ...prev, [collaboratorId]: 'Det gick inte att ta bort samarbetaren.' }));
    }
  }

  // ── Transfer ownership ──────────────────────────────────────────────────────

  async function handleTransferOwnership() {
    if (!id || !transferTarget) return;
    setTransferError(null);
    try {
      await transferDanceListOwnership(id, { newOwnerId: transferTarget });
      toast('Ägarskapet är överlåtet');
      navigate(`/dance-lists/${id}`);
    } catch {
      setTransferError('Det gick inte att överlåta ägarskapet.');
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!id) return;
    setDeleteError(null);
    try {
      await deleteDanceList(id);
      toast('Danslistan är raderad');
      navigate(ownerGroup?.id ? `/groups/${ownerGroup.id}` : '/dance-lists');
    } catch {
      setDeleteError('Det gick inte att radera danslistan.');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const privateDescription = ownerGroup
    ? 'Bara gruppens medlemmar och de ni delar med ser den.'
    : 'Bara du och de du delar med ser den.';

  const segmentClass = (active: boolean) =>
    `inline-flex min-h-10 items-center rounded-[var(--radius-full)] px-3.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] ${
      active
        ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))]'
        : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
    }`;

  return (
    <div className="space-y-6">
      <Link
        to={`/dance-lists/${id}`}
        className="inline-flex min-h-11 max-w-full items-center gap-1 pr-2 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
      >
        <ChevronLeftIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{danceList.name}</span>
      </Link>

      <div className="flex items-center gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text-muted))]"
          aria-hidden
        >
          <QueueListIcon className="h-7 w-7" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[rgb(var(--color-text-muted))]">Inställningar</p>
          <h1 className="truncate text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            {danceList.name}
          </h1>
        </div>
      </div>

      {/* Om danslistan */}
      <SettingsSection
        title="Om danslistan"
        description="Namnet och beskrivningen syns för alla som kan se danslistan."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveAbout();
          }}
          className="space-y-4"
        >
          <TextField id="dance-list-name" label="Namn" value={name} onChange={setName} />
          {isOwner && (
            <div className="space-y-1">
              <label
                htmlFor="dance-list-description"
                className="block text-sm font-medium text-[rgb(var(--color-text))]"
              >
                Beskrivning
              </label>
              <textarea
                id="dance-list-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setAboutError(null);
                }}
                rows={4}
                className={inputClass}
              />
            </div>
          )}
          <Button type="submit" disabled={savingAbout || !name.trim()}>
            Spara
          </Button>
          <InlineError>{aboutError}</InlineError>
        </form>
      </SettingsSection>

      {/* Synlighet och delning */}
      <SettingsSection
        title="Synlighet och delning"
        description="Välj vem som kan hitta danslistan och skapa en länk att skicka vidare."
      >
        <div className="space-y-5">
          {isOwner && (
            <div className="space-y-2">
              <label
                htmlFor="dance-list-public"
                className="flex min-h-11 cursor-pointer items-center justify-between gap-4"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-[rgb(var(--color-text))]">
                    Offentlig danslista
                  </span>
                  <span className="block text-[13px] text-[rgb(var(--color-text-muted))]">
                    {danceList.isPublic ? 'Alla kan hitta och se den här danslistan.' : privateDescription}
                  </span>
                </span>
                <input
                  id="dance-list-public"
                  type="checkbox"
                  checked={danceList.isPublic === true}
                  onChange={handleTogglePublic}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgb(var(--color-focus))] ${
                    danceList.isPublic ? 'bg-[rgb(var(--color-selected))]' : 'bg-[rgb(var(--color-border-strong))]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      danceList.isPublic ? 'translate-x-5' : 'translate-x-0.5'
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
                  Alla med länken kan se danslistan, även utan konto.
                </p>
                <label htmlFor="dance-list-share-url" className="sr-only">
                  Delningslänk
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="dance-list-share-url"
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
                <p className="text-[13px] text-[rgb(var(--color-text-muted))]">Ingen delningslänk är aktiv.</p>
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

      {/* Låt andra lägga till */}
      {isOwner && id && (
        <SettingsSection
          title="Låt andra lägga till"
          description="En kod och en QR-kod till danskvällen eller kursen. Den som har koden kan lägga till danser, men inte ändra något annat."
        >
          <GuestCodePanel
            kind="danceList"
            listId={id}
            code={danceList.guestCode ?? null}
            onChange={(code) => setDanceList((prev) => (prev ? { ...prev, guestCode: code ?? undefined } : prev))}
          />
        </SettingsSection>
      )}

      {/* Delad med */}
      <SettingsSection title="Delad med" description="Personer och grupper som kan se eller redigera danslistan.">
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
            <Avatar name={ownerGroup ? ownerGroup.name : ownerName} />
            <div className="min-w-0 flex-1 basis-40">
              {ownerGroup ? (
                <p className="break-words text-[15px] font-bold text-[rgb(var(--color-text))]">
                  Ägs av gruppen{' '}
                  <Link to={`/groups/${ownerGroup.id}`} className="text-[rgb(var(--color-link))] hover:underline">
                    {ownerGroup.name}
                  </Link>
                </p>
              ) : (
                <p className="break-words text-[15px] font-bold text-[rgb(var(--color-text))]">{ownerName}</p>
              )}
              <p className="break-words text-[13px] text-[rgb(var(--color-text-muted))]">
                {ownerGroup
                  ? 'Gruppens medlemmar ser danslistan'
                  : danceList.owner?.username
                    ? `${danceList.owner.username} · Ägare`
                    : 'Ägare'}
              </p>
            </div>
            <span className="inline-flex h-7 shrink-0 items-center rounded-[var(--radius-full)] border border-[rgb(var(--color-border))] px-2.5 text-[13px] font-medium text-[rgb(var(--color-text-muted))]">
              Ägare
            </span>
          </li>

          {(danceList.collaborators ?? []).map((collab) => {
            const collabName = collab.groupId
              ? collab.groupName
              : (collab.displayName ?? collab.username ?? collab.userId);
            return (
              <li key={collab.id} className="space-y-2 py-3 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Avatar name={collabName} />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="break-words text-[15px] font-bold text-[rgb(var(--color-text))]">
                      {collab.groupId ? `Gruppen ${collabName}` : collabName}
                    </p>
                    <p className="break-words text-[13px] text-[rgb(var(--color-text-muted))]">
                      {collaboratorStatus(collab)}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
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

        {isOwner && ownerGroup && (
          <p className="mt-4 text-[13px] text-[rgb(var(--color-text-muted))]">
            Vill du att fler i gruppen ska kunna ändra listan?{' '}
            <Link
              to={`/groups/${ownerGroup.id}/settings`}
              className="font-medium text-[rgb(var(--color-link))] hover:underline"
            >
              Hantera gruppens medlemmar
            </Link>
          </p>
        )}

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

      {/* Överlåt ägarskap */}
      {isOwner && !ownerGroup && acceptedUserCollaborators.length > 0 && (
        <SettingsSection
          title="Överlåt ägarskap"
          description="Du blir redaktör och den valda personen blir ny ägare."
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
                {acceptedUserCollaborators.map((c) => (
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

      {/* Radera */}
      {isOwner && (
        <SettingsSection
          title="Radera danslista"
          description="Det här går inte att ångra. Skriv in danslistans namn för att bekräfta."
          danger
        >
          <div className="space-y-3">
            <ConfirmDeleteByName name={danceList.name ?? ''} buttonLabel="Radera danslista" onConfirm={handleDelete} />
            <InlineError>{deleteError}</InlineError>
          </div>
        </SettingsSection>
      )}
    </div>
  );
}
