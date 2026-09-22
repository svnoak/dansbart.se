import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlaylistPage } from './PlaylistPage';
import { authValue, loggedInAuthValue } from '@/test/authValue';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getPlaylist = vi.fn();
const getStyleTree = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/playlists/playlists', () => ({
  getPlaylist: (...args: unknown[]) => getPlaylist(...args),
  removeTrack: vi.fn(),
  updatePlaylist: vi.fn(),
  reorderTracks: vi.fn(),
}));

vi.mock('@/api/generated/styles/styles', () => ({
  getStyleTree: (...args: unknown[]) => getStyleTree(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => ({ play: vi.fn() }),
}));

vi.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

describe('PlaylistPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getPlaylist.mockReset();
    getStyleTree.mockReset();
    useAuth.mockReset();
    useAuth.mockReturnValue(authValue());
    getStyleTree.mockResolvedValue([]);
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
        <MemoryRouter initialEntries={['/playlists/p1']}>
          <Routes>
            <Route path="/playlists/:id" element={<PlaylistPage />} />
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

  it('a group playlist shows the group as owner', async () => {
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
    const settingsButton = getButtonByText('Ändra inställningar');
    expect(settingsButton).toBeDefined();
  });

  it('viewerCanManage false hides owner controls', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Gruppens spellista',
      description: undefined,
      isPublic: false,
      ownerGroup: { id: 'g1', name: 'Barngruppen', isPublic: true },
      owner: undefined,
      viewerCanManage: false,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const settingsButton = getButtonByText('Ändra inställningar');
    expect(settingsButton).toBeUndefined();
  });
});
