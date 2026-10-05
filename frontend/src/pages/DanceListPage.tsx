import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getDanceList,
  addEntry,
  removeEntry,
  renameEntry,
  addTrackToEntry,
  removeTrackFromEntry,
  setPlayMode,
  reorderEntries,
} from '@/api/generated/dance-lists/dance-lists';
import { getDances } from '@/api/generated/dances/dances';
import { searchTracks } from '@/api/generated/tracks/tracks';
import type { DanceListDto } from '@/api/models/danceListDto';
import type { DanceListEntryDto } from '@/api/models/danceListEntryDto';
import type { Dance } from '@/api/models/dance';
import type { PlaylistTrackDto } from '@/api/models/playlistTrackDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import {
  AnchoredMenu,
  Button,
  Card,
  EmptyState,
  IconButton,
  InlineError,
  Pill,
  RowSkeleton,
  menuDangerItemClassName,
  menuItemClassName,
  toast,
} from '@/ui';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  GripIcon,
  MoreVerticalIcon,
  PlayIcon,
  PlusIcon,
  QueueListIcon,
} from '@/icons';
import { usePlayer } from '@/player/usePlayer';
import { SelectableSearchResults, TrackRow } from '@/components';
import { StylePill } from '@/components/TrackRow/StylePill';

type ActiveSearch = 'dance' | { entryId: string } | null;
type ConfirmRemoval =
  | { kind: 'entry'; entryId: string }
  | { kind: 'track'; entryId: string; trackId: string }
  | null;

function extractContent<T>(result: unknown): T[] {
  const content = result && typeof result === 'object' && 'content' in result ? result.content : null;
  return Array.isArray(content) ? (content as T[]) : [];
}

const PLAY_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: 'in_order', label: 'I ordning' },
  { value: 'random', label: 'Slumpvis' },
];

const INPUT_CLASS =
  'h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] pr-3 text-[15px] text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:border-[rgb(var(--color-focus))] focus:outline-none focus-visible:ring-1 focus-visible:ring-[rgb(var(--color-focus))]';
const SEARCH_INPUT_CLASS = `${INPUT_CLASS} pl-10`;
const TEXT_INPUT_CLASS = `${INPUT_CLASS} pl-3`;
const MAX_ENTRY_NAME_LENGTH = 200;

