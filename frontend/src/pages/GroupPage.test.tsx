import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GroupPage } from './GroupPage';
import { ApiError } from '@/api/http-client';
import { authValue, loggedInAuthValue } from '@/test/authValue';
import { getInputByLabel } from '@/test/getInputByLabel';
import { typeInto } from '@/test/typeInto';
import { ToastContainer } from '@/ui';
import * as ui from '@/ui';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getGroup = vi.fn();
const removeMember = vi.fn();
const createGroupPlaylist = vi.fn();
const createDanceList = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/groups/groups', () => ({
  getGroup: (...args: unknown[]) => getGroup(...args),
  removeMember: (...args: unknown[]) => removeMember(...args),
  createGroupPlaylist: (...args: unknown[]) => createGroupPlaylist(...args),
}));

vi.mock('@/api/generated/dance-lists/dance-lists', () => ({
  createDanceList: (...args: unknown[]) => createDanceList(...args),
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
    createGroupPlaylist.mockReset();
    createDanceList.mockReset();
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
          <ToastContainer />
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
    expect(getLinkByText('Inställningar')).toBeUndefined();
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
    expect(getLinkByText('Inställningar')).toBeUndefined();
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
    const settingsLink = getLinkByText('Inställningar');
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

  it("lists the group's playlists", async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
      playlists: [
        { id: 'p1', name: 'Barnens favoriter', description: 'Lugna valser', isPublic: true, trackCount: 4 },
      ],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Barnens favoriter');
    expect(document.body.textContent).toContain('Lugna valser');
    expect(document.body.textContent).toContain('4 låtar');
    const playlistLink = getLinkByText('Barnens favoriter');
    expect(playlistLink).toBeDefined();
    expect(playlistLink?.getAttribute('href')).toBe('/playlists/p1');
  });

  it('shows an empty text when the group has no playlists', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists: false, status: 'accepted' },
      ],
      playlists: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Gruppen har inga spellistor ännu.');
  });

  async function renderGroupAsMember(canManagePlaylists: boolean, extra: object = {}) {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Barngruppen',
      aboutUs: 'Vi dansar polska',
      isPublic: true,
      members: [
        { id: 'm1', userId: 'u1', username: 'user1', displayName: 'User 1', isAdmin: false, canEditInfo: false, canInviteMembers: false, canRemoveMembers: false, canManagePlaylists, status: 'accepted' },
      ],
      playlists: [],
      danceLists: [],
      ...extra,
    });
    await renderPage();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  }

  async function submitNewList(k: (typeof listKinds)[number]) {
    await act(async () => {
      getButtonByText(k.open)?.click();
    });
    await act(async () => {
      await typeInto(getInputByLabel(k.input)!, k.name);
    });
    const submitButton = getButtonByText(k.submit);
    await act(async () => {
      submitButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    return submitButton;
  }

  const listKinds = [
    {
      kind: 'playlist', open: 'Ny spellista', input: 'Spellistans namn', submit: 'Skapa spellista', name: 'Höstens danser',
      error: 'Det gick inte att skapa spellistan.', create: createGroupPlaylist,
      created: { id: 'p1', name: 'Höstens danser', isPublic: false, trackCount: 0 },
      calledWith: ['g1', { name: 'Höstens danser' }],
    },
    {
      kind: 'dance list', open: 'Ny danslista', input: 'Danslistans namn', submit: 'Skapa danslista', name: 'Hambo',
      error: 'Det gick inte att skapa danslistan.', create: createDanceList,
      created: { id: 'd2', name: 'Hambo', isPublic: false },
      calledWith: [{ name: 'Hambo', groupId: 'g1' }],
    },
  ];

  describe.each(listKinds)('creating a $kind', (k) => {
    it('a member who can manage playlists creates one', async () => {
      k.create.mockResolvedValue(k.created);
      await renderGroupAsMember(true);

      await submitNewList(k);

      expect(k.create).toHaveBeenCalledWith(...k.calledWith);
      expect(document.body.textContent).toContain(k.name);
    });

    it('a member without the permission sees no create buttons', async () => {
      await renderGroupAsMember(false);

      expect(getButtonByText(k.open)).toBeUndefined();
      expect(getButtonByText(k.submit)).toBeUndefined();
    });

    it('a failed creation shows the error in the form, not as a toast', async () => {
      k.create.mockRejectedValue(new Error('Network error'));
      const toastSpy = vi.spyOn(ui, 'toast');
      await renderGroupAsMember(true);

      const submitButton = await submitNewList(k);

      const alert = submitButton?.closest('form')?.querySelector('[role="alert"]');
      expect(alert?.textContent).toBe(k.error);
      expect(toastSpy).not.toHaveBeenCalledWith(k.error, 'error');

      toastSpy.mockRestore();
    });
  });

  it("lists the group's dance lists", async () => {
    await renderGroupAsMember(false, {
      danceLists: [{ id: 'd1', name: 'Hambo', description: 'Tre danser', isPublic: true }],
    });

    expect(document.body.textContent).toContain('Gruppens danslistor');
    expect(getLinkByText('Hambo')?.getAttribute('href')).toBe('/dance-lists/d1');
  });
});
