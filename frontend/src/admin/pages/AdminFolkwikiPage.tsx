import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/api/http-client';
import { Pagination } from '@/admin/components/Pagination';
import { ConfidenceBadge } from '@/admin/components/ConfidenceBadge';
import { Modal } from '@/admin/components/Modal';
import { toast } from '@/admin/components/toastEmitter';
import { Badge, Button, Card, EmptyState, IconButton, InlineError, LoadError, RowSkeleton } from '@/ui';
import { StylePill } from '@/components/TrackRow/StylePill';
import { stylePillState } from '@/components/TrackRow/stylePillState';
import { usePlayer } from '@/player/usePlayer';
import { PlayIcon, PauseIcon } from '@/icons';
import type { TrackListDto } from '@/api/models/trackListDto';
import { getStyleTree } from '@/api/generated/styles/styles';
import type { StyleNode } from '@/api/models/styleNode';

interface FolkwikiMatch {
  trackId: string;
  trackTitle: string;
  dbStyle: string | null;
  dbSubStyle: string | null;
  dbConfidence: number | null;
  classificationSource: string | null;
  folkwikiTuneId: number;
  folkwikiId: string;
  folkwikiTitle: string;
  folkwikiStyle: string | null;
  folkwikiMeter: string | null;
  folkwikiBpb: number | null;
  folkwikiUrl: string;
  matchType: string;
  matchStatus: string;
  playbackLinks: { id?: string; platform?: string; deepLink?: string; isWorking?: boolean }[];
}

interface StatusCounts {
  pending: number;
  confirmed: number;
  rejected: number;
  total: number;
}

type StatusFilter = 'pending' | 'confirmed' | 'rejected' | '';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Ej granskade' },
  { value: 'confirmed', label: 'Bekräftade' },
  { value: 'rejected', label: 'Avvisade' },
  { value: '', label: 'Alla' },
];

