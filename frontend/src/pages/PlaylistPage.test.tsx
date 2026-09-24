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
const generateShareToken = vi.fn();
const invalidateShareToken = vi.fn();

vi.mock('@/api/generated/playlists/playlists', () => ({
  getPlaylist: (...args: unknown[]) => getPlaylist(...args),
  removeTrack: vi.fn(),
  updatePlaylist: vi.fn(),
  reorderTracks: vi.fn(),
  generateShareToken: (...args: unknown[]) => generateShareToken(...args),
  invalidateShareToken: (...args: unknown[]) => invalidateShareToken(...args),
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

vi.mock('@/favorites/useFavorites', () => ({
  useFavorites: () => ({
    isFavorited: () => false,
    toggleFavorite: vi.fn(),
  }),
}));

describe('PlaylistPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getPlaylist.mockReset();
    getStyleTree.mockReset();
    useAuth.mockReset();
    generateShareToken.mockReset();
    invalidateShareToken.mockReset();
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

  it('shows the actions in order', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Teststlista',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: { id: 'u1', username: 'user1' },
      viewerCanManage: true,
      trackCount: 1,
      tracks: [{
        id: 'pt1',
        track: {
          id: 'track1',
          title: 'Test Track',
          artistName: 'Test Artist',
          danceStyle: 'Polska',
          tempoCategory: undefined,
          confidence: 0.9,
          durationMs: 180000,
        },
        position: 0,
      }],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const playButton = getButtonByText('Spela');
    const addButton = getLinkByText('Lägg till låtar');
    const shareButton = getButtonByText('Dela spellista');
    const settingsButton = getButtonByText('Ändra inställningar');

    expect(playButton).toBeDefined();
    expect(addButton).toBeDefined();
    expect(shareButton).toBeDefined();
    expect(settingsButton).toBeDefined();

    if (playButton && addButton && shareButton && settingsButton) {
      const playIndex = Array.from(document.body.querySelectorAll('*')).indexOf(playButton);
      const addIndex = Array.from(document.body.querySelectorAll('*')).indexOf(addButton);
      const shareIndex = Array.from(document.body.querySelectorAll('*')).indexOf(shareButton);
      const settingsIndex = Array.from(document.body.querySelectorAll('*')).indexOf(settingsButton);

      expect(playIndex).toBeLessThan(addIndex);
      expect(addIndex).toBeLessThan(shareIndex);
      expect(shareIndex).toBeLessThan(settingsIndex);
    }
  });

  it('hides Spela without tracks', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Tom spellista',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: { id: 'u1', username: 'user1' },
      viewerCanManage: true,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const playButton = getButtonByText('Spela');
    expect(playButton).toBeUndefined();
  });

  it('Lägg till låtar opens search for this playlist', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Teststlista',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: { id: 'u1', username: 'user1' },
      viewerCanManage: true,
      trackCount: 1,
      tracks: [{
        id: 'pt1',
        track: {
          id: 'track1',
          title: 'Test Track',
          artistName: 'Test Artist',
          danceStyle: 'Polska',
          tempoCategory: undefined,
          confidence: 0.9,
          durationMs: 180000,
        },
        position: 0,
      }],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const addLink = getLinkByText('Lägg till låtar');
    expect(addLink).toBeDefined();
    if (addLink) {
      expect(addLink.getAttribute('href')).toBe('/search?addTo=p1');
    }
  });

  it('a viewer sees Spela but not Lägg till låtar or Ändra inställningar', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Delad spellista',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: { id: 'u2', username: 'other' },
      viewerCanManage: false,
      trackCount: 1,
      tracks: [{
        id: 'pt1',
        track: {
          id: 'track1',
          title: 'Test Track',
          artistName: 'Test Artist',
          danceStyle: 'Polska',
          tempoCategory: undefined,
          confidence: 0.9,
          durationMs: 180000,
        },
        position: 0,
      }],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const playButton = getButtonByText('Spela');
    const addLink = getLinkByText('Lägg till låtar');
    const settingsButton = getButtonByText('Ändra inställningar');

    expect(playButton).toBeDefined();
    expect(addLink).toBeUndefined();
    expect(settingsButton).toBeUndefined();
  });

  it('an editor creates a share link', async () => {
    generateShareToken.mockResolvedValue({ shareToken: 'new-token' });

    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Teststlista',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: { id: 'u1', username: 'user1' },
      viewerCanManage: true,
      trackCount: 1,
      shareToken: undefined,
      tracks: [{
        id: 'pt1',
        track: {
          id: 'track1',
          title: 'Test Track',
          artistName: 'Test Artist',
          danceStyle: 'Polska',
          tempoCategory: undefined,
          confidence: 0.9,
          durationMs: 180000,
        },
        position: 0,
      }],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const shareButton = getButtonByText('Dela spellista');
    expect(shareButton).toBeDefined();

    if (shareButton) {
      await act(async () => {
        shareButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    const createLinkButton = getButtonByText('Skapa länk');
    expect(createLinkButton).toBeDefined();

    if (createLinkButton) {
      await act(async () => {
        createLinkButton.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    }

    expect(generateShareToken).toHaveBeenCalledWith('p1');

    const copyLinkButton = getButtonByText('Kopiera länk');
    expect(copyLinkButton).toBeDefined();
  });

  it("a visitor copies a public playlist's address", async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Publik spellista',
      description: undefined,
      isPublic: true,
      ownerGroup: undefined,
      owner: { id: 'u2', username: 'other' },
      viewerCanManage: false,
      trackCount: 1,
      shareToken: undefined,
      tracks: [{
        id: 'pt1',
        track: {
          id: 'track1',
          title: 'Test Track',
          artistName: 'Test Artist',
          danceStyle: 'Polska',
          tempoCategory: undefined,
          confidence: 0.9,
          durationMs: 180000,
        },
        position: 0,
      }],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const shareButton = getButtonByText('Dela spellista');
    expect(shareButton).toBeDefined();

    if (shareButton) {
      await act(async () => {
        shareButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    const copyLinkButton = getButtonByText('Kopiera länk');
    const createLinkButton = getButtonByText('Skapa länk');

    expect(copyLinkButton).toBeDefined();
    expect(createLinkButton).toBeUndefined();
  });

  it('Dela spellista is hidden for a private playlist the viewer cannot manage', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Privat spellista',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: { id: 'u2', username: 'other' },
      viewerCanManage: false,
      trackCount: 1,
      shareToken: undefined,
      tracks: [{
        id: 'pt1',
        track: {
          id: 'track1',
          title: 'Test Track',
          artistName: 'Test Artist',
          danceStyle: 'Polska',
          tempoCategory: undefined,
          confidence: 0.9,
          durationMs: 180000,
        },
        position: 0,
      }],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const shareButton = getButtonByText('Dela spellista');
    expect(shareButton).toBeUndefined();
  });

  it('the name pencil is a labelled button', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Teststlista',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: { id: 'u1', username: 'user1' },
      viewerCanManage: true,
      trackCount: 0,
      tracks: [],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const editButton = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Ändra namn'
    );
    expect(editButton).toBeDefined();
  });

  it('sorting by name reorders the tracks', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Teststlista',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: { id: 'u1', username: 'user1' },
      viewerCanManage: true,
      trackCount: 3,
      tracks: [
        {
          id: 'pt1',
          track: {
            id: 'track1',
            title: 'Zebra',
            artistName: 'Test Artist',
            danceStyle: 'Polska',
            tempoCategory: undefined,
            confidence: 0.9,
            durationMs: 180000,
          },
          position: 0,
        },
        {
          id: 'pt2',
          track: {
            id: 'track2',
            title: 'Apple',
            artistName: 'Test Artist',
            danceStyle: 'Polska',
            tempoCategory: undefined,
            confidence: 0.9,
            durationMs: 180000,
          },
          position: 1,
        },
        {
          id: 'pt3',
          track: {
            id: 'track3',
            title: 'Mango',
            artistName: 'Test Artist',
            danceStyle: 'Polska',
            tempoCategory: undefined,
            confidence: 0.9,
            durationMs: 180000,
          },
          position: 2,
        },
      ],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const sortButton = getButtonByText('Namn');
    expect(sortButton).toBeDefined();

    if (sortButton) {
      await act(async () => {
        sortButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    const trackTitles = Array.from(document.body.querySelectorAll('li')).map(
      (li) => li.textContent
    );
    const appleIndex = trackTitles.findIndex((title) => title?.includes('Apple'));
    const mangoIndex = trackTitles.findIndex((title) => title?.includes('Mango'));
    const zebraIndex = trackTitles.findIndex((title) => title?.includes('Zebra'));

    expect(appleIndex).toBeLessThan(mangoIndex);
    expect(mangoIndex).toBeLessThan(zebraIndex);
  });

  it('a created share link survives closing and reopening the panel', async () => {
    generateShareToken.mockResolvedValue({ shareToken: 'new-token' });

    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Teststlista',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: { id: 'u1', username: 'user1' },
      viewerCanManage: true,
      trackCount: 1,
      shareToken: undefined,
      tracks: [{
        id: 'pt1',
        track: {
          id: 'track1',
          title: 'Test Track',
          artistName: 'Test Artist',
          danceStyle: 'Polska',
          tempoCategory: undefined,
          confidence: 0.9,
          durationMs: 180000,
        },
        position: 0,
      }],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const shareButton = getButtonByText('Dela spellista');
    expect(shareButton).toBeDefined();

    if (shareButton) {
      await act(async () => {
        shareButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    const createLinkButton = getButtonByText('Skapa länk');
    expect(createLinkButton).toBeDefined();

    if (createLinkButton) {
      await act(async () => {
        createLinkButton.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    }

    expect(generateShareToken).toHaveBeenCalledTimes(1);
    let copyLinkButton = getButtonByText('Kopiera länk');
    expect(copyLinkButton).toBeDefined();

    if (shareButton) {
      await act(async () => {
        shareButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    const createLinkButtonAfterClose = getButtonByText('Skapa länk');
    expect(createLinkButtonAfterClose).toBeUndefined();

    if (shareButton) {
      await act(async () => {
        shareButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    copyLinkButton = getButtonByText('Kopiera länk');
    expect(copyLinkButton).toBeDefined();

    expect(generateShareToken).toHaveBeenCalledTimes(1);
  });

  it('clicking Namn twice sorts descending', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Teststlista',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: { id: 'u1', username: 'user1' },
      viewerCanManage: true,
      trackCount: 3,
      tracks: [
        {
          id: 'pt1',
          track: {
            id: 'track1',
            title: 'Zebra',
            artistName: 'Test Artist',
            danceStyle: 'Polska',
            tempoCategory: undefined,
            confidence: 0.9,
            durationMs: 180000,
          },
          position: 0,
        },
        {
          id: 'pt2',
          track: {
            id: 'track2',
            title: 'Apple',
            artistName: 'Test Artist',
            danceStyle: 'Polska',
            tempoCategory: undefined,
            confidence: 0.9,
            durationMs: 180000,
          },
          position: 1,
        },
        {
          id: 'pt3',
          track: {
            id: 'track3',
            title: 'Mango',
            artistName: 'Test Artist',
            danceStyle: 'Polska',
            tempoCategory: undefined,
            confidence: 0.9,
            durationMs: 180000,
          },
          position: 2,
        },
      ],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const sortButton = getButtonByText('Namn');
    expect(sortButton).toBeDefined();

    if (sortButton) {
      await act(async () => {
        sortButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      await act(async () => {
        sortButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    const trackTitles = Array.from(document.body.querySelectorAll('li')).map(
      (li) => li.textContent
    );
    const appleIndex = trackTitles.findIndex((title) => title?.includes('Apple'));
    const mangoIndex = trackTitles.findIndex((title) => title?.includes('Mango'));
    const zebraIndex = trackTitles.findIndex((title) => title?.includes('Zebra'));

    expect(zebraIndex).toBeLessThan(mangoIndex);
    expect(mangoIndex).toBeLessThan(appleIndex);
  });

  it('clicking Ordning twice keeps the chosen order', async () => {
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
    getPlaylist.mockResolvedValue({
      id: 'p1',
      name: 'Teststlista',
      description: undefined,
      isPublic: false,
      ownerGroup: undefined,
      owner: { id: 'u1', username: 'user1' },
      viewerCanManage: true,
      trackCount: 3,
      tracks: [
        {
          id: 'pt1',
          track: {
            id: 'track1',
            title: 'Zebra',
            artistName: 'Test Artist',
            danceStyle: 'Polska',
            tempoCategory: undefined,
            confidence: 0.9,
            durationMs: 180000,
          },
          position: 0,
        },
        {
          id: 'pt2',
          track: {
            id: 'track2',
            title: 'Apple',
            artistName: 'Test Artist',
            danceStyle: 'Polska',
            tempoCategory: undefined,
            confidence: 0.9,
            durationMs: 180000,
          },
          position: 1,
        },
        {
          id: 'pt3',
          track: {
            id: 'track3',
            title: 'Mango',
            artistName: 'Test Artist',
            danceStyle: 'Polska',
            tempoCategory: undefined,
            confidence: 0.9,
            durationMs: 180000,
          },
          position: 2,
        },
      ],
      collaborators: [],
    });
    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const sortButton = getButtonByText('Ordning');
    expect(sortButton).toBeDefined();

    if (sortButton) {
      await act(async () => {
        sortButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      await act(async () => {
        sortButton.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    const trackTitles = Array.from(document.body.querySelectorAll('li')).map(
      (li) => li.textContent
    );
    const zebraIndex = trackTitles.findIndex((title) => title?.includes('Zebra'));
    const appleIndex = trackTitles.findIndex((title) => title?.includes('Apple'));
    const mangoIndex = trackTitles.findIndex((title) => title?.includes('Mango'));

    expect(zebraIndex).toBeLessThan(appleIndex);
    expect(appleIndex).toBeLessThan(mangoIndex);
  });
});
