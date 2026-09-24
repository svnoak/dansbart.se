import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getGroup,
  updateGroup,
  deleteGroup,
  inviteMember,
  updateMember,
  removeMember,
} from '@/api/generated/groups/groups';
import type { GroupDto } from '@/api/models/groupDto';
import type { GroupMemberDto } from '@/api/models/groupMemberDto';
import { useAuth } from '@/auth/useAuth';
import { ConfirmDeleteByName } from '@/components';
import { BackArrowIcon } from '@/icons';
import { Badge, Button, Card, IconButton, Modal, SectionTitle, toast } from '@/ui';
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

export function GroupSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const [confirmingPublic, setConfirmingPublic] = useState(false);

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

  if (loading) {
    return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  }

  if (!group) {
    return <p className="text-[rgb(var(--color-text-muted))]">Gruppen hittades inte.</p>;
  }

  const myMembership = group.members?.find((m) => m.userId === user?.id);

  if (!canOpenGroupSettings(myMembership)) {
    return (
      <div className="space-y-4">
        <p className="text-[rgb(var(--color-text))]">Du har inte behörighet att ändra gruppen.</p>
        <Link to={`/groups/${id}`} className="text-[rgb(var(--color-accent))] hover:underline">
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
    } catch {
      setInfoError('Det gick inte att spara ändringarna.');
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

  async function handleDelete() {
    if (!id) return;
    try {
      await deleteGroup(id);
      toast('Gruppen är raderad.');
      navigate('/groups');
    } catch {
      toast('Det gick inte att radera gruppen.', 'error');
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <IconButton aria-label="Tillbaka till gruppen" onClick={() => navigate(`/groups/${id}`)}>
          <BackArrowIcon className="h-5 w-5" aria-hidden />
        </IconButton>
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
          Inställningar för {group.name}
        </h1>
      </div>

      {canEditInfo && (
        <section className="space-y-3">
          <SectionTitle>Om gruppen</SectionTitle>
          <Card className="space-y-3 p-4">
            <div className="space-y-1">
              <label
                htmlFor="group-settings-name"
                className="block text-sm font-medium text-[rgb(var(--color-text))]"
              >
                Gruppens namn
              </label>
              <input
                id="group-settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))]"
              />
            </div>
            <div className="space-y-1">
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
                className="w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))]"
              />
            </div>
            <div className="flex min-h-11 items-center gap-2">
              <input
                id="group-settings-visibility"
                type="checkbox"
                checked={!!group.isPublic}
                onChange={handleToggleVisibility}
                className="h-5 w-5 rounded border-[rgb(var(--color-border))]"
              />
              <label htmlFor="group-settings-visibility" className="text-sm text-[rgb(var(--color-text))]">
                Visa gruppen offentligt
              </label>
            </div>
            <Button onClick={handleSaveInfo} disabled={savingInfo || !name.trim()}>
              Spara
            </Button>
            {infoError && (
              <p className="text-sm text-[rgb(var(--color-error))]" role="alert">
                {infoError}
              </p>
            )}
          </Card>
        </section>
      )}

      <Modal open={confirmingPublic} onClose={() => setConfirmingPublic(false)} label="Bekräfta offentlig grupp">
        <p className="text-sm text-[rgb(var(--color-text))]">
          Gruppen kommer att visas offentligt. Vill du genomföra ändringen?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmingPublic(false)}>
            Nej
          </Button>
          <Button onClick={handleConfirmMakePublic}>Ja</Button>
        </div>
      </Modal>

      {canInviteMembers && (
        <section className="space-y-3">
          <SectionTitle>Bjud in medlem</SectionTitle>
          <Card className="space-y-3 p-4">
            <div className="space-y-1">
              <label
                htmlFor="group-invite-username"
                className="block text-sm font-medium text-[rgb(var(--color-text))]"
              >
                Användarnamn
              </label>
              <input
                id="group-invite-username"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                autoComplete="off"
                className="min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:border-[rgb(var(--color-accent))]"
              />
            </div>
            <Button onClick={handleInvite} disabled={inviting || !inviteUsername.trim()}>
              Bjud in
            </Button>
            {inviteError && (
              <p className="text-sm text-[rgb(var(--color-error))]" role="alert">
                {inviteError}
              </p>
            )}
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle>Medlemmar</SectionTitle>
        <ul className="space-y-2">
          {members.map((member) => {
            const memberName = member.displayName ?? member.username ?? '';
            const isSelf = member.userId === user?.id;
            const showPermissions = isAdmin && member.status === 'accepted' && !isSelf;
            return (
              <li key={member.id}>
                <Card className="space-y-2 p-3">
                  <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[rgb(var(--color-text))]">
                        {memberName}
                      </span>
                      {member.isAdmin && <Badge>Administratör</Badge>}
                      {member.status === 'pending' && <Badge variant="muted">Väntande</Badge>}
                    </div>
                    {isSelf ? (
                      !confirmingLeave ? (
                        <Button variant="secondary" size="sm" onClick={() => setConfirmingLeave(true)}>
                          Lämna gruppen
                        </Button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-[rgb(var(--color-text))]">Vill du lämna gruppen?</span>
                          <Button variant="danger" size="sm" disabled={leaving} onClick={() => handleRemove(member)}>
                            Ja, lämna gruppen
                          </Button>
                          <Button variant="ghost" size="sm" disabled={leaving} onClick={() => setConfirmingLeave(false)}>
                            Avbryt
                          </Button>
                        </div>
                      )
                    ) : (
                      canRemove(member) && (
                        <Button variant="danger" size="sm" onClick={() => handleRemove(member)}>
                          Ta bort
                        </Button>
                      )
                    )}
                  </div>
                  {showPermissions && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {PERMISSION_FIELDS.map(({ field, label }) => {
                        const forcedByAdmin = field !== 'isAdmin' && !!member.isAdmin;
                        return (
                          <label
                            key={field}
                            className="flex min-h-11 items-center gap-2 text-sm text-[rgb(var(--color-text))]"
                          >
                            <input
                              type="checkbox"
                              checked={forcedByAdmin ? true : !!member[field]}
                              disabled={forcedByAdmin}
                              onChange={() => handleTogglePermission(member, field)}
                              aria-label={`${label} för ${memberName}`}
                              className="h-5 w-5 rounded border-[rgb(var(--color-border))]"
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
        {memberError && (
          <p className="text-sm text-[rgb(var(--color-error))]" role="alert">
            {memberError}
          </p>
        )}
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <SectionTitle>Radera grupp</SectionTitle>
          <Card className="space-y-3 p-4">
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Det går inte att ångra. Gruppens spellistor raderas också.
            </p>
            <ConfirmDeleteByName
              name={group.name ?? ''}
              buttonLabel="Radera grupp"
              onConfirm={handleDelete}
            />
          </Card>
        </section>
      )}
    </div>
  );
}
