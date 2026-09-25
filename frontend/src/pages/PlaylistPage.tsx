import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getPlaylist, removeTrack, updatePlaylist, reorderTracks } from '@/api/generated/playlists/playlists';
import { getStyleTree } from '@/api/generated/styles/styles';
import type { PlaylistDto } from '@/api/models/playlistDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import type { StyleNode } from '@/api/models/styleNode';
import { PlaylistTrackRow } from '@/components/PlaylistTrackRow';
import { SharePlaylistPanel } from '@/components/SharePlaylistPanel';
import { BackArrowIcon, ChevronDownIcon, EditIcon, PlayIcon, PlusIcon, SettingsIcon, ShareIcon, SpotifyIcon, YouTubeIcon } from '@/icons';
import { Button, IconButton, InlineError, Modal, Pill, toast } from '@/ui';
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

// ── Sort / Filter ─────────────────────────────────────────────────────────────

type SortKey = 'position' | 'name' | 'duration' | 'tempo';
type SortDirection = 'asc' | 'desc';

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
  const [saveNameError, setSaveNameError] = useState<string | null>(null);
  const [removeTrackError, setRemoveTrackError] = useState<{ id: string; message: string } | null>(null);

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

  // Drag state (position mode only)
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Prevent autoplay from firing again on subsequent playlist state updates
  const autoplayTriggered = useRef(false);

  const { shareToken, shareUrl, createLink, copyLink } = usePlaylistShareLink(id, playlist?.shareToken);

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
    setRemoveTrackError(null);
    try {
      await removeTrack(id, trackId);
      setPlaylist((prev) =>
        prev ? { ...prev, tracks: prev.tracks?.filter((t) => t.id !== playlistTrackId) } : prev,
      );
      toast('Låt borttagen från spellista');
    } catch {
      setRemoveTrackError({ id: playlistTrackId, message: 'Kunde inte ta bort låt' });
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
              className="flex-1 space-y-1"
            >
              <div className="flex items-center gap-2">
                <input
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
              </div>
              <InlineError>{saveNameError}</InlineError>
            </form>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h1 className="min-w-0 truncate text-2xl font-bold text-[rgb(var(--color-text))]">
                {playlist.name}
              </h1>
              {canEdit && (
                <IconButton
                  aria-label="Ändra namn"
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
        </div>

        {/* Owner group */}
        {playlist.ownerGroup && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Ägs av gruppen{' '}
            <Link
              to={`/groups/${playlist.ownerGroup.id}`}
              className="text-[rgb(var(--color-accent))] hover:underline"
            >
              {playlist.ownerGroup.name}
            </Link>
          </p>
        )}

        {/* Description */}
        {playlist.description && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">{playlist.description}</p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {tracks.length > 0 && (
            <Button onClick={handlePlay} className="flex items-center gap-1.5">
              <PlayIcon className="h-4 w-4" aria-hidden />
              Spela
            </Button>
          )}
          {canEdit && (
            <Link
              to={`/search?addTo=${id}`}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-accent-muted))] px-4 py-2 text-sm font-medium text-[rgb(var(--color-accent))] hover:opacity-90"
            >
              <PlusIcon className="h-4 w-4" aria-hidden />
              Lägg till låtar
            </Link>
          )}
          {(canEdit || playlist.isPublic) && (
            <Button
              variant="secondary"
              onClick={() => setShowSharePanel((s) => !s)}
              className="flex items-center gap-1.5"
            >
              <ShareIcon className="h-4 w-4" aria-hidden />
              Dela spellista
            </Button>
          )}
          {canEdit && (
            <Button
              variant="secondary"
              onClick={() => navigate(`/playlists/${id}/settings`)}
              className="flex items-center gap-1.5"
            >
              <SettingsIcon className="h-4 w-4" aria-hidden />
              Ändra inställningar
            </Button>
          )}
        </div>

        {(canEdit || playlist.isPublic) && id && (
          <Modal open={showSharePanel} onClose={() => setShowSharePanel(false)} label="Dela spellista">
            <SharePlaylistPanel playlistId={id} canEdit={canEdit} shareToken={shareToken} shareUrl={shareUrl} createLink={createLink} copyLink={copyLink} />
          </Modal>
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

        {/* Track count */}
        <p className="text-sm text-[rgb(var(--color-text-muted))]">
          {tracks.length} {tracks.length === 1 ? 'låt' : 'låtar'}
        </p>
      </div>

      {/* Sort + Filter bar */}
      {tracks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: 'position', label: 'Ordning', reversible: false },
              { key: 'name', label: 'Namn', reversible: true },
              { key: 'duration', label: 'Längd', reversible: true },
              { key: 'tempo', label: 'Tempo', reversible: true },
            ] as { key: SortKey; label: string; reversible: boolean }[]
          ).map(({ key, label, reversible }) => (
            <Pill
              key={key}
              active={sort === key}
              onClick={() => handleSortClick(key)}
              className="flex items-center gap-1 min-h-11"
            >
              {label}
              {reversible && sort === key && (
                <>
                  <ChevronDownIcon
                    aria-hidden
                    className={`h-3.5 w-3.5 transition-transform ${sortDirection === 'desc' ? '' : 'rotate-180'}`}
                  />
                  <span className="sr-only">{sortDirection === 'desc' ? 'fallande' : 'stigande'}</span>
                </>
              )}
            </Pill>
          ))}

          {/* Filter toggles */}
          <div className="flex items-center gap-1">
            <Pill
              active={filterSpotify}
              variant="green"
              aria-label="Filtrera Spotify"
              title="Visa endast låtar med Spotify"
              onClick={() => setFilterSpotify((s) => !s)}
              className="flex items-center gap-1 min-h-11"
            >
              <SpotifyIcon className="h-3.5 w-3.5" aria-hidden />
              Spotify
            </Pill>
            <Pill
              active={filterYouTube}
              variant="red"
              aria-label="Filtrera YouTube"
              title="Visa endast låtar med YouTube"
              onClick={() => setFilterYouTube((s) => !s)}
              className="flex items-center gap-1 min-h-11"
            >
              <YouTubeIcon className="h-3.5 w-3.5" aria-hidden />
              YouTube
            </Pill>
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
              error={removeTrackError && removeTrackError.id === pt.id ? removeTrackError.message : null}
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
