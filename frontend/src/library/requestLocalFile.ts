import { toast } from '@/ui';
import { getLocalFileForTrack, LocalFilePermissionDenied } from './localHandles';

/** Asks for access to the stored file. Shows an error when access is denied. */
export async function requestLocalFile(trackId: string): Promise<'ready' | 'missing' | 'denied'> {
  try {
    const file = await getLocalFileForTrack(trackId, { askPermission: true });
    return file ? 'ready' : 'missing';
  } catch (error) {
    if (!(error instanceof LocalFilePermissionDenied)) throw error;
    toast('Dansbart.se kan inte läsa filen. Tillåt åtkomst och försök igen.', 'error');
    return 'denied';
  }
}
