import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/api/http-client';
import { Pagination } from '@/admin/components/Pagination';
import { ConfidenceBadge } from '@/admin/components/ConfidenceBadge';
import { Modal } from '@/admin/components/Modal';
import { toast } from '@/admin/components/toastEmitter';
import { Button, InlineError, LoadError, PageHeader, fieldClassName, fieldLabelClassName } from '@/ui';
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
  const listRef = useRef<HTMLDivElement>(null);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Folkwiki-matchning" />
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm text-[rgb(var(--color-text-muted))]">
            <kbd className="rounded border border-[rgb(var(--color-border))] px-1">j/k</kbd> navigera{' '}
            <kbd className="rounded border border-[rgb(var(--color-border))] px-1">Mellanslag</kbd> spela{' '}
            <kbd className="rounded border border-[rgb(var(--color-border))] px-1">Enter</kbd> bekräfta{' '}
            <kbd className="rounded border border-[rgb(var(--color-border))] px-1">Backspace</kbd> avvisa
          </div>
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
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importerar...' : 'Importera JSON'}
          </Button>
          {importError && <InlineError>{importError}</InlineError>}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-sunken))] p-1">
        {STATUS_TABS.map((tab) => {
          const count = counts
            ? tab.value === '' ? counts.total
            : counts[tab.value as keyof Omit<StatusCounts, 'total'>]
            : null;
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => updateParam('status', tab.value)}
              className={`flex min-h-9 items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] ${
                active
                  ? 'bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text))] shadow-[var(--color-card-shadow)]'
                  : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
              }`}
            >
              {tab.label}
              {count != null && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  active ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
                    : 'bg-[rgb(var(--color-pill-bg))]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Match list */}
      {loadError && <LoadError message={loadError} onRetry={fetchMatches} />}

      {!loadError && (loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-[rgb(var(--color-bg-elevated))]" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="py-12 text-center text-[rgb(var(--color-text-muted))]">
          Inga matchningar att visa
        </div>
      ) : (
        <div ref={listRef} className="space-y-1">
          {matches.map((m, i) => {
            const disagree = stylesDisagree(m);
            const active = i === activeIndex;
            return (
              <div
                key={`${m.trackId}-${m.folkwikiTuneId}`}
                onClick={() => setActiveIndex(i)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
                  active
                    ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent-muted))]/30'
                    : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] hover:border-[rgb(var(--color-border))]/80'
                }`}
              >
                {/* Play button */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handlePlay(m); }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[rgb(var(--color-border))]/50 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
                  aria-label={player.currentTrack?.id === m.trackId && player.isPlaying ? 'Pausa' : 'Spela'}
                >
                  {player.currentTrack?.id === m.trackId && player.isPlaying ? (
                    <PauseIcon className="h-4 w-4" />
                  ) : (
                    <PlayIcon className="h-4 w-4 ml-0.5" />
                  )}
                </button>

                {/* Track info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{m.trackTitle}</span>
                    <span className="text-[rgb(var(--color-text-muted))]">/</span>
                    <span className="truncate text-sm text-[rgb(var(--color-text-muted))]">{m.folkwikiTitle}</span>
                    <span className={`shrink-0 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-xs font-medium ${
                      m.matchType === 'exact'
                        ? 'bg-[rgb(var(--color-selected-muted))] text-[rgb(var(--color-success))]'
                        : 'bg-[rgb(var(--color-now-playing-muted))] text-[rgb(var(--color-now-playing))]'
                    }`}>
                      {m.matchType === 'exact' ? 'Exakt' : 'Delvis'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[rgb(var(--color-text-muted))]">
                    <span>DB: {m.dbStyle ?? '(ingen)'}</span>
                    {m.dbConfidence != null && <ConfidenceBadge value={m.dbConfidence} />}
                    <span className="text-[rgb(var(--color-border))]">|</span>
                    <span>Folkwiki: {m.folkwikiStyle ?? '?'}</span>
                    {m.folkwikiMeter && <span>({m.folkwikiMeter})</span>}
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
                  className="shrink-0 text-xs text-[rgb(var(--color-accent))] hover:underline"
                  title="Visa på folkwiki.se"
                >
                  folkwiki
                </a>

                {/* Actions */}
                {m.matchStatus === 'pending' && (
                  <div className="flex shrink-0 gap-1.5">
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
                      variant="ghost"
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
                  <span className={`shrink-0 rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium ${
                    m.matchStatus === 'confirmed'
                      ? 'bg-[rgb(var(--color-selected-muted))] text-[rgb(var(--color-success))]'
                      : 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-error))]'
                  }`}>
                    {m.matchStatus === 'confirmed' ? 'Bekräftad' : 'Avvisad'}
                  </span>
                )}
                {rowErrors[matchKey(m)] && (
                  <InlineError>{rowErrors[matchKey(m)]}</InlineError>
                )}
              </div>
            );
          })}
        </div>
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
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Stilen <span className="font-medium text-[rgb(var(--color-text))]">{styleModal.folkwikiStyle}</span> finns
              inte bland nyckelorden. Välj hur den ska läggas till:
            </p>

            {/* Mode tabs */}
            <div className="flex gap-1 rounded-lg bg-[rgb(var(--color-bg))] p-1">
              {(
                [
                  { value: 'correct', label: 'Rätta stavning' },
                  { value: 'pick', label: 'Substil till befintlig' },
                  { value: 'new', label: 'Ny huvudstil' },
                ] as { value: 'correct' | 'pick' | 'new'; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => { setStyleModalMode(tab.value); setStyleModalError(null); }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    styleModalMode === tab.value
                      ? 'bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text))] shadow-sm'
                      : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {styleModalMode === 'correct' ? (
              <div className="space-y-3">
                <label htmlFor="folkwiki-corrected-style" className={fieldLabelClassName}>
                  Rätt stavning
                </label>
                <input
                  id="folkwiki-corrected-style"
                  type="text"
                  value={correctedStyle}
                  onChange={(e) => { setCorrectedStyle(e.target.value); setStyleModalError(null); }}
                  className={fieldClassName}
                />
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  Sparar <span className="font-medium">{correctedStyle || '...'}</span> direkt i folkwiki-tabellen och bekräftar sedan matchningen.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  {styleModalError && <InlineError>{styleModalError}</InlineError>}
                  <Button variant="ghost" size="sm" onClick={() => { setStyleModal(null); setStyleModalError(null); }}>
                    Avbryt
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!correctedStyle.trim() || addingKeyword}
                    onClick={handleCorrectStyleAndConfirm}
                  >
                    {addingKeyword ? 'Sparar...' : 'Rätta och bekräfta'}
                  </Button>
                </div>
              </div>
            ) : styleModalMode === 'pick' ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Huvudstil
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {styleModal.styleTree.map((node) => (
                    <button
                      key={node.name}
                      onClick={() => setSelectedMainStyle(node.name ?? '')}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        selectedMainStyle === node.name
                          ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent-muted))]/30 text-[rgb(var(--color-text))]'
                          : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:border-[rgb(var(--color-border))]/80'
                      }`}
                    >
                      <span className="font-medium">{node.name}</span>
                      {node.subStyles && node.subStyles.length > 0 && (
                        <span className="ml-1 text-xs opacity-60">
                          ({node.subStyles.length} sub)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedMainStyle && (
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    Nyckelord <span className="font-medium">{styleModal.folkwikiStyle}</span> läggs
                    till som substil under <span className="font-medium">{selectedMainStyle}</span>
                  </p>
                )}
                <div className="flex items-center justify-end gap-2 pt-2">
                  {styleModalError && <InlineError>{styleModalError}</InlineError>}
                  <Button variant="ghost" size="sm" onClick={() => { setStyleModal(null); setStyleModalError(null); }}>
                    Avbryt
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!selectedMainStyle || addingKeyword}
                    onClick={() => handleAddKeywordAndConfirm(selectedMainStyle, styleModal.folkwikiStyle)}
                  >
                    {addingKeyword ? 'Sparar...' : 'Lägg till och bekräfta'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="folkwiki-new-main-style" className={fieldLabelClassName}>
                  Namn på ny huvudstil
                </label>
                <input
                  id="folkwiki-new-main-style"
                  type="text"
                  value={newMainStyle}
                  onChange={(e) => { setNewMainStyle(e.target.value); setStyleModalError(null); }}
                  placeholder={styleModal.folkwikiStyle}
                  className={fieldClassName}
                />
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  Nyckelord <span className="font-medium">{styleModal.folkwikiStyle}</span> läggs
                  till som ny huvudstil <span className="font-medium">{newMainStyle || styleModal.folkwikiStyle}</span>
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  {styleModalError && <InlineError>{styleModalError}</InlineError>}
                  <Button variant="ghost" size="sm" onClick={() => { setStyleModal(null); setStyleModalError(null); }}>
                    Avbryt
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
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
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              <span className="font-medium text-[rgb(var(--color-text))]">{rejectModal.match.trackTitle}</span>
              {' '}matchad mot folkwiki-stil{' '}
              <span className="font-medium text-[rgb(var(--color-text))]">{rejectModal.match.folkwikiStyle ?? '?'}</span>
            </p>

            {/* Option 1: DB style is already correct */}
            <button
              onClick={() => handleRejectSimple(rejectModal.match)}
              className="w-full rounded-lg border border-[rgb(var(--color-border))] px-4 py-3 text-left transition-colors hover:border-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent-muted))]/20"
            >
              <span className="block text-sm font-medium">Stilen var redan korrekt</span>
              <span className="block text-xs text-[rgb(var(--color-text-muted))]">
                Behåll nuvarande stil: {rejectModal.match.dbStyle ?? '(ingen)'}
                {rejectModal.match.dbSubStyle && ` / ${rejectModal.match.dbSubStyle}`}
              </span>
            </button>
            {rejectModalError && !overrideStyle && <InlineError>{rejectModalError}</InlineError>}

            {/* Option 2: Override with a different style */}
            <div className="space-y-2">
              <label htmlFor="folkwiki-override-style" className={fieldLabelClassName}>Det är en annan stil:</label>
              <select
                id="folkwiki-override-style"
                value={overrideStyle}
                onChange={(e) => { setOverrideStyle(e.target.value); setRejectModalError(null); }}
                className={`${fieldClassName} pr-9`}
              >
                <option value="">Välj stil...</option>
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
              <div className="flex items-center justify-end gap-2 pt-1">
                {rejectModalError && overrideStyle && <InlineError>{rejectModalError}</InlineError>}
                <Button variant="ghost" size="sm" onClick={() => { setRejectModal(null); setRejectModalError(null); }}>
                  Avbryt
                </Button>
                <Button
                  variant="primary"
                  size="sm"
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
