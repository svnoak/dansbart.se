import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getDanceList,
  addEntry,
  removeEntry,
  addTrackToEntry,
  removeTrackFromEntry,
  setPlayMode,
} from '@/api/generated/dance-lists/dance-lists';
import { getDances } from '@/api/generated/dances/dances';
import { searchTracks } from '@/api/generated/tracks/tracks';
import type { DanceListDto } from '@/api/models/danceListDto';
import type { DanceListEntryDto } from '@/api/models/danceListEntryDto';
import type { Dance } from '@/api/models/dance';
import type { PlaylistTrackDto } from '@/api/models/playlistTrackDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import { Button, Card, InlineError } from '@/ui';
import { PlusIcon, PlayIcon } from '@/icons';
import { usePlayer } from '@/player/usePlayer';
import { SelectableSearchResults } from '@/components';

type ActiveSearch = 'dance' | { entryId: string } | null;
type ConfirmRemoval = { kind: 'entry'; entryId: string } | { kind: 'track'; entryId: string; trackId: string } | null;

function extractContent<T>(result: unknown): T[] {
  const content = result && typeof result === 'object' && 'content' in result ? result.content : null;
  return Array.isArray(content) ? (content as T[]) : [];
}

const PLAY_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: 'in_order', label: 'I ordning' },
  { value: 'random', label: 'Slumpvis' },
];

