import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlaylistSettingsPage } from './PlaylistSettingsPage';
import { authValue, loggedInAuthValue } from '@/test/authValue';
import { typeInto } from '@/test/typeInto';
import { getInputByLabel } from '@/test/getInputByLabel';
import { ApiError } from '@/api/http-client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getPlaylist = vi.fn();
const updatePlaylist = vi.fn();
const inviteCollaborator = vi.fn();
const searchUsers = vi.fn();
const useAuth = vi.fn();
const toast = vi.fn();

vi.mock('@/api/generated/playlists/playlists', () => ({
  getPlaylist: (...args: unknown[]) => getPlaylist(...args),
  updatePlaylist: (...args: unknown[]) => updatePlaylist(...args),
  deletePlaylist: vi.fn(),
  generateShareToken: vi.fn(),
  invalidateShareToken: vi.fn(),
  inviteCollaborator: (...args: unknown[]) => inviteCollaborator(...args),
  updateCollaborator: vi.fn(),
  removeCollaborator: vi.fn(),
  transferOwnership: vi.fn(),
}));

vi.mock('@/api/generated/users/users', () => ({
  searchUsers: (...args: unknown[]) => searchUsers(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/ui', async () => {
  const actual = await vi.importActual<typeof import('@/ui')>('@/ui');
  return {
    ...actual,
    toast: (...args: unknown[]) => toast(...args),
  };
});

describe('PlaylistSettingsPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getPlaylist.mockReset();
    updatePlaylist.mockReset();
    inviteCollaborator.mockReset();
    searchUsers.mockReset();
    useAuth.mockReset();
    toast.mockReset();
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
        <MemoryRouter initialEntries={['/playlists/p1/settings']}>
          <Routes>
            <Route path="/playlists/:id/settings" element={<PlaylistSettingsPage />} />
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

  it('a group playlist shows the group as owner and no transfer', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Gruppens spellista',
      description: undefined,
      isPublic: false,
      ownerGroup: { id: 'g1', name: 'Barngruppen', isPublic: true },
      owner: undefined,
      viewerCanManage: true,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Ägs av gruppen Barngruppen');
    const groupLink = getLinkByText('Barngruppen');
    expect(groupLink).toBeDefined();
    expect(groupLink?.getAttribute('href')).toBe('/groups/g1');
    expect(document.body.textContent).not.toContain('Överlåt ägarskap');
  });

  it('a personal playlist owner still sees transfer', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Min spellista',
      description: undefined,
      isPublic: false,
      owner: { id: 'u1', username: 'user1', displayName: 'User 1' },
      ownerGroup: undefined,
      viewerCanManage: true,
      trackCount: 0,
      tracks: [],
      collaborators: [
        { id: 'c1', userId: 'u2', username: 'user2', displayName: 'User 2', permission: 'edit', status: 'accepted' },
      ],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Överlåt ägarskap');
  });

  it('an editor can save a new description', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Min spellista',
      description: 'Gamla texten',
      isPublic: false,
      owner: { id: 'u1', username: 'user1', displayName: 'User 1' },
      ownerGroup: undefined,
      viewerCanManage: true,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });
    updatePlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Min spellista',
      description: 'Lugna valser för nybörjare',
      isPublic: false,
      owner: { id: 'u1', username: 'user1', displayName: 'User 1' },
      ownerGroup: undefined,
      viewerCanManage: true,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const descriptionField = getInputByLabel('Beskrivning');
    expect(descriptionField).toBeTruthy();
    expect(descriptionField?.value).toBe('Gamla texten');

    await act(async () => {
      typeInto(descriptionField as HTMLTextAreaElement, 'Lugna valser för nybörjare');
    });

    const saveButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Spara' && btn.closest('section')?.textContent?.includes('Om spellistan'),
    );
    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(updatePlaylist).toHaveBeenCalledWith('p1', {
      description: 'Lugna valser för nybörjare',
    });
  });

  it('a viewer does not see the description field', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Min spellista',
      description: 'Gamla texten',
      isPublic: false,
      owner: { id: 'u2', username: 'user2', displayName: 'User 2' },
      ownerGroup: undefined,
      viewerCanManage: false,
      trackCount: 0,
      tracks: [],
      collaborators: [
        { id: 'c1', userId: 'u1', username: 'user1', displayName: 'User 1', permission: 'view', status: 'accepted' },
      ],
    });

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const descriptionField = getInputByLabel('Beskrivning');
    expect(descriptionField).toBeNull();
  });

  it('an edit collaborator can save a new description', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Min spellista',
      description: 'Gamla texten',
      isPublic: false,
      owner: { id: 'u2', username: 'user2', displayName: 'User 2' },
      ownerGroup: undefined,
      viewerCanManage: false,
      trackCount: 0,
      tracks: [],
      collaborators: [
        { id: 'c1', userId: 'u1', username: 'user1', displayName: 'User 1', permission: 'edit', status: 'accepted' },
      ],
    });
    updatePlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Min spellista',
      description: 'Ny beskrivning',
      isPublic: false,
      owner: { id: 'u2', username: 'user2', displayName: 'User 2' },
      ownerGroup: undefined,
      viewerCanManage: false,
      trackCount: 0,
      tracks: [],
      collaborators: [
        { id: 'c1', userId: 'u1', username: 'user1', displayName: 'User 1', permission: 'edit', status: 'accepted' },
      ],
    });

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const descriptionField = getInputByLabel('Beskrivning');
    expect(descriptionField).toBeTruthy();
    expect(descriptionField?.value).toBe('Gamla texten');

    await act(async () => {
      typeInto(descriptionField as HTMLTextAreaElement, 'Ny beskrivning');
    });

    const saveButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Spara' && btn.closest('section')?.textContent?.includes('Om spellistan'),
    );
    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(updatePlaylist).toHaveBeenCalledWith('p1', {
      description: 'Ny beskrivning',
    });
  });

  it('a failed save shows an error and re-enables the button', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Min spellista',
      description: 'Gamla texten',
      isPublic: false,
      owner: { id: 'u2', username: 'user2', displayName: 'User 2' },
      ownerGroup: undefined,
      viewerCanManage: false,
      trackCount: 0,
      tracks: [],
      collaborators: [
        { id: 'c1', userId: 'u1', username: 'user1', displayName: 'User 1', permission: 'edit', status: 'accepted' },
      ],
    });
    updatePlaylist.mockRejectedValue(new Error('Save failed'));

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const descriptionField = getInputByLabel('Beskrivning');
    expect(descriptionField).toBeTruthy();

    await act(async () => {
      typeInto(descriptionField as HTMLTextAreaElement, 'Ny beskrivning');
    });

    const saveButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Spara' && btn.closest('section')?.textContent?.includes('Om spellistan'),
    );
    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(toast).toHaveBeenCalledWith('Det gick inte att spara beskrivningen.', 'error');
    expect(saveButton?.disabled).toBe(false);
  });

  it('invite form offers the permissions Se and Redigera', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Min spellista',
      description: undefined,
      isPublic: false,
      owner: { id: 'u1', username: 'user1', displayName: 'User 1' },
      ownerGroup: undefined,
      viewerCanManage: true,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const inviteButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Bjud in till spellista'),
    );
    expect(inviteButton).toBeTruthy();

    await act(async () => {
      inviteButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const permissionSelects = Array.from(document.body.querySelectorAll('select'));
    const permissionSelect = permissionSelects[permissionSelects.length - 1];
    expect(permissionSelect).toBeTruthy();

    const options = Array.from(permissionSelect?.querySelectorAll('option') ?? []);
    const optionTexts = options.map((opt) => opt.textContent);

    expect(optionTexts).toContain('Se');
    expect(optionTexts).toContain('Redigera');
    expect(optionTexts).not.toContain('Visare');
    expect(optionTexts).not.toContain('Redaktör');
  });

  it('when inviteCollaborator rejects with ApiError 400, the page shows the error inline', async () => {
    vi.useFakeTimers();
    try {
      useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
      getPlaylist.mockResolvedValue({
        id: 'p1',
        name: 'Min spellista',
        description: undefined,
        isPublic: false,
        owner: { id: 'u1', username: 'user1', displayName: 'User 1' },
        ownerGroup: undefined,
        viewerCanManage: true,
        trackCount: 0,
        tracks: [],
        collaborators: [],
      });
      searchUsers.mockResolvedValue([
        { id: 'u2', username: 'anna', displayName: 'Anna' },
      ]);
      inviteCollaborator.mockRejectedValue(new ApiError('Bad Request', 400));

      await renderPage();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      const inviteButton = Array.from(document.body.querySelectorAll('button')).find(
        (btn) => btn.textContent?.trim() === '+ Bjud in till spellista',
      );
      expect(inviteButton).toBeTruthy();

      await act(async () => {
        inviteButton?.click();
      });

      const searchInput = document.body.querySelector('input[type="search"]') as HTMLInputElement;
      typeInto(searchInput, 'an');

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      await act(async () => {
        await Promise.resolve();
      });

      const annaButton = Array.from(document.body.querySelectorAll('button')).find(
        (btn) => btn.textContent?.includes('Anna'),
      );
      await act(async () => {
        annaButton?.click();
      });

      const submitButton = Array.from(document.body.querySelectorAll('button')).find(
        (btn) => btn.textContent?.trim() === 'Bjud in',
      );
      await act(async () => {
        submitButton?.click();
        vi.advanceTimersByTime(100);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(document.body.textContent).toContain('Du kan inte bjuda in dig själv.');
    } finally {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });
});
