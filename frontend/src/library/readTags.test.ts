import { describe, it, expect, vi } from 'vitest';
import { readTags } from './readTags';

const parseBlob = vi.fn();
vi.mock('music-metadata', () => ({
  parseBlob: (...args: unknown[]) => parseBlob(...args),
}));

describe('readTags', () => {
  it('falls back to the file name when tags are missing', async () => {
    parseBlob.mockResolvedValue({ common: {}, format: {} });

    const tags = await readTags(new File(['x'], 'Slängpolska efter Olle.mp3'));

    expect(tags.title).toBe('Slängpolska efter Olle');
  });

  it('reads the ISRC from the tags', async () => {
    parseBlob.mockResolvedValue({
      common: { title: 'Vals', artist: 'Anna', album: 'Skiva', isrc: ['SEABC2300001'] },
      format: { duration: 183.4 },
    });

    const tags = await readTags(new File(['x'], 'vals.flac'));

    expect(tags).toEqual({
      title: 'Vals',
      artist: 'Anna',
      album: 'Skiva',
      durationMs: 183400,
      isrc: 'SEABC2300001',
    });
  });
});
