import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  audioFilesFromDrop,
  audioFilesOf,
  getLocalFileForTrack,
  pickAudioFiles,
  pickAudioFolder,
  saveLocalFile,
} from './localHandles';
import { installFakeOpfs } from '@/test/fakeOpfs';

describe('localHandles', () => {
  const realCreate = document.createElement.bind(document);
  const originalShowPicker = window.showOpenFilePicker;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.showOpenFilePicker = originalShowPicker;
  });

  it('finds the file of a track by its id', async () => {
    const file = new File(['audio bytes'], 'vals.mp3');
    await saveLocalFile('s1', { file }, 't1');

    expect(await getLocalFileForTrack('t1')).toBe(file);
    expect(await getLocalFileForTrack('t2')).toBeUndefined();
  });

  it('picks files with a file input when the browser has no file picker', async () => {
    delete (window as { showOpenFilePicker?: typeof window.showOpenFilePicker }).showOpenFilePicker;

    const file = new File(['audio bytes'], 'vals.mp3');

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'input') {
        const input = realCreate('input') as HTMLInputElement;
        Object.defineProperty(input, 'files', {
          writable: true,
          value: { 0: file, length: 1 },
        });
        return input;
      }
      return realCreate(tagName);
    });

    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      setTimeout(() => {
        const event = new Event('change');
        this.dispatchEvent(event);
      }, 0);
    });

    const result = await pickAudioFiles();

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe(file);
    expect(result[0].handle).toBeUndefined();
  });

  it('resolves with no files when the person cancels the file input', async () => {
    delete (window as { showOpenFilePicker?: typeof window.showOpenFilePicker }).showOpenFilePicker;

    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      setTimeout(() => {
        const event = new Event('cancel');
        this.dispatchEvent(event);
      }, 0);
    });

    const result = await pickAudioFiles();

    expect(result).toEqual([]);
  });
});

describe('localHandles local copies', () => {
  let fakeOpfs: ReturnType<typeof installFakeOpfs>;

  const loadFresh = async () => {
    vi.resetModules();
    return import('./localHandles');
  };

  beforeEach(() => {
    fakeOpfs = installFakeOpfs();
  });

  afterEach(() => {
    fakeOpfs.restore();
    vi.resetModules();
  });

  it('saving a file without a handle writes a copy named by the track', async () => {
    const { saveLocalFile } = await loadFresh();
    const file = new File(['audio bytes'], 'vals.mp3');

    await saveLocalFile('s1', { file }, 't1');

    const directory = await fakeOpfs.root.getDirectoryHandle('mina-latar');
    const copy = await (await directory.getFileHandle('t1')).getFile();
    expect(await copy.text()).toBe('audio bytes');
  });

  it('a saved file plays after a reload from its copy', async () => {
    const first = await loadFresh();
    await first.saveLocalFile('s1', { file: new File(['audio bytes'], 'vals.mp3') }, 't1');

    const reloaded = await loadFresh();

    const file = await reloaded.getLocalFileForTrack('t1');
    expect(await file?.text()).toBe('audio bytes');
    expect(await reloaded.hasLocalFileForTrack('t1')).toBe(true);
    expect(await reloaded.hasLocalFileForTrack('t2')).toBe(false);
  });

  it('a failed copy keeps the file for the session', async () => {
    fakeOpfs.restore();
    fakeOpfs = installFakeOpfs({
      createWritableRejects: new DOMException('Quota', 'QuotaExceededError'),
    });
    const first = await loadFresh();
    const file = new File(['audio bytes'], 'vals.mp3');

    await first.saveLocalFile('s1', { file }, 't1');

    expect(await first.getLocalFileForTrack('t1')).toBe(file);
    const reloaded = await loadFresh();
    expect(await reloaded.getLocalFileForTrack('t1')).toBeUndefined();
  });

  it('a copy written later replaces the session file', async () => {
    fakeOpfs.root.setCreateWritableRejects(new DOMException('Quota', 'QuotaExceededError'));
    const { saveLocalFile, getLocalFileForTrack } = await loadFresh();
    await saveLocalFile('s1', { file: new File(['old bytes'], 'vals.mp3') }, 't1');
    fakeOpfs.root.setCreateWritableRejects(undefined);

    await saveLocalFile('s1', { file: new File(['new bytes'], 'vals.mp3') }, 't1');

    expect(await (await getLocalFileForTrack('t1'))?.text()).toBe('new bytes');
  });

  it('asking for permission returns the copy without an error', async () => {
    const first = await loadFresh();
    await first.saveLocalFile('s1', { file: new File(['audio bytes'], 'vals.mp3') }, 't1');

    const reloaded = await loadFresh();

    const file = await reloaded.getLocalFileForTrack('t1', { askPermission: true });
    expect(await file?.text()).toBe('audio bytes');
  });

  it('without OPFS a saved file lasts only for the session', async () => {
    fakeOpfs.restore();
    const first = await loadFresh();
    const file = new File(['audio bytes'], 'vals.mp3');

    await first.saveLocalFile('s1', { file }, 't1');

    expect(await first.getLocalFileForTrack('t1')).toBe(file);
    const reloaded = await loadFresh();
    expect(await reloaded.getLocalFileForTrack('t1')).toBeUndefined();
  });
});

