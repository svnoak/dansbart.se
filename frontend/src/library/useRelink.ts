import { useCallback } from 'react';
import { listTracks, matchHash } from '@/api/generated/library/library';
import { toast } from '@/ui';
import { computeAudioHash } from './audioHash';
import { pickAudioFiles, saveLocalFile } from './localHandles';

/** Links a picked file to a local track again. The file must have the hash of the track. */
export function useRelink() {
  const relink = useCallback(async (trackId: string) => {
    try {
      // Firefox requires the picker to open inside the click's user activation.
      const [picked] = await pickAudioFiles();
      if (!picked) return false;
      const sources = await listTracks();
      const source = sources.find((s) => s.trackId === trackId && s.provider === 'LOCAL');
      if (!source) throw new Error('No local source for the track');
      const { matches } = await matchHash(source.sourceId!, {
        contentHash: await computeAudioHash(picked.file),
      });
      if (!matches) {
        toast('Filen hör inte till den här låten. Välj en annan fil.', 'error');
        return false;
      }
      await saveLocalFile(source.sourceId!, picked, trackId);
      return true;
    } catch {
      toast('Det gick inte att välja filen igen. Försök igen.', 'error');
      return false;
    }
  }, []);

  return { relink };
}
