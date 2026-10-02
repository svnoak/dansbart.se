import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GlobalPlayerShell } from './GlobalPlayerShell';
import type { TrackListDto } from '@/api/models/trackListDto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const track: TrackListDto = {
  id: 't1',
  title: 'Vals efter Anna',
  playable: true,
  playbackLinks: [{ platform: 'YOUTUBE', deepLink: 'dQw4w9WgXcQ' }],
};

const useLocalAudioPlayer = vi.fn();
const useYouTubePlayer = vi.fn();
const togglePlayPause = vi.fn();

vi.mock('@/api/generated/analytics/analytics', () => ({
  recordPlayback: vi.fn(),
  recordInteraction1: vi.fn(),
}));
vi.mock('@/consent/useConsent', () => ({ useConsent: () => ({ consentStatus: 'granted' }) }));
vi.mock('@/player/usePlayer', () => ({
  usePlayer: () => ({
    currentTrack: track,
    queue: [],
    isPlaying: true,
    togglePlayPause,
    playFromQueue: vi.fn(),
    removeFromQueue: vi.fn(),
    clearQueue: vi.fn(),
    reorderQueue: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    queueOpen: false,
    toggleQueue: vi.fn(),
  }),
}));
vi.mock('@/player/SmartNudge', () => ({ SmartNudge: () => null }));
vi.mock('./hooks/useStructureBars', () => ({ useStructureBars: () => [] }));
vi.mock('./hooks/useLocalAudioPlayer', () => ({
  useLocalAudioPlayer: (...args: unknown[]) => useLocalAudioPlayer(...args),
}));
vi.mock('./hooks/useYouTubePlayer', () => ({
  useYouTubePlayer: (...args: unknown[]) => useYouTubePlayer(...args),
}));

describe('GlobalPlayerShell', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useYouTubePlayer.mockReset();
    useYouTubePlayer.mockReturnValue({ ytPlayerRef: { current: null }, ytPlayerReady: false });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it('uses the local player when the track has a local file', async () => {
    useLocalAudioPlayer.mockReturnValue({
      hasLocalFile: true,
      positionMs: 5000,
      durationMs: 100000,
      seekTo: vi.fn(),
      getCurrentTime: () => 5,
    });

    await act(async () => root.render(<GlobalPlayerShell />));

    expect(useYouTubePlayer).toHaveBeenLastCalledWith(expect.objectContaining({ activeSource: 'local' }));
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.body.textContent).toContain('0:05');
  });
});
