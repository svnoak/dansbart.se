import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TrackRow } from './TrackRow';
import type { TrackListDto } from '@/api/models/trackListDto';
import { ThemeProvider } from '@/theme/ThemeContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/api/generated/playlists/playlists', () => ({
  addTrack: vi.fn(),
}));

const { hasLocalFileForTrack, getLocalFileForTrack } = vi.hoisted(() => ({
  hasLocalFileForTrack: vi.fn(),
  getLocalFileForTrack: vi.fn(),
}));

vi.mock('@/library/localHandles', () => ({
  LocalFilePermissionDenied: class extends Error {},
  hasLocalFileForTrack: (...args: unknown[]) => hasLocalFileForTrack(...args),
  getLocalFileForTrack: (...args: unknown[]) => getLocalFileForTrack(...args),
}));

vi.mock('@/ui', async () => {
  const actual = await vi.importActual('@/ui');
  return {
    ...actual,
    toast: vi.fn(),
  };
});

const { playMock } = vi.hoisted(() => ({ playMock: vi.fn() }));

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => ({
    play: playMock,
    addToQueue: vi.fn(),
    currentTrack: null,
    isPlaying: false,
  }),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/favorites/useFavorites', () => ({
  useFavorites: () => ({
    isFavorited: () => false,
    toggleFavorite: vi.fn(),
  }),
}));

function firePointerEvent(
  target: EventTarget,
  type: string,
  options: { pointerType: string; clientX?: number; clientY?: number },
) {
  const { pointerType, clientX = 0, clientY = 0 } = options;
  let event: Event;
  if (typeof PointerEvent === 'function') {
    event = new PointerEvent(type, { bubbles: true, cancelable: true, clientX, clientY, pointerType });
  } else {
    event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
  }
  target.dispatchEvent(event);
}

const track: TrackListDto = {
  id: 'track-1',
  title: 'Test Track',
  artistName: 'Test Artist',
  danceStyle: 'Polska',
  tempoCategory: 'Medium',
  confidence: 0.85,
  durationMs: 180000,
};

describe('TrackRow add to playlist', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.clearAllMocks();
  });

  it('renders no add button without addToPlaylistId', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <TrackRow track={track} />
        </ThemeProvider>,
      );
    });

    const addButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Lägg till'),
    );

    expect(addButton).toBeFalsy();
  });

  it('adds the track with one tap', async () => {
    const { addTrack } = await import('@/api/generated/playlists/playlists');
    vi.mocked(addTrack).mockResolvedValue({});

    await act(async () => {
      root.render(
        <ThemeProvider>
          <TrackRow track={track} addToPlaylistId="p1" />
        </ThemeProvider>,
      );
    });

    const addButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Lägg till'),
    );

    expect(addButton).toBeTruthy();
    expect(addButton?.disabled).toBe(false);

    await act(async () => {
      addButton?.click();
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(vi.mocked(addTrack)).toHaveBeenCalledWith('p1', { trackId: 'track-1' });

    expect(addButton?.textContent).toContain('Tillagd');
    expect(addButton?.disabled).toBe(true);
  });

  it('shows an error when adding fails', async () => {
    const { addTrack } = await import('@/api/generated/playlists/playlists');
    const { toast } = await import('@/ui');

    vi.mocked(addTrack).mockRejectedValue(new Error('Network error'));

    await act(async () => {
      root.render(
        <ThemeProvider>
          <TrackRow track={track} addToPlaylistId="p1" />
        </ThemeProvider>,
      );
    });

    const addButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Lägg till'),
    );

    expect(addButton).toBeTruthy();

    await act(async () => {
      addButton?.click();
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(addButton?.textContent).toContain('Lägg till');
    expect(addButton?.disabled).toBe(false);
    expect(vi.mocked(toast)).toHaveBeenCalledWith('Det gick inte att lägga till låten.', 'error');
  });
});

