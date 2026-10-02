import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useLocalAudioPlayer } from './useLocalAudioPlayer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getLocalFileForTrack = vi.fn();

vi.mock('@/library/localHandles', () => ({
  getLocalFileForTrack: (...args: unknown[]) => getLocalFileForTrack(...args),
}));

describe('useLocalAudioPlayer', () => {
  let container: HTMLDivElement;
  let root: Root;
  const playedSources: string[] = [];
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();

  function Probe({ trackId }: { trackId: string }) {
    useLocalAudioPlayer({ trackId, isPlaying: true, onEnded: () => {} });
    return null;
  }

  const renderFor = (trackId: string) =>
    act(async () => root.render(createElement(Probe, { trackId })));

  beforeEach(() => {
    playedSources.length = 0;
    getLocalFileForTrack.mockReset();
    getLocalFileForTrack.mockResolvedValue(new File(['audio bytes'], 'vals.mp3'));
    createObjectURL.mockReset();
    createObjectURL.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    revokeObjectURL.mockReset();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      playedSources.push(this.src);
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('plays the local file from an object URL', async () => {
    await renderFor('t1');

    expect(getLocalFileForTrack).toHaveBeenCalledWith('t1');
    expect(playedSources).toEqual(['blob:first']);
  });

  it('revokes the object URL when the track changes', async () => {
    await renderFor('t1');

    await renderFor('t2');

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first');
    expect(playedSources).toEqual(['blob:first', 'blob:second']);
  });
});