function fileHandle(name: string) {
  return { kind: 'file', name, getFile: async () => new File(['audio'], name) };
}

function directoryHandle(name: string, children: unknown[]) {
  return {
    kind: 'directory',
    name,
    async *values() {
      yield* children;
    },
  };
}

describe('localHandles folders', () => {
  const originalShowDirectoryPicker = window.showDirectoryPicker;

  afterEach(() => {
    window.showDirectoryPicker = originalShowDirectoryPicker;
  });

  it('picks the audio files of a folder and its subfolders with their handles', async () => {
    const polska = fileHandle('polska.flac');
    const vals = fileHandle('Vals.MP3');
    window.showDirectoryPicker = vi.fn().mockResolvedValue(
      directoryHandle('Musik', [
        fileHandle('omslag.jpg'),
        vals,
        directoryHandle('Skiva 2', [polska, fileHandle('noter.pdf')]),
      ]),
    );

    const picked = await pickAudioFolder();

    expect(picked?.map(({ file }) => file.name)).toEqual(['polska.flac', 'Vals.MP3']);
    expect(picked?.map(({ handle }) => handle)).toEqual([polska, vals]);
  });

  it('returns null when the person closes the folder picker', async () => {
    window.showDirectoryPicker = vi
      .fn()
      .mockRejectedValue(new DOMException('Closed', 'AbortError'));

    expect(await pickAudioFolder()).toBeNull();
  });

  it('keeps the audio files of a folder picked with a file input, in path order', () => {
    const withPath = (name: string, path: string, type = '') => {
      const file = new File(['audio'], name, { type });
      Object.defineProperty(file, 'webkitRelativePath', { value: path });
      return file;
    };

    const picked = audioFilesOf([
      withPath('b.mp3', 'Musik/b.mp3'),
      withPath('omslag.jpg', 'Musik/omslag.jpg', 'image/jpeg'),
      withPath('spår', 'Musik/A/spår', 'audio/ogg'),
    ]);

    expect(picked.map(({ file }) => file.name)).toEqual(['spår', 'b.mp3']);
  });

  it('reads dropped files and folders, subfolders included', async () => {
    const fileEntry = (name: string, fullPath: string) => ({
      isFile: true,
      isDirectory: false,
      fullPath,
      file: (resolve: (file: File) => void) => resolve(new File(['audio'], name)),
    });
    const directoryEntry = (children: unknown[]) => ({
      isFile: false,
      isDirectory: true,
      createReader: () => {
        let read = false;
        return {
          readEntries: (resolve: (batch: unknown[]) => void) => {
            const batch = read ? [] : children;
            read = true;
            setTimeout(() => resolve(batch), 0);
          },
        };
      },
    });
    const item = (entry: unknown) => ({ kind: 'file', webkitGetAsEntry: () => entry });
    const dataTransfer = {
      items: [
        item(fileEntry('vals.mp3', '/vals.mp3')),
        item(
          directoryEntry([
            fileEntry('omslag.jpg', '/Musik/omslag.jpg'),
            fileEntry('polska.flac', '/Musik/polska.flac'),
          ]),
        ),
        { kind: 'string', webkitGetAsEntry: () => null },
      ],
    } as unknown as DataTransfer;

    const dropped = await audioFilesFromDrop(dataTransfer);

    expect(dropped.map(({ file }) => file.name)).toEqual(['polska.flac', 'vals.mp3']);
  });
});
