import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GroupSettingsPage } from './GroupSettingsPage';
import { ApiError } from '@/api/http-client';
import { loggedInAuthValue } from '@/test/authValue';
import { getInputByLabel } from '@/test/getInputByLabel';
import { typeInto } from '@/test/typeInto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getGroup = vi.fn();
const updateGroup = vi.fn();
const deleteGroup = vi.fn();
const inviteMember = vi.fn();
const updateMember = vi.fn();
const removeMember = vi.fn();
const searchUsers = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/groups/groups', () => ({
  getGroup: (...args: unknown[]) => getGroup(...args),
  updateGroup: (...args: unknown[]) => updateGroup(...args),
  deleteGroup: (...args: unknown[]) => deleteGroup(...args),
  inviteMember: (...args: unknown[]) => inviteMember(...args),
  updateMember: (...args: unknown[]) => updateMember(...args),
  removeMember: (...args: unknown[]) => removeMember(...args),
}));

vi.mock('@/api/generated/users/users', () => ({
  searchUsers: (...args: unknown[]) => searchUsers(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

describe('GroupSettingsPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getGroup.mockReset();
    updateGroup.mockReset();
    deleteGroup.mockReset();
    inviteMember.mockReset();
    updateMember.mockReset();
    removeMember.mockReset();
    searchUsers.mockReset();
    useAuth.mockReset();
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/groups/g1/settings']}>
          <Routes>
            <Route path="/groups/:id/settings" element={<GroupSettingsPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  function getLinkByText(text: string) {
    return Array.from(document.body.querySelectorAll('a')).find((a) =>
      a.textContent?.includes(text),
    );
  }

  function getButtonByText(text: string) {
    return Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(text),
    );
  }

  function getCheckboxByAccessibleName(name: string) {
    return Array.from(document.body.querySelectorAll('input[type="checkbox"]')).find((cb) => {
      const ariaLabel = cb.getAttribute('aria-label');
      const labelElement = Array.from(document.body.querySelectorAll('label')).find((l) =>
        l.getAttribute('for') === cb.id && l.textContent?.includes(name),
      );
      return ariaLabel?.includes(name) || labelElement;
    });
  }

  it('sends a member without settings access back to the group page', async () => {
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Du har inte behörighet att ändra gruppen.');
    const groupLink = getLinkByText('gruppen');
    expect(groupLink?.getAttribute('href')).toBe('/groups/g1');
  });

  it('an editor can change name and description', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: true, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
    });
    updateGroup.mockResolvedValue(undefined);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const nameInput = getInputByLabel('Gruppens namn') as HTMLInputElement;
    const descriptionInput = getInputByLabel('Om oss') as HTMLTextAreaElement;
    typeInto(nameInput, 'Ny grupp');
    typeInto(descriptionInput, 'Ny beskrivning');

    const saveButton = getButtonByText('Spara');
    await act(async () => {
      saveButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(updateGroup).toHaveBeenCalledWith('g1', { name: 'Ny grupp', aboutUs: 'Ny beskrivning' });
  });

  it('an inviter sees only the invite form', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: true, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(getButtonByText('Spara')).toBeUndefined();
    expect(document.body.querySelector('input[type="checkbox"]')).toBeNull();
    expect(getButtonByText('Radera grupp')).toBeUndefined();
    expect(document.body.textContent).toContain('Sök');
  });

  it('inviting a person', async () => {
    vi.useFakeTimers();
    try {
      useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
      getGroup.mockResolvedValue({
        id: 'g1',
        name: 'Barngruppen',
        aboutUs: 'Vi dansar polska',
        isPublic: true,
        members: [
          { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: true, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
        ],
      });
      searchUsers.mockResolvedValue([
        { id: 'u2', username: 'anna', displayName: 'Anna' },
      ]);
      inviteMember.mockResolvedValue(undefined);
      await renderPage();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      const searchInput = document.body.querySelector('input[type="search"]') as HTMLInputElement;
      typeInto(searchInput, 'an');

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      await act(async () => {
        await Promise.resolve();
      });

      const annaButton = getButtonByText('Anna');
      await act(async () => {
        annaButton?.click();
      });

      const inviteButton = getButtonByText('Bjud in');
      await act(async () => {
        inviteButton?.click();
        vi.advanceTimersByTime(100);
      });

      expect(inviteMember).toHaveBeenCalledWith('g1', { userId: 'u2' });
    } finally {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it('inviting someone already invited shows the conflict text', async () => {
    vi.useFakeTimers();
    try {
      useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
      getGroup.mockResolvedValue({
        id: 'g1',
        name: 'Barngruppen',
        aboutUs: 'Vi dansar polska',
        isPublic: true,
        members: [
          { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: true, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
        ],
      });
      searchUsers.mockResolvedValue([
        { id: 'u2', username: 'anna', displayName: 'Anna' },
      ]);
      inviteMember.mockRejectedValue(new ApiError('Conflict', 409));
      await renderPage();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      const searchInput = document.body.querySelector('input[type="search"]') as HTMLInputElement;
      typeInto(searchInput, 'an');

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      await act(async () => {
        await Promise.resolve();
      });

      const annaButton = getButtonByText('Anna');
      await act(async () => {
        annaButton?.click();
      });

      const inviteButton = getButtonByText('Bjud in');
      await act(async () => {
        inviteButton?.click();
        vi.advanceTimersByTime(100);
      });

      expect(document.body.textContent).toContain('Personen är redan inbjuden eller medlem.');
    } finally {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it("an admin changes a member's permission", async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: true, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
        { id: 'm2', userId: 'u2', username: 'anna', displayName: 'Anna', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
    });
    updateMember.mockResolvedValue(undefined);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const checkbox = getCheckboxByAccessibleName('Hantera spellistor') as HTMLElement | null;
    await act(async () => {
      checkbox?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(updateMember).toHaveBeenCalledWith('g1', 'm2', { canManagePlaylists: true });
  });

  it('removing the last admin shows the admin rule', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: true, canEditInfo: false, canInviteMembers: false, canRemoveMembers: true, canManagePlaylists: false, status: 'accepted' },
        { id: 'm2', userId: 'u2', username: 'anna', displayName: 'Anna', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
    });
    removeMember.mockRejectedValue(new ApiError('Conflict', 409));
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const removeButton = getButtonByText('Ta bort');
    await act(async () => {
      removeButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Personen kan inte tas bort. En grupp måste ha minst en administratör.');
  });

  it('pending invitations show as Väntande for an inviter', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: true, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
        { id: 'm3', userId: 'u3', username: 'bob', displayName: 'Bob', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'pending' },
      ],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Bob');
    expect(document.body.textContent).toContain('Väntande');
    expect(document.body.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('an admin deletes the group', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: true, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
    });
    deleteGroup.mockResolvedValue(undefined);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const deleteButton = getButtonByText('Radera grupp');
    await act(async () => {
      deleteButton?.click();
    });

    const confirmInput = document.body.querySelector('input[type="text"]') as HTMLInputElement;
    typeInto(confirmInput, 'Barngruppen');

    const confirmDeleteButton = getButtonByText('Radera permanent');
    await act(async () => {
      confirmDeleteButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(deleteGroup).toHaveBeenCalledWith('g1');
  });

  it('a non-admin never sees Radera grupp', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: true, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(getButtonByText('Radera grupp')).toBeUndefined();
  });

  it('leaving from settings asks for confirmation', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: true, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
    });
    removeMember.mockResolvedValue(undefined);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const leaveButton = getButtonByText('Lämna gruppen');
    expect(leaveButton).toBeDefined();

    await act(async () => {
      leaveButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(removeMember).not.toHaveBeenCalled();

    const confirmButton = getButtonByText('Ja, lämna gruppen');
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(removeMember).toHaveBeenCalledWith('g1', 'm1');
  });
});
