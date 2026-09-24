import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { GroupsPage } from './GroupsPage';
import { ApiError } from '@/api/http-client';
import { authValue, loggedInAuthValue } from '@/test/authValue';
import { getInputByLabel } from '@/test/getInputByLabel';
import { typeInto } from '@/test/typeInto';
import { ToastContainer } from '@/ui';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getMyGroups = vi.fn();
const getPublicGroups = vi.fn();
const getGroupInvitations = vi.fn();
const createGroup = vi.fn();
const respondToGroupInvitation = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/groups/groups', () => ({
  getMyGroups: () => getMyGroups(),
  getPublicGroups: () => getPublicGroups(),
  getGroupInvitations: () => getGroupInvitations(),
  createGroup: (...args: unknown[]) => createGroup(...args),
  respondToGroupInvitation: (...args: unknown[]) => respondToGroupInvitation(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

describe('GroupsPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getMyGroups.mockReset();
    getPublicGroups.mockReset();
    getGroupInvitations.mockReset();
    createGroup.mockReset();
    respondToGroupInvitation.mockReset();
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
        <MemoryRouter>
          <GroupsPage />
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

  it('shows public groups to a visitor who is not logged in', async () => {
    getPublicGroups.mockResolvedValue([{ id: 'g1', name: 'Öppen grupp', isPublic: true }]);
    await renderPage();

    expect(getPublicGroups).toHaveBeenCalled();
    expect(getMyGroups).not.toHaveBeenCalled();
    expect(getGroupInvitations).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Öppen grupp');

    const loginButton = getButtonByText('Logga in');
    expect(loginButton).toBeDefined();
  });

  it('shows my groups and hides them from the public list', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({}));
    getMyGroups.mockResolvedValue([{ id: 'g1', name: 'Öppen grupp', isPublic: true }]);
    getPublicGroups.mockResolvedValue([
      { id: 'g1', name: 'Öppen grupp', isPublic: true },
      { id: 'g2', name: 'Annan grupp', isPublic: true },
    ]);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const pageText = document.body.textContent;
    expect(pageText?.match(/Öppen grupp/g)?.length).toBe(1);
    expect(pageText).toContain('Annan grupp');
  });

  it('shows no member count on the cards', async () => {
    getPublicGroups.mockResolvedValue([{ id: 'g1', name: 'Öppen grupp', isPublic: true }]);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent?.match(/medlem/i)).toBeNull();
  });

  it('accepting an invitation removes it and reloads my groups', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({}));
    getGroupInvitations.mockResolvedValue([
      {
        id: 'i1',
        groupId: 'g3',
        groupName: 'Barngruppen',
        invitedByDisplayName: 'Anna',
      },
    ]);
    getMyGroups.mockResolvedValue([]);
    respondToGroupInvitation.mockResolvedValue(undefined);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Barngruppen');

    const acceptButton = getButtonByText('Acceptera');
    expect(acceptButton).toBeDefined();

    await act(async () => {
      acceptButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(respondToGroupInvitation).toHaveBeenCalledWith('i1', { accept: true });
    expect(getMyGroups).toHaveBeenCalledTimes(2);
  });

  it('declining an invitation removes it', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({}));
    getGroupInvitations.mockResolvedValue([
      {
        id: 'i1',
        groupId: 'g3',
        groupName: 'Barngruppen',
        invitedByDisplayName: 'Anna',
      },
    ]);
    respondToGroupInvitation.mockResolvedValue(undefined);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const declineButton = getButtonByText('Avböj');
    expect(declineButton).toBeDefined();

    await act(async () => {
      declineButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(respondToGroupInvitation).toHaveBeenCalledWith('i1', { accept: false });
  });

  it('creates a group', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({}));
    getMyGroups.mockResolvedValue([]);
    getPublicGroups.mockResolvedValue([]);
    createGroup.mockResolvedValue({ id: 'g4', name: 'Barngruppen', isPublic: false });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const newGroupButton = getButtonByText('Ny grupp');
    expect(newGroupButton).toBeDefined();

    await act(async () => {
      newGroupButton?.click();
    });

    const groupNameInput = getInputByLabel('Gruppens namn');
    expect(groupNameInput).toBeDefined();

    if (groupNameInput) typeInto(groupNameInput, 'Barngruppen');

    const createButton = getButtonByText('Skapa grupp');
    expect(createButton).toBeDefined();

    await act(async () => {
      createButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(createGroup).toHaveBeenCalledWith({ name: 'Barngruppen', isPublic: false });
    expect(document.body.textContent).toContain('Barngruppen');
  });

  it('each group card links to its group page', async () => {
    getPublicGroups.mockResolvedValue([{ id: 'g1', name: 'Öppen grupp', isPublic: true }]);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const link = document.querySelector('a[href="/groups/g1"]');
    expect(link).toBeDefined();
  });

  it('after accepting an invitation, if getMyGroups fails, shows update list error toast', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({}));
    getGroupInvitations.mockResolvedValue([
      {
        id: 'i1',
        groupId: 'g3',
        groupName: 'Barngruppen',
        invitedByDisplayName: 'Anna',
      },
    ]);
    getMyGroups.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Network error'));
    respondToGroupInvitation.mockResolvedValue(undefined);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const acceptButton = getButtonByText('Acceptera');
    await act(async () => {
      acceptButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(respondToGroupInvitation).toHaveBeenCalledWith('i1', { accept: true });
    expect(document.body.textContent).toContain('Det gick inte att uppdatera listan. Ladda om sidan.');
  });

  it('renders public groups only after my groups have loaded for logged-in user', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({}));
    const getPublicGroupsPromise = new Promise<Array<{ id: string; name: string; isPublic: boolean }>>(
      (resolve) => {
        setTimeout(() => resolve([{ id: 'g1', name: 'Öppen grupp', isPublic: true }]), 50);
      },
    );
    const getMyGroupsPromise = new Promise<Array<{ id: string; name: string; isPublic: boolean }>>(
      (resolve) => {
        setTimeout(() => resolve([{ id: 'g2', name: 'Min grupp', isPublic: false }]), 200);
      },
    );
    getPublicGroups.mockReturnValue(getPublicGroupsPromise);
    getMyGroups.mockReturnValue(getMyGroupsPromise);
    getGroupInvitations.mockResolvedValue([]);

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const pageText = document.body.textContent;
    expect(pageText).not.toContain('Öppen grupp');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    const pageTextAfter = document.body.textContent;
    expect(pageTextAfter).toContain('Öppen grupp');
    expect(pageTextAfter).toContain('Min grupp');
  });

  it('shows error message when getPublicGroups fails', async () => {
    getPublicGroups.mockRejectedValue(new Error('Network error'));
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Det gick inte att hämta grupperna');
  });

  it('does not fetch my groups when authLoading is true', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({}, { isLoading: true }));
    getPublicGroups.mockResolvedValue([]);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(getMyGroups).not.toHaveBeenCalled();
    expect(getGroupInvitations).not.toHaveBeenCalled();
  });

  it('renders the new group button small', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({}));
    getMyGroups.mockResolvedValue([]);
    getPublicGroups.mockResolvedValue([]);
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const newButton = getButtonByText('Ny grupp');
    expect(newButton).toBeDefined();
    expect(newButton?.className).toContain('px-3');
    expect(newButton?.className).toContain('py-1.5');
    expect(newButton?.className).not.toContain('px-4');
  });

  it('shows that a group name is taken', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({}));
    getMyGroups.mockResolvedValue([]);
    getPublicGroups.mockResolvedValue([]);
    createGroup.mockRejectedValue(new ApiError('Conflict', 409));
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const newGroupButton = getButtonByText('Ny grupp');
    await act(async () => {
      newGroupButton?.click();
    });

    const groupNameInput = getInputByLabel('Gruppens namn');
    if (groupNameInput) typeInto(groupNameInput, 'Barngruppen');

    const createButton = getButtonByText('Skapa grupp');
    await act(async () => {
      createButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Det finns redan en grupp som heter så.');
  });
});
