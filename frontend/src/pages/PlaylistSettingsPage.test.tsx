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
const updateCollaborator = vi.fn();
const removeCollaborator = vi.fn();
const transferOwnership = vi.fn();
const deletePlaylist = vi.fn();
const useAuth = vi.fn();
const toast = vi.fn();

vi.mock('@/api/generated/playlists/playlists', () => ({
  getPlaylist: (...args: unknown[]) => getPlaylist(...args),
  updatePlaylist: (...args: unknown[]) => updatePlaylist(...args),
  deletePlaylist: (...args: unknown[]) => deletePlaylist(...args),
  generateShareToken: vi.fn(),
  invalidateShareToken: vi.fn(),
  inviteCollaborator: (...args: unknown[]) => inviteCollaborator(...args),
  updateCollaborator: (...args: unknown[]) => updateCollaborator(...args),
  removeCollaborator: (...args: unknown[]) => removeCollaborator(...args),
  transferOwnership: (...args: unknown[]) => transferOwnership(...args),
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
    updateCollaborator.mockReset();
    removeCollaborator.mockReset();
    transferOwnership.mockReset();
    deletePlaylist.mockReset();
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

    const errorAlert = Array.from(document.body.querySelectorAll('[role="alert"]')).find((el) =>
      el.closest('section')?.textContent?.includes('Om spellistan'),
    );
    expect(errorAlert?.textContent).toBe('Det gick inte att spara beskrivningen.');
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), 'error');
    expect(saveButton?.disabled).toBe(false);
  });

  it('clears the description error when the text changes', async () => {
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

    await act(async () => {
      saveButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const errorAlert = Array.from(document.body.querySelectorAll('[role="alert"]')).find((el) =>
      el.closest('section')?.textContent?.includes('Om spellistan'),
    );
    expect(errorAlert?.textContent).toBe('Det gick inte att spara beskrivningen.');

    await act(async () => {
      typeInto(descriptionField as HTMLTextAreaElement, 'Ännu en ny beskrivning');
    });

    const errorAlertAfterChange = Array.from(document.body.querySelectorAll('[role="alert"]')).find((el) =>
      el.closest('section')?.textContent?.includes('Om spellistan'),
    );
    expect(errorAlertAfterChange).toBeUndefined();
  });

  it('clears the description error after a successful retry', async () => {
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
    updatePlaylist.mockRejectedValueOnce(new Error('Save failed'));
    updatePlaylist.mockResolvedValueOnce({
      id: 'p1',
      name: 'Min spellista',
      description: 'Lyckat sparad',
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

    await act(async () => {
      typeInto(descriptionField as HTMLTextAreaElement, 'Första försök');
    });

    const saveButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Spara' && btn.closest('section')?.textContent?.includes('Om spellistan'),
    );

    await act(async () => {
      saveButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const errorAlert = Array.from(document.body.querySelectorAll('[role="alert"]')).find((el) =>
      el.closest('section')?.textContent?.includes('Om spellistan'),
    );
    expect(errorAlert?.textContent).toBe('Det gick inte att spara beskrivningen.');

    await act(async () => {
      typeInto(descriptionField as HTMLTextAreaElement, 'Lyckat sparad');
    });

    await act(async () => {
      saveButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const errorAlertAfterRetry = Array.from(document.body.querySelectorAll('[role="alert"]')).find((el) =>
      el.closest('section')?.textContent?.includes('Om spellistan'),
    );
    expect(errorAlertAfterRetry).toBeUndefined();
    expect(toast).toHaveBeenCalledWith('Beskrivningen är sparad.');
  });

  it('a failed visibility change shows an error inline near the toggle', async () => {
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
    updatePlaylist.mockRejectedValue(new Error('Visibility failed'));

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const toggleButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Gör offentlig',
    );
    expect(toggleButton).toBeTruthy();

    await act(async () => {
      toggleButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const errorAlert = Array.from(document.body.querySelectorAll('[role="alert"]')).find((el) =>
      el.closest('section')?.textContent?.includes('Synlighet'),
    );
    expect(errorAlert?.textContent).toBe('Kunde inte ändra synlighet');
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), 'error');
  });

  it('a failed permission change shows an error inline in the collaborator row', async () => {
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
        { id: 'c1', userId: 'u2', username: 'user2', displayName: 'User 2', permission: 'view', status: 'accepted' },
      ],
    });
    updateCollaborator.mockRejectedValue(new Error('Permission failed'));

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const permissionSelect = Array.from(document.body.querySelectorAll('select')).find((sel) =>
      Array.from(sel.querySelectorAll('option')).some((opt) => opt.textContent === 'Redigera'),
    ) as HTMLSelectElement;
    expect(permissionSelect).toBeTruthy();

    const row = permissionSelect.closest('.px-4.py-3');
    expect(row).toBeTruthy();

    await act(async () => {
      permissionSelect.value = 'edit';
      permissionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const errorAlert = row?.querySelector('[role="alert"]');
    expect(errorAlert?.textContent).toBe('Kunde inte ändra behörighet');
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), 'error');
  });

  it('a failed collaborator removal shows an error inline in the collaborator row', async () => {
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
        { id: 'c1', userId: 'u2', username: 'user2', displayName: 'User 2', permission: 'view', status: 'accepted' },
      ],
    });
    removeCollaborator.mockRejectedValue(new Error('Remove failed'));

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const removeButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Ta bort',
    );
    expect(removeButton).toBeTruthy();

    const row = removeButton?.closest('.px-4.py-3');
    expect(row).toBeTruthy();

    await act(async () => {
      removeButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const errorAlert = row?.querySelector('[role="alert"]');
    expect(errorAlert?.textContent).toBe('Kunde inte ta bort samarbetare');
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), 'error');
  });

  it('a failed ownership transfer shows an error inline near the transfer control', async () => {
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
    transferOwnership.mockRejectedValue(new Error('Transfer failed'));

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const transferSelect = Array.from(document.body.querySelectorAll('select')).find((sel) =>
      Array.from(sel.querySelectorAll('option')).some((opt) => opt.textContent === 'User 2'),
    ) as HTMLSelectElement;
    expect(transferSelect).toBeTruthy();

    await act(async () => {
      transferSelect.value = 'u2';
      transferSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const transferButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Överlåt',
    );
    expect(transferButton).toBeTruthy();

    await act(async () => {
      transferButton?.click();
    });

    const confirmButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Bekräfta',
    );
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      confirmButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const errorAlert = Array.from(document.body.querySelectorAll('[role="alert"]')).find((el) =>
      el.closest('section')?.textContent?.includes('Överlåt ägarskap'),
    );
    expect(errorAlert?.textContent).toBe('Kunde inte överlåta ägarskap');
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), 'error');
  });

  it('a failed playlist deletion shows an error inline near the delete control', async () => {
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
    deletePlaylist.mockRejectedValue(new Error('Delete failed'));

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const deleteButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Radera spellista',
    );
    expect(deleteButton).toBeTruthy();

    await act(async () => {
      deleteButton?.click();
    });

    const confirmInput = document.body.querySelector('input[type="text"]') as HTMLInputElement;
    expect(confirmInput).toBeTruthy();

    await act(async () => {
      typeInto(confirmInput, 'Min spellista');
    });

    const confirmDeleteButton = Array.from(document.body.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Radera permanent',
    );
    expect(confirmDeleteButton).toBeTruthy();

    await act(async () => {
      confirmDeleteButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const errorAlert = Array.from(document.body.querySelectorAll('[role="alert"]')).find((el) =>
      el.closest('section')?.textContent?.includes('Farlig zon'),
    );
    expect(errorAlert?.textContent).toBe('Kunde inte radera spellista');
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), 'error');
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

      const usernameInput = getInputByLabel('Användarnamn');
      expect(usernameInput).toBeTruthy();

      await act(async () => {
        typeInto(usernameInput as HTMLInputElement, 'anna');
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

      expect(inviteCollaborator).toHaveBeenCalledWith('p1', {
        username: 'anna',
        permission: 'view',
      });
      expect(document.body.textContent).toContain('Du kan inte bjuda in dig själv.');
    } finally {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it('shows a message when no user has the name', async () => {
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
      inviteCollaborator.mockRejectedValue(new ApiError('Unprocessable Entity', 422));

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

      const usernameInput = getInputByLabel('Användarnamn');
      expect(usernameInput).toBeTruthy();

      await act(async () => {
        typeInto(usernameInput as HTMLInputElement, 'spokelse');
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

      expect(document.body.textContent).toContain(
        'Ingen användare heter så. Kontrollera stavningen.',
      );
    } finally {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });
});
