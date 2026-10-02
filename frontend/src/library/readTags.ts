export interface LocalTags {
  title: string;
  artist?: string;
  album?: string;
  durationMs?: number;
  isrc?: string;
}

export async function readTags(file: File): Promise<LocalTags> {
  const { parseBlob } = await import('music-metadata');
  const { common, format } = await parseBlob(file);
  return {
    title: common.title ?? file.name.replace(/\.[^.]+$/, ''),
    artist: common.artist,
    album: common.album,
    durationMs: format.duration === undefined ? undefined : Math.round(format.duration * 1000),
    isrc: common.isrc?.[0],
  };
}
