import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SharedPlaylistPage } from './SharedPlaylistPage';
import { authValue } from '@/test/authValue';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getPlaylistByShareToken = vi.fn();
const getPublicPlaylist = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/manual/publicLists', () => ({
  getPublicPlaylist: (...args: unknown[]) => getPublicPlaylist(...args),
}));

vi.mock('@/api/generated/playlists/playlists', () => ({
  getPlaylistByShareToken: (...args: unknown[]) => getPlaylistByShareToken(...args),
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

describe('SharedPlaylistPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getPlaylistByShareToken.mockReset();
    getPublicPlaylist.mockReset();
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
        <MemoryRouter initialEntries={['/shared/token123']}>
          <Routes>
            <Route path="/shared/:token" element={<SharedPlaylistPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  async function renderPublicPage() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/playlists/p1']}>
          <Routes>
            <Route path="/playlists/:id" element={<SharedPlaylistPage source="public" />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  }

  it('shows the group as owner', async () => {
    getPlaylistByShareToken.mockResolvedValue({
      id: 'p1',
      name: 'Gruppens spellista',
      description: undefined,
      isPublic: false,
      ownerGroup: { id: 'g1', name: 'Barngruppen', isPublic: true },
      owner: undefined,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Av gruppen Barngruppen');
  });

  it('shows the person as owner', async () => {
    getPlaylistByShareToken.mockResolvedValue({
      id: 'p1',
      name: 'Annas spellista',
      description: undefined,
      isPublic: false,
      owner: { id: 'u1', username: 'anna', displayName: 'Anna' },
      ownerGroup: undefined,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain('Av Anna');
  });

  it('opens a public playlist by its id from the public API', async () => {
    getPublicPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Bygdedans',
      owner: { id: 'u1', username: 'anna', displayName: 'Anna' },
      trackCount: 0,
      tracks: [],
    });

    await renderPublicPage();

    expect(getPublicPlaylist).toHaveBeenCalledWith('p1', expect.anything());
    expect(getPlaylistByShareToken).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Bygdedans');
    expect(document.body.textContent).toContain('Av Anna');
  });

  it('says that a private or missing playlist was not found, with a hint to sign in', async () => {
    getPublicPlaylist.mockRejectedValue(new Error('not found'));

    await renderPublicPage();

    expect(document.body.textContent).toContain('Spellistan hittades inte');
    expect(document.body.textContent).toContain('Logga in om det är din spellista.');
  });
});
