import { useCallback, useEffect, useRef, useState } from 'react';
import { listMyTracks, deleteLibraryTrack } from '@/api/generated/library/library';
import type { LibraryTrackDto } from '@/api/models/libraryTrackDto';
import { TrackRow } from '@/components/TrackRow';
import { canKeepHandles, pickAudioFiles } from '@/library/localHandles';
import { deleteLocalCopy, requestPersistentStorage } from '@/library/localCopies';
import { useLibraryImport, type ImportResult } from '@/library/useLibraryImport';
import { Badge, Button, InlineError, LoadError, SectionTitle, toast } from '@/ui';

const SOURCE_LABELS: Record<string, string> = {
  LOCAL: 'Lokalt',
  GDRIVE: 'Google Drive',
  HIDRIVE: 'HiDrive',
};

function importResultText({ imported, skipped }: ImportResult): string {
  const importedText = `${imported} ${imported === 1 ? 'låt importerad' : 'låtar importerade'}`;
  if (skipped === 0) return importedText;
  if (imported === 0) return `${skipped} ${skipped === 1 ? 'låt fanns' : 'låtar fanns'} redan`;
  return `${importedText}, ${skipped} fanns redan`;
}

export function MyLibraryPage() {
  const [entries, setEntries] = useState<LibraryTrackDto[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { importFiles, progress, error } = useLibraryImport();

  const load = useCallback(async () => {
    try {
      setEntries(await listMyTracks());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    listMyTracks().then(setEntries, () => setLoadFailed(true));
  }, []);

  async function importAndReload(picked: Parameters<typeof importFiles>[0]) {
    const result = await importFiles(picked);
    if (result.imported > 0 || result.skipped > 0) toast(importResultText(result));
    await load();
  }

  async function handleImportClick() {
    requestPersistentStorage();
    if (!canKeepHandles()) {
      fileInput.current?.click();
      return;
    }
    try {
      await importAndReload(await pickAudioFiles());
    } catch {
      // The person closed the file picker.
    }
  }

  async function remove(trackId: string) {
    try {
      await deleteLibraryTrack(trackId);
      await deleteLocalCopy(trackId);
      setEntries((current) => current?.filter((entry) => entry.track?.id !== trackId) ?? null);
      toast('Låten är borttagen');
    } catch {
      toast('Det gick inte att ta bort låten. Försök igen.', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <SectionTitle>Mina låtar</SectionTitle>
      <p className="mb-4 text-sm text-[rgb(var(--color-text-muted))]">
        Ljudet stannar på din enhet. Bara titel, artist och ett fingeravtryck skickas.
      </p>

      <Button disabled={progress !== null} onClick={() => void handleImportClick()}>
        Importera låtar
      </Button>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="audio/*"
        hidden
        onChange={(e) => {
          void importAndReload(Array.from(e.target.files ?? [], (file) => ({ file })));
          e.target.value = '';
        }}
      />
      {progress && (
        <p role="status" className="mt-3 text-sm">
          Importerar låt {progress.done + 1} av {progress.total}
        </p>
      )}
      <InlineError>{error}</InlineError>

      <div className="mt-6">
        {loadFailed && <LoadError message="Det gick inte att hämta dina låtar." onRetry={load} />}
        {entries?.length === 0 && (
          <p>Du har inga låtar än. Importera en låt för att börja.</p>
        )}
        <ul>
          {entries?.map((entry) => (
            <li key={entry.track!.id}>
              <TrackRow
                track={entry.track!}
                contextTracks={entries.map((e) => e.track!)}
                showAlbum
                badges={<div className="mt-1 flex flex-wrap gap-1">
                  {entry.sources?.map((source) => (
                    <Badge key={source.sourceId} variant="muted">
                      {SOURCE_LABELS[source.provider!]}
                    </Badge>
                  ))}
                </div>}
                extraMenuItems={[
                  { label: 'Ta bort från Mina låtar', onClick: () => remove(entry.track!.id!) },
                ]}
                isPrivate={!entry.linkedToCatalog}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
