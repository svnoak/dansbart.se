import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';
import { ThemeProvider } from '@/theme/ThemeContext';
import { typeInto } from '@/test/typeInto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getStyleOverview = vi.fn();
const getArtists = vi.fn();
const getPublicGroups = vi.fn();
const getGroup = vi.fn();
const getStats = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/analytics/useAnalyticsFlag', () => ({
  useAnalyticsFlag: vi.fn(),
}));

vi.mock('@/api/generated/discovery/discovery', () => ({
  getStyleOverview: () => getStyleOverview(),
}));

vi.mock('@/api/generated/artists/artists', () => ({
  getArtists: (...args: unknown[]) => getArtists(...args),
}));

vi.mock('@/api/generated/groups/groups', () => ({
  getPublicGroups: () => getPublicGroups(),
  getGroup: (...args: unknown[]) => getGroup(...args),
}));

vi.mock('@/api/generated/stats/stats', () => ({
  getStats: () => getStats(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('HomePage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getStyleOverview.mockReset();
    getArtists.mockReset();
    getPublicGroups.mockReset();
    getGroup.mockReset();
    getStats.mockReset();
    navigateMock.mockReset();
    getStyleOverview.mockResolvedValue([{ style: 'Polska', trackCount: 3 }]);
    getArtists.mockResolvedValue({ items: [{ id: 'a1', name: 'Spelmanslaget' }] });
    getPublicGroups.mockResolvedValue([{ id: 'g1', name: 'Öppen grupp', isPublic: true }]);
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Öppen grupp',
      playlists: [{ id: 'p1', name: 'Bygdedans', isPublic: true, trackCount: 4 }],
    });
    getStats.mockResolvedValue({ totalTracks: 100, coveragePercent: 42, lastAdded: '2024-01-01' });
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
            <HomePage />
          </MemoryRouter>
        </ThemeProvider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('navigates to the search page with the entered query on submit', async () => {
    await renderPage();

    const input = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Sök låtar, artister eller album"]',
    );
    expect(input).toBeDefined();
    typeInto(input!, 'Bingsjöpolska');

    const form = input!.closest('form');
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(navigateMock).toHaveBeenCalledWith('/search?q=Bingsj%C3%B6polska');
  });

  it('navigates to the plain search page when the field is empty', async () => {
    await renderPage();

    const input = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Sök låtar, artister eller album"]',
    );
    const form = input!.closest('form');
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(navigateMock).toHaveBeenCalledWith('/search');
  });

  it('shows a retry error when the styles fetch fails, and reloads them on retry', async () => {
    getStyleOverview.mockReset();
    getStyleOverview.mockRejectedValueOnce(new Error('network error'));
    getStyleOverview.mockResolvedValueOnce([{ style: 'Vals', trackCount: 5 }]);

    await renderPage();

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta dansstilarna.');

    const retryButton = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Försök igen'),
    );
    expect(retryButton).toBeDefined();

    await act(async () => {
      retryButton!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.body.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.textContent).toContain('Vals');
  });

  it('shows a retry error when the artists fetch fails', async () => {
    getArtists.mockReset();
    getArtists.mockRejectedValue(new Error('network error'));

    await renderPage();

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta artisterna.');
  });

  it('shows a retry error when the playlists fetch fails', async () => {
    getPublicGroups.mockReset();
    getPublicGroups.mockRejectedValue(new Error('network error'));

    await renderPage();

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte hämta spellistorna.');
  });

  it('shows only public playlists from public groups, to any visitor', async () => {
    getGroup.mockResolvedValue({
      id: 'g1',
      name: 'Öppen grupp',
      playlists: [
        { id: 'p1', name: 'Bygdedans', isPublic: true, trackCount: 4 },
        { id: 'p2', name: 'Privat lista', isPublic: false, trackCount: 2 },
      ],
    });

    await renderPage();

    expect(document.body.textContent).toContain('Bygdedans');
    expect(document.body.textContent).not.toContain('Privat lista');
  });

  it('shows an empty state when no public group has a public playlist', async () => {
    getPublicGroups.mockResolvedValue([]);

    await renderPage();

    expect(document.body.textContent).toContain('Inga offentliga spellistor ännu.');
  });
});
