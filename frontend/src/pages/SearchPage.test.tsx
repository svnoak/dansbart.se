import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SearchPage } from './SearchPage';
import { authValue } from '@/test/authValue';
import { FavoritesProvider } from '@/favorites/FavoritesContext';
import { ThemeProvider } from '@/theme/ThemeContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getTracks = vi.fn();
const getPlaylist = vi.fn();
const getStyleOverview = vi.fn();
const getFavoriteIds = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/tracks/tracks', () => ({
  getTracks: (...args: unknown[]) => getTracks(...args),
}));

vi.mock('@/api/generated/playlists/playlists', () => ({
  getPlaylist: (...args: unknown[]) => getPlaylist(...args),
  addTrack: vi.fn(),
}));

vi.mock('@/api/generated/discovery/discovery', () => ({
  getStyleOverview: (...args: unknown[]) => getStyleOverview(...args),
}));

vi.mock('@/api/generated/artists/artists', () => ({
  searchArtists: vi.fn(),
  getArtists: vi.fn(),
}));

vi.mock('@/api/generated/albums/albums', () => ({
  searchAlbums: vi.fn(),
  getAlbums: vi.fn(),
}));

vi.mock('@/api/generated/favorites/favorites', () => ({
  getFavoriteIds: (...args: unknown[]) => getFavoriteIds(...args),
  toggleFavorite: vi.fn(),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/analytics/useAnalyticsFlag', () => ({
  useAnalyticsFlag: vi.fn(),
}));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => ({ play: vi.fn() }),
}));

describe('SearchPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getTracks.mockReset();
    getPlaylist.mockReset();
    getStyleOverview.mockReset();
    getFavoriteIds.mockReset();
    useAuth.mockReset();
    useAuth.mockReturnValue(authValue());
    getStyleOverview.mockResolvedValue([]);
    getTracks.mockResolvedValue({ items: [], total: 0 });
    getFavoriteIds.mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function renderPageAt(pathname: string) {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <FavoritesProvider>
            <MemoryRouter initialEntries={[pathname]}>
              <Routes>
                <Route path="/search" element={<SearchPage />} />
              </Routes>
            </MemoryRouter>
          </FavoritesProvider>
        </ThemeProvider>,
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

  it('shows which playlist tracks go to', async () => {
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Fest',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: undefined,
      viewerCanManage: true,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });

    await renderPageAt('/search?addTo=p1');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const bannerText = document.body.textContent?.includes('Du lägger till låtar i Fest');
    expect(bannerText).toBe(true);
  });

  it('Klar returns to the playlist', async () => {
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Fest',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: undefined,
      viewerCanManage: false,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });

    await renderPageAt('/search?addTo=p1');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const doneLink = getLinkByText('Klar');
    expect(doneLink).toBeDefined();
    expect(doneLink?.getAttribute('href')).toBe('/playlists/p1');
  });

  it('track rows get the one-tap add', async () => {
    getTracks.mockResolvedValue({
      items: [
        {
          id: 'track1',
          title: 'Test Track',
          artistName: 'Test Artist',
          danceStyle: 'Polska',
          tempoCategory: undefined,
          confidence: 0.9,
          durationMs: 180000,
        },
      ],
      total: 1,
    });

    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Fest',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: undefined,
      viewerCanManage: true,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });

    await renderPageAt('/search?addTo=p1');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    const addButton = getButtonByText('Lägg till');
    expect(addButton).toBeDefined();
  });

  it('a viewer gets no one-tap add', async () => {
    getTracks.mockResolvedValue({
      items: [
        {
          id: 'track1',
          title: 'Test Track',
          artistName: 'Test Artist',
          danceStyle: 'Polska',
          tempoCategory: undefined,
          confidence: 0.9,
          durationMs: 180000,
        },
      ],
      total: 1,
    });

    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Fest',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: undefined,
      viewerCanManage: false,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });

    await renderPageAt('/search?addTo=p1');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    const addButton = getButtonByText('Lägg till');
    expect(addButton).toBeUndefined();

    const bannerText = document.body.textContent?.includes('Du lägger till låtar i');
    expect(bannerText).toBe(false);

    const errorText = document.body.textContent?.includes('Du kan inte lägga till låtar i den här spellistan.');
    expect(errorText).toBe(true);
  });

  it('normal search has no banner', async () => {
    getTracks.mockResolvedValue({ items: [], total: 0 });

    await renderPageAt('/search');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const bannerText = document.body.textContent?.includes('Du lägger till låtar i');
    expect(bannerText).toBe(false);

    const addButton = getButtonByText('Lägg till');
    expect(addButton).toBeUndefined();
  });
});
