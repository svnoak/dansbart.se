import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlaylistSettingsPage } from './PlaylistSettingsPage';
import { authValue, loggedInAuthValue } from '@/test/authValue';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getPlaylist = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/playlists/playlists', () => ({
  getPlaylist: (...args: unknown[]) => getPlaylist(...args),
  updatePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  generateShareToken: vi.fn(),
  invalidateShareToken: vi.fn(),
  inviteCollaborator: vi.fn(),
  updateCollaborator: vi.fn(),
  removeCollaborator: vi.fn(),
  transferOwnership: vi.fn(),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

describe('PlaylistSettingsPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getPlaylist.mockReset();
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
});