function SearchGlyph() {
  return (
    <span
      className="pointer-events-none absolute bottom-3 left-3 text-[rgb(var(--color-text-muted))]"
      aria-hidden
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

/** The person's own name for the entry wins over the site's dance name. */
function entryName(entry: DanceListEntryDto): string {
  return entry.freeTextName ?? entry.danceName ?? 'Namnlös dans';
}

/** A track that plays from the person's own file: playable, with no streaming links. */
function isOwnTrack(track: TrackListDto): boolean {
  return track.playable === true && !track.playbackLinks?.length;
}

function EntryMenu({
  name,
  open,
  onToggle,
  onClose,
  onRename,
  onRemove,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onRename: () => void;
  onRemove: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <IconButton
        ref={buttonRef}
        aria-label={`Fler alternativ för ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <MoreVerticalIcon className="h-5 w-5" aria-hidden />
      </IconButton>
      <AnchoredMenu open={open} anchorRef={buttonRef} onClose={onClose} width={192}>
        <li role="none">
          <button type="button" role="menuitem" className={menuItemClassName} onClick={onRename}>
            Byt namn
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" className={menuDangerItemClassName} onClick={onRemove}>
            Ta bort dansen
          </button>
        </li>
      </AnchoredMenu>
    </div>
  );
}

function sortedTracks(entry: DanceListEntryDto): PlaylistTrackDto[] {
  return [...(entry.tracks ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/** The nested track of an entry row, in the shape TrackRow reads. */
function toTrackListDto(pt: PlaylistTrackDto): TrackListDto | null {
  const t = pt.track;
  if (!t) return null;
  // id, title, artistName, durationMs, danceStyle, confidence, tempoCategory and
  // playbackLinks come through as they are; a fresh object keeps TrackRow's props stable.
  return { ...t };
}

/** The one style all tracks of a dance share, if they share one. */
function entryStyle(tracks: PlaylistTrackDto[]): string | null {
  const styles = new Set(
    tracks.map((pt) => pt.track?.danceStyle).filter((s): s is string => typeof s === 'string' && s.length > 0),
  );
  return styles.size === 1 ? [...styles][0] : null;
}

function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function formatTotalDuration(ms: number): string | null {
  if (ms <= 0) return null;
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `ca ${minutes} min`;
  if (minutes === 0) return `ca ${hours} h`;
  return `ca ${hours} h ${minutes} min`;
}

export default function DanceListPage() {
  const { id } = useParams<{ id: string }>();
  const { play } = usePlayer();
  const [danceList, setDanceList] = useState<DanceListDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeSearch, setActiveSearch] = useState<ActiveSearch>(null);
  const [confirmRemoval, setConfirmRemoval] = useState<ConfirmRemoval>(null);
  const [closedEntries, setClosedEntries] = useState<Set<string>>(() => new Set());
  const [menuEntryId, setMenuEntryId] = useState<string | null>(null);
  const [renamingEntryId, setRenamingEntryId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameErrors, setRenameErrors] = useState<Record<string, string>>({});

  const [danceQuery, setDanceQuery] = useState('');
  const [danceResults, setDanceResults] = useState<Dance[]>([]);
  const [danceSearching, setDanceSearching] = useState(false);
  const [danceSearchFailed, setDanceSearchFailed] = useState(false);
  const [selectedDanceId, setSelectedDanceId] = useState<string | null>(null);
  const [addingDance, setAddingDance] = useState(false);
  const danceSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [trackQuery, setTrackQuery] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [trackResults, setTrackResults] = useState<TrackListDto[]>([]);
  const [trackSearching, setTrackSearching] = useState(false);
  const [trackSearchFailed, setTrackSearchFailed] = useState(false);
  const [addingTrack, setAddingTrack] = useState(false);
  const trackSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [addDanceError, setAddDanceError] = useState<string | null>(null);
  const [addTrackError, setAddTrackError] = useState<string | null>(null);
  const [entryRemoveErrors, setEntryRemoveErrors] = useState<Record<string, string>>({});
  const [trackRemoveErrors, setTrackRemoveErrors] = useState<Record<string, string>>({});
  const [playModeErrors, setPlayModeErrors] = useState<Record<string, string>>({});

  // Drag state for reordering the dances
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragArmedEntryId, setDragArmedEntryId] = useState<string | null>(null);

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
      searchTracks({
        q: trackQuery.trim(),
        ...(mineOnly ? { mine: true } : {}),
        pageable: { page: 0, size: 20 },
      })
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
  }, [activeSearch, trackQuery, mineOnly]);

  function openDanceSearch() {
    setDanceQuery('');
    setSelectedDanceId(null);
    setAddDanceError(null);
    setActiveSearch('dance');
  }

  function openTrackSearch(entryId: string) {
    setTrackQuery('');
    setAddTrackError(null);
    setActiveSearch({ entryId });
    setClosedEntries((prev) => {
      if (!prev.has(entryId)) return prev;
      const next = new Set(prev);
      next.delete(entryId);
      return next;
    });
  }

  function closeSearch() {
    setActiveSearch(null);
    setDanceQuery('');
    setTrackQuery('');
    setAddDanceError(null);
    setAddTrackError(null);
  }

  function toggleEntryOpen(entryId: string) {
    setClosedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
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

  function openRename(entry: DanceListEntryDto) {
    const entryId = entry.id ?? '';
    setMenuEntryId(null);
    setConfirmRemoval(null);
    setRenameErrors((prev) => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
    setRenameValue(entryName(entry));
    setRenamingEntryId(entryId);
  }

  async function handleRename(entryId: string) {
    const name = renameValue.trim();
    if (!id || !name || renaming) return;
    setRenaming(true);
    setRenameErrors((prev) => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
    try {
      await renameEntry(id, entryId, { name });
      setDanceList((prev) =>
        prev
          ? {
              ...prev,
              entries: (prev.entries ?? []).map((e) => (e.id === entryId ? { ...e, freeTextName: name } : e)),
            }
          : prev,
      );
      setRenamingEntryId(null);
      toast('Namnet sparat');
    } catch {
      setRenameErrors((prev) => ({ ...prev, [entryId]: 'Det gick inte att byta namn.' }));
    } finally {
      setRenaming(false);
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
        track: { ...track },
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
      toast(`${track.title ?? 'Låten'} tillagd`);
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
    const tracks = sortedTracks(entry)
      .map((t) => t.track)
      .filter((t): t is NonNullable<typeof t> => !!t);
    if (tracks.length === 0) return;
    const index = entry.playMode === 'random' ? Math.floor(Math.random() * tracks.length) : 0;
    play(tracks[index], tracks);
  }

  // ── Reorder ─────────────────────────────────────────────────────────────────

  async function moveEntry(from: number, to: number) {
    if (!id || !danceList) return;
    const current = sortedEntries(danceList);
    if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) return;

    const reordered = [...current];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const newOrder = reordered.map((e, idx) => ({ ...e, position: idx }));
    setDanceList((prev) => (prev ? { ...prev, entries: newOrder } : prev));

    try {
      await reorderEntries(id, { entryIds: newOrder.map((e) => e.id as string) });
    } catch {
      toast('Kunde inte ändra ordning', 'error');
      setDanceList((prev) => (prev ? { ...prev, entries: current } : prev));
    }
  }

  function handleDragStart(i: number) {
    dragIndex.current = i;
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOverIndex(i);
  }

  function handleDrop(i: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setDragOverIndex(null);
    setDragArmedEntryId(null);
    if (from === null || from === i) return;
    const to = from < i ? i - 1 : i;
    void moveEntry(from, to);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOverIndex(null);
    setDragArmedEntryId(null);
  }

  function handleGripKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      void moveEntry(i, i - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      void moveEntry(i, i + 1);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <RowSkeleton rows={3} label="Laddar danslista" />
      </div>
    );
  }

  if (notFound || !danceList) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={<QueueListIcon className="h-7 w-7" aria-hidden />}
          title="Danslistan hittades inte."
          description="Den kan ha tagits bort, eller så har du inte tillgång till den."
          action={
            <Link
              to="/dance-lists"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] px-4 text-sm font-semibold text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
            >
              Till danslistorna
            </Link>
          }
        />
      </div>
    );
  }

  const entries = sortedEntries(danceList);
  const totalTracks = entries.reduce((sum, e) => sum + (e.tracks?.length ?? 0), 0);
  const totalDurationMs = entries.reduce(
    (sum, e) => sum + (e.tracks ?? []).reduce((s, pt) => s + (pt.track?.durationMs ?? 0), 0),
    0,
  );
  const durationLabel = formatTotalDuration(totalDurationMs);
  const isDanceSearchOpen = activeSearch === 'dance';

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <Card className="p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span
            className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]"
            aria-hidden
          >
            <QueueListIcon className="h-[52px] w-[52px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
              {danceList.name}
            </h1>
            {danceList.description && (
              <p className="text-[15px] text-[rgb(var(--color-text))]">{danceList.description}</p>
            )}
            <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
              {countLabel(entries.length, 'dans', 'danser')} · {countLabel(totalTracks, 'låt', 'låtar')}
              {durationLabel ? ` · ${durationLabel}` : ''}
            </p>
            {canManage && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  onClick={() => (isDanceSearchOpen ? closeSearch() : openDanceSearch())}
                  aria-expanded={isDanceSearchOpen}
                >
                  <PlusIcon className="h-4 w-4" aria-hidden />
                  Lägg till dans
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {canManage && isDanceSearchOpen && (
        <Card className="p-5">
          <div className="space-y-3">
            <div className="relative">
              <label
                htmlFor="dance-search"
                className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text))]"
              >
                Sök efter dans
              </label>
              <SearchGlyph />
              <input
                id="dance-search"
                type="search"
                value={danceQuery}
                onChange={(e) => {
                  setDanceQuery(e.target.value);
                  setAddDanceError(null);
                }}
                placeholder="Skriv dansens namn"
                autoFocus
                className={SEARCH_INPUT_CLASS}
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
                <p className="text-sm text-[rgb(var(--color-text-muted))]">
                  Dansen finns inte på sidan. Lägg till den som en egen rad:
                </p>
                <Button onClick={() => handleAddDance(null, danceQuery)} disabled={addingDance} variant="secondary">
                  <PlusIcon className="h-4 w-4" aria-hidden />
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
        <EmptyState
          icon={<QueueListIcon className="h-7 w-7" aria-hidden />}
          title="Danslistan har inga danser ännu."
          description={
            canManage
              ? 'Lägg till kvällens första dans så kan du koppla låtar till den.'
              : 'Den som sköter listan har inte lagt till några danser ännu.'
          }
        />
      ) : (
        <section className="space-y-3" aria-label="Danser i listan">
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Fäll ihop danser du är klar med. Varje dans spelar sina låtar i ordning eller slumpvis.
          </p>

          <ol className="flex flex-col gap-3">
            {entries.map((entry, index) => {
              const entryId = entry.id ?? '';
              const name = entryName(entry);
              const tracks = sortedTracks(entry);
              const linkedTrackIds = new Set(
                tracks.map((t) => t.track?.id).filter((trackId): trackId is string => !!trackId),
              );
              const isOpen = !closedEntries.has(entryId);
              const isFreeText = !entry.danceId;
              const style = entryStyle(tracks);
              const isConfirmingEntryRemoval =
                confirmRemoval?.kind === 'entry' && confirmRemoval.entryId === entryId;
              const isTrackSearchOpen = typeof activeSearch === 'object' && activeSearch?.entryId === entryId;
              const isMenuOpen = menuEntryId === entryId;
              const isRenaming = renamingEntryId === entryId;
              const bodyId = `dance-entry-body-${entryId}`;
              const currentPlayMode = entry.playMode ?? 'in_order';

              return (
                <li
                  key={entryId}
                  draggable={canManage && dragArmedEntryId === entryId}
                  onDragStart={canManage ? () => handleDragStart(index) : undefined}
                  onDragOver={canManage ? (e) => handleDragOver(e, index) : undefined}
                  onDrop={canManage ? () => handleDrop(index) : undefined}
                  onDragEnd={canManage ? handleDragEnd : undefined}
                  className={`rounded-[var(--radius-lg)] ${
                    dragOverIndex === index ? 'ring-2 ring-[rgb(var(--color-selected))]' : ''
                  }`}
                >
                  <Card className="overflow-hidden">
                    {/* Entry header */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] p-3">
                      {canManage && (
                        <button
                          type="button"
                          aria-label={`Flytta dans ${index + 1}`}
                          title="Dra, eller använd pil upp och pil ned"
                          onPointerDown={() => setDragArmedEntryId(entryId)}
                          onPointerUp={() => setDragArmedEntryId(null)}
                          onKeyDown={(e) => handleGripKeyDown(e, index)}
                          className="flex h-11 w-8 shrink-0 cursor-grab items-center justify-center rounded-[var(--radius)] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-accent-muted))] hover:text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] active:cursor-grabbing"
                        >
                          <GripIcon className="h-4 w-4" aria-hidden />
                        </button>
                      )}

                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent))] text-[13px] font-bold tabular-nums text-[rgb(var(--color-accent-foreground))]">
                        {index + 1}
                      </span>

                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                        {entry.danceId ? (
                          <Link
                            to={`/dance/${entry.danceId}`}
                            className="truncate text-base font-bold text-[rgb(var(--color-text))] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className="truncate text-base font-bold text-[rgb(var(--color-text))]">{name}</span>
                        )}
                        {style ? (
                          <StylePill style={style} state="confirmed" />
                        ) : isFreeText ? (
                          <span className="inline-flex h-7 items-center rounded-full bg-[rgb(var(--color-accent-muted))] px-2.5 text-[13px] font-medium text-[rgb(var(--color-text-muted))]">
                            Egen rad
                          </span>
                        ) : null}
                        <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                          {countLabel(tracks.length, 'låt', 'låtar')}
                        </span>
                      </div>

                      <div className="ml-auto flex flex-wrap items-center gap-1.5">
                        {canManage && (
                          <div
                            role="group"
                            aria-label={`Spelläge för ${name}`}
                            className="inline-flex h-8 overflow-hidden rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] text-sm font-medium"
                          >
                            {PLAY_MODE_OPTIONS.map((option) => {
                              const active = currentPlayMode === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => {
                                    if (!active) void handlePlayModeChange(entryId, option.value);
                                  }}
                                  className={`px-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--color-focus))] ${
                                    active
                                      ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))]'
                                      : 'bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {tracks.length > 0 && (
                          <Button variant="secondary" onClick={() => handlePlayEntry(entry)}>
                            <PlayIcon className="h-4 w-4" aria-hidden />
                            Spela
                          </Button>
                        )}

                        {canManage && (
                          <EntryMenu
                            name={name}
                            open={isMenuOpen}
                            onToggle={() => setMenuEntryId(isMenuOpen ? null : entryId)}
                            onClose={() => setMenuEntryId(null)}
                            onRename={() => openRename(entry)}
                            onRemove={() => {
                              setMenuEntryId(null);
                              setRenamingEntryId(null);
                              setConfirmRemoval({ kind: 'entry', entryId });
                            }}
                          />
                        )}

                        <IconButton
                          aria-label={`Visa eller dölj låtar för ${name}`}
                          aria-expanded={isOpen}
                          aria-controls={bodyId}
                          onClick={() => toggleEntryOpen(entryId)}
                        >
                          <ChevronRightIcon
                            className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                            aria-hidden
                          />
                        </IconButton>
                      </div>
                    </div>

                    {(isRenaming ||
                      isConfirmingEntryRemoval ||
                      renameErrors[entryId] ||
                      entryRemoveErrors[entryId] ||
                      playModeErrors[entryId]) && (
                      <div className="space-y-2 border-b border-[rgb(var(--color-border))] px-3 py-2.5">
                        {isRenaming && (
                          <form
                            className="flex flex-wrap items-end gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void handleRename(entryId);
                            }}
                          >
                            <div className="min-w-0 flex-1 basis-56">
                              <label
                                htmlFor={`rename-entry-${entryId}`}
                                className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text))]"
                              >
                                Nytt namn för {name}
                              </label>
                              <input
                                id={`rename-entry-${entryId}`}
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                maxLength={MAX_ENTRY_NAME_LENGTH}
                                autoFocus
                                className={TEXT_INPUT_CLASS}
                              />
                            </div>
                            <Button type="submit" disabled={renaming || !renameValue.trim()}>
                              Spara
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setRenamingEntryId(null)} disabled={renaming}>
                              Avbryt
                            </Button>
                            {entry.danceId && entry.danceName && (
                              <p className="w-full text-[13px] text-[rgb(var(--color-text-muted))]">
                                Dansen är fortfarande kopplad till {entry.danceName} på sidan.
                              </p>
                            )}
                          </form>
                        )}
                        {isConfirmingEntryRemoval && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-[rgb(var(--color-text))]">
                              Ta bort {name} och dess låtar ur listan?
                            </span>
                            <Button variant="danger" onClick={() => handleRemoveEntry(entryId)}>
                              Ja, ta bort
                            </Button>
                            <Button variant="ghost" onClick={() => setConfirmRemoval(null)}>
                              Avbryt
                            </Button>
                          </div>
                        )}
                        <InlineError>{renameErrors[entryId]}</InlineError>
                        <InlineError>{entryRemoveErrors[entryId]}</InlineError>
                        <InlineError>{playModeErrors[entryId]}</InlineError>
                      </div>
                    )}

                    {/* Entry body */}
                    {isOpen && (
                      <div id={bodyId} className="pl-10 pr-2 pb-2">
                        {tracks.length === 0 ? (
                          <p className="px-2 py-3 text-sm text-[rgb(var(--color-text-muted))]">
                            {isFreeText ? 'Egen rad utan låtar.' : 'Inga låtar ännu.'}
                          </p>
                        ) : (
                          <ul>
                            {tracks.map((pt) => {
                              const track = toTrackListDto(pt);
                              if (!track) return null;
                              const ptId = pt.id ?? '';
                              const title = track.title ?? 'Okänd låt';
                              const isConfirmingTrackRemoval =
                                confirmRemoval?.kind === 'track' &&
                                confirmRemoval.entryId === entryId &&
                                confirmRemoval.trackId === ptId;
                              return (
                                <li key={ptId || track.id}>
                                  <TrackRow
                                    track={track}
                                    contextTracks={tracks
                                      .map((t) => t.track)
                                      .filter((t): t is TrackListDto => !!t)}
                                    action={
                                      canManage ? (
                                        <IconButton
                                          aria-label={`Ta bort ${title} från ${name}`}
                                          onClick={() => setConfirmRemoval({ kind: 'track', entryId, trackId: ptId })}
                                        >
                                          <CloseIcon className="h-5 w-5 text-[rgb(var(--color-text-muted))]" aria-hidden />
                                        </IconButton>
                                      ) : undefined
                                    }
                                  />
                                  {isConfirmingTrackRemoval && (
                                    <div className="flex flex-wrap items-center gap-2 border-b border-[rgb(var(--color-border))] px-2 py-2.5">
                                      <span className="text-sm text-[rgb(var(--color-text))]">
                                        Ta bort {title} från {name}?
                                      </span>
                                      <Button variant="danger" onClick={() => handleRemoveTrack(entryId, ptId)}>
                                        Ja, ta bort
                                      </Button>
                                      <Button variant="ghost" onClick={() => setConfirmRemoval(null)}>
                                        Avbryt
                                      </Button>
                                    </div>
                                  )}
                                  {trackRemoveErrors[ptId] && (
                                    <div className="px-2 py-2">
                                      <InlineError>{trackRemoveErrors[ptId]}</InlineError>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {canManage && !isTrackSearchOpen && (
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => openTrackSearch(entryId)}
                              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] px-3 text-sm font-semibold text-[rgb(var(--color-link))] hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
                            >
                              <PlusIcon className="h-4 w-4" aria-hidden />
                              Lägg till låt
                            </button>
                          </div>
                        )}

                        {canManage && isTrackSearchOpen && (
                          <div className="space-y-3 px-2 pt-3">
                            <div className="relative">
                              <label
                                htmlFor={`track-search-${entryId}`}
                                className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text))]"
                              >
                                Lägg till låt i {name}
                              </label>
                              <SearchGlyph />
                              <input
                                id={`track-search-${entryId}`}
                                type="search"
                                value={trackQuery}
                                onChange={(e) => {
                                  setTrackQuery(e.target.value);
                                  setAddTrackError(null);
                                }}
                                placeholder="Sök låt eller artist"
                                autoFocus
                                className={SEARCH_INPUT_CLASS}
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <Pill active={mineOnly} aria-pressed={mineOnly} onClick={() => setMineOnly((v) => !v)}>
                                Bara mina låtar
                              </Pill>
                              <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                                Dina egna låtar visas först.
                              </span>
                            </div>

                            {trackSearching && (
                              <p className="text-sm text-[rgb(var(--color-text-muted))]">Söker...</p>
                            )}

                            {!trackSearching && trackResults.length > 0 && (
                              <ul
                                aria-label="Sökträffar"
                                className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]"
                              >
                                {trackResults.map((track) => {
                                  const alreadyLinked = !!track.id && linkedTrackIds.has(track.id);
                                  return (
                                    <li key={track.id}>
                                      <TrackRow
                                        track={track}
                                        contextTracks={trackResults}
                                        badges={
                                          isOwnTrack(track) ? (
                                            <span className="mt-0.5 inline-flex h-6 w-fit items-center rounded-full bg-[rgb(var(--color-accent-muted))] px-2 text-xs font-medium text-[rgb(var(--color-text))]">
                                              Min låt
                                            </span>
                                          ) : undefined
                                        }
                                        action={
                                          alreadyLinked ? (
                                            <span className="px-2 text-[13px] text-[rgb(var(--color-text-muted))]">
                                              Redan tillagd
                                            </span>
                                          ) : (
                                            <Button
                                              variant="secondary"
                                              disabled={addingTrack}
                                              onClick={() => handleAddTrack(entryId, track)}
                                            >
                                              <PlusIcon className="h-4 w-4" aria-hidden />
                                              Lägg till
                                            </Button>
                                          )
                                        }
                                      />
                                    </li>
                                  );
                                })}
                              </ul>
                            )}

                            {!trackSearching && trackSearchFailed && (
                              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                                Sökningen misslyckades. Försök igen.
                              </p>
                            )}

                            {!trackSearching && !trackSearchFailed && trackQuery.trim() && trackResults.length === 0 && (
                              <p className="text-sm text-[rgb(var(--color-text-muted))]">
                                {mineOnly ? 'Ingen av dina låtar matchar.' : 'Inga låtar hittades.'}
                              </p>
                            )}

                            <InlineError>{addTrackError}</InlineError>

                            <Button type="button" variant="ghost" onClick={closeSearch} disabled={addingTrack}>
                              Klar
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}

            {/* Trailing drop zone so a dance can be dragged to the very end */}
            {canManage && entries.length > 1 && (
              <li
                aria-hidden
                onDragOver={(e) => handleDragOver(e, entries.length)}
                onDrop={() => handleDrop(entries.length)}
                onDragEnd={handleDragEnd}
                className={`h-2 rounded-full transition-colors ${
                  dragOverIndex === entries.length ? 'bg-[rgb(var(--color-selected))]' : 'bg-transparent'
                }`}
              />
            )}
          </ol>
        </section>
      )}
    </div>
  );
}

function sortedEntries(list: DanceListDto): DanceListEntryDto[] {
  return [...(list.entries ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

function BackLink() {
  return (
    <Link
      to="/dance-lists"
      className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius)] pr-3 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
    >
      <ChevronLeftIcon className="h-5 w-5" aria-hidden />
      Danslistor
    </Link>
  );
}
