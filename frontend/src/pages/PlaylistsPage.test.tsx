import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { PlaylistsPage } from './PlaylistsPage';
import { ThemeProvider } from '@/theme/ThemeContext';
import { loggedInAuthValue } from '@/test/authValue';
import type { Playlist } from '@/api/models/playlist';
import type { PlaylistListItemDto } from '@/api/models/playlistListItemDto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getMyPlaylists1 = vi.fn();
const useAnalyticsFlag = vi.fn();
const useAuth = vi.fn();

vi.mock('@/api/generated/playlists/playlists', () => ({
  getMyPlaylists1: (...args: unknown[]) => getMyPlaylists1(...args),
  createPlaylist: vi.fn(),
  getInvitations: vi.fn(() => Promise.resolve([])),
  respondToInvitation: vi.fn(),
}));

vi.mock('@/analytics/useAnalyticsFlag', () => ({
  useAnalyticsFlag: (...args: unknown[]) => useAnalyticsFlag(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

describe('PlaylistsPage playlist cards', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getMyPlaylists1.mockReset();
    useAnalyticsFlag.mockReset();
    useAuth.mockReset();
    useAuth.mockReturnValue(loggedInAuthValue({ id: 'u1', username: 'user1', role: 'USER' }));
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
        <ThemeProvider>
          <MemoryRouter>
            <PlaylistsPage />
          </MemoryRouter>
        </ThemeProvider>,
      );
    });
  }

  it('a card shows the whole description, clamped to two lines', async () => {
    const longDescription = 'Detta är en väldigt långt beskrivning av spellistan som innehåller många ord och bör visas på två rader utan att klippas av helt.';
    const playlists: Playlist[] = [
      {
        id: 'pl1',
        name: 'Långsammare valser',
        description: longDescription,
        tracks: [],
      },
    ];

    getMyPlaylists1.mockResolvedValue(playlists);

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(document.body.textContent).toContain(longDescription);
    const descriptionElement = Array.from(document.body.querySelectorAll('p')).find(
      (p) => p.textContent?.includes(longDescription),
    );
    expect(descriptionElement).toBeTruthy();
    expect(descriptionElement?.className).toContain('line-clamp-2');
  });

  it('a card without a description renders no empty description element', async () => {
    const playlists: Playlist[] = [
      {
        id: 'pl1',
        name: 'Musik utan beskrivning',
        tracks: [],
      },
    ];

    getMyPlaylists1.mockResolvedValue(playlists);

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const playlistCard = Array.from(document.body.querySelectorAll('li')).find(
      (li) => li.textContent?.includes('Musik utan beskrivning'),
    );
    expect(playlistCard).toBeTruthy();

    const descriptionElements = Array.from(playlistCard?.querySelectorAll('p') ?? []).filter(
      (p) => p.className.includes('line-clamp-2'),
    );
    expect(descriptionElements.length).toBe(0);
  });

  it('tags render at 14px or larger', async () => {
    const playlists: Playlist[] = [
      {
        id: 'pl1',
        name: 'Vals med tags',
        danceStyle: 'Vals',
        tracks: [],
      },
    ];

    getMyPlaylists1.mockResolvedValue(playlists);

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const tagElements = Array.from(document.body.querySelectorAll('span')).filter(
      (span) => span.textContent?.includes('Vals'),
    );
    expect(tagElements.length).toBeGreaterThan(0);

    tagElements.forEach((tag) => {
      expect(tag.className).not.toContain('text-[10px]');
      expect(tag.className).not.toContain('text-xs');
    });
  });

  it('shows the owning group of a group playlist', async () => {
    const playlists: PlaylistListItemDto[] = [
      {
        id: 'pl1',
        name: 'Grupp spellista',
        ownerGroup: { id: 'g1', name: 'Testgruppen' },
      },
      {
        id: 'pl2',
        name: 'Min spellista',
        ownerGroup: null,
      },
    ];

    getMyPlaylists1.mockResolvedValue(playlists);

    await renderPage();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const ownershipTexts = Array.from(document.body.querySelectorAll('*')).filter(
      (el) => el.textContent?.includes('Ägs av gruppen'),
    );
    expect(ownershipTexts.length).toBe(1);

    const groupLinks = Array.from(document.body.querySelectorAll('a')).filter(
      (a) => a.textContent?.includes('Testgruppen'),
    );
    expect(groupLinks.length).toBeGreaterThan(0);
    expect(groupLinks[0]?.href).toMatch(/\/groups\/g1$/);
  });
});
