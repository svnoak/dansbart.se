import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getGroup,
  updateGroup,
  deleteGroup,
  inviteMember,
  updateMember,
  removeMember,
  getGroupPlaylistInvitations,
  respondToGroupPlaylistInvitation,
} from '@/api/generated/groups/groups';
import { ApiError } from '@/api/http-client';
import type { GroupDto } from '@/api/models/groupDto';
import type { GroupMemberDto } from '@/api/models/groupMemberDto';
import type { InvitationDto } from '@/api/models/invitationDto';
import { useAuth } from '@/auth/useAuth';
import { useTheme } from '@/theme/useTheme';
import { getStyleColor } from '@/styles/danceStyleColors';
import { ConfirmDeleteByName } from '@/components';
import { ChevronLeftIcon, CloseIcon, StarMarkIcon } from '@/icons';
import { Badge, Button, Card, IconButton, InlineError, Modal, RowSkeleton, TextField, toast } from '@/ui';
import { canOpenGroupSettings, hasGroupPermission } from '@/utils/groupPermissions';
import { describeGroupError } from '@/utils/describeGroupError';

type PermissionField = keyof Pick<
  GroupMemberDto,
  'isAdmin' | 'canEditInfo' | 'canManagePlaylists' | 'canInviteMembers' | 'canRemoveMembers'
>;

const PERMISSION_FIELDS: { field: PermissionField; label: string }[] = [
  { field: 'isAdmin', label: 'Administratör' },
  { field: 'canEditInfo', label: 'Ändra namn och beskrivning' },
  { field: 'canManagePlaylists', label: 'Hantera spellistor' },
  { field: 'canInviteMembers', label: 'Bjuda in medlemmar' },
  { field: 'canRemoveMembers', label: 'Ta bort medlemmar' },
];

const LIST_CLASS =
  'overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]';
const ROW_CLASS = 'px-4 py-3 border-b border-[rgb(var(--color-border))] last:border-b-0';
const INPUT_CLASS =
  'w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';
const CHECKBOX_CLASS =
  'h-5 w-5 shrink-0 rounded-[4px] border-[rgb(var(--color-border-strong))] accent-[rgb(var(--color-accent))] disabled:opacity-50';

function initialOf(name: string | undefined): string {
  return (name ?? '').trim().charAt(0).toUpperCase() || '?';
}

interface SettingsSectionProps {
  title: string;
  description: string;
  danger?: boolean;
  children: ReactNode;
}

/** One settings board: explanation on the left, the controls in a card on the right. */
function SettingsSection({ title, description, danger = false, children }: SettingsSectionProps) {
  return (
    <section className="grid gap-5 border-t border-[rgb(var(--color-border))] pt-8 md:grid-cols-[260px_minmax(0,1fr)] md:gap-8">
      <div className="space-y-1">
        <h2
          className={`text-[18px] font-bold ${
            danger ? 'text-[rgb(var(--color-error))]' : 'text-[rgb(var(--color-text))]'
          }`}
        >
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-[rgb(var(--color-text-muted))]">{description}</p>
      </div>
      {danger ? (
        <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-error))] bg-[rgb(var(--color-bg-elevated))] p-5">
          {children}
        </div>
      ) : (
        <Card className="p-5">{children}</Card>
      )}
    </section>
  );
}

