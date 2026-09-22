import type { GroupMemberDto } from '@/api/models';

type Membership = Pick<
  GroupMemberDto,
  'isAdmin' | 'canEditInfo' | 'canManagePlaylists' | 'canInviteMembers' | 'canRemoveMembers' | 'status'
>;

export type PermissionFlag = 'canEditInfo' | 'canInviteMembers' | 'canRemoveMembers' | 'canManagePlaylists';

export function hasGroupPermission(membership: Membership | undefined, flag: PermissionFlag): boolean {
  if (!membership || membership.status !== 'accepted') {
    return false;
  }

  return !!(membership.isAdmin || membership[flag]);
}

export function canOpenGroupSettings(membership?: Membership): boolean {
  if (!membership || membership.status !== 'accepted') {
    return false;
  }

  return !!(
    hasGroupPermission(membership, 'canEditInfo') ||
    hasGroupPermission(membership, 'canInviteMembers') ||
    hasGroupPermission(membership, 'canRemoveMembers')
  );
}