export default function DanceListPage() {
  const { id } = useParams<{ id: string }>();
  const { play } = usePlayer();
  const [danceList, setDanceList] = useState<DanceListDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeSearch, setActiveSearch] = useState<ActiveSearch>(null);
  const [confirmRemoval, setConfirmRemoval] = useState<ConfirmRemoval>(null);

  const [danceQuery, setDanceQuery] = useState('');
  const [danceResults, setDanceResults] = useState<Dance[]>([]);
  const [danceSearching, setDanceSearching] = useState(false);
  const [danceSearchFailed, setDanceSearchFailed] = useState(false);
  const [selectedDanceId, setSelectedDanceId] = useState<string | null>(null);
  const [addingDance, setAddingDance] = useState(false);
  const danceSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<TrackListDto[]>([]);
  const [trackSearching, setTrackSearching] = useState(false);
  const [trackSearchFailed, setTrackSearchFailed] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [addingTrack, setAddingTrack] = useState(false);
  const trackSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [addDanceError, setAddDanceError] = useState<string | null>(null);
  const [addTrackError, setAddTrackError] = useState<string | null>(null);
  const [entryRemoveErrors, setEntryRemoveErrors] = useState<Record<string, string>>({});
  const [trackRemoveErrors, setTrackRemoveErrors] = useState<Record<string, string>>({});
  const [playModeErrors, setPlayModeErrors] = useState<Record<string, string>>({});

  const canManage = danceList?.viewerCanManage === true;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await getDanceList(id as string);
        if (!cancelled) setDanceList(data);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (activeSearch !== 'dance' || !danceQuery.trim()) {
      setDanceResults([]);
      setDanceSearching(false);
      setDanceSearchFailed(false);
      return;
    }
    let cancelled = false;
    setDanceSearching(true);
    setDanceSearchFailed(false);
    clearTimeout(danceSearchDebounceRef.current);
    danceSearchDebounceRef.current = setTimeout(() => {
      getDances({ search: danceQuery.trim() })
        .then((result) => {
          if (cancelled) return;
          setDanceResults(extractContent<Dance>(result));
        })
        .catch(() => {
          if (cancelled) return;
          setDanceResults([]);
          setDanceSearchFailed(true);
        })
        .finally(() => {
          if (!cancelled) setDanceSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(danceSearchDebounceRef.current);
    };
  }, [activeSearch, danceQuery]);

  useEffect(() => {
    if (typeof activeSearch !== 'object' || !activeSearch || !trackQuery.trim()) {
      setTrackResults([]);
      setTrackSearching(false);
      setTrackSearchFailed(false);
      return;
    }
    let cancelled = false;
    setTrackSearching(true);
    setTrackSearchFailed(false);
    clearTimeout(trackSearchDebounceRef.current);
    trackSearchDebounceRef.current = setTimeout(() => {
      searchTracks({ q: trackQuery.trim(), pageable: { page: 0, size: 20 } })
        .then((result) => {
          if (cancelled) return;
          setTrackResults(result?.items ?? []);
        })
        .catch(() => {
          if (cancelled) return;
          setTrackResults([]);
          setTrackSearchFailed(true);
        })
        .finally(() => {
          if (!cancelled) setTrackSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(trackSearchDebounceRef.current);
    };
  }, [activeSearch, trackQuery]);

  function openDanceSearch() {
    setDanceQuery('');
    setSelectedDanceId(null);
    setActiveSearch('dance');
  }

  function openTrackSearch(entryId: string) {
    setTrackQuery('');
    setSelectedTrackId(null);
    setActiveSearch({ entryId });
  }

  function closeSearch() {
    setActiveSearch(null);
    setDanceQuery('');
    setTrackQuery('');
    setAddDanceError(null);
    setAddTrackError(null);
  }

  async function handleAddDance(danceId: string | null, freeTextName: string | null) {
    if (!id || addingDance) return;
    setAddingDance(true);
    try {
      const newEntry = await addEntry(id, {
        danceId: danceId || undefined,
        freeTextName: freeTextName || undefined,
      });
      setDanceList((prev) =>
        prev ? { ...prev, entries: [...(prev.entries ?? []), newEntry] } : prev,
      );
      closeSearch();
    } catch {
      setAddDanceError('Det gick inte att lägga till dansen.');
    } finally {
      setAddingDance(false);
    }
  }

  async function handleRemoveEntry(entryId: string) {
    if (!id) return;
    setEntryRemoveErrors((prev) => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
    try {
      await removeEntry(id, entryId);
      setDanceList((prev) =>
        prev ? { ...prev, entries: (prev.entries ?? []).filter((e) => e.id !== entryId) } : prev,
      );
    } catch {
      setEntryRemoveErrors((prev) => ({ ...prev, [entryId]: 'Det gick inte att ta bort dansen.' }));
    } finally {
      setConfirmRemoval(null);
    }
  }

  async function handleAddTrack(entryId: string, track: TrackListDto) {
    if (!id || !track.id || addingTrack) return;
    setAddingTrack(true);
    try {
      const linked = await addTrackToEntry(id, entryId, { trackId: track.id });
      const newTrack: PlaylistTrackDto = {
        id: linked.id,
        position: linked.position,
        track: { id: track.id, title: track.title, artistName: track.artistName, durationMs: track.durationMs },
      };
      setDanceList((prev) =>
        prev
          ? {
              ...prev,
              entries: (prev.entries ?? []).map((e) =>
                e.id === entryId ? { ...e, tracks: [...(e.tracks ?? []), newTrack] } : e,
              ),
            }
          : prev,
      );
      closeSearch();
    } catch {
      setAddTrackError('Det gick inte att lägga till låten.');
    } finally {
      setAddingTrack(false);
    }
  }

  async function handleRemoveTrack(entryId: string, trackId: string) {
    if (!id) return;
    setTrackRemoveErrors((prev) => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
    try {
      await removeTrackFromEntry(id, entryId, trackId);
      setDanceList((prev) =>
        prev
          ? {
              ...prev,
              entries: (prev.entries ?? []).map((e) =>
                e.id === entryId ? { ...e, tracks: (e.tracks ?? []).filter((t) => t.id !== trackId) } : e,
              ),
            }
          : prev,
      );
    } catch {
      setTrackRemoveErrors((prev) => ({ ...prev, [trackId]: 'Det gick inte att ta bort låten.' }));
    } finally {
      setConfirmRemoval(null);
    }
  }

  async function handlePlayModeChange(entryId: string, nextPlayMode: string) {
    if (!id) return;
    setPlayModeErrors((prev) => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
    try {
      await setPlayMode(id, entryId, { playMode: nextPlayMode });
      setDanceList((prev) =>
        prev
          ? {
              ...prev,
              entries: (prev.entries ?? []).map((e) =>
                e.id === entryId ? { ...e, playMode: nextPlayMode } : e,
              ),
            }
          : prev,
      );
    } catch {
      setPlayModeErrors((prev) => ({ ...prev, [entryId]: 'Det gick inte att ändra spelläget.' }));
    }
  }

  function handlePlayEntry(entry: DanceListEntryDto) {
    const ordered = [...(entry.tracks ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const tracks = ordered.map((t) => t.track).filter((t): t is NonNullable<typeof t> => !!t);
    if (tracks.length === 0) return;
    const index = entry.playMode === 'random' ? Math.floor(Math.random() * tracks.length) : 0;
    play(tracks[index], tracks);
  }

  if (loading) {
    return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  }

  if (notFound || !danceList) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))]">Danslistan hittades inte.</p>;
  }

  const entries = danceList.entries ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">{danceList.name}</h1>
        {danceList.description && (
          <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">{danceList.description}</p>
        )}
      </div>

      {canManage && activeSearch === null && (
        <Button onClick={openDanceSearch}>
          <PlusIcon className="mr-1.5 h-4 w-4" aria-hidden />
          Lägg till dans
        </Button>
      )}

      {canManage && activeSearch === 'dance' && (
        <Card className="p-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="dance-search" className="block text-sm font-medium text-[rgb(var(--color-text))]">
                Sök efter dans
              </label>
              <input
                id="dance-search"
                type="text"
                value={danceQuery}
                onChange={(e) => {
                  setDanceQuery(e.target.value);
                  setAddDanceError(null);
                }}
                placeholder="Sök..."
                autoFocus
                className="mt-1 min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] placeholder-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
              />
            </div>

            {danceSearching && <p className="text-sm text-[rgb(var(--color-text-muted))]">Söker...</p>}

            {!danceSearching && (
              <SelectableSearchResults
                results={danceResults}
                getId={(dance) => dance.id}
                renderResult={(dance) => dance.name}
                selectedId={selectedDanceId}
                onSelect={setSelectedDanceId}
                onConfirm={(dance) => handleAddDance(dance.id as string, null)}
                confirming={addingDance}
              />
            )}

            {!danceSearching && danceSearchFailed && (
              <p className="text-sm text-[rgb(var(--color-text-muted))]">Sökningen misslyckades. Försök igen.</p>
            )}

            {!danceSearching && !danceSearchFailed && danceQuery.trim() && danceResults.length === 0 && (
              <div className="space-y-2 border-t border-[rgb(var(--color-border))] pt-3">
                <p className="text-sm text-[rgb(var(--color-text-muted))]">Dansen finns inte. Lägg till den manuellt:</p>
                <Button onClick={() => handleAddDance(null, danceQuery)} disabled={addingDance} variant="secondary">
                  Lägg till som egen dans
                </Button>
              </div>
            )}

            <InlineError>{addDanceError}</InlineError>

            <Button type="button" variant="ghost" onClick={closeSearch} disabled={addingDance}>
              Avbryt
            </Button>
          </div>
        </Card>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">Danslistan har inga danser ännu.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const tracks = [...(entry.tracks ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            const linkedTrackIds = new Set(
              tracks.map((t) => t.track?.id).filter((trackId): trackId is string => !!trackId),
            );
            const isConfirmingEntryRemoval = confirmRemoval?.kind === 'entry' && confirmRemoval.entryId === entry.id;
            const isTrackSearchOpen = typeof activeSearch === 'object' && activeSearch?.entryId === entry.id;

            return (
              <li key={entry.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[rgb(var(--color-text))]">
                      {entry.danceName ?? entry.freeTextName}
                    </span>
                    <div className="flex items-center gap-2">
                      {tracks.length > 0 && (
                        <Button size="sm" variant="secondary" onClick={() => handlePlayEntry(entry)}>
                          <PlayIcon className="mr-1.5 h-4 w-4" aria-hidden />
                          Spela
                        </Button>
                      )}
                      {canManage &&
                        (isConfirmingEntryRemoval ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleRemoveEntry(entry.id as string)}
                            >
                              Ja, ta bort
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmRemoval(null)}>
                              Avbryt
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmRemoval({ kind: 'entry', entryId: entry.id ?? '' })}
                          >
                            Ta bort
                          </Button>
                        ))}
                    </div>
                  </div>

                  <InlineError>{entryRemoveErrors[entry.id ?? '']}</InlineError>

                  {canManage && (
                    <div>
                      <label
                        htmlFor={`play-mode-${entry.id}`}
                        className="mr-2 text-sm font-medium text-[rgb(var(--color-text))]"
                      >
                        Spelläge
                      </label>
                      <select
                        id={`play-mode-${entry.id}`}
                        value={entry.playMode ?? 'in_order'}
                        onChange={(e) => handlePlayModeChange(entry.id as string, e.target.value)}
                        className="min-h-11 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
                      >
                        {PLAY_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <InlineError>{playModeErrors[entry.id ?? '']}</InlineError>
                    </div>
                  )}

                  {tracks.length === 0 ? (
                    <p className="text-sm text-[rgb(var(--color-text-muted))]">Inga låtar länkade ännu.</p>
                  ) : (
                    <ul className="space-y-1">
                      {tracks.map((pt) => {
                        const isConfirmingTrackRemoval =
                          confirmRemoval?.kind === 'track' &&
                          confirmRemoval.entryId === entry.id &&
                          confirmRemoval.trackId === pt.id;
                        return (
                          <li
                            key={pt.id}
                            className="flex items-center justify-between gap-3 border-t border-[rgb(var(--color-border))]/50 pt-2 first:border-t-0 first:pt-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">
                                {pt.track?.title ?? 'Okänd låt'}
                              </p>
                              <p className="truncate text-sm text-[rgb(var(--color-text-muted))]">
                                {pt.track?.artistName ?? 'Okänd artist'}
                              </p>
                              <InlineError>{trackRemoveErrors[pt.id ?? '']}</InlineError>
                            </div>
                            {canManage &&
                              (isConfirmingTrackRemoval ? (
                                <div className="flex shrink-0 gap-2">
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => handleRemoveTrack(entry.id as string, pt.id as string)}
                                  >
                                    Ja, ta bort
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setConfirmRemoval(null)}>
                                    Avbryt
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="shrink-0"
                                  onClick={() =>
                                    setConfirmRemoval({ kind: 'track', entryId: entry.id ?? '', trackId: pt.id ?? '' })
                                  }
                                >
                                  Ta bort låt
                                </Button>
                              ))}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {canManage && !isTrackSearchOpen && activeSearch === null && (
                    <Button size="sm" variant="secondary" onClick={() => openTrackSearch(entry.id as string)}>
                      <PlusIcon className="mr-1.5 h-4 w-4" aria-hidden />
                      Lägg till låt
                    </Button>
                  )}

                  {canManage && isTrackSearchOpen && (
                    <Card className="space-y-3 p-3">
                      <div>
                        <label
                          htmlFor={`track-search-${entry.id}`}
                          className="block text-sm font-medium text-[rgb(var(--color-text))]"
                        >
                          Sök efter låt
                        </label>
                        <input
                          id={`track-search-${entry.id}`}
                          type="text"
                          value={trackQuery}
                          onChange={(e) => {
                            setTrackQuery(e.target.value);
                            setAddTrackError(null);
                          }}
                          placeholder="Sök..."
                          autoFocus
                          className="mt-1 min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] placeholder-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
                        />
                      </div>

                      {trackSearching && <p className="text-sm text-[rgb(var(--color-text-muted))]">Söker...</p>}

                      {!trackSearching && (
                        <SelectableSearchResults
                          results={trackResults}
                          getId={(track) => track.id}
                          renderResult={(track) => (
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[rgb(var(--color-text))]">
                                {track.title}
                              </p>
                              <p className="truncate text-sm text-[rgb(var(--color-text-muted))]">
                                {track.artistName ?? 'Okänd artist'}
                              </p>
                            </div>
                          )}
                          selectedId={selectedTrackId}
                          onSelect={setSelectedTrackId}
                          onConfirm={(track) => handleAddTrack(entry.id as string, track)}
                          confirming={addingTrack}
                          disabledIds={linkedTrackIds}
                          disabledLabel="Redan tillagd"
                        />
                      )}

                      {!trackSearching && trackSearchFailed && (
                        <p className="text-sm text-[rgb(var(--color-text-muted))]">Sökningen misslyckades. Försök igen.</p>
                      )}

                      {!trackSearching && !trackSearchFailed && trackQuery.trim() && trackResults.length === 0 && (
                        <p className="text-sm text-[rgb(var(--color-text-muted))]">Inga låtar hittades.</p>
                      )}

                      <InlineError>{addTrackError}</InlineError>

                      <Button type="button" variant="ghost" onClick={closeSearch} disabled={addingTrack}>
                        Avbryt
                      </Button>
                    </Card>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