describe('TrackRow heart replacement', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.clearAllMocks();
  });

  it('shows Lägg till in place of the heart when adding to a playlist', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <TrackRow track={track} addToPlaylistId="p1" />
        </ThemeProvider>,
      );
    });

    const heartButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => {
        const label = btn.getAttribute('aria-label');
        return label === 'Favoritmarkera' || label === 'Sluta favoritmarkera';
      },
    );
    expect(heartButton).toBeFalsy();

    const menuButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.getAttribute('aria-label') === 'Mer',
    );
    expect(menuButton).toBeTruthy();
    const menuWrapper = menuButton!.parentElement;
    const rightGroup = menuWrapper!.parentElement;

    const addButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Lägg till'),
    );
    expect(addButton).toBeTruthy();

    // The add button sits in the row's right-hand group, directly before the menu trigger.
    expect(addButton!.parentElement).toBe(rightGroup);
    expect(addButton!.nextElementSibling).toBe(menuWrapper);
  });

  it('shows the heart when the row has no action', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <TrackRow track={track} />
        </ThemeProvider>,
      );
    });

    const heartButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => {
        const label = btn.getAttribute('aria-label');
        return label === 'Favoritmarkera' || label === 'Sluta favoritmarkera';
      },
    );
    expect(heartButton).toBeTruthy();
  });
});

describe('TrackRow long press', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    root.unmount();
    container.remove();
    vi.clearAllMocks();
  });

  it('opens the track options after a touch long press', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <TrackRow track={track} />
        </ThemeProvider>,
      );
    });

    // The row's outer element has no dedicated selector, so this uses the root DOM node TrackRow renders.
    const row = container.firstElementChild as HTMLElement;

    act(() => {
      firePointerEvent(row, 'pointerdown', { pointerType: 'touch' });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      firePointerEvent(row, 'pointerup', { pointerType: 'touch' });
    });

    const dialog = document.querySelector('[role="dialog"][aria-label="Test Track"]');
    expect(dialog).toBeTruthy();
  });

  it('does not open the options for a mouse press', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <TrackRow track={track} />
        </ThemeProvider>,
      );
    });

    const row = container.firstElementChild as HTMLElement;

    act(() => {
      firePointerEvent(row, 'pointerdown', { pointerType: 'mouse' });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      firePointerEvent(row, 'pointerup', { pointerType: 'mouse' });
    });

    const dialog = document.querySelector('[role="dialog"][aria-label="Test Track"]');
    expect(dialog).toBeFalsy();
  });

  it('a long press does not start playback', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <TrackRow track={track} />
        </ThemeProvider>,
      );
    });

    const row = container.firstElementChild as HTMLElement;

    act(() => {
      firePointerEvent(row, 'pointerdown', { pointerType: 'touch' });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      firePointerEvent(row, 'pointerup', { pointerType: 'touch' });
    });

    const playButton = row.querySelector<HTMLButtonElement>('button[aria-label="Spela"]');

    act(() => {
      playButton?.click();
    });

    expect(playMock).not.toHaveBeenCalled();
  });
});

describe('TrackRow availability', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    hasLocalFileForTrack.mockReset();
    getLocalFileForTrack.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function renderRow(row: TrackListDto) {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <TrackRow track={row} />
        </ThemeProvider>,
      );
    });
  }

  it('shows Inte tillgänglig för dig and no play action for a track the viewer cannot play', async () => {
    await renderRow({ ...track, playable: false, playbackLinks: [] });

    expect(container.textContent).toContain('Inte tillgänglig för dig');
    expect(container.querySelector('button[aria-label="Spela"]')).toBeNull();
    expect(container.textContent).toContain('Test Track');
  });

  it('offers Välj filen igen for an own track without a local file', async () => {
    hasLocalFileForTrack.mockResolvedValue(false);

    await renderRow({ ...track, playable: true, playbackLinks: [] });

    expect(hasLocalFileForTrack).toHaveBeenCalledWith('track-1');
    expect(container.textContent).toContain('Välj filen igen');
    expect(container.querySelector('button[aria-label="Spela"]')).toBeNull();
  });

  it('offers play for an own track with a stored handle that needs permission', async () => {
    hasLocalFileForTrack.mockResolvedValue(true);
    getLocalFileForTrack.mockResolvedValue(undefined);

    await renderRow({ ...track, playable: true, playbackLinks: [] });

    expect(container.textContent).not.toContain('Välj filen igen');
    expect(container.querySelector('button[aria-label="Spela"]')).not.toBeNull();
  });

  it('asks for file permission when playing an own track from a row', async () => {
    hasLocalFileForTrack.mockResolvedValue(true);
    getLocalFileForTrack.mockResolvedValue(new File(['audio bytes'], 'vals.mp3'));
    const ownTrack = { ...track, playable: true, playbackLinks: [] };

    await renderRow(ownTrack);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Spela"]')!.click();
    });

    expect(getLocalFileForTrack).toHaveBeenCalledWith('track-1', { askPermission: true });
    expect(playMock).toHaveBeenCalledWith(ownTrack, undefined);
  });
});