export function GroupSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [group, setGroup] = useState<GroupDto | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [aboutUs, setAboutUs] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [memberError, setMemberError] = useState<string | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const [confirmingPublic, setConfirmingPublic] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [respondingInvitationId, setRespondingInvitationId] = useState<string | null>(null);
  const [invitationErrors, setInvitationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getGroup(id)
      .then((data) => {
        if (cancelled) return;
        setGroup(data);
        setName(data.name ?? '');
        setAboutUs(data.aboutUs ?? '');
      })
      .catch(() => {
        if (!cancelled) setGroup(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !group) return;
    const membership = group.members?.find((m) => m.userId === user?.id);
    if (!membership?.isAdmin) return;
    let cancelled = false;
    getGroupPlaylistInvitations(id)
      .then((data) => {
        if (!cancelled) setInvitations(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, group, user?.id]);

  if (loading) {
    return <RowSkeleton rows={3} label="Laddar inställningarna" />;
  }

  if (!group) {
    return <p className="text-[15px] text-[rgb(var(--color-text-muted))]">Gruppen hittades inte.</p>;
  }

  const myMembership = group.members?.find((m) => m.userId === user?.id);

  if (!canOpenGroupSettings(myMembership)) {
    return (
      <div className="space-y-4">
        <p className="text-[15px] text-[rgb(var(--color-text))]">Du har inte behörighet att ändra gruppen.</p>
        <Link
          to={`/groups/${id}`}
          className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-[rgb(var(--color-link))] hover:underline"
        >
          <ChevronLeftIcon className="h-5 w-5" aria-hidden />
          Tillbaka till gruppen
        </Link>
      </div>
    );
  }

  const isAdmin = !!myMembership?.isAdmin;
  const canEditInfo = hasGroupPermission(myMembership, 'canEditInfo');
  const canInviteMembers = hasGroupPermission(myMembership, 'canInviteMembers');
  const canRemoveMembers = hasGroupPermission(myMembership, 'canRemoveMembers');
  const members = group.members ?? [];

  function canRemove(member: GroupMemberDto): boolean {
    if (isAdmin) return true;
    return canRemoveMembers && !member.isAdmin;
  }

  async function handleSaveInfo() {
    if (!id) return;
    setSavingInfo(true);
    setInfoError(null);
    try {
      await updateGroup(id, { name: name.trim(), aboutUs: aboutUs.trim() });
      setGroup((prev) => (prev ? { ...prev, name: name.trim(), aboutUs: aboutUs.trim() } : prev));
      toast('Gruppen är uppdaterad.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setInfoError(describeGroupError(error, 'saveName'));
      } else {
        setInfoError('Det gick inte att spara ändringarna.');
      }
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleToggleVisibility() {
    if (!id || !group) return;
    if (!group.isPublic) {
      setConfirmingPublic(true);
      return;
    }
    try {
      const updated = await updateGroup(id, { isPublic: false });
      setGroup((prev) => (prev ? { ...prev, isPublic: updated.isPublic } : prev));
    } catch {
      setInfoError('Det gick inte att ändra synligheten.');
    }
  }

  async function handleConfirmMakePublic() {
    if (!id) return;
    setConfirmingPublic(false);
    try {
      const updated = await updateGroup(id, { isPublic: true });
      setGroup((prev) => (prev ? { ...prev, isPublic: updated.isPublic } : prev));
    } catch {
      setInfoError('Det gick inte att ändra synligheten.');
    }
  }

  async function handleInvite() {
    if (!id || !inviteUsername.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      await inviteMember(id, { username: inviteUsername.trim() });
      const updated = await getGroup(id);
      setGroup(updated);
      setInviteUsername('');
      toast('Inbjudan är skickad.');
    } catch (error) {
      setInviteError(describeGroupError(error, 'invite'));
    } finally {
      setInviting(false);
    }
  }

  async function handleTogglePermission(member: GroupMemberDto, field: PermissionField) {
    if (!id || !member.id) return;
    setMemberError(null);
    try {
      const updated = await updateMember(id, member.id, { [field]: !member[field] });
      setGroup((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members?.map((m) => (m.id === member.id ? { ...m, ...updated } : m)),
            }
          : prev,
      );
    } catch (error) {
      setMemberError(describeGroupError(error, 'updatePermissions'));
    }
  }

  async function handleRemove(member: GroupMemberDto) {
    if (!id || !member.id) return;
    const isSelf = member.userId === user?.id;
    setMemberError(null);
    if (isSelf) {
      setLeaving(true);
    }
    try {
      await removeMember(id, member.id);
      if (isSelf) {
        toast('Du har lämnat gruppen.');
        navigate('/groups');
        return;
      }
      setGroup((prev) =>
        prev ? { ...prev, members: prev.members?.filter((m) => m.id !== member.id) } : prev,
      );
    } catch (error) {
      setMemberError(describeGroupError(error, isSelf ? 'leave' : 'remove'));
      if (isSelf) {
        setConfirmingLeave(false);
        setLeaving(false);
      }
    }
  }

  async function handleRespondToPlaylistInvitation(invitationId: string, accept: boolean) {
    if (!id) return;
    setRespondingInvitationId(invitationId);
    setInvitationErrors((prev) => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
    try {
      await respondToGroupPlaylistInvitation(id, invitationId, { accept });
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      toast(accept ? 'Inbjudan accepterad' : 'Inbjudan avböjd');
    } catch {
      setInvitationErrors((prev) => ({ ...prev, [invitationId]: 'Det gick inte att svara på inbjudan.' }));
    } finally {
      setRespondingInvitationId(null);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleteError(null);
    try {
      await deleteGroup(id);
      toast('Gruppen är raderad.');
      navigate('/groups');
    } catch {
      setDeleteError('Det gick inte att radera gruppen.');
    }
  }

  function statusLine(member: GroupMemberDto, isSelf: boolean): string {
    const role =
      member.status === 'pending'
        ? 'Inbjuden · väntar på svar'
        : member.isAdmin
          ? 'Administratör'
          : 'Medlem';
    return isSelf ? `${role} · det här är du` : role;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <Link
          to={`/groups/${id}`}
          className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
        >
          <ChevronLeftIcon className="h-5 w-5" aria-hidden />
          {group.name}
        </Link>
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent-muted))] text-xl font-bold text-[rgb(var(--color-text))]"
            aria-hidden
          >
            {initialOf(group.name)}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[rgb(var(--color-text-muted))]">Inställningar</p>
            <h1 className="truncate text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
              {group.name}
            </h1>
          </div>
        </div>
      </div>

      {canEditInfo && (
        <SettingsSection
          title="Om gruppen"
          description="Namnet och beskrivningen visas för alla som hittar gruppen."
        >
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="group-settings-name"
                className="block text-sm font-medium text-[rgb(var(--color-text))]"
              >
                Gruppens namn
              </label>
              <input
                id="group-settings-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setInfoError(null);
                }}
                className={`min-h-11 ${INPUT_CLASS}`}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="group-settings-about"
                className="block text-sm font-medium text-[rgb(var(--color-text))]"
              >
                Om oss
              </label>
              <textarea
                id="group-settings-about"
                value={aboutUs}
                onChange={(e) => setAboutUs(e.target.value)}
                rows={4}
                className={`min-h-11 ${INPUT_CLASS}`}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="group-settings-visibility"
                className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-medium text-[rgb(var(--color-text))]"
              >
                <input
                  id="group-settings-visibility"
                  type="checkbox"
                  role="switch"
                  checked={!!group.isPublic}
                  onChange={handleToggleVisibility}
                  aria-describedby="group-settings-visibility-help"
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgb(var(--color-focus))] ${
                    group.isPublic
                      ? 'bg-[rgb(var(--color-selected))]'
                      : 'bg-[rgb(var(--color-border-strong))]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      group.isPublic ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </span>
                Visa gruppen offentligt
              </label>
              <p
                id="group-settings-visibility-help"
                className="text-[13px] leading-relaxed text-[rgb(var(--color-text-muted))]"
              >
                Offentliga grupper syns under Grupper och vem som helst kan be om att gå med. Du får en
                fråga innan ändringen sparas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSaveInfo} disabled={savingInfo || !name.trim()}>
                Spara
              </Button>
              <InlineError>{infoError}</InlineError>
            </div>
          </div>
        </SettingsSection>
      )}

      <Modal open={confirmingPublic} onClose={() => setConfirmingPublic(false)} label="Bekräfta offentlig grupp">
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Gruppen kommer att visas offentligt. Vill du genomföra ändringen?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmingPublic(false)}>
            Nej
          </Button>
          <Button onClick={handleConfirmMakePublic}>Ja</Button>
        </div>
      </Modal>

      <SettingsSection
        title="Medlemmar"
        description="Vem som är med i gruppen och vad var och en får göra."
      >
        <ul className={LIST_CLASS}>
          {members.map((member) => {
            const memberName = member.displayName ?? member.username ?? '';
            const isSelf = member.userId === user?.id;
            const showPermissions = isAdmin && member.status === 'accepted' && !isSelf;
            const expanded = expandedMemberId === member.id;
            const panelId = `group-member-permissions-${member.id}`;
            return (
              <li key={member.id} className={ROW_CLASS}>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent-muted))] text-[15px] font-bold text-[rgb(var(--color-text))]"
                    aria-hidden
                  >
                    {initialOf(memberName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-[rgb(var(--color-text))]">{memberName}</p>
                    <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                      {statusLine(member, isSelf)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {member.isAdmin && <Badge>Administratör</Badge>}
                    {member.status === 'pending' && <Badge variant="muted">Väntar</Badge>}
                    {showPermissions && (
                      <Button
                        variant="outline"
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        onClick={() => setExpandedMemberId(expanded ? null : (member.id ?? null))}
                      >
                        Behörigheter
                      </Button>
                    )}
                    {isSelf
                      ? !confirmingLeave && (
                          <Button variant="outline" onClick={() => setConfirmingLeave(true)}>
                            Lämna gruppen
                          </Button>
                        )
                      : canRemove(member) && (
                          <IconButton
                            aria-label={`Ta bort ${memberName} ur gruppen`}
                            onClick={() => handleRemove(member)}
                          >
                            <CloseIcon className="h-5 w-5" aria-hidden />
                          </IconButton>
                        )}
                  </div>
                </div>
                {isSelf && confirmingLeave && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-[52px]">
                    <span className="text-[15px] text-[rgb(var(--color-text))]">Vill du lämna gruppen?</span>
                    <Button variant="danger" disabled={leaving} onClick={() => handleRemove(member)}>
                      Ja, lämna gruppen
                    </Button>
                    <Button variant="ghost" disabled={leaving} onClick={() => setConfirmingLeave(false)}>
                      Avbryt
                    </Button>
                  </div>
                )}
                {showPermissions && expanded && (
                  <div id={panelId} className="mt-3 sm:pl-[52px]">
                    <p className="text-[13px] font-semibold text-[rgb(var(--color-text-muted))]">
                      Behörigheter för {memberName}
                    </p>
                    <div className="mt-1">
                      {PERMISSION_FIELDS.map(({ field, label }) => {
                        const forcedByAdmin = field !== 'isAdmin' && !!member.isAdmin;
                        return (
                          <label
                            key={field}
                            className="flex min-h-8 items-center gap-3 text-sm text-[rgb(var(--color-text))]"
                          >
                            <input
                              type="checkbox"
                              checked={forcedByAdmin ? true : !!member[field]}
                              disabled={forcedByAdmin}
                              onChange={() => handleTogglePermission(member, field)}
                              aria-label={`${label} för ${memberName}`}
                              className={CHECKBOX_CLASS}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-3">
          <InlineError>{memberError}</InlineError>
        </div>

        {canInviteMembers && (
          <div className="mt-5 border-t border-[rgb(var(--color-border))] pt-5">
            <h3 className="text-[15px] font-bold text-[rgb(var(--color-text))]">Bjud in medlem</h3>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <TextField
                  id="group-invite-username"
                  label="Användarnamn"
                  value={inviteUsername}
                  onChange={setInviteUsername}
                  autoComplete="off"
                />
              </div>
              <Button onClick={handleInvite} disabled={inviting || !inviteUsername.trim()}>
                Bjud in
              </Button>
            </div>
            <div className="mt-2">
              <InlineError>{inviteError}</InlineError>
            </div>
          </div>
        )}
      </SettingsSection>

      {isAdmin && invitations.length > 0 && (
        <SettingsSection
          title="Inbjudningar till spellistor"
          description="Spellistor som andra vill dela med gruppen. Svara för gruppens räkning."
        >
          <ul className={LIST_CLASS}>
            {invitations.map((inv) => {
              const color = getStyleColor(null);
              const permissionText =
                inv.permission === 'edit' ? 'kan redigera' : inv.permission === 'view' ? 'kan se' : null;
              return (
                <li key={inv.id} className={ROW_CLASS}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)]"
                      style={{
                        backgroundColor: isDark ? color.bgDark : color.bg,
                        color: isDark ? color.textDark : color.text,
                      }}
                      aria-hidden
                    >
                      <StarMarkIcon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-[rgb(var(--color-text))]">
                        {inv.playlistName}
                      </p>
                      <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                        Inbjuden av {inv.invitedByDisplayName ?? inv.invitedByUserId}
                        {permissionText && ` · ${permissionText}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        className="h-10 min-h-10"
                        disabled={respondingInvitationId === inv.id}
                        onClick={() => handleRespondToPlaylistInvitation(inv.id!, true)}
                      >
                        Acceptera
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 min-h-10"
                        disabled={respondingInvitationId === inv.id}
                        onClick={() => handleRespondToPlaylistInvitation(inv.id!, false)}
                      >
                        Avböj
                      </Button>
                    </div>
                  </div>
                  {inv.id && invitationErrors[inv.id] && (
                    <div className="mt-2 sm:pl-[52px]">
                      <InlineError>{invitationErrors[inv.id]}</InlineError>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </SettingsSection>
      )}

      {isAdmin && (
        <SettingsSection
          title="Radera grupp"
          description="Tar bort gruppen för alla medlemmar."
          danger
        >
          <div className="space-y-3">
            <p className="text-[15px] text-[rgb(var(--color-text))]">
              Går inte att ångra. Gruppens spellistor raderas också.
            </p>
            <ConfirmDeleteByName
              name={group.name ?? ''}
              buttonLabel="Radera grupp"
              onConfirm={handleDelete}
            />
            <InlineError>{deleteError}</InlineError>
          </div>
        </SettingsSection>
      )}
    </div>
  );
}
