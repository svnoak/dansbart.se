import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getPlaylist, removeTrack, updatePlaylist, reorderTracks } from '@/api/generated/playlists/playlists';
import { getStyleTree } from '@/api/generated/styles/styles';
import type { PlaylistDto } from '@/api/models/playlistDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { StyleNode } from '@/api/models/styleNode';
import { PlaylistTrackRow } from '@/components/PlaylistTrackRow';
import { BackArrowIcon, EditIcon, PlayIcon, SettingsIcon, SpotifyIcon, YouTubeIcon } from '@/icons';
import { IconButton, toast } from '@/ui';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/auth/useAuth';
import { usePlayer } from '@/player/usePlayer';

// ── Tempo ────────────────────────────────────────────────────────────────────

const TEMPO_OPTIONS: { value: string; label: string }[] = [
  { value: 'Slow', label: 'Långsamt' },
  { value: 'SlowMed', label: 'Lugnt' },
  { value: 'Medium', label: 'Lagom' },
  { value: 'Fast', label: 'Snabbt' },
  { value: 'Turbo', label: 'Väldigt snabbt' },
];

function tempoLabel(value: string | undefined): string {
  return TEMPO_OPTIONS.find((o) => o.value === value)?.label ?? '';
}

// ── Sort / Filter ─────────────────────────────────────────────────────────────

type SortKey = 'position' | 'name' | 'duration' | 'tempo';

function sortTracks(
  tracks: PlaylistDto['tracks'],
  sort: SortKey,
): NonNullable<PlaylistDto['tracks']> {
  if (!tracks) return [];
  const copy = [...tracks];
  switch (sort) {
    case 'name':
      return copy.sort((a, b) =>
        (a.track?.title ?? '').localeCompare(b.track?.title ?? '', 'sv'),
      );
    case 'duration':
      return copy.sort(
        (a, b) => (a.track?.durationMs ?? 0) - (b.track?.durationMs ?? 0),
      );
    case 'tempo':
      return copy.sort(
        (a, b) => (a.track?.effectiveBpm ?? 0) - (b.track?.effectiveBpm ?? 0),
      );
    default:
      return copy.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }
}

function filterTracks(
  tracks: NonNullable<PlaylistDto['tracks']>,
  filterSpotify: boolean,
  filterYouTube: boolean,
): NonNullable<PlaylistDto['tracks']> {
  return tracks.filter((pt) => {
    const links = pt.track?.playbackLinks ?? [];
    if (filterSpotify && !links.some((l) => l.platform === 'SPOTIFY' && l.isWorking)) return false;
    if (filterYouTube && !links.some((l) => l.platform === 'YOUTUBE' && l.isWorking)) return false;
    return true;
  });
}

// ── Shared dropdown wrapper ───────────────────────────────────────────────────

function useOutsideClick(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ref, onClose]);
}

// ── Main style dropdown ───────────────────────────────────────────────────────

interface MainStyleDropdownProps {
  current: string | undefined;
  styleNodes: StyleNode[];
  onSelect: (value: string | null) => void;
  onClose: () => void;
}

function MainStyleDropdown({ current, styleNodes, onSelect, onClose }: MainStyleDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, onClose);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-lg"
    >
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="w-full px-3 py-1.5 text-left text-sm text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/40"
      >
        Ingen stil
      </button>
      {styleNodes.map((node) => (
        <button
          key={node.name}
          type="button"
          onClick={() => onSelect(node.name ?? null)}
          className={`w-full px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-border))]/40 ${
            current === node.name
              ? 'font-medium text-[rgb(var(--color-accent))]'
              : 'text-[rgb(var(--color-text))]'
          }`}
        >
          {node.name ? node.name.charAt(0).toUpperCase() + node.name.slice(1) : ''}
        </button>
      ))}
    </div>
  );
}

// ── Sub-style dropdown ────────────────────────────────────────────────────────

interface SubStyleDropdownProps {
  current: string | undefined;
  subStyles: string[];
  onSelect: (value: string | null) => void;
  onClose: () => void;
}

