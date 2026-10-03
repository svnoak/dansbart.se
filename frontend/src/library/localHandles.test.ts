import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLocalFileForTrack, saveLocalFile, pickAudioFiles } from './localHandles';

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
