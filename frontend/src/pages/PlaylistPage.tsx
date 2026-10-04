import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getPlaylist, removeTrack, updatePlaylist, reorderTracks } from '@/api/generated/playlists/playlists';
import { getStyleTree } from '@/api/generated/styles/styles';
import type { PlaylistDto } from '@/api/models/playlistDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { StyleNode } from '@/api/models/styleNode';
import { PlaylistTrackRow } from '@/components/PlaylistTrackRow';
import { SharePlaylistPanel } from '@/components/SharePlaylistPanel';
import { StylePill } from '@/components/TrackRow/StylePill';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  EditIcon,
  MoreVerticalIcon,
  PlayIcon,
  PlaylistIcon,
  PlusIcon,
  SettingsIcon,
  ShareIcon,
  SpotifyIcon,
  StarMarkIcon,
  YouTubeIcon,
} from '@/icons';
import { Button, Card, EmptyState, IconButton, InlineError, Modal, RowSkeleton, toast } from '@/ui';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/auth/useAuth';
import { usePlayer } from '@/player/usePlayer';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { usePlaylistShareLink } from '@/hooks/usePlaylistShareLink';
import { canEditPlaylist } from '@/utils/playlistPermissions';

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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "1 h 32 min" or "32 min"; empty when there is nothing to sum. */
function formatTotalDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes <= 0) return '';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

// ── Sort / Filter ─────────────────────────────────────────────────────────────

type SortKey = 'position' | 'name' | 'duration' | 'tempo';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string; reversible: boolean }[] = [
  { key: 'position', label: 'Ordning', reversible: false },
  { key: 'name', label: 'Namn', reversible: true },
  { key: 'duration', label: 'Längd', reversible: true },
  { key: 'tempo', label: 'Tempo', reversible: true },
];

