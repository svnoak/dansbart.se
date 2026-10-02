// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { computeAudioHash } from './audioHash';

// Helper: create an MPEG frame sync and audio data
function fakeAudioFrameSync(): Uint8Array<ArrayBuffer> {
  return new Uint8Array([0xFF, 0xFB, 0x90, 0x00]); // MPEG frame sync + fixed header
}

// Helper: create a FLAC metadata block
function flacBlock(
  type: number,
  data: Uint8Array,
  isLast: boolean = false,
): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(4);
  header[0] = (isLast ? 0x80 : 0x00) | (type & 0x7F);
  const length = data.length;
  header[1] = (length >> 16) & 0xFF;
  header[2] = (length >> 8) & 0xFF;
  header[3] = length & 0xFF;
  return new Uint8Array([...header, ...data]) as Uint8Array<ArrayBuffer>;
}

// Helper: create an ID3v2 header
function id3v2(tagBody: Uint8Array): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(10);
  header[0] = 0x49; // I
  header[1] = 0x44; // D
  header[2] = 0x33; // 3
  header[3] = 0x04; // version major
  header[4] = 0x00; // version minor
  header[5] = 0x00; // flags (no footer)
  // Syncsafe size: 7 bits per byte
  const size = tagBody.length;
  header[6] = (size >> 21) & 0x7F;
  header[7] = (size >> 14) & 0x7F;
  header[8] = (size >> 7) & 0x7F;
  header[9] = size & 0x7F;
  return new Uint8Array([...header, ...tagBody]) as Uint8Array<ArrayBuffer>;
}

// Helper: create an ID3v2 header with footer flag
function id3v2WithFooter(tagBody: Uint8Array): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(10);
  header[0] = 0x49; // I
  header[1] = 0x44; // D
  header[2] = 0x33; // 3
  header[3] = 0x04; // version major
  header[4] = 0x00; // version minor
  header[5] = 0x10; // flags (footer flag set)
  const size = tagBody.length;
  header[6] = (size >> 21) & 0x7F;
  header[7] = (size >> 14) & 0x7F;
  header[8] = (size >> 7) & 0x7F;
  header[9] = size & 0x7F;
  // ID3v2 footer: "3DI" followed by version and same size
  const footer = new Uint8Array(10);
  footer[0] = 0x33; // 3
  footer[1] = 0x44; // D
  footer[2] = 0x49; // I
  footer[3] = 0x04; // version major
  footer[4] = 0x00; // version minor
  footer[5] = 0x10; // flags (same as header)
  footer[6] = (size >> 21) & 0x7F;
  footer[7] = (size >> 14) & 0x7F;
  footer[8] = (size >> 7) & 0x7F;
  footer[9] = size & 0x7F;
  return new Uint8Array([...header, ...tagBody, ...footer]) as Uint8Array<ArrayBuffer>;
}

// Helper: create an ID3v1 tag (128 bytes)
function id3v1(): Uint8Array<ArrayBuffer> {
  const tag = new Uint8Array(128);
  tag[0] = 0x54; // T
  tag[1] = 0x41; // A
  tag[2] = 0x47; // G
  return tag as Uint8Array<ArrayBuffer>;
}

// Helper: create an APEv2 footer (32 bytes)
function apeFooter(tagSize: number, hasHeader: boolean = false): Uint8Array<ArrayBuffer> {
  const footer = new Uint8Array(32);
  footer[0] = 0x41; // A
  footer[1] = 0x50; // P
  footer[2] = 0x45; // E
  footer[3] = 0x54; // T
  footer[4] = 0x41; // A
  footer[5] = 0x47; // G
  footer[6] = 0x45; // E
  footer[7] = 0x58; // X
  footer[8] = 2; // version
  footer[9] = 0;
  footer[10] = 0;
  footer[11] = 0;
  // Size (little-endian, includes footer, excludes header)
  footer[12] = tagSize & 0xFF;
  footer[13] = (tagSize >> 8) & 0xFF;
  footer[14] = (tagSize >> 16) & 0xFF;
  footer[15] = (tagSize >> 24) & 0xFF;
  // Item count
  footer[16] = 1;
  footer[17] = 0;
  footer[18] = 0;
  footer[19] = 0;
  // Flags: bit 31 for header presence
  footer[23] = hasHeader ? 0x80 : 0x00;
  return footer as Uint8Array<ArrayBuffer>;
}

function computeExpectedHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('computeAudioHash', () => {
  it('hashes an MP3 without tags as the whole file', async () => {
    const audioPayload = fakeAudioFrameSync();
    const file = new Blob([audioPayload], { type: 'audio/mpeg' });

    const hash = await computeAudioHash(file);
    const expected = computeExpectedHash(audioPayload);

    expect(hash).toBe(expected);
  });

  it('gives the same hash for an MP3 with and without an ID3v2 tag', async () => {
    const audioPayload = fakeAudioFrameSync();
    const id3Tag = id3v2(new Uint8Array([0xAA, 0xBB, 0xCC]));

    const fileWithoutTag = new Blob([audioPayload], { type: 'audio/mpeg' });
    const fileWithTag = new Blob([id3Tag, audioPayload], { type: 'audio/mpeg' });

    const hashWithout = await computeAudioHash(fileWithoutTag);
    const hashWith = await computeAudioHash(fileWithTag);

    expect(hashWith).toBe(hashWithout);
  });

  it('gives the same hash when the ID3v2 tag content changes', async () => {
    const audioPayload = fakeAudioFrameSync();
    const id3Tag1 = id3v2(new Uint8Array([0xAA, 0xBB, 0xCC]));
    const id3Tag2 = id3v2(new Uint8Array([0xDD, 0xEE, 0xFF]));

    const file1 = new Blob([id3Tag1, audioPayload], { type: 'audio/mpeg' });
    const file2 = new Blob([id3Tag2, audioPayload], { type: 'audio/mpeg' });

    const hash1 = await computeAudioHash(file1);
    const hash2 = await computeAudioHash(file2);

    expect(hash1).toBe(hash2);
  });

  it('skips the ID3v2 footer when the footer flag is set', async () => {
    const audioPayload = fakeAudioFrameSync();
    const id3Tag = id3v2WithFooter(new Uint8Array([0xAA, 0xBB, 0xCC]));

    const fileWithFooter = new Blob([id3Tag, audioPayload], { type: 'audio/mpeg' });
    const fileWithoutFooter = new Blob([fakeAudioFrameSync()], { type: 'audio/mpeg' });

    const hash1 = await computeAudioHash(fileWithFooter);
    const hash2 = await computeAudioHash(fileWithoutFooter);

    expect(hash1).toBe(hash2);
  });

  it('skips an ID3v1 tag at the end', async () => {
    const audioPayload = fakeAudioFrameSync();
    const id3v1Tag = id3v1();

    const fileWithTag = new Blob([audioPayload, id3v1Tag], { type: 'audio/mpeg' });
    const fileWithoutTag = new Blob([audioPayload], { type: 'audio/mpeg' });

    const hashWith = await computeAudioHash(fileWithTag);
    const hashWithout = await computeAudioHash(fileWithoutTag);

    expect(hashWith).toBe(hashWithout);
  });

  it('skips an APEv2 tag with a header before an ID3v1 tag', async () => {
    const audioPayload = fakeAudioFrameSync();
    const id3v1Tag = id3v1();
    const apeTagData = new Uint8Array([0xAA, 0xBB]);
    const apeHeader = apeFooter(32 + apeTagData.length, true); // header flag set
    const apeFooterData = apeFooter(32 + apeTagData.length, true);

    const fileWithTags = new Blob(
      [audioPayload, apeHeader, apeTagData, apeFooterData, id3v1Tag],
      { type: 'audio/mpeg' },
    );
    const fileWithoutTags = new Blob([audioPayload], { type: 'audio/mpeg' });

    const hashWith = await computeAudioHash(fileWithTags);
    const hashWithout = await computeAudioHash(fileWithoutTags);

    expect(hashWith).toBe(hashWithout);
  });

  it('skips an APEv2 tag without an ID3v1 tag', async () => {
    const audioPayload = fakeAudioFrameSync();
    const apeTagData = new Uint8Array([0xAA, 0xBB]);
    const apeFooterData = apeFooter(32 + apeTagData.length, false); // no header

    const fileWithTags = new Blob(
      [audioPayload, apeTagData, apeFooterData],
      { type: 'audio/mpeg' },
    );
    const fileWithoutTags = new Blob([audioPayload], { type: 'audio/mpeg' });

    const hashWith = await computeAudioHash(fileWithTags);
    const hashWithout = await computeAudioHash(fileWithoutTags);

    expect(hashWith).toBe(hashWithout);
  });

  it('gives the same hash for a FLAC file when a metadata block changes', async () => {
    const flacMarker = new Uint8Array([0x66, 0x4C, 0x61, 0x43]); // 'fLaC'
    const audioPayload = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
    const block1 = flacBlock(4, new Uint8Array([0xAA, 0xBB]), true);
    const block2 = flacBlock(4, new Uint8Array([0xCC, 0xDD, 0xEE]), true);

    const file1 = new Blob([flacMarker, block1, audioPayload], { type: 'audio/flac' });
    const file2 = new Blob([flacMarker, block2, audioPayload], { type: 'audio/flac' });

    const hash1 = await computeAudioHash(file1);
    const hash2 = await computeAudioHash(file2);

    expect(hash1).toBe(hash2);
  });

  it('hashes a file of another format as the whole file', async () => {
    const riffData = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0xAA, 0xBB, 0xCC, 0xDD]);
    const file = new Blob([riffData], { type: 'audio/wav' });

    const hash = await computeAudioHash(file);
    const expected = computeExpectedHash(riffData);

    expect(hash).toBe(expected);
  });

  it('returns lowercase hex of 64 characters', async () => {
    const audioPayload = fakeAudioFrameSync();
    const file = new Blob([audioPayload], { type: 'audio/mpeg' });

    const hash = await computeAudioHash(file);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
