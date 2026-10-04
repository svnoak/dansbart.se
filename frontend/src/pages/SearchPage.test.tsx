import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SearchPage } from './SearchPage';
import { authValue } from '@/test/authValue';
import { typeInto, pressKey } from '@/test/typeInto';
import { getInputByLabel } from '@/test/getInputByLabel';
import { FavoritesProvider } from '@/favorites/FavoritesContext';
import { ThemeProvider } from '@/theme/ThemeContext';
import type { GetTracksParams } from '@/api/models/getTracksParams';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getTracks = vi.fn();
const getPlaylist = vi.fn();
const getStyleOverview = vi.fn();
const getFavoriteIds = vi.fn();
const getArtists = vi.fn();
const getAlbums = vi.fn();
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
  searchArtists: (...args: unknown[]) => getArtists(...args),
  getArtists: (...args: unknown[]) => getArtists(...args),
}));

vi.mock('@/api/generated/albums/albums', () => ({
  searchAlbums: (...args: unknown[]) => getAlbums(...args),
  getAlbums: (...args: unknown[]) => getAlbums(...args),
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

const playlist = (viewerCanManage: boolean) => ({
  id: 'p1',
  name: 'Fest',
  description: undefined,
  isPublic: false,
  ownerGroup: undefined,
  owner: undefined,
  viewerCanManage,
  trackCount: 0,
  tracks: [],
  collaborators: [],
});

const oneTrack = {
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
};

describe('SearchPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let observerCallback: IntersectionObserverCallback | undefined;

  class FakeIntersectionObserver {
    constructor(cb: IntersectionObserverCallback) {
      observerCallback = cb;
    }
    observe() {}
    disconnect() {
      observerCallback = undefined;
    }
  }

  beforeEach(() => {
    observerCallback = undefined;
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    getTracks.mockReset();
    getPlaylist.mockReset();
    getStyleOverview.mockReset();
    getFavoriteIds.mockReset();
    getArtists.mockReset();
    getAlbums.mockReset();
    useAuth.mockReset();
    useAuth.mockReturnValue(authValue());
    getStyleOverview.mockResolvedValue([]);
    getTracks.mockResolvedValue({ items: [], total: 0 });
    getArtists.mockResolvedValue({ items: [], total: 0 });
    getAlbums.mockResolvedValue({ items: [], total: 0 });
    getFavoriteIds.mockResolvedValue([]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    await settle();
  }

  async function settle(ms = 50) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  }

  async function click(element: HTMLElement | undefined) {
    expect(element).toBeDefined();
    await act(async () => {
      element!.click();
    });
    await settle();
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

  function getButtonByName(name: string) {
    return document.body.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`) ?? undefined;
  }

  function lastTracksParams(): GetTracksParams {
    const call = getTracks.mock.calls.at(-1);
    expect(call).toBeDefined();
    return call![0] as GetTracksParams;
  }

  it('shows which playlist tracks go to', async () => {
    getPlaylist.mockResolvedValue(playlist(true));

    await renderPageAt('/search?addTo=p1');
    await settle(100);

    const bannerText = document.body.textContent?.includes('Du lägger till låtar i Fest');
    expect(bannerText).toBe(true);
  });

  it('Klar returns to the playlist', async () => {
    getPlaylist.mockResolvedValue(playlist(false));

    await renderPageAt('/search?addTo=p1');
    await settle(100);

    const doneLink = getLinkByText('Klar');
    expect(doneLink).toBeDefined();
    expect(doneLink?.getAttribute('href')).toBe('/playlists/p1');
  });

  it('track rows get the one-tap add', async () => {
    getTracks.mockResolvedValue(oneTrack);
    getPlaylist.mockResolvedValue(playlist(true));

    await renderPageAt('/search?addTo=p1');
    await settle(300);

    const addButton = getButtonByText('Lägg till');
    expect(addButton).toBeDefined();
  });

  it('a viewer gets no one-tap add', async () => {
    getTracks.mockResolvedValue(oneTrack);
    getPlaylist.mockResolvedValue(playlist(false));

    await renderPageAt('/search?addTo=p1');
    await settle(300);

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
    await settle(100);

    const bannerText = document.body.textContent?.includes('Du lägger till låtar i');
    expect(bannerText).toBe(false);

    const addButton = getButtonByText('Lägg till');
    expect(addButton).toBeUndefined();
  });

  it('Enter applies the typed query', async () => {
    await renderPageAt('/search');

    const input = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Sök låt, artist eller album"]',
    );
    expect(input).not.toBeNull();
    await act(async () => {
      typeInto(input!, 'polska efter Byss-Calle');
    });
    // Typing alone is a draft: nothing is fetched yet.
    expect(lastTracksParams().search).toBeUndefined();

    await act(async () => {
      pressKey(input!, 'Enter');
    });
    await settle();

    expect(lastTracksParams().search).toBe('polska efter Byss-Calle');
    expect(document.body.querySelector('h2')?.textContent).toContain('”polska efter Byss-Calle”');
  });

  it('the Sök button applies the typed query', async () => {
    await renderPageAt('/search');

    const input = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Sök låt, artist eller album"]',
    );
    await act(async () => {
      typeInto(input!, 'vals');
    });
    await click(getButtonByText('Sök'));

    expect(lastTracksParams().search).toBe('vals');
  });

  it('the segmented control switches what is searched', async () => {
    await renderPageAt('/search');

    const tracksSegment = getButtonByName('Sök bland låtar');
    const artistsSegment = getButtonByName('Sök bland artister');
    expect(tracksSegment?.getAttribute('aria-pressed')).toBe('true');
    expect(artistsSegment?.getAttribute('aria-pressed')).toBe('false');
    expect(tracksSegment?.closest('[role="group"]')?.getAttribute('aria-label')).toBe('Vad som söks');

    await click(artistsSegment);

    expect(getArtists).toHaveBeenCalled();
    expect(getButtonByName('Sök bland artister')?.getAttribute('aria-pressed')).toBe('true');
    // The filter card belongs to tracks only.
    expect(getButtonByName('Visa alla dansstilar')).toBeUndefined();
  });

  it('a style chip filters on the main style and opens the sub-style row', async () => {
    getStyleOverview.mockResolvedValue([
      { style: 'Polska', subStyles: ['Slängpolska', 'Bingsjöpolska'], trackCount: 12 },
      { style: 'Schottis', subStyles: [], trackCount: 4 },
    ]);
    getTracks.mockResolvedValue({ items: [], total: 12 });

    await renderPageAt('/search');

    const all = getButtonByName('Visa alla dansstilar');
    const polska = getButtonByName('Visa Polska');
    expect(all?.getAttribute('aria-pressed')).toBe('true');
    expect(polska?.getAttribute('aria-pressed')).toBe('false');
    expect(document.body.textContent).not.toContain('Typ av Polska');

    await click(polska);

    expect(lastTracksParams().mainStyle).toBe('Polska');
    expect(getButtonByName('Visa Polska')?.getAttribute('aria-pressed')).toBe('true');
    expect(getButtonByName('Visa alla dansstilar')?.getAttribute('aria-pressed')).toBe('false');
    expect(document.body.textContent).toContain('Typ av Polska');
    expect(document.body.querySelector('h2')?.textContent).toBe('12 låtar · Polska');

    await click(getButtonByName('Visa Slängpolska'));

    expect(lastTracksParams().mainStyle).toBe('Polska');
    expect(lastTracksParams().subStyle).toBe('Slängpolska');
    expect(getButtonByName('Visa Slängpolska')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.body.querySelector('h2')?.textContent).toBe('12 låtar · Slängpolska');

    // A style with no sub-styles shows no second row.
    await click(getButtonByName('Visa Schottis'));
    expect(lastTracksParams().mainStyle).toBe('Schottis');
    expect(lastTracksParams().subStyle).toBeUndefined();
    expect(document.body.textContent).not.toContain('Typ av');
  });

  it('a tempo word travels as a BPM range', async () => {
    await renderPageAt('/search');

    const tempoGroup = document.body.querySelector('[role="group"][aria-label="Tempo"]');
    expect(tempoGroup).not.toBeNull();
    expect(getButtonByName('Visa alla tempon')?.getAttribute('aria-pressed')).toBe('true');

    await click(getButtonByName('Visa lagom tempo'));

    expect(lastTracksParams().minBpm).toBe(110);
    expect(lastTracksParams().maxBpm).toBe(135);
    expect(getButtonByName('Visa lagom tempo')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.body.querySelector('h2')?.textContent).toContain('Lagom');

    await click(getButtonByName('Visa långsamt tempo'));
    expect(lastTracksParams().minBpm).toBeUndefined();
    expect(lastTracksParams().maxBpm).toBe(90);

    await click(getButtonByName('Visa v. snabbt tempo'));
    expect(lastTracksParams().minBpm).toBe(165);
    expect(lastTracksParams().maxBpm).toBeUndefined();

    await click(getButtonByName('Visa alla tempon'));
    expect(lastTracksParams().minBpm).toBeUndefined();
    expect(lastTracksParams().maxBpm).toBeUndefined();
  });

  it('an exact BPM range from the URL shows no tempo word and counts as an advanced filter', async () => {
    await renderPageAt('/search?tempo=true&minBpm=100&maxBpm=120');

    expect(lastTracksParams().minBpm).toBe(100);
    expect(lastTracksParams().maxBpm).toBe(120);
    const pressed = Array.from(
      document.body.querySelectorAll('[role="group"][aria-label="Tempo"] button[aria-pressed="true"]'),
    );
    expect(pressed).toHaveLength(0);
    expect(document.body.querySelector('h2')?.textContent).toContain('100–120 BPM');

    const more = getButtonByText('Fler filter');
    expect(more?.textContent).toContain('1');
    expect(more?.getAttribute('aria-expanded')).toBe('true');
  });

  it('Bara bekräftade asks for confirmed styles only', async () => {
    await renderPageAt('/search');

    const confirmed = getButtonByName('Visa bara bekräftade dansstilar');
    expect(confirmed?.getAttribute('aria-pressed')).toBe('false');

    await click(confirmed);

    expect(lastTracksParams().styleConfirmed).toBe(true);
    expect(getButtonByName('Visa bara bekräftade dansstilar')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.body.querySelector('h2')?.textContent).toContain('bara bekräftade');
  });

  it('Fler filter opens a drawer with the rarer filters', async () => {
    await renderPageAt('/search');

    const more = getButtonByText('Fler filter');
    expect(more?.getAttribute('aria-expanded')).toBe('false');
    expect(getInputByLabel('Längd')).toBeNull();

    await click(more);

    expect(getButtonByText('Fler filter')?.getAttribute('aria-expanded')).toBe('true');
    const drawerId = getButtonByText('Fler filter')?.getAttribute('aria-controls');
    expect(drawerId).toBeTruthy();
    const drawer = document.getElementById(drawerId!);
    expect(drawer).not.toBeNull();

    const duration = getInputByLabel('Längd') as unknown as HTMLSelectElement | null;
    expect(duration).not.toBeNull();
    await act(async () => {
      duration!.value = 'short';
      duration!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();

    expect(lastTracksParams().maxDuration).toBe(180);
    expect(getButtonByText('Fler filter')?.textContent).toContain('1');

    await click(getButtonByName('Visa låtar från Spotify'));
    expect(lastTracksParams().source).toBe('spotify');
    expect(getButtonByText('Fler filter')?.textContent).toContain('2');

    await click(getButtonByName('Visa instrumental musik'));
    expect(lastTracksParams().vocals).toBe('false');
    expect(document.body.querySelector('h2')?.textContent).toBe(
      '0 låtar · Spotify · instrumental · kort (under 3 min)',
    );
  });

  it('Rensa alla filter keeps the query and drops every filter', async () => {
    getStyleOverview.mockResolvedValue([{ style: 'Polska', subStyles: [], trackCount: 12 }]);

    await renderPageAt('/search?q=byss&style=Polska&confirmed=true&source=youtube');

    expect(lastTracksParams().mainStyle).toBe('Polska');
    expect(lastTracksParams().styleConfirmed).toBe(true);

    await click(getButtonByText('Rensa alla filter'));

    const params = lastTracksParams();
    expect(params.search).toBe('byss');
    expect(params.mainStyle).toBeUndefined();
    expect(params.styleConfirmed).toBeUndefined();
    expect(params.source).toBeUndefined();
    expect(getButtonByText('Rensa alla filter')).toBeUndefined();
  });

  it('shows an empty state with a way out when filters match nothing', async () => {
    getStyleOverview.mockResolvedValue([{ style: 'Polska', subStyles: [], trackCount: 12 }]);

    await renderPageAt('/search?style=Polska');

    expect(document.body.textContent).toContain('Inga låtar matchar');
    await click(getButtonByText('Rensa filter'));

    expect(lastTracksParams().mainStyle).toBeUndefined();
  });

  it('shows the error with a retry when tracks cannot load', async () => {
    getTracks.mockRejectedValueOnce(new Error('Servern svarar inte'));

    await renderPageAt('/search');

    const alert = document.body.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Servern svarar inte');

    getTracks.mockResolvedValue(oneTrack);
    await click(getButtonByText('Försök igen'));

    expect(document.body.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.textContent).toContain('Test Track');
    expect(document.body.querySelector('h2')?.textContent).toBe('1 låt');
  });

  it('loads the next page when the sentinel comes into view', async () => {
    const page = (offset: number) => ({
      items: Array.from({ length: 20 }, (_, i) => ({
        id: `t${offset + i}`,
        title: `Låt ${offset + i}`,
        artistName: 'Spelman',
        danceStyle: 'Polska',
        confidence: 1,
        durationMs: 120000,
      })),
      total: 40,
    });
    getTracks.mockImplementation((params: GetTracksParams) => Promise.resolve(page(params.offset ?? 0)));

    await renderPageAt('/search');

    expect(document.body.querySelectorAll('li').length).toBe(20);
    expect(document.body.textContent).toContain('Fler låtar laddas när du skrollar.');
    expect(observerCallback).toBeDefined();

    await act(async () => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    await settle();

    expect(lastTracksParams().offset).toBe(20);
    expect(document.body.querySelectorAll('li').length).toBe(40);
    expect(document.body.textContent).toContain('Låt 39');
    expect(document.body.textContent).not.toContain('Fler låtar laddas när du skrollar.');
    expect(document.body.querySelector('h2')?.textContent).toBe('40 låtar');
  });

  it('the sort select has a visible label and applies at once', async () => {
    await renderPageAt('/search');

    const sort = getInputByLabel('Sortera') as unknown as HTMLSelectElement | null;
    expect(sort).not.toBeNull();
    await act(async () => {
      sort!.value = 'tempoBpm:desc';
      sort!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();

    expect(lastTracksParams().sortBy).toBe('tempoBpm');
    expect(lastTracksParams().sortDirection).toBe('desc');
  });
});
