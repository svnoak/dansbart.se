import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { DancePage } from './DancePage';
import { authValue } from '@/test/authValue';
import { ToastContainer } from '@/ui';
import * as toastEmitter from '@/ui/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const httpClient = vi.fn();
const getPrimaryTrack = vi.fn();
const setPrimaryTrack = vi.fn();
const clearPrimaryTrack = vi.fn();
const useAuth = vi.fn();
const usePlayerMock = { play: vi.fn(), currentTrack: undefined, isPlaying: false };

vi.mock('@/api/http-client', () => ({
  httpClient: (...args: unknown[]) => httpClient(...args),
}));

vi.mock('@/api/generated/dances/dances', () => ({
  getPrimaryTrack: (...args: unknown[]) => getPrimaryTrack(...args),
  setPrimaryTrack: (...args: unknown[]) => setPrimaryTrack(...args),
  clearPrimaryTrack: (...args: unknown[]) => clearPrimaryTrack(...args),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => usePlayerMock,
}));

vi.mock('@/favorites/useFavorites', () => ({
  useFavorites: () => ({
    isFavorited: () => false,
    toggleFavorite: vi.fn(),
  }),
}));

vi.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'dance-1' }),
  };
});

const mockDance = {
  id: 'dance-1',
  name: 'Familjevals från Ödsmål',
  danceType: 'Vals',
  music: 'Vals',
};

const mockTrack = {
  id: 'track-1',
  title: 'Ett förslag',
  artistName: 'En artist',
  durationMs: 180000,
  danceStyle: 'vals',
};