function SubStyleDropdown({ current, subStyles, onSelect, onClose }: SubStyleDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, onClose);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-lg"
    >
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="w-full px-3 py-1.5 text-left text-sm text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/40"
      >
        Ingen substil
      </button>
      {subStyles.map((sub) => (
        <button
          key={sub}
          type="button"
          onClick={() => onSelect(sub)}
          className={`w-full px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-border))]/40 ${
            current === sub
              ? 'font-medium text-[rgb(var(--color-accent))]'
              : 'text-[rgb(var(--color-text))]'
          }`}
        >
          {sub.charAt(0).toUpperCase() + sub.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ── Tempo tag dropdown ────────────────────────────────────────────────────────

interface TempoDropdownProps {
  current: string | undefined;
  onSelect: (value: string | null) => void;
  onClose: () => void;
}

function TempoDropdown({ current, onSelect, onClose }: TempoDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, onClose);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-lg"
    >
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="w-full px-3 py-1.5 text-left text-sm text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/40"
      >
        Inget tempo
      </button>
      {TEMPO_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`w-full px-3 py-1.5 text-left text-sm hover:bg-[rgb(var(--color-border))]/40 ${
            current === opt.value
              ? 'text-[rgb(var(--color-accent))] font-medium'
              : 'text-[rgb(var(--color-text))]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildContextTracks(pl: PlaylistDto): TrackListDto[] {
  const ordered = sortTracks(pl.tracks, 'position');
  return ordered.map((pt) => pt.track!).filter(Boolean);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { play } = usePlayer();

  const [playlist, setPlaylist] = useState<PlaylistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [styleNodes, setStyleNodes] = useState<StyleNode[]>([]);

  // Inline editing state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  // Tag dropdown state
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showSubStyleDropdown, setShowSubStyleDropdown] = useState(false);
  const [showTempoDropdown, setShowTempoDropdown] = useState(false);

  // Sort / filter
  const [sort, setSort] = useState<SortKey>('position');
  const [filterSpotify, setFilterSpotify] = useState(false);
  const [filterYouTube, setFilterYouTube] = useState(false);

  // Drag state (position mode only)
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Prevent autoplay from firing again on subsequent playlist state updates
  const autoplayTriggered = useRef(false);

  const isOwner = !!(playlist?.owner?.id && user?.id && playlist.owner.id === user.id);
  const myCollaborator = playlist?.collaborators?.find((c) => c.userId === user?.id);
  const myPermission: 'owner' | 'edit' | 'view' = isOwner
    ? 'owner'
    : myCollaborator?.permission === 'edit'
      ? 'edit'
      : 'view';
  const canEdit = myPermission !== 'view';

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    Promise.all([
      getPlaylist(id, { signal: controller.signal }),
      getStyleTree({ signal: controller.signal }),
    ])
      .then(([pl, styles]) => {
        setPlaylist(pl);
        setStyleNodes(styles);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPlaylist(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  // ── Auto-play on navigation ─────────────────────────────────────────────────

  useEffect(() => {
    if (!playlist || loading) return;
    if (searchParams.get('autoplay') !== 'true') return;
    if (autoplayTriggered.current) return;
    const tracks = buildContextTracks(playlist);
    if (tracks.length === 0) return;
    autoplayTriggered.current = true;
    play(tracks[0], tracks);
  }, [playlist, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const rawSorted = sortTracks(playlist?.tracks, sort);
  const displayTracks = filterTracks(rawSorted, filterSpotify, filterYouTube);
  const contextTracks: TrackListDto[] = playlist ? buildContextTracks(playlist) : [];

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleRemoveTrack(playlistTrackId: string, trackId: string) {
    if (!id) return;
    try {
      await removeTrack(id, trackId);
      setPlaylist((prev) =>
        prev ? { ...prev, tracks: prev.tracks?.filter((t) => t.id !== playlistTrackId) } : prev,
      );
      toast('Låt borttagen från spellista');
    } catch {
      toast('Kunde inte ta bort låt', 'error');
    }
  }

  async function handleSaveName() {
    if (!id || !nameValue.trim()) return;
    try {
      await updatePlaylist(id, { name: nameValue.trim() });
      setPlaylist((prev) => (prev ? { ...prev, name: nameValue.trim() } : prev));
      setEditingName(false);
      toast('Namn sparat');
    } catch {
      toast('Kunde inte spara namn', 'error');
    }
  }

  async function handleTagUpdate(field: 'danceStyle' | 'subStyle' | 'tempoCategory', value: string | null) {
    if (!id) return;
    const patch: Record<string, string> = { [field]: value ?? '' };
    // Changing main style always resets the sub-style
    if (field === 'danceStyle') patch.subStyle = '';
    try {
      await updatePlaylist(id, patch);
      setPlaylist((prev) => {
        if (!prev) return prev;
        const next = { ...prev, [field]: value ?? undefined };
        if (field === 'danceStyle') next.subStyle = undefined;
        return next;
      });
    } catch {
      toast('Kunde inte spara tagg', 'error');
    }
    if (field === 'danceStyle') setShowStyleDropdown(false);
    else if (field === 'subStyle') setShowSubStyleDropdown(false);
    else setShowTempoDropdown(false);
  }

  // ── Drag reorder ────────────────────────────────────────────────────────────

  function handleDragStart(i: number) {
    dragIndex.current = i;
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOverIndex(i);
  }

  async function handleDrop(i: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setDragOverIndex(null);
    if (from === null || from === i || !id || !playlist?.tracks) return;

    const positionSorted = sortTracks(playlist!.tracks, 'position');
    const to = from < i ? i - 1 : i;

    const reordered = [...positionSorted];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    const newOrder = reordered.map((pt, idx) => ({ ...pt, position: idx }));
    setPlaylist((prev) => (prev ? { ...prev, tracks: newOrder } : prev));

    try {
      await reorderTracks(id, {
        trackIds: newOrder.map((pt) => pt.track?.id as string),
      });
    } catch {
      toast('Kunde inte ändra ordning', 'error');
      setPlaylist((prev) =>
        prev ? { ...prev, tracks: positionSorted } : prev,
      );
    }
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  // ── Play all ────────────────────────────────────────────────────────────────

  function handlePlayAll() {
    if (contextTracks.length === 0) return;
    play(contextTracks[0], contextTracks);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>;
  }

  if (!playlist) {
    return <p className="text-[rgb(var(--color-text-muted))]">Spellistan hittades inte.</p>;
  }

  const tracks = playlist.tracks ?? [];
  const styleColor = playlist.danceStyle ? getStyleColor(playlist.danceStyle) : null;
  const tLabel = tempoLabel(playlist.tempoCategory);

  return (
    <div className="space-y-6">
      {/* Back */}
      <IconButton aria-label="Tillbaka" onClick={() => navigate('/playlists')}>
        <BackArrowIcon className="h-5 w-5" aria-hidden />
      </IconButton>

      {/* Header */}
      <div className="space-y-2">
        {/* Name row */}
        <div className="flex items-start gap-2">
          {editingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveName();
              }}
              className="flex flex-1 items-center gap-2"
            >
              <input
                autoFocus
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditingName(false);
                    setNameValue(playlist.name ?? '');
                  }
                }}
                className="flex-1 rounded-lg border border-[rgb(var(--color-accent))] bg-[rgb(var(--color-bg-elevated))] px-3 py-1 text-2xl font-bold text-[rgb(var(--color-text))] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!nameValue.trim()}
                className="rounded-lg bg-[rgb(var(--color-accent))] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Spara
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingName(false);
                  setNameValue(playlist.name ?? '');
                }}
                className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 text-sm text-[rgb(var(--color-text-muted))]"
              >
                Avbryt
              </button>
            </form>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h1 className="min-w-0 truncate text-2xl font-bold text-[rgb(var(--color-text))]">
                {playlist.name}
              </h1>
              {canEdit && (
                <button
                  type="button"
                  aria-label="Redigera namn"
                  onClick={() => {
                    setNameValue(playlist.name ?? '');
                    setEditingName(true);
                  }}
                  className="shrink-0 rounded p-1 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))]"
                >
                  <EditIcon className="h-4 w-4" aria-hidden />
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  aria-label="Inställningar"
                  onClick={() => navigate(`/playlists/${id}/settings`)}
                  className="shrink-0 rounded p-1 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))]"
                >
                  <SettingsIcon className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {playlist.description && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">{playlist.description}</p>
        )}

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main dance style */}
          <div className="relative">
            {isOwner ? (
              <button
                type="button"
                onClick={() => {
                  setShowStyleDropdown((s) => !s);
                  setShowSubStyleDropdown(false);
                  setShowTempoDropdown(false);
                }}
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${
                  styleColor
                    ? ''
                    : 'border border-dashed border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]'
                }`}
                style={
                  styleColor
                    ? {
                        backgroundColor: theme === 'dark' ? styleColor.bgDark : styleColor.bg,
                        color: theme === 'dark' ? styleColor.textDark : styleColor.text,
                      }
                    : undefined
                }
              >
                {playlist.danceStyle
                  ? playlist.danceStyle.charAt(0).toUpperCase() + playlist.danceStyle.slice(1)
                  : '+ Dansstil'}
              </button>
            ) : styleColor && playlist.danceStyle ? (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor: theme === 'dark' ? styleColor.bgDark : styleColor.bg,
                  color: theme === 'dark' ? styleColor.textDark : styleColor.text,
                }}
              >
                {playlist.danceStyle.charAt(0).toUpperCase() + playlist.danceStyle.slice(1)}
              </span>
            ) : null}
            {showStyleDropdown && (
              <MainStyleDropdown
                current={playlist.danceStyle}
                styleNodes={styleNodes}
                onSelect={(v) => handleTagUpdate('danceStyle', v)}
                onClose={() => setShowStyleDropdown(false)}
              />
            )}
          </div>

          {/* Sub-style — only shown when main style is set and has sub-styles */}
          {(() => {
            const currentNode = styleNodes.find((n) => n.name === playlist.danceStyle);
            const subStyles = currentNode?.subStyles ?? [];
            if (!playlist.danceStyle || subStyles.length === 0) return null;
            return (
              <div className="relative">
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubStyleDropdown((s) => !s);
                      setShowStyleDropdown(false);
                      setShowTempoDropdown(false);
                    }}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${
                      styleColor
                        ? 'opacity-80'
                        : 'border border-dashed border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]'
                    } ${playlist.subStyle ? '' : 'border border-dashed'}`}
                    style={
                      styleColor && playlist.subStyle
                        ? {
                            backgroundColor: theme === 'dark' ? styleColor.bgDark : styleColor.bg,
                            color: theme === 'dark' ? styleColor.textDark : styleColor.text,
                          }
                        : undefined
                    }
                  >
                    {playlist.subStyle
                      ? playlist.subStyle.charAt(0).toUpperCase() + playlist.subStyle.slice(1)
                      : '+ Substil'}
                  </button>
                ) : playlist.subStyle ? (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium opacity-80"
                    style={
                      styleColor
                        ? {
                            backgroundColor: theme === 'dark' ? styleColor.bgDark : styleColor.bg,
                            color: theme === 'dark' ? styleColor.textDark : styleColor.text,
                          }
                        : undefined
                    }
                  >
                    {playlist.subStyle.charAt(0).toUpperCase() + playlist.subStyle.slice(1)}
                  </span>
                ) : null}
                {showSubStyleDropdown && (
                  <SubStyleDropdown
                    current={playlist.subStyle}
                    subStyles={subStyles}
                    onSelect={(v) => handleTagUpdate('subStyle', v)}
                    onClose={() => setShowSubStyleDropdown(false)}
                  />
                )}
              </div>
            );
          })()}

          {/* Tempo tag */}
          <div className="relative">
            {isOwner ? (
              <button
                type="button"
                onClick={() => {
                  setShowTempoDropdown((s) => !s);
                  setShowStyleDropdown(false);
                  setShowSubStyleDropdown(false);
                }}
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${
                  tLabel
                    ? 'bg-[rgb(var(--color-border))] text-[rgb(var(--color-text))]'
                    : 'border border-dashed border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]'
                }`}
              >
                {tLabel || '+ Tempo'}
              </button>
            ) : tLabel ? (
              <span className="inline-flex items-center rounded-full bg-[rgb(var(--color-border))] px-2.5 py-1 text-xs font-medium text-[rgb(var(--color-text))]">
                {tLabel}
              </span>
            ) : null}
            {showTempoDropdown && (
              <TempoDropdown
                current={playlist.tempoCategory}
                onSelect={(v) => handleTagUpdate('tempoCategory', v)}
                onClose={() => setShowTempoDropdown(false)}
              />
            )}
          </div>
        </div>

        {/* Track count + play all */}
        <div className="flex items-center gap-3">
          <p className="text-xs text-[rgb(var(--color-text-muted))]">
            {tracks.length} {tracks.length === 1 ? 'låt' : 'låtar'}
          </p>
          {tracks.length > 0 && (
            <button
              type="button"
              onClick={handlePlayAll}
              className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-accent))] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              <PlayIcon className="h-4 w-4" aria-hidden />
              Spela alla
            </button>
          )}
        </div>
      </div>

      {/* Sort + Filter bar */}
      {tracks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort buttons */}
          <div className="flex rounded-lg border border-[rgb(var(--color-border))] overflow-hidden text-xs">
            {(
              [
                { key: 'position', label: 'Ordning' },
                { key: 'name', label: 'Namn' },
                { key: 'duration', label: 'Längd' },
                { key: 'tempo', label: 'Tempo' },
              ] as { key: SortKey; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={`px-3 py-1.5 transition-colors ${
                  sort === key
                    ? 'bg-[rgb(var(--color-accent))] text-white'
                    : 'text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Filter toggles */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Filtrera Spotify"
              title="Visa endast låtar med Spotify"
              onClick={() => setFilterSpotify((s) => !s)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                filterSpotify
                  ? 'border-[#1DB954] bg-[#1DB954]/10 text-[#1DB954]'
                  : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50'
              }`}
            >
              <SpotifyIcon className="h-3.5 w-3.5" aria-hidden />
              Spotify
            </button>
            <button
              type="button"
              aria-label="Filtrera YouTube"
              title="Visa endast låtar med YouTube"
              onClick={() => setFilterYouTube((s) => !s)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                filterYouTube
                  ? 'border-[#FF0000] bg-[#FF0000]/10 text-[#FF0000]'
                  : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50'
              }`}
            >
              <YouTubeIcon className="h-3.5 w-3.5" aria-hidden />
              YouTube
            </button>
          </div>
        </div>
      )}

      {tracks.length === 0 && (
        <p className="text-[rgb(var(--color-text-muted))]">Spellistan är tom.</p>
      )}

      {displayTracks.length === 0 && tracks.length > 0 && (
        <p className="text-[rgb(var(--color-text-muted))]">Inga låtar matchar filtret.</p>
      )}

      {/* Track list */}
      <ul>
        {displayTracks.map((pt, i) =>
          pt.track ? (
            <PlaylistTrackRow
              key={pt.id ?? pt.track.id}
              track={pt.track}
              contextTracks={contextTracks}
              showGrip={sort === 'position' && canEdit}
              isDragOver={dragOverIndex === i}
              onRemove={canEdit && pt.id ? () => handleRemoveTrack(pt.id!, pt.track!.id!) : undefined}
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
            />
          ) : null,
        )}
        {/* Trailing drop zone — lets the user drag any item to the very end */}
        {sort === 'position' && canEdit && displayTracks.length > 0 && (
          <li
            onDragOver={(e) => handleDragOver(e, displayTracks.length)}
            onDrop={() => handleDrop(displayTracks.length)}
            onDragEnd={handleDragEnd}
            className={`h-2 border-t-2 transition-colors ${
              dragOverIndex === displayTracks.length
                ? 'border-[rgb(var(--color-accent))]'
                : 'border-transparent'
            }`}
          />
        )}
      </ul>
    </div>
  );
}
