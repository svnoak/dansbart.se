import { useCallback, useEffect, useRef, useState } from 'react';
import { listTracks, deleteSource } from '@/api/generated/library/library';
import type { LibrarySourceDto } from '@/api/models/librarySourceDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import { PlayButton } from '@/components/TrackRow/PlayButton';
import { StyleVotePanel } from '@/components/TrackRow/StyleVotePanel';
import { canKeepHandles, pickAudioFiles } from '@/library/localHandles';
import { requestLocalFile } from '@/library/requestLocalFile';
import { usePlayer } from '@/player/usePlayer';
import { UNKNOWN_STYLE_COLOR } from '@/styles/danceStyleColors';
import { useLibraryImport, type ImportResult } from '@/library/useLibraryImport';
import { RelinkButton } from '@/components/TrackRow/RelinkButton';
import { Button, InlineError, LoadError, SectionTitle, toast } from '@/ui';

function toTrack(source: LibrarySourceDto): TrackListDto {
  return {
    id: source.trackId,
    title: source.title,
    artistName: source.artist,
    playable: true,
    playbackLinks: [],
  };
}

function importResultText({ imported, skipped }: ImportResult): string {
  const importedText = `${imported} ${imported === 1 ? 'låt importerad' : 'låtar importerade'}`;
  if (skipped === 0) return importedText;
  if (imported === 0) return `${skipped} ${skipped === 1 ? 'låt fanns' : 'låtar fanns'} redan`;
  return `${importedText}, ${skipped} fanns redan`;
}

export function MyLibraryPage() {
  const [sources, setSources] = useState<LibrarySourceDto[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [votingOn, setVotingOn] = useState<LibrarySourceDto | null>(null);
  const [removeError, setRemoveError] = useState<{ sourceId: string; text: string } | null>(null);
  const [missingTrackIds, setMissingTrackIds] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const { importFiles, progress, error } = useLibraryImport();
  const { play, togglePlayPause, currentTrack, isPlaying } = usePlayer();

  const load = useCallback(async () => {
    try {
      setSources(await listTracks());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    listTracks().then(setSources, () => setLoadFailed(true));
  }, []);

  async function importAndReload(picked: Parameters<typeof importFiles>[0]) {
    const result = await importFiles(picked);
    if (result.imported > 0 || result.skipped > 0) toast(importResultText(result));
    await load();
  }

  async function handleImportClick() {
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

  async function handlePlay(source: LibrarySourceDto) {
    if (currentTrack?.id === source.trackId) {
      togglePlayPause();
      return;
    }
    const access = await requestLocalFile(source.trackId!);
    if (access === 'missing') setMissingTrackIds((ids) => [...ids, source.trackId!]);
    if (access !== 'ready') return;
    play(toTrack(source), sources?.map(toTrack));
  }

  async function handleRemove(sourceId: string) {
    setRemoveError(null);
    try {
      await deleteSource(sourceId);
      setSources((current) => current?.filter((s) => s.sourceId !== sourceId) ?? null);
      toast('Låten är borttagen');
    } catch {
      setRemoveError({ sourceId, text: 'Det gick inte att ta bort låten. Försök igen.' });
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
        {sources?.length === 0 && (
          <p>Du har inga låtar än. Importera en låt för att börja.</p>
        )}
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {sources?.map((source) => (
            <li key={source.sourceId} className="flex flex-wrap items-center gap-3 py-3">
              {missingTrackIds.includes(source.trackId!) ? (
                <RelinkButton
                  trackId={source.trackId!}
                  onRelinked={() =>
                    setMissingTrackIds((ids) => ids.filter((id) => id !== source.trackId))
                  }
                />
              ) : (
                <PlayButton
                  track={toTrack(source)}
                  isCurrent={currentTrack?.id === source.trackId}
                  isPlaying={isPlaying}
                  styleColor={UNKNOWN_STYLE_COLOR}
                  onPlay={() => void handlePlay(source)}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{source.title}</p>
                <p className="truncate text-sm text-[rgb(var(--color-text-muted))]">
                  {source.artist}
                </p>
                {removeError && removeError.sourceId === source.sourceId && (
                  <InlineError>{removeError.text}</InlineError>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={() => setVotingOn(source)}>
                Kategorisera
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void handleRemove(source.sourceId!)}>
                Ta bort
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {votingOn && (
        <StyleVotePanel
          open
          trackId={votingOn.trackId!}
          trackTitle={votingOn.title ?? ''}
          currentStyle={undefined}
          onClose={() => setVotingOn(null)}
        />
      )}
    </div>
  );
}