function sortTracks(
  tracks: PlaylistDto['tracks'],
  sort: SortKey,
  direction: SortDirection = 'asc',
): NonNullable<PlaylistDto['tracks']> {
  if (!tracks) return [];
  const copy = [...tracks];
  const sign = direction === 'desc' ? -1 : 1;
  switch (sort) {
    case 'name':
      return copy.sort(
        (a, b) => sign * (a.track?.title ?? '').localeCompare(b.track?.title ?? '', 'sv'),
      );
    case 'duration':
      return copy.sort(
        (a, b) => sign * ((a.track?.durationMs ?? 0) - (b.track?.durationMs ?? 0)),
      );
    case 'tempo':
      return copy.sort(
        (a, b) => sign * ((a.track?.effectiveBpm ?? 0) - (b.track?.effectiveBpm ?? 0)),
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

// ── Floating option list shared by the tag dropdowns ─────────────────────────

interface OptionListProps {
  options: { value: string | null; label: string }[];
  current: string | undefined;
  onSelect: (value: string | null) => void;
  onClose: () => void;
}

function OptionList({ options, current, onSelect, onClose }: OptionListProps) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, onClose);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-20 mt-1 w-48 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-[var(--color-card-shadow)]"
    >
      {options.map((opt) => {
        const selected = opt.value !== null && current === opt.value;
        return (
          <button
            key={opt.value ?? '__none'}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`flex min-h-10 w-full items-center justify-between px-3 text-left text-sm hover:bg-[rgb(var(--color-accent-muted))] ${
              opt.value === null
                ? 'text-[rgb(var(--color-text-muted))]'
                : selected
                  ? 'font-semibold text-[rgb(var(--color-text))]'
                  : 'text-[rgb(var(--color-text))]'
            }`}
          >
            {opt.label}
            {selected && <CheckIcon className="h-4 w-4 text-[rgb(var(--color-selected))]" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

// ── Tag chip (sub-style, tempo, "+ Dansstil") ────────────────────────────────

interface TagChipProps {
  label: string;
  filled: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

function TagChip({ label, filled, onClick, ariaLabel, style }: TagChipProps) {
  const base = 'inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 text-[13px] font-semibold whitespace-nowrap';
  const look = filled
    ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]'
    : 'border border-dashed border-[rgb(var(--color-border-strong))] text-[rgb(var(--color-text-muted))]';
  if (!onClick) {
    return (
      <span className={`${base} ${look}`} style={style}>
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${base} ${look} transition-colors hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]`}
      style={style}
    >
      {filled ? label : `+ ${label}`}
    </button>
  );
}

// ── Header tile ───────────────────────────────────────────────────────────────

interface PlaylistTileProps {
  danceStyle: string | undefined;
  sizeClass: string;
  iconClass: string;
}

/** The square tile that stands in for playlist artwork, in the main style's colour. */
function PlaylistTile({ danceStyle, sizeClass, iconClass }: PlaylistTileProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const color = danceStyle ? getStyleColor(danceStyle) : null;
  const style: React.CSSProperties | undefined = color
    ? {
        backgroundColor: isDark ? color.bgDark : color.bg,
        color: isDark ? color.textDark : color.text,
      }
    : undefined;
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-[var(--radius-lg)] ${sizeClass} ${
        color ? '' : 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text-muted))]'
      }`}
      style={style}
      aria-hidden
    >
      <StarMarkIcon className={iconClass} aria-hidden />
    </div>
  );
}

// ── "Fler alternativ" menu ────────────────────────────────────────────────────

interface MoreMenuProps {
  onClose: () => void;
  onSettings?: () => void;
  showFilters: boolean;
  filterSpotify: boolean;
  filterYouTube: boolean;
  onToggleSpotify: () => void;
  onToggleYouTube: () => void;
}

function MoreMenu({
  onClose,
  onSettings,
  showFilters,
  filterSpotify,
  filterYouTube,
  onToggleSpotify,
  onToggleYouTube,
}: MoreMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, onClose);

  const itemClass =
    'flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:bg-[rgb(var(--color-accent-muted))]';

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Fler alternativ"
      className="absolute right-0 top-full z-20 mt-1 w-64 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-[var(--color-card-shadow)]"
    >
      {onSettings && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onSettings();
            onClose();
          }}
          className={itemClass}
        >
          <SettingsIcon className="h-4 w-4 text-[rgb(var(--color-text-muted))]" aria-hidden />
          Ändra inställningar
        </button>
      )}
      {onSettings && showFilters && (
        <div className="my-1 border-t border-[rgb(var(--color-border))]" role="separator" />
      )}
      {showFilters && (
        <>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={filterSpotify}
            onClick={onToggleSpotify}
            className={itemClass}
          >
            <SpotifyIcon className="h-4 w-4 text-[rgb(var(--color-text-muted))]" aria-hidden />
            <span className="flex-1">Visa bara låtar med Spotify</span>
            {filterSpotify && <CheckIcon className="h-4 w-4 text-[rgb(var(--color-selected))]" aria-hidden />}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={filterYouTube}
            onClick={onToggleYouTube}
            className={itemClass}
          >
            <YouTubeIcon className="h-4 w-4 text-[rgb(var(--color-text-muted))]" aria-hidden />
            <span className="flex-1">Visa bara låtar med YouTube</span>
            {filterYouTube && <CheckIcon className="h-4 w-4 text-[rgb(var(--color-selected))]" aria-hidden />}
          </button>
        </>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildContextTracks(pl: PlaylistDto): TrackListDto[] {
  const ordered = sortTracks(pl.tracks, 'position');
  return ordered.map((pt) => pt.track!).filter(Boolean);
}

const secondaryLinkClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-[rgb(var(--color-accent-muted))] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-text))] transition-colors hover:bg-[rgb(var(--color-border))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';

const primaryLinkClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] transition-colors hover:bg-[rgb(var(--color-accent-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';

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
  const [saveNameError, setSaveNameError] = useState<string | null>(null);
  const [removeTrackErrors, setRemoveTrackErrors] = useState<Record<string, string>>({});

  // Tag dropdown state
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showSubStyleDropdown, setShowSubStyleDropdown] = useState(false);
  const [showTempoDropdown, setShowTempoDropdown] = useState(false);

  // Sort / filter
  const [sort, setSort] = useState<SortKey>('position');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterSpotify, setFilterSpotify] = useState(false);
  const [filterYouTube, setFilterYouTube] = useState(false);

  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Drag state (position mode only)
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Prevent autoplay from firing again on subsequent playlist state updates
  const autoplayTriggered = useRef(false);

  const { shareToken, shareUrl, createLink, copyLink, clearErrors, createLinkError, copyLinkError } =
    usePlaylistShareLink(id, playlist?.shareToken);

  const isOwner = playlist?.viewerCanManage === true;
  const canEdit = canEditPlaylist(playlist, user?.id);

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

  const rawSorted = sortTracks(playlist?.tracks, sort, sortDirection);
  const displayTracks = filterTracks(rawSorted, filterSpotify, filterYouTube);
  const contextTracks: TrackListDto[] = playlist ? buildContextTracks(playlist) : [];

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleRemoveTrack(playlistTrackId: string, trackId: string) {
    if (!id) return;
    setRemoveTrackErrors((prev) => {
      const next = { ...prev };
      delete next[playlistTrackId];
      return next;
    });
    try {
      await removeTrack(id, trackId);
      setPlaylist((prev) =>
        prev ? { ...prev, tracks: prev.tracks?.filter((t) => t.id !== playlistTrackId) } : prev,
      );
      toast('Låt borttagen från spellista');
    } catch {
      setRemoveTrackErrors((prev) => ({ ...prev, [playlistTrackId]: 'Kunde inte ta bort låt' }));
    }
  }

  async function handleSaveName() {
    if (!id || !nameValue.trim()) return;
    setSaveNameError(null);
    try {
      await updatePlaylist(id, { name: nameValue.trim() });
      setPlaylist((prev) => (prev ? { ...prev, name: nameValue.trim() } : prev));
      setEditingName(false);
      toast('Namn sparat');
    } catch {
      setSaveNameError('Kunde inte spara namn');
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

  function handleSortClick(key: SortKey) {
    if (key === sort && key !== 'position') {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSort(key);
    setSortDirection('asc');
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

  // ── Play ────────────────────────────────────────────────────────────────────

  function handlePlay() {
    if (contextTracks.length === 0) return;
    play(contextTracks[0], contextTracks);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const backLink = (
    <Link
      to="/playlists"
      className="inline-flex min-h-11 items-center gap-1 pr-2 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
    >
      <ChevronLeftIcon className="h-4 w-4" aria-hidden />
      Spellistor
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {backLink}
        <RowSkeleton rows={5} label="Laddar spellistan" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="space-y-6">
        {backLink}
        <EmptyState
          icon={<PlaylistIcon className="h-7 w-7" aria-hidden />}
          title="Spellistan hittades inte"
          description="Den kan ha tagits bort, eller så har du inte tillgång till den."
          action={
            <Link to="/playlists" className={primaryLinkClass}>
              Till spellistor
            </Link>
          }
        />
      </div>
    );
  }

  const tracks = playlist.tracks ?? [];
  const styleColor = playlist.danceStyle ? getStyleColor(playlist.danceStyle) : null;
  const subStyleChipStyle: React.CSSProperties | undefined =
    styleColor && playlist.subStyle
      ? {
          backgroundColor: theme === 'dark' ? styleColor.bgDark : styleColor.bg,
          color: theme === 'dark' ? styleColor.textDark : styleColor.text,
        }
      : undefined;
  const tLabel = tempoLabel(playlist.tempoCategory);
  const totalDuration = formatTotalDuration(
    tracks.reduce((sum, pt) => sum + (pt.track?.durationMs ?? 0), 0),
  );
  const currentNode = styleNodes.find((n) => n.name === playlist.danceStyle);
  const subStyles = currentNode?.subStyles ?? [];
  const showMoreButton = canEdit || tracks.length > 0;

  const metaParts: React.ReactNode[] = [];
  if (playlist.ownerGroup) {
    metaParts.push(
      <span key="group">
        Ägs av gruppen{' '}
        <Link
          to={`/groups/${playlist.ownerGroup.id}`}
          className="font-medium text-[rgb(var(--color-link))] hover:underline"
        >
          {playlist.ownerGroup.name}
        </Link>
      </span>,
    );
  }
  metaParts.push(<span key="count">{tracks.length} {tracks.length === 1 ? 'låt' : 'låtar'}</span>);
  if (totalDuration) metaParts.push(<span key="duration">{totalDuration}</span>);
  metaParts.push(<span key="visibility">{playlist.isPublic ? 'Offentlig' : 'Privat'}</span>);

  return (
    <div className="space-y-6">
      {/* Back */}
      {backLink}

      {/* Header */}
      <Card className="flex flex-col gap-6 p-7 sm:flex-row">
        <PlaylistTile danceStyle={playlist.danceStyle} sizeClass="h-28 w-28" iconClass="h-[60px] w-[60px]" />

        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            {/* Name row */}
            {editingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveName();
                }}
                className="space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="playlist-name" className="sr-only">
                    Spellistans namn
                  </label>
                  <input
                    id="playlist-name"
                    autoFocus
                    type="text"
                    value={nameValue}
                    onChange={(e) => {
                      setNameValue(e.target.value);
                      setSaveNameError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setEditingName(false);
                        setNameValue(playlist.name ?? '');
                      }
                    }}
                    className="min-h-11 min-w-0 flex-1 rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 text-xl font-bold text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
                  />
                  <Button type="submit" disabled={!nameValue.trim()}>
                    Spara
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingName(false);
                      setNameValue(playlist.name ?? '');
                    }}
                  >
                    Avbryt
                  </Button>
                </div>
                <InlineError>{saveNameError}</InlineError>
              </form>
            ) : (
              <div className="flex min-w-0 items-start gap-1">
                <h1 className="min-w-0 break-words text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
                  {playlist.name}
                </h1>
                {canEdit && (
                  <IconButton
                    aria-label="Ändra namn"
                    className="shrink-0 text-[rgb(var(--color-text-muted))]"
                    onClick={() => {
                      setNameValue(playlist.name ?? '');
                      setEditingName(true);
                    }}
                  >
                    <EditIcon className="h-4 w-4" aria-hidden />
                  </IconButton>
                )}
              </div>
            )}

            {/* Description */}
            {playlist.description && (
              <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text))]">{playlist.description}</p>
            )}

            {/* Meta line */}
            <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
              {metaParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span aria-hidden> · </span>}
                  {part}
                </span>
              ))}
            </p>
          </div>

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Main dance style */}
            <div className="relative">
              {isOwner ? (
                playlist.danceStyle ? (
                  <button
                    type="button"
                    aria-label={`Ändra dansstil, nu ${capitalize(playlist.danceStyle)}`}
                    onClick={() => {
                      setShowStyleDropdown((s) => !s);
                      setShowSubStyleDropdown(false);
                      setShowTempoDropdown(false);
                    }}
                    className="inline-flex rounded-[var(--radius-full)] transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
                  >
                    <StylePill style={capitalize(playlist.danceStyle)} state="confirmed" />
                  </button>
                ) : (
                  <TagChip
                    label="Dansstil"
                    filled={false}
                    ariaLabel="Ange dansstil"
                    onClick={() => {
                      setShowStyleDropdown((s) => !s);
                      setShowSubStyleDropdown(false);
                      setShowTempoDropdown(false);
                    }}
                  />
                )
              ) : playlist.danceStyle ? (
                <StylePill style={capitalize(playlist.danceStyle)} state="confirmed" />
              ) : null}
              {showStyleDropdown && (
                <OptionList
                  current={playlist.danceStyle}
                  options={[
                    { value: null, label: 'Ingen stil' },
                    ...styleNodes.map((node) => ({
                      value: node.name ?? null,
                      label: node.name ? capitalize(node.name) : '',
                    })),
                  ]}
                  onSelect={(v) => handleTagUpdate('danceStyle', v)}
                  onClose={() => setShowStyleDropdown(false)}
                />
              )}
            </div>

            {/* Sub-style — only shown when main style is set and has sub-styles */}
            {playlist.danceStyle && subStyles.length > 0 && (
              <div className="relative">
                {isOwner ? (
                  <TagChip
                    label={playlist.subStyle ? capitalize(playlist.subStyle) : 'Substil'}
                    filled={!!playlist.subStyle}
                    ariaLabel={playlist.subStyle ? `Ändra substil, nu ${capitalize(playlist.subStyle)}` : 'Ange substil'}
                    style={subStyleChipStyle}
                    onClick={() => {
                      setShowSubStyleDropdown((s) => !s);
                      setShowStyleDropdown(false);
                      setShowTempoDropdown(false);
                    }}
                  />
                ) : playlist.subStyle ? (
                  <TagChip label={capitalize(playlist.subStyle)} filled style={subStyleChipStyle} />
                ) : null}
                {showSubStyleDropdown && (
                  <OptionList
                    current={playlist.subStyle}
                    options={[
                      { value: null, label: 'Ingen substil' },
                      ...subStyles.map((sub) => ({ value: sub, label: capitalize(sub) })),
                    ]}
                    onSelect={(v) => handleTagUpdate('subStyle', v)}
                    onClose={() => setShowSubStyleDropdown(false)}
                  />
                )}
              </div>
            )}

            {/* Tempo tag */}
            <div className="relative">
              {isOwner ? (
                <TagChip
                  label={tLabel || 'Tempo'}
                  filled={!!tLabel}
                  ariaLabel={tLabel ? `Ändra tempo, nu ${tLabel}` : 'Ange tempo'}
                  onClick={() => {
                    setShowTempoDropdown((s) => !s);
                    setShowStyleDropdown(false);
                    setShowSubStyleDropdown(false);
                  }}
                />
              ) : tLabel ? (
                <TagChip label={tLabel} filled />
              ) : null}
              {showTempoDropdown && (
                <OptionList
                  current={playlist.tempoCategory}
                  options={[
                    { value: null, label: 'Inget tempo' },
                    ...TEMPO_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
                  ]}
                  onSelect={(v) => handleTagUpdate('tempoCategory', v)}
                  onClose={() => setShowTempoDropdown(false)}
                />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {tracks.length > 0 && (
              <Button onClick={handlePlay}>
                <PlayIcon className="h-4 w-4" aria-hidden />
                Spela
              </Button>
            )}
            {canEdit && (
              <Link to={`/search?addTo=${id}`} className={secondaryLinkClass}>
                <PlusIcon className="h-4 w-4" aria-hidden />
                Lägg till låtar
              </Link>
            )}
            {(canEdit || playlist.isPublic) && (
              <Button
                variant="outline"
                onClick={() =>
                  setShowSharePanel((s) => {
                    if (!s) clearErrors();
                    return !s;
                  })
                }
              >
                <ShareIcon className="h-4 w-4" aria-hidden />
                Dela
              </Button>
            )}
            {showMoreButton && (
              <div className="relative">
                <IconButton
                  aria-label="Fler alternativ"
                  aria-haspopup="menu"
                  aria-expanded={showMoreMenu}
                  onClick={() => setShowMoreMenu((s) => !s)}
                  className="border border-[rgb(var(--color-border))]"
                >
                  <MoreVerticalIcon className="h-5 w-5" aria-hidden />
                </IconButton>
                {showMoreMenu && (
                  <MoreMenu
                    onClose={() => setShowMoreMenu(false)}
                    onSettings={canEdit ? () => navigate(`/playlists/${id}/settings`) : undefined}
                    showFilters={tracks.length > 0}
                    filterSpotify={filterSpotify}
                    filterYouTube={filterYouTube}
                    onToggleSpotify={() => setFilterSpotify((s) => !s)}
                    onToggleYouTube={() => setFilterYouTube((s) => !s)}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {(canEdit || playlist.isPublic) && id && (
        <Modal open={showSharePanel} onClose={() => setShowSharePanel(false)} label="Dela spellista">
          <SharePlaylistPanel
            playlistId={id}
            canEdit={canEdit}
            shareToken={shareToken}
            shareUrl={shareUrl}
            createLink={createLink}
            copyLink={copyLink}
            createLinkError={createLinkError}
            copyLinkError={copyLinkError}
          />
        </Modal>
      )}

      {/* Sort bar */}
      {tracks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Sortera låtarna"
            className="inline-flex rounded-[var(--radius-full)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] p-0.5"
          >
            {SORT_OPTIONS.map(({ key, label, reversible }) => {
              const active = sort === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSortClick(key)}
                  className={`inline-flex min-h-10 items-center gap-1 rounded-[var(--radius-full)] px-3.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] ${
                    active
                      ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))]'
                      : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
                  }`}
                >
                  {label}
                  {reversible && active && (
                    <>
                      <ChevronDownIcon
                        aria-hidden
                        className={`h-3.5 w-3.5 transition-transform ${sortDirection === 'desc' ? '' : 'rotate-180'}`}
                      />
                      <span className="sr-only">{sortDirection === 'desc' ? 'fallande' : 'stigande'}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          {canEdit && (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Dra i handtaget för att ändra ordning. Ta bort en låt via menyn på raden.
            </p>
          )}
        </div>
      )}

      {/* Empty playlist */}
      {tracks.length === 0 && (
        <EmptyState
          icon={<PlaylistIcon className="h-7 w-7" aria-hidden />}
          title="Spellistan är tom"
          description="Lägg till låtar från sökningen så samlas de här."
          action={
            canEdit ? (
              <Link to={`/search?addTo=${id}`} className={primaryLinkClass}>
                <PlusIcon className="h-4 w-4" aria-hidden />
                Lägg till låtar
              </Link>
            ) : undefined
          }
        />
      )}

      {displayTracks.length === 0 && tracks.length > 0 && (
        <p className="text-[15px] text-[rgb(var(--color-text-muted))]">Inga låtar matchar filtret.</p>
      )}

      {/* Track list */}
      {displayTracks.length > 0 && (
        <ol className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
          {displayTracks.map((pt, i) =>
            pt.track ? (
              <PlaylistTrackRow
                key={pt.id ?? pt.track.id}
                track={pt.track}
                contextTracks={contextTracks}
                position={i + 1}
                showGrip={sort === 'position' && canEdit}
                isDragOver={dragOverIndex === i}
                error={pt.id ? (removeTrackErrors[pt.id] ?? null) : null}
                onRemove={canEdit && pt.id ? () => handleRemoveTrack(pt.id!, pt.track!.id!) : undefined}
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
              />
            ) : null,
          )}
          {/* Trailing drop zone — lets the user drag any item to the very end */}
          {sort === 'position' && canEdit && (
            <li
              onDragOver={(e) => handleDragOver(e, displayTracks.length)}
              onDrop={() => handleDrop(displayTracks.length)}
              onDragEnd={handleDragEnd}
              className={`h-2 border-t-2 transition-colors ${
                dragOverIndex === displayTracks.length
                  ? 'border-[rgb(var(--color-selected))]'
                  : 'border-transparent'
              }`}
            />
          )}
        </ol>
      )}
    </div>
  );
}
