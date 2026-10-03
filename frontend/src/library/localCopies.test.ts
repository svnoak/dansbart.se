import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installFakeOpfs } from '@/test/fakeOpfs';
import {
  writeLocalCopy,
  readLocalCopy,
  hasLocalCopy,
  deleteLocalCopy,
  canKeepLocalCopies,
  requestPersistentStorage,
} from './localCopies';

describe('localCopies', () => {
  let fakeOpfs: ReturnType<typeof installFakeOpfs>;

  beforeEach(() => {
    fakeOpfs = installFakeOpfs();
  });

  afterEach(() => {
    fakeOpfs.restore();
    vi.resetModules();
  });

  it('writes a copy that reads back with the same bytes', async () => {
    const trackId = 'track-1';
    const content = 'audio content here';
    const file = new File([content], 'song.mp3', { type: 'audio/mpeg' });

    const writeResult = await writeLocalCopy(trackId, file);
    expect(writeResult).toBe(true);

    const readFile = await readLocalCopy(trackId);
    expect(readFile).not.toBeUndefined();
    expect(readFile!.name).toBe(trackId);

    const text = await readFile!.text();
    expect(text).toBe(content);
  });

  it('has a copy after a write and none before', async () => {
    const trackId = 'track-2';

    const beforeWrite = await hasLocalCopy(trackId);
    expect(beforeWrite).toBe(false);

    const file = new File(['content'], 'song.mp3');
    await writeLocalCopy(trackId, file);

    const afterWrite = await hasLocalCopy(trackId);
    expect(afterWrite).toBe(true);
  });

  it('overwrites the copy of the same track', async () => {
    const trackId = 'track-3';

    const file1 = new File(['first content'], 'song.mp3');
    await writeLocalCopy(trackId, file1);

    const file2 = new File(['second content'], 'song.mp3');
    const writeResult = await writeLocalCopy(trackId, file2);
    expect(writeResult).toBe(true);

    const readFile = await readLocalCopy(trackId);
    const text = await readFile!.text();
    expect(text).toBe('second content');
  });

  it('deletes a copy and ignores a missing copy', async () => {
    const trackId = 'track-4';

    const file = new File(['content'], 'song.mp3');
    await writeLocalCopy(trackId, file);

    let hasCopy = await hasLocalCopy(trackId);
    expect(hasCopy).toBe(true);

    await deleteLocalCopy(trackId);

    hasCopy = await hasLocalCopy(trackId);
    expect(hasCopy).toBe(false);

    await expect(deleteLocalCopy(trackId)).resolves.not.toThrow();
  });

  it('write resolves false and stores nothing when getDirectory rejects', async () => {
    fakeOpfs.restore();
    const securityError = new DOMException('Not allowed', 'SecurityError');
    fakeOpfs = installFakeOpfs({ getDirectoryRejects: securityError });

    const trackId = 'track-5';
    const file = new File(['content'], 'song.mp3');

    const writeResult = await writeLocalCopy(trackId, file);
    expect(writeResult).toBe(false);

    const hasCopy = await hasLocalCopy(trackId);
    expect(hasCopy).toBe(false);
  });

  it('write resolves false and keeps no partial copy when createWritable rejects', async () => {
    fakeOpfs.restore();
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    fakeOpfs = installFakeOpfs({ createWritableRejects: quotaError });

    const trackId = 'track-6';
    const file = new File(['content that is too large'], 'song.mp3');

    const writeResult = await writeLocalCopy(trackId, file);
    expect(writeResult).toBe(false);

    const hasCopy = await hasLocalCopy(trackId);
    expect(hasCopy).toBe(false);
  });

  it('cannot keep copies when getDirectory or createWritable is missing', async () => {
    fakeOpfs.restore();
    delete (navigator as unknown as Record<string, unknown>).storage;
    delete (globalThis as Record<string, unknown>).FileSystemFileHandle;

    const canKeep = canKeepLocalCopies();
    expect(canKeep).toBe(false);

    const file = new File(['content'], 'song.mp3');
    const writeResult = await writeLocalCopy('track-7', file);
    expect(writeResult).toBe(false);

    const readResult = await readLocalCopy('track-7');
    expect(readResult).toBeUndefined();
  });

  it('a failed overwrite keeps the earlier copy', async () => {
    await writeLocalCopy('track-8', new File(['first content'], 'song.mp3'));
    fakeOpfs.root.setCreateWritableRejects(new DOMException('Quota', 'QuotaExceededError'));

    const writeResult = await writeLocalCopy('track-8', new File(['second content'], 'song.mp3'));

    expect(writeResult).toBe(false);
    expect(await (await readLocalCopy('track-8'))!.text()).toBe('first content');
  });

  it('a copy keeps the audio type of the original file', async () => {
    await writeLocalCopy('track-9', new File(['content'], 'song.flac', { type: 'audio/flac' }));

    expect((await readLocalCopy('track-9'))!.type).toBe('audio/flac');
    await deleteLocalCopy('track-9');
    expect(await hasLocalCopy('track-9')).toBe(false);
  });

  it('requests persistent storage once per page load', () => {
    const persistFn = vi.mocked(navigator.storage.persist);

    requestPersistentStorage();
    requestPersistentStorage();

    expect(persistFn).toHaveBeenCalledTimes(1);
  });

  it('ignores a rejected persistent storage request', async () => {
    vi.resetModules();
    const fresh = await import('./localCopies');
    vi.mocked(navigator.storage.persist).mockRejectedValueOnce(new Error('Not allowed'));

    expect(() => fresh.requestPersistentStorage()).not.toThrow();
    await Promise.resolve();

    expect(navigator.storage.persist).toHaveBeenCalledTimes(1);
  });
});
