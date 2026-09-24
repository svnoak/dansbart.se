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

  it('does not lay the remove button over the favourite button', async () => {
    const onRemove = vi.fn();

    await act(async () => {
      root.render(
        <ThemeProvider>
          <ul>
            <PlaylistTrackRow
              track={track}
              contextTracks={[track]}
              isDragOver={false}
              onRemove={onRemove}
              onDragStart={() => {}}
              onDragOver={() => {}}
              onDrop={() => {}}
              onDragEnd={() => {}}
            />
          </ul>
        </ThemeProvider>,
      );
    });

    const removeButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.getAttribute('aria-label') === 'Ta bort från spellista',
    );
    const favouriteButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => {
        const label = btn.getAttribute('aria-label');
        return label === 'Favoritmarkera' || label === 'Sluta favoritmarkera';
      },
    );

    expect(removeButton).toBeTruthy();
    expect(favouriteButton).toBeTruthy();

    // Remove button should not use absolute positioning.
    expect(removeButton?.classList.contains('absolute')).toBe(false);

    // Favourite button should come before remove button in document order.
    expect(
      favouriteButton!.compareDocumentPosition(removeButton!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