describe('DancePage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toastSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toastSpy = vi.spyOn(toastEmitter, 'toast');
    httpClient.mockReset();
    getPrimaryTrack.mockReset();
    setPrimaryTrack.mockReset();
    clearPrimaryTrack.mockReset();
    useAuth.mockReset();
    usePlayerMock.play.mockReset();
    useAuth.mockReturnValue(authValue());
    getPrimaryTrack.mockRejectedValue(new Error('no primary track'));

    httpClient.mockImplementation((input: string, init?: RequestInit) => {
      if (typeof input === 'string' && input === '/api/dances/dance-1') {
        return Promise.resolve(mockDance);
      }
      if (typeof input === 'string' && input === '/api/dances/dance-1/tracks') {
        return Promise.resolve([]);
      }
      if (typeof input === 'string' && input === '/api/dances/dance-1/matching') {
        return Promise.resolve([]);
      }
      if (typeof input === 'string' && input.startsWith('/api/dances/dance-1/recommendations')) {
        return Promise.resolve({ items: [mockTrack], total: 1 });
      }
      if (
        typeof input === 'string' &&
        input === '/api/dances/dance-1/tracks/track-1/vote' &&
        init?.method === 'POST'
      ) {
        return Promise.reject(new Error('vote save failed'));
      }
      if (
        typeof input === 'string' &&
        input === '/api/dances/dance-1/tracks/track-1/vote' &&
        init?.method === 'DELETE'
      ) {
        return Promise.reject(new Error('vote remove failed'));
      }
      return Promise.reject(new Error(`unexpected request: ${String(input)}`));
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    toastSpy.mockRestore();
    root.unmount();
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <DancePage />
          <ToastContainer />
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function getRecommendationRow() {
    const li = Array.from(document.body.querySelectorAll('li')).find((el) =>
      el.textContent?.includes('Ett förslag'),
    );
    expect(li).toBeDefined();
    return li!;
  }

  it('shows the save-vote error inline next to the vote control, not as a toast', async () => {
    await renderPage();

    const row = getRecommendationRow();
    const upvoteButton = row.querySelector('button[aria-label="Bra förslag"]') as HTMLButtonElement;
    expect(upvoteButton).toBeDefined();

    await act(async () => {
      upvoteButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const alert = row.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte spara rösten, försök igen.');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('shows the remove-vote error inline next to the vote control, not as a toast', async () => {
    httpClient.mockImplementation((input: string, init?: RequestInit) => {
      if (typeof input === 'string' && input === '/api/dances/dance-1') {
        return Promise.resolve(mockDance);
      }
      if (typeof input === 'string' && input === '/api/dances/dance-1/tracks') {
        return Promise.resolve([]);
      }
      if (typeof input === 'string' && input === '/api/dances/dance-1/matching') {
        return Promise.resolve([]);
      }
      if (typeof input === 'string' && input.startsWith('/api/dances/dance-1/recommendations')) {
        return Promise.resolve({ items: [mockTrack], total: 1 });
      }
      if (
        typeof input === 'string' &&
        input === '/api/dances/dance-1/tracks/track-1/vote' &&
        init?.method === 'POST'
      ) {
        return Promise.resolve({});
      }
      if (
        typeof input === 'string' &&
        input === '/api/dances/dance-1/tracks/track-1/vote' &&
        init?.method === 'DELETE'
      ) {
        return Promise.reject(new Error('vote remove failed'));
      }
      return Promise.reject(new Error(`unexpected request: ${String(input)}`));
    });

    await renderPage();

    const row = getRecommendationRow();
    // A down vote does not move the track out of the recommendations list,
    // so voting down twice toggles the vote off without unmounting the row.
    const downvoteButton = row.querySelector('button[aria-label="Dåligt förslag"]') as HTMLButtonElement;
    expect(downvoteButton).toBeDefined();

    await act(async () => {
      downvoteButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      downvoteButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const alert = row.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Kunde inte ta bort rösten, försök igen.');
    expect(toastSpy).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('ignores a second vote on a track while its first vote is saving', async () => {
    let resolvePost: (value: unknown) => void = () => {};
    const postVoteCalls: string[] = [];

    httpClient.mockImplementation((input: string, init?: RequestInit) => {
      if (typeof input === 'string' && input === '/api/dances/dance-1') {
        return Promise.resolve(mockDance);
      }
      if (typeof input === 'string' && input === '/api/dances/dance-1/tracks') {
        return Promise.resolve([]);
      }
      if (typeof input === 'string' && input === '/api/dances/dance-1/matching') {
        return Promise.resolve([]);
      }
      if (typeof input === 'string' && input.startsWith('/api/dances/dance-1/recommendations')) {
        return Promise.resolve({ items: [mockTrack], total: 1 });
      }
      if (
        typeof input === 'string' &&
        input === '/api/dances/dance-1/tracks/track-1/vote' &&
        init?.method === 'POST'
      ) {
        postVoteCalls.push(input);
        return new Promise((resolve) => {
          resolvePost = resolve;
        });
      }
      return Promise.reject(new Error(`unexpected request: ${String(input)}`));
    });

    await renderPage();

    const row = getRecommendationRow();
    const upvoteButton = row.querySelector('button[aria-label="Bra förslag"]') as HTMLButtonElement;

    await act(async () => {
      upvoteButton.click();
    });
    await act(async () => {
      upvoteButton.click();
    });

    expect(postVoteCalls.length).toBe(1);

    await act(async () => {
      resolvePost({});
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const matchingRows = Array.from(document.body.querySelectorAll('li')).filter((el) =>
      el.textContent?.includes('Ett förslag'),
    );
    expect(matchingRows.length).toBe(1);
  });

  it('keeps a track\'s vote error after another track\'s vote succeeds', async () => {
    const mockTrackB = {
      id: 'track-2',
      title: 'Ett annat förslag',
      artistName: 'En annan artist',
      durationMs: 200000,
      danceStyle: 'vals',
    };

    httpClient.mockImplementation((input: string, init?: RequestInit) => {
      if (typeof input === 'string' && input === '/api/dances/dance-1') {
        return Promise.resolve(mockDance);
      }
      if (typeof input === 'string' && input === '/api/dances/dance-1/tracks') {
        return Promise.resolve([]);
      }
      if (typeof input === 'string' && input === '/api/dances/dance-1/matching') {
        return Promise.resolve([]);
      }
      if (typeof input === 'string' && input.startsWith('/api/dances/dance-1/recommendations')) {
        return Promise.resolve({ items: [mockTrack, mockTrackB], total: 2 });
      }
      if (
        typeof input === 'string' &&
        input === '/api/dances/dance-1/tracks/track-1/vote' &&
        init?.method === 'POST'
      ) {
        return Promise.reject(new Error('vote save failed'));
      }
      if (
        typeof input === 'string' &&
        input === '/api/dances/dance-1/tracks/track-2/vote' &&
        init?.method === 'POST'
      ) {
        return Promise.resolve({});
      }
      return Promise.reject(new Error(`unexpected request: ${String(input)}`));
    });

    await renderPage();

    const rowA = getRecommendationRow();
    const rowB = Array.from(document.body.querySelectorAll('li')).find((el) =>
      el.textContent?.includes('Ett annat förslag'),
    )!;
    expect(rowB).toBeDefined();

    const upvoteA = rowA.querySelector('button[aria-label="Bra förslag"]') as HTMLButtonElement;
    const upvoteB = rowB.querySelector('button[aria-label="Bra förslag"]') as HTMLButtonElement;

    await act(async () => {
      upvoteA.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(rowA.querySelector('[role="alert"]')?.textContent).toContain(
      'Kunde inte spara rösten, försök igen.',
    );

    await act(async () => {
      upvoteB.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(rowA.querySelector('[role="alert"]')?.textContent).toContain(
      'Kunde inte spara rösten, försök igen.',
    );
  });
});
