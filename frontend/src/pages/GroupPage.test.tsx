import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GroupPage } from './GroupPage';
import { ApiError } from '@/api/http-client';
import { authValue, loggedInAuthValue } from '@/test/authValue';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getGroup = vi.fn();
const removeMember = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/groups/groups', () => ({
  getGroup: (...args: unknown[]) => getGroup(...args),
  removeMember: (...args: unknown[]) => removeMember(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

describe('GroupPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getGroup.mockReset();
    removeMember.mockReset();
    useAuth.mockReset();
    useAuth.mockReturnValue(authValue());
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
        <MemoryRouter initialEntries={['/groups/g1']}>
          <Routes>
            <Route path="/groups/:id" element={<GroupPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  function getButtonByText(text: string) {
    return Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(text),
    );
  }

  function getLinkByText(text: string) {
    return Array.from(document.body.querySelectorAll('a')).find((a) =>
      a.textContent?.includes(text),
    );
  }

  it('shows a public group to a visitor', async () => {
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Barngruppen');
    expect(document.body.textContent).toContain('Vi dansar polska');
    expect(document.body.textContent).not.toContain('medlem');
    expect(getButtonByText('Lämna gruppen')).toBeUndefined();
    expect(getLinkByText('Inställningar för gruppen')).toBeUndefined();
    expect(document.body.textContent).toContain('Logga in');
  });

  it('shows members to a member', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
        { id: 'm2', userId: 'u2', username: 'user2', displayName: 'Anna', isAdmin: true, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Anna');
    expect(document.body.textContent).toContain('Administratör');
    expect(document.body.textContent).not.toContain('medlemmar');
    expect(getLinkByText('Inställningar för gruppen')).toBeUndefined();
  });

  it('shows the member count to a member who can open settings', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: true, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
        { id: 'm2', userId: 'u2', username: 'user2', displayName: 'Anna', isAdmin: true, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
      memberCount: 2,
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('2 medlemmar');
    const settingsLink = getLinkByText('Inställningar för gruppen');
    expect(settingsLink).toBeDefined();
    expect(settingsLink?.getAttribute('href')).toBe('/groups/g1/settings');
  });

  it('shows no pending invitations as members', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
        { id: 'm3', userId: 'u3', username: 'user3', displayName: 'Bob', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'pending' },
      ],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).not.toContain('Bob');
  });

  it('leaving the group', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
        { id: 'm2', userId: 'u2', username: 'user2', displayName: 'Anna', isAdmin: true, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
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
    });

    const confirmButton = getButtonByText('Ja, lämna gruppen');
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(removeMember).toHaveBeenCalledWith('g1', 'm1');
  });

  it('shows the admin rule when leaving fails with a conflict', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: true, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
        { id: 'm2', userId: 'u2', username: 'user2', displayName: 'Anna', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
    });
    removeMember.mockRejectedValue(new ApiError('Conflict', 409));
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const leaveButton = getButtonByText('Lämna gruppen');
    await act(async () => {
      leaveButton?.click();
    });

    const confirmButton = getButtonByText('Ja, lämna gruppen');
    await act(async () => {
      confirmButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Du kan inte lämna gruppen. En grupp måste ha minst en administratör.');
  });

  it('shows not found', async () => {
    getGroup.mockRejectedValue(new Error('Not found'));
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Gruppen hittades inte.');
  });
});