export function AdminFolkwikiPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? 'pending') as StatusFilter;
  const limit = parseInt(params.get('limit') ?? '50', 10);
  const offset = parseInt(params.get('offset') ?? '0', 10);

  const [matches, setMatches] = useState<FolkwikiMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLUListElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const player = usePlayer();

  // Style resolution modal state (confirm unknown style)
  const [styleModal, setStyleModal] = useState<{
    match: FolkwikiMatch;
    folkwikiStyle: string;
    styleTree: StyleNode[];
  } | null>(null);
  const [styleModalMode, setStyleModalMode] = useState<'correct' | 'pick' | 'new'>('correct');
  const [correctedStyle, setCorrectedStyle] = useState('');
  const [selectedMainStyle, setSelectedMainStyle] = useState('');
  const [newMainStyle, setNewMainStyle] = useState('');
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [styleModalError, setStyleModalError] = useState<string | null>(null);

  // Reject modal state (override style)
  const [rejectModal, setRejectModal] = useState<{
    match: FolkwikiMatch;
    styleTree: StyleNode[];
  } | null>(null);
  const [overrideStyle, setOverrideStyle] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectModalError, setRejectModalError] = useState<string | null>(null);

  const matchKey = (m: FolkwikiMatch) => `${m.trackId}-${m.folkwikiTuneId}`;

  const handlePlay = (m: FolkwikiMatch) => {
    const asTrackList: TrackListDto = {
      id: m.trackId,
      title: m.trackTitle,
      danceStyle: m.dbStyle ?? undefined,
      subStyle: m.dbSubStyle ?? undefined,
      confidence: m.dbConfidence ?? undefined,
      playbackLinks: m.playbackLinks,
    };
    if (player.currentTrack?.id === m.trackId && player.isPlaying) {
      player.togglePlayPause();
    } else {
      player.play(asTrackList);
    }
  };

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (status) query.set('status', status);
      const res = await apiFetch(`/api/admin/folkwiki/matches?${query}`);
      if (!res.ok) throw new Error('Kunde inte hämta matchningar');
      const data = await res.json();
      setMatches(data.items);
      setTotal(data.total);
      setActiveIndex(0);
      setLoadError(null);
    } catch {
      setLoadError('Kunde inte hämta folkwiki-matchningar');
    } finally {
      setLoading(false);
    }
  }, [status, limit, offset]);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/folkwiki/matches/counts');
      if (res.ok) setCounts(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch('/api/admin/folkwiki/import', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Import misslyckades');
      }
      const data = await res.json();
      toast(
        `Importerade ${data.tunesTotal} låtar, ${data.newMatches} nya matchningar`,
        'success',
      );
      fetchMatches();
      fetchCounts();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import misslyckades');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateParam = (key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'offset') next.delete('offset');
      return next;
    });
  };

  const removeMatch = (match: FolkwikiMatch) => {
    setMatches((prev) => prev.filter(
      (m) => !(m.trackId === match.trackId && m.folkwikiTuneId === match.folkwikiTuneId),
    ));
    setTotal((prev) => prev - 1);
    fetchCounts();
    setActiveIndex((prev) => Math.min(prev, matches.length - 2));
  };

  const handleAction = async (
    match: FolkwikiMatch,
    action: 'confirm' | 'reject',
    force = false,
    onError?: (message: string) => void,
  ) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[matchKey(match)];
      return next;
    });
    try {
      const query = force ? '?force=true' : '';
      const res = await apiFetch(
        `/api/admin/folkwiki/matches/${match.trackId}/${match.folkwikiTuneId}/${action}${query}`,
        { method: 'PUT' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Misslyckades');
      }
      const data = await res.json();

      // Backend says style is unknown -- show modal
      if (data.status === 'style_unknown') {
        const tree = await getStyleTree();
        setStyleModal({ match, folkwikiStyle: data.folkwikiStyle, styleTree: tree });
        setStyleModalMode('correct');
        setCorrectedStyle(data.folkwikiStyle);
        setSelectedMainStyle('');
        setNewMainStyle('');
        setStyleModalError(null);
        return;
      }

      removeMatch(match);

      if (action === 'confirm' && data.appliedStyle) {
        toast(`Bekräftad: ${match.trackTitle} -> ${data.appliedStyle}`, 'success');
      } else if (action === 'reject') {
        toast(`Avvisad: ${match.trackTitle}`, 'success');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Misslyckades';
      if (onError) {
        onError(message);
      } else {
        setRowErrors((prev) => ({ ...prev, [matchKey(match)]: message }));
      }
    }
  };

  const handleAddKeywordAndConfirm = async (mainStyle: string, subStyle: string | null) => {
    if (!styleModal) return;
    setAddingKeyword(true);
    setStyleModalError(null);
    try {
      // Create the keyword
      const kwRes = await apiFetch('/api/admin/style-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: styleModal.folkwikiStyle,
          mainStyle,
          subStyle,
        }),
      });
      if (!kwRes.ok) {
        const data = await kwRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Kunde inte skapa nyckelord');
      }

      // Confirm with force=true since we just created the keyword
      const { match } = styleModal;
      setStyleModal(null);
      await handleAction(match, 'confirm', true);
    } catch (e) {
      setStyleModalError(e instanceof Error ? e.message : 'Misslyckades');
    } finally {
      setAddingKeyword(false);
    }
  };

  const handleCorrectStyleAndConfirm = async () => {
    if (!styleModal || !correctedStyle.trim()) return;
    setAddingKeyword(true);
    setStyleModalError(null);
    try {
      const res = await apiFetch(`/api/admin/folkwiki/tunes/${styleModal.match.folkwikiTuneId}/style`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style: correctedStyle.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Kunde inte spara stil');
      }
      const { match } = styleModal;
      setStyleModal(null);
      await handleAction(match, 'confirm', false);
    } catch (e) {
      setStyleModalError(e instanceof Error ? e.message : 'Misslyckades');
    } finally {
      setAddingKeyword(false);
    }
  };

  const openRejectModal = async (match: FolkwikiMatch) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[matchKey(match)];
      return next;
    });
    try {
      const tree = await getStyleTree();
      setRejectModal({ match, styleTree: tree });
      setOverrideStyle('');
      setRejectModalError(null);
    } catch {
      setRowErrors((prev) => ({ ...prev, [matchKey(match)]: 'Kunde inte hämta stilar' }));
    }
  };

  const handleRejectSimple = async (match: FolkwikiMatch) => {
    setRejectModalError(null);
    let failed = false;
    await handleAction(match, 'reject', false, (message) => {
      failed = true;
      setRejectModalError(message);
    });
    if (!failed) setRejectModal(null);
  };

  const handleRejectWithOverride = async () => {
    if (!rejectModal || !overrideStyle) return;
    setRejecting(true);
    setRejectModalError(null);
    try {
      const query = `?overrideStyle=${encodeURIComponent(overrideStyle)}`;
      const res = await apiFetch(
        `/api/admin/folkwiki/matches/${rejectModal.match.trackId}/${rejectModal.match.folkwikiTuneId}/reject${query}`,
        { method: 'PUT' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Misslyckades');
      }
      const data = await res.json();
      const { match } = rejectModal;
      setRejectModal(null);
      removeMatch(match);
      toast(`Avvisad: ${match.trackTitle} -> ${data.appliedStyle ?? overrideStyle}`, 'success');
    } catch (e) {
      setRejectModalError(e instanceof Error ? e.message : 'Misslyckades');
    } finally {
      setRejecting(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const match = matches[activeIndex];
      if (!match) return;

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, matches.length - 1));
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          handleAction(match, 'confirm');
          break;
        case 'Backspace':
          e.preventDefault();
          openRejectModal(match);
          break;
        case ' ':
          e.preventDefault();
          handlePlay(match);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [matches, activeIndex]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  const stylesDisagree = (m: FolkwikiMatch) =>
    m.dbStyle && m.folkwikiStyle && m.dbStyle.toLowerCase() !== m.folkwikiStyle.toLowerCase();

  const segment = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))] ${
      active
        ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))]'
        : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
    }`;

  const inputClass =
    'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';

  const kbdClass =
    'rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] px-1.5 py-0.5 text-[13px] text-[rgb(var(--color-text))]';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Folkwiki-matchning
        </h1>
        <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-muted))]">
          Låtar i biblioteket som liknar en låt på folkwiki.se. Bekräfta en matchning för att
          ta över dansstilen från Folkwiki, eller avvisa den och behåll stilen som den är.
        </p>
      </div>

      {/* Import */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">Importera från Folkwiki</h2>
          <p className="mt-1 text-[13px] text-[rgb(var(--color-text-muted))]">
            Ladda upp en JSON-export från folkwiki.se. Nya låtar matchas mot biblioteket direkt.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
          <Button
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importerar...' : 'Importera JSON'}
          </Button>
          {importError && <InlineError>{importError}</InlineError>}
        </div>
      </Card>

      {/* Status tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Status"
          className="inline-flex flex-wrap rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] p-0.5"
        >
          {STATUS_TABS.map((tab) => {
            const count = counts
              ? tab.value === '' ? counts.total
              : counts[tab.value as keyof Omit<StatusCounts, 'total'>]
              : null;
            const active = status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => updateParam('status', tab.value)}
                className={segment(active)}
              >
                {tab.label}
                {count != null && (
                  <span className={`text-[13px] tabular-nums ${active ? 'opacity-80' : 'text-[rgb(var(--color-text-muted))]'}`}>
                    {count.toLocaleString('sv-SE')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
          <kbd className={kbdClass}>j</kbd>/<kbd className={kbdClass}>k</kbd> navigera{' '}
          <kbd className={kbdClass}>Mellanslag</kbd> spela{' '}
          <kbd className={kbdClass}>Enter</kbd> bekräfta{' '}
          <kbd className={kbdClass}>Backspace</kbd> avvisa
        </p>
      </div>

      {/* Match list */}
      {loadError && <LoadError message={loadError} onRetry={fetchMatches} />}

      {!loadError && (loading ? (
        <RowSkeleton rows={8} label="Laddar matchningar" />
      ) : matches.length === 0 ? (
        <EmptyState
          title="Inga matchningar att visa"
          description="Importera en ny JSON-export från Folkwiki eller byt status ovan."
        />
      ) : (
        <ul
          ref={listRef}
          className="divide-y divide-[rgb(var(--color-border))] overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]"
          aria-label="Matchningar"
        >
          {matches.map((m, i) => {
            const disagree = stylesDisagree(m);
            const active = i === activeIndex;
            const isPlaying = player.currentTrack?.id === m.trackId && player.isPlaying;
            return (
              <li
                key={`${m.trackId}-${m.folkwikiTuneId}`}
                onClick={() => setActiveIndex(i)}
                aria-current={active ? 'true' : undefined}
                className={`flex flex-wrap items-center gap-3 border-l-[3px] px-3 py-2.5 transition-colors sm:flex-nowrap ${
                  active
                    ? 'border-l-[rgb(var(--color-selected))] bg-[rgb(var(--color-selected))]/8'
                    : 'border-l-transparent hover:bg-[rgb(var(--color-bg))]/60'
                }`}
              >
                {/* Play button */}
                <IconButton
                  aria-label={isPlaying ? `Pausa ${m.trackTitle}` : `Spela ${m.trackTitle}`}
                  onClick={(e) => { e.stopPropagation(); handlePlay(m); }}
                  className="shrink-0"
                >
                  {isPlaying ? (
                    <PauseIcon className="h-5 w-5" />
                  ) : (
                    <PlayIcon className="ml-0.5 h-5 w-5" />
                  )}
                </IconButton>

                {/* Track info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-[15px] font-medium text-[rgb(var(--color-text))]">{m.trackTitle}</span>
                    <span className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">{m.folkwikiTitle}</span>
                    <Badge variant={m.matchType === 'exact' ? 'default' : 'muted'}>
                      {m.matchType === 'exact' ? 'Exakt träff' : 'Delvis träff'}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[rgb(var(--color-text-muted))]">
                    <span className="inline-flex items-center gap-1.5">
                      Biblioteket:
                      <StylePill style={m.dbStyle} state={stylePillState(m.dbStyle, m.dbConfidence)} />
                      {m.dbConfidence != null && <ConfidenceBadge value={m.dbConfidence} />}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      Folkwiki:
                      <StylePill style={m.folkwikiStyle} state={m.folkwikiStyle ? 'guess' : 'unknown'} />
                      {m.folkwikiMeter && <span>({m.folkwikiMeter})</span>}
                    </span>
                    {disagree && (
                      <span className="font-medium text-[rgb(var(--color-error))]">Stilkonflikt</span>
                    )}
                  </div>
                </div>

                {/* Folkwiki link */}
                <a
                  href={m.folkwikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-[rgb(var(--color-link))] hover:underline"
                >
                  Visa på folkwiki.se
                </a>

                {/* Actions */}
                {m.matchStatus === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleAction(m, 'confirm');
                      }}
                    >
                      Bekräfta
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        openRejectModal(m);
                      }}
                    >
                      Avvisa
                    </Button>
                  </div>
                )}
                {m.matchStatus !== 'pending' && (
                  <Badge variant={m.matchStatus === 'confirmed' ? 'default' : 'muted'} className="shrink-0">
                    {m.matchStatus === 'confirmed' ? 'Bekräftad' : 'Avvisad'}
                  </Badge>
                )}
                {rowErrors[matchKey(m)] && (
                  <InlineError>{rowErrors[matchKey(m)]}</InlineError>
                )}
              </li>
            );
          })}
        </ul>
      ))}

      {total > limit && (
        <Pagination
          offset={offset}
          limit={limit}
          total={total}
          onChange={(newOffset) => updateParam('offset', String(newOffset))}
        />
      )}

      {/* Style resolution modal */}
      <Modal
        open={styleModal !== null}
        onClose={() => { setStyleModal(null); setStyleModalError(null); }}
        title="Okänd stil"
      >
        {styleModal && (
          <div className="space-y-4">
            <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
              Stilen <span className="font-medium text-[rgb(var(--color-text))]">{styleModal.folkwikiStyle}</span> finns
              inte bland nyckelorden. Välj hur den ska läggas till:
            </p>

            {/* Mode tabs */}
            <div
              role="group"
              aria-label="Hur stilen ska läggas till"
              className="inline-flex flex-wrap rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] p-0.5"
            >
              {(
                [
                  { value: 'correct', label: 'Rätta stavning' },
                  { value: 'pick', label: 'Understil till befintlig' },
                  { value: 'new', label: 'Ny huvudstil' },
                ] as { value: 'correct' | 'pick' | 'new'; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={styleModalMode === tab.value}
                  onClick={() => { setStyleModalMode(tab.value); setStyleModalError(null); }}
                  className={segment(styleModalMode === tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {styleModalMode === 'correct' ? (
              <div className="space-y-3">
                <label htmlFor="fw-corrected-style" className="block text-sm font-medium text-[rgb(var(--color-text))]">
                  Rätt stavning
                </label>
                <input
                  id="fw-corrected-style"
                  type="text"
                  value={correctedStyle}
                  onChange={(e) => { setCorrectedStyle(e.target.value); setStyleModalError(null); }}
                  className={inputClass}
                />
                <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                  Sparar <span className="font-medium">{correctedStyle || '...'}</span> direkt i folkwiki-tabellen och bekräftar sedan matchningen.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  {styleModalError && <InlineError>{styleModalError}</InlineError>}
                  <Button variant="ghost" onClick={() => { setStyleModal(null); setStyleModalError(null); }}>
                    Avbryt
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!correctedStyle.trim() || addingKeyword}
                    onClick={handleCorrectStyleAndConfirm}
                  >
                    {addingKeyword ? 'Sparar...' : 'Rätta och bekräfta'}
                  </Button>
                </div>
              </div>
            ) : styleModalMode === 'pick' ? (
              <div className="space-y-3">
                <span id="fw-main-style-label" className="block text-sm font-medium text-[rgb(var(--color-text))]">
                  Huvudstil
                </span>
                <div
                  role="group"
                  aria-labelledby="fw-main-style-label"
                  className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto"
                >
                  {styleModal.styleTree.map((node) => {
                    const selected = selectedMainStyle === node.name;
                    return (
                      <button
                        key={node.name}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedMainStyle(node.name ?? '')}
                        className={`flex min-h-11 flex-wrap items-center gap-x-2 rounded-[var(--radius)] border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] ${
                          selected
                            ? 'border-[rgb(var(--color-selected))] bg-[rgb(var(--color-selected))]/10 text-[rgb(var(--color-text))]'
                            : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
                        }`}
                      >
                        <span className="font-medium">{node.name}</span>
                        {node.subStyles && node.subStyles.length > 0 && (
                          <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                            {node.subStyles.length} understilar
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedMainStyle && (
                  <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                    Nyckelordet <span className="font-medium">{styleModal.folkwikiStyle}</span> läggs
                    till som understil under <span className="font-medium">{selectedMainStyle}</span>.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  {styleModalError && <InlineError>{styleModalError}</InlineError>}
                  <Button variant="ghost" onClick={() => { setStyleModal(null); setStyleModalError(null); }}>
                    Avbryt
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!selectedMainStyle || addingKeyword}
                    onClick={() => handleAddKeywordAndConfirm(selectedMainStyle, styleModal.folkwikiStyle)}
                  >
                    {addingKeyword ? 'Sparar...' : 'Lägg till och bekräfta'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="fw-new-main-style" className="block text-sm font-medium text-[rgb(var(--color-text))]">
                  Namn på ny huvudstil
                </label>
                <input
                  id="fw-new-main-style"
                  type="text"
                  value={newMainStyle}
                  onChange={(e) => { setNewMainStyle(e.target.value); setStyleModalError(null); }}
                  placeholder={styleModal.folkwikiStyle}
                  className={inputClass}
                />
                <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                  Nyckelordet <span className="font-medium">{styleModal.folkwikiStyle}</span> läggs
                  till som ny huvudstil <span className="font-medium">{newMainStyle || styleModal.folkwikiStyle}</span>.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  {styleModalError && <InlineError>{styleModalError}</InlineError>}
                  <Button variant="ghost" onClick={() => { setStyleModal(null); setStyleModalError(null); }}>
                    Avbryt
                  </Button>
                  <Button
                    variant="primary"
                    disabled={addingKeyword}
                    onClick={() => handleAddKeywordAndConfirm(
                      newMainStyle || styleModal.folkwikiStyle,
                      null,
                    )}
                  >
                    {addingKeyword ? 'Sparar...' : 'Lägg till och bekräfta'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject modal */}
      <Modal
        open={rejectModal !== null}
        onClose={() => { setRejectModal(null); setRejectModalError(null); }}
        title="Avvisa matchning"
      >
        {rejectModal && (
          <div className="space-y-4">
            <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
              <span className="font-medium text-[rgb(var(--color-text))]">{rejectModal.match.trackTitle}</span>
              {' '}matchad mot folkwiki-stilen{' '}
              <span className="font-medium text-[rgb(var(--color-text))]">{rejectModal.match.folkwikiStyle ?? '?'}</span>
            </p>

            {/* Option 1: DB style is already correct */}
            <button
              type="button"
              onClick={() => handleRejectSimple(rejectModal.match)}
              className="w-full rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] px-4 py-3 text-left transition-colors hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
            >
              <span className="block text-[15px] font-medium text-[rgb(var(--color-text))]">Stilen var redan korrekt</span>
              <span className="mt-0.5 block text-[13px] text-[rgb(var(--color-text-muted))]">
                Behåll nuvarande stil: {rejectModal.match.dbStyle ?? '(ingen)'}
                {rejectModal.match.dbSubStyle && ` / ${rejectModal.match.dbSubStyle}`}
              </span>
            </button>
            {rejectModalError && !overrideStyle && <InlineError>{rejectModalError}</InlineError>}

            {/* Option 2: Override with a different style */}
            <div className="space-y-2">
              <label htmlFor="fw-override-style" className="block text-sm font-medium text-[rgb(var(--color-text))]">
                Det är en annan stil
              </label>
              <select
                id="fw-override-style"
                value={overrideStyle}
                onChange={(e) => { setOverrideStyle(e.target.value); setRejectModalError(null); }}
                className={inputClass}
              >
                <option value="">Välj stil</option>
                {rejectModal.styleTree.map((node) => (
                  <optgroup key={node.name} label={node.name}>
                    <option value={node.name}>{node.name}</option>
                    {node.subStyles?.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                {rejectModalError && overrideStyle && <InlineError>{rejectModalError}</InlineError>}
                <Button variant="ghost" onClick={() => { setRejectModal(null); setRejectModalError(null); }}>
                  Avbryt
                </Button>
                <Button
                  variant="primary"
                  disabled={!overrideStyle || rejecting}
                  onClick={handleRejectWithOverride}
                >
                  {rejecting ? 'Sparar...' : `Avvisa och sätt ${overrideStyle || '...'}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
