import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PlaylistTrackRow } from './PlaylistTrackRow';
import type { TrackListDto } from '@/api/models/trackListDto';
import { ThemeProvider } from '@/theme/ThemeContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/api/generated/playlists/playlists', () => ({
  addTrack: vi.fn(),
}));

vi.mock('@/ui', async () => {
  const actual = await vi.importActual('@/ui');
  return {
    ...actual,
    toast: vi.fn(),
  };
});

vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => ({
    play: vi.fn(),
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

const track: TrackListDto = {
  id: 'track-1',
  title: 'Test Track',
  artistName: 'Test Artist',
  danceStyle: 'Polska',
  tempoCategory: 'Medium',
  confidence: 0.85,
  durationMs: 180000,
};

describe('PlaylistTrackRow', () => {
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

  it('keeps the heart and offers removal in the row menu', async () => {
    const onRemove = vi.fn();

    await act(async () => {
      root.render(
        <ThemeProvider>
          <ol>
            <PlaylistTrackRow
              track={track}
              contextTracks={[track]}
              position={1}
              isDragOver={false}
              onRemove={onRemove}
              onDragStart={() => {}}
              onDragOver={() => {}}
              onDrop={() => {}}
              onDragEnd={() => {}}
            />
          </ol>
        </ThemeProvider>,
      );
    });

    // The heart stays in the action slot.
    const heartButton = Array.from(container.querySelectorAll('button')).find((btn) => {
      const label = btn.getAttribute('aria-label');
      return label === 'Favoritmarkera' || label === 'Sluta favoritmarkera';
    });
    expect(heartButton).toBeTruthy();

    // No separate remove button sits in the row.
    const removeButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.getAttribute('aria-label') === 'Ta bort från spellista',
    );
    expect(removeButton).toBeFalsy();

    // The handle is a labelled button that names the track's position.
    const handle = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.getAttribute('aria-label') === 'Flytta låt 1',
    );
    expect(handle).toBeTruthy();

    // Removal is the last item in the row menu.
    const menuButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.getAttribute('aria-label') === 'Mer',
    );
    expect(menuButton).toBeTruthy();

    await act(async () => {
      menuButton!.click();
    });

    const removeItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
      (item) => item.textContent?.trim() === 'Ta bort från spellistan',
    ) as HTMLButtonElement | undefined;
    expect(removeItem).toBeTruthy();

    await act(async () => {
      removeItem!.click();
    });
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('has no removal item without onRemove', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <ol>
            <PlaylistTrackRow
              track={track}
              contextTracks={[track]}
              position={2}
              isDragOver={false}
              onDragStart={() => {}}
              onDragOver={() => {}}
              onDrop={() => {}}
              onDragEnd={() => {}}
            />
          </ol>
        </ThemeProvider>,
      );
    });

    const menuButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.getAttribute('aria-label') === 'Mer',
    );
    await act(async () => {
      menuButton!.click();
    });

    const removeItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
      (item) => item.textContent?.trim() === 'Ta bort från spellistan',
    );
    expect(removeItem).toBeFalsy();
  });
});
