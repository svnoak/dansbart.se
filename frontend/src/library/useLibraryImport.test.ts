import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useLibraryImport } from './useLibraryImport';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const saveLocalFile = vi.fn();

vi.mock('./audioHash', () => ({ computeAudioHash: async () => 'a'.repeat(64) }));
vi.mock('./readTags', () => ({
  readTags: async () => ({
    title: 'Vals',
    artist: 'Anna',
    album: 'Skiva',
    durationMs: 183400,
    isrc: 'SEABC2300001',
  }),
}));
vi.mock('./localHandles', () => ({
  saveLocalFile: (...args: unknown[]) => saveLocalFile(...args),
}));

describe('useLibraryImport', () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

  const hook: { current?: ReturnType<typeof useLibraryImport> } = {};

  function Probe() {
    const value = useLibraryImport();
    useEffect(() => {
      hook.current = value;
    });
    return null;
  }

  beforeEach(() => {
    fetchMock.mockReset();
    saveLocalFile.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ sourceId: 's1', trackId: 't1', linkedToCatalog: false })),
    );
    vi.stubGlobal('fetch', fetchMock);
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    vi.unstubAllGlobals();
  });

  it('posts the hash and the tags and uploads no audio', async () => {
    await act(async () => root.render(createElement(Probe)));
    const file = new File(['audio bytes'], 'vals.mp3');

    await act(async () => {
      await hook.current!.importFiles([{ file }]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/library/tracks');
    expect(init.method).toBe('POST');
    expect(typeof init.body).toBe('string');
    expect(JSON.parse(init.body as string)).toEqual({
      contentHash: 'a'.repeat(64),
      provider: 'LOCAL',
      providerFileId: 'vals.mp3',
      title: 'Vals',
      artist: 'Anna',
      album: 'Skiva',
      durationMs: 183400,
      isrc: 'SEABC2300001',
    });
    expect(init.body as string).not.toContain('audio bytes');
    expect(saveLocalFile).toHaveBeenCalledWith('s1', { file });
  });
});
