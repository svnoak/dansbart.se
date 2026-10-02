import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useRelink } from './useRelink';
import { toastListeners } from '@/ui/toastEmitter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const listTracks = vi.fn();
const matchHash = vi.fn();
const pickAudioFiles = vi.fn();
const saveLocalFile = vi.fn();

vi.mock('@/api/generated/library/library', () => ({
  listTracks: () => listTracks(),
  matchHash: (...args: unknown[]) => matchHash(...args),
}));
vi.mock('./audioHash', () => ({ computeAudioHash: async () => 'a'.repeat(64) }));
vi.mock('./localHandles', () => ({
  pickAudioFiles: () => pickAudioFiles(),
  saveLocalFile: (...args: unknown[]) => saveLocalFile(...args),
}));

describe('useRelink', () => {
  let container: HTMLDivElement;
  let root: Root;
  const hook: { current?: ReturnType<typeof useRelink> } = {};
  const picked = { file: new File(['audio bytes'], 'vals.mp3') };

  function Probe() {
    const value = useRelink();
    useEffect(() => {
      hook.current = value;
    });
    return null;
  }

  beforeEach(async () => {
    listTracks.mockReset();
    matchHash.mockReset();
    pickAudioFiles.mockReset();
    saveLocalFile.mockReset();
    listTracks.mockResolvedValue([
      { sourceId: 'cloud', trackId: 't1', provider: 'GOOGLE_DRIVE' },
      { sourceId: 's1', trackId: 't1', provider: 'LOCAL' },
    ]);
    pickAudioFiles.mockResolvedValue([picked]);
    container = document.createElement('div');
    root = createRoot(container);
    await act(async () => root.render(createElement(Probe)));
  });

  afterEach(() => {
    root.unmount();
    toastListeners.clear();
  });

  it('keeps the file when the hash matches', async () => {
    matchHash.mockResolvedValue({ matches: true });

    let result: boolean | undefined;
    await act(async () => {
      result = await hook.current!.relink('t1');
    });

    expect(matchHash).toHaveBeenCalledWith('s1', { contentHash: 'a'.repeat(64) });
    expect(saveLocalFile).toHaveBeenCalledWith('s1', picked, 't1');
    expect(result).toBe(true);
  });

  it('rejects a file whose hash does not match', async () => {
    matchHash.mockResolvedValue({ matches: false });
    const messages: unknown[] = [];
    toastListeners.add((message) => messages.push(message));

    let result: boolean | undefined;
    await act(async () => {
      result = await hook.current!.relink('t1');
    });

    expect(saveLocalFile).not.toHaveBeenCalled();
    expect(result).toBe(false);
    expect(messages).toEqual([
      expect.objectContaining({
        text: 'Filen hör inte till den här låten. Välj en annan fil.',
        variant: 'error',
      }),
    ]);
  });
});
