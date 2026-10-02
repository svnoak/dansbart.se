import { useCallback, useState } from 'react';
import { importTrack } from '@/api/generated/library/library';
import { computeAudioHash } from './audioHash';
import { saveLocalFile, type PickedFile } from './localHandles';
import { readTags } from './readTags';

export interface ImportProgress {
  done: number;
  total: number;
}

/** Imports picked files one at a time. Only the hash and the tags leave the device. */
export function useLibraryImport() {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importFiles = useCallback(async (picked: PickedFile[]) => {
    const failedNames: string[] = [];
    setError(null);
    for (const [index, item] of picked.entries()) {
      setProgress({ done: index, total: picked.length });
      try {
        const [contentHash, tags] = await Promise.all([
          computeAudioHash(item.file),
          readTags(item.file),
        ]);
        const { sourceId, trackId } = await importTrack({
          contentHash,
          provider: 'LOCAL',
          providerFileId: item.file.name,
          ...tags,
        });
        await saveLocalFile(sourceId!, item, trackId!);
      } catch {
        failedNames.push(item.file.name);
      }
    }
    setProgress(null);
    if (failedNames.length > 0) {
      setError(`Det gick inte att importera: ${failedNames.join(', ')}. Försök igen.`);
    }
  }, []);

  return { importFiles, progress, error };
}
