import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TrackCard } from './TrackCard';
import type { TrackListDto } from '@/api/models/trackListDto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe('TrackCard long press', () => {
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
      root.render(<TrackCard track={track} />);
    });

    // The card's outer element has no dedicated selector, so this uses the root DOM node TrackCard renders.
    const card = container.firstElementChild as HTMLElement;

    act(() => {
      firePointerEvent(card, 'pointerdown', { pointerType: 'touch' });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      firePointerEvent(card, 'pointerup', { pointerType: 'touch' });
    });

    const dialog = document.querySelector('[role="dialog"][aria-label="Test Track"]');
    expect(dialog).toBeTruthy();
  });
});
