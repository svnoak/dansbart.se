export async function computeAudioHash(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array<ArrayBuffer>(buffer);

  let audioBytes: Uint8Array<ArrayBuffer>;

  if (isFlac(bytes)) {
    audioBytes = skipFlacMetadataBlocks(bytes);
  } else if (isMp3(bytes)) {
    audioBytes = skipMp3Tags(bytes);
  } else {
    audioBytes = bytes;
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', audioBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isFlac(bytes: Uint8Array<ArrayBuffer>): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x66 &&
    bytes[1] === 0x4c &&
    bytes[2] === 0x61 &&
    bytes[3] === 0x43
  );
}

function isMp3(bytes: Uint8Array<ArrayBuffer>): boolean {
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return true;
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return true;
  }
  return false;
}

function skipFlacMetadataBlocks(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  let offset = 4;

  while (offset + 4 <= bytes.length) {
    const headerByte = bytes[offset];
    const isLastBlock = (headerByte & 0x80) !== 0;
    const blockLength =
      (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 4 + blockLength;

    if (isLastBlock) {
      break;
    }
  }

  return bytes.subarray(offset) as Uint8Array<ArrayBuffer>;
}

function skipMp3Tags(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  let start = 0;
  let end = bytes.length;

  start = skipId3v2(bytes);

  if (hasId3v1(bytes, end)) {
    end -= 128;
  }

  end = skipApeTagAtEnd(bytes, end);

  return bytes.subarray(start, end) as Uint8Array<ArrayBuffer>;
}

function skipId3v2(bytes: Uint8Array<ArrayBuffer>): number {
  if (
    bytes.length < 10 ||
    bytes[0] !== 0x49 ||
    bytes[1] !== 0x44 ||
    bytes[2] !== 0x33
  ) {
    return 0;
  }

  const flags = bytes[5];
  const tagSize =
    (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
  let offset = 10 + tagSize;

  if ((flags & 0x10) !== 0) {
    offset += 10;
  }

  return offset;
}

function hasId3v1(bytes: Uint8Array<ArrayBuffer>, endOffset: number): boolean {
  return (
    endOffset >= 128 &&
    bytes[endOffset - 128] === 0x54 &&
    bytes[endOffset - 127] === 0x41 &&
    bytes[endOffset - 126] === 0x47
  );
}

function skipApeTagAtEnd(bytes: Uint8Array<ArrayBuffer>, endOffset: number): number {
  if (endOffset < 32) {
    return endOffset;
  }

  const footerOffset = endOffset - 32;
  if (
    bytes[footerOffset] !== 0x41 ||
    bytes[footerOffset + 1] !== 0x50 ||
    bytes[footerOffset + 2] !== 0x45 ||
    bytes[footerOffset + 3] !== 0x54 ||
    bytes[footerOffset + 4] !== 0x41 ||
    bytes[footerOffset + 5] !== 0x47 ||
    bytes[footerOffset + 6] !== 0x45 ||
    bytes[footerOffset + 7] !== 0x58
  ) {
    return endOffset;
  }

  const footer = bytes.subarray(footerOffset, endOffset);
  const tagSize =
    footer[12] | (footer[13] << 8) | (footer[14] << 16) | (footer[15] << 24);
  const hasHeader = (footer[23] & 0x80) !== 0;

  let newEnd = endOffset - tagSize;
  if (hasHeader) {
    newEnd -= 32;
  }

  return newEnd;
}
