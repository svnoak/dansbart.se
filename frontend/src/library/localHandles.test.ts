import { describe, it, expect } from 'vitest';
import { getLocalFileForTrack, saveLocalFile } from './localHandles';

describe('localHandles', () => {
  it('finds the file of a track by its id', async () => {
    const file = new File(['audio bytes'], 'vals.mp3');
    await saveLocalFile('s1', { file }, 't1');

    expect(await getLocalFileForTrack('t1')).toBe(file);
    expect(await getLocalFileForTrack('t2')).toBeUndefined();
  });
});
