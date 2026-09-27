import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/api/http-client';
import { Pagination } from '@/admin/components/Pagination';
import { ConfidenceBadge } from '@/admin/components/ConfidenceBadge';
import { Modal } from '@/admin/components/Modal';
import { toast } from '@/admin/components/toastEmitter';
import { Button } from '@/ui';
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
  { value: 'confirmed', label: 'Bekraftade' },
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [importing, setImporting] = useState(false);
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

  // Reject modal state (override style)
  const [rejectModal, setRejectModal] = useState<{
    match: FolkwikiMatch;
    styleTree: StyleNode[];
  } | null>(null);
  const [overrideStyle, setOverrideStyle] = useState('');
  const [rejecting, setRejecting] = useState(false);

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
      if (!res.ok) throw new Error('Kunde inte hamta matchningar');
      const data = await res.json();
      setMatches(data.items);
      setTotal(data.total);
      setActiveIndex(0);
    } catch {
      toast('Kunde inte hamta folkwiki-matchningar', 'error');
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
      toast(e instanceof Error ? e.message : 'Import misslyckades', 'error');
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
  ) => {
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
        return;
      }

      removeMatch(match);

      if (action === 'confirm' && data.appliedStyle) {
        toast(`Bekraftad: ${match.trackTitle} -> ${data.appliedStyle}`, 'success');
      } else if (action === 'reject') {
        toast(`Avvisad: ${match.trackTitle}`, 'success');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Misslyckades', 'error');
    }
  };

  const handleAddKeywordAndConfirm = async (mainStyle: string, subStyle: string | null) => {
    if (!styleModal) return;
    setAddingKeyword(true);
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
      toast(e instanceof Error ? e.message : 'Misslyckades', 'error');
    } finally {
      setAddingKeyword(false);
    }
  };

  const handleCorrectStyleAndConfirm = async () => {
    if (!styleModal || !correctedStyle.trim()) return;
    setAddingKeyword(true);
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
      toast(e instanceof Error ? e.message : 'Misslyckades', 'error');
    } finally {
      setAddingKeyword(false);
    }
  };

  const openRejectModal = async (match: FolkwikiMatch) => {
    try {
      const tree = await getStyleTree();
      setRejectModal({ match, styleTree: tree });
      setOverrideStyle('');
    } catch {
      toast('Kunde inte hamta stilar', 'error');
    }
  };

  const handleRejectSimple = async (match: FolkwikiMatch) => {
    setRejectModal(null);
    await handleAction(match, 'reject');
  };

  const handleRejectWithOverride = async () => {
    if (!rejectModal || !overrideStyle) return;
    setRejecting(true);
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
      toast(e instanceof Error ? e.message : 'Misslyckades', 'error');
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Folkwiki-matchning</h1>
        <div className="flex items-center gap-4">
          <div className="text-xs text-[rgb(var(--color-text-muted))]">
            <kbd className="rounded border border-[rgb(var(--color-border))] px-1">j/k</kbd> navigera{' '}
            <kbd className="rounded border border-[rgb(var(--color-border))] px-1">Mellanslag</kbd> spela{' '}
            <kbd className="rounded border border-[rgb(var(--color-border))] px-1">Enter</kbd> bekrafta{' '}
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
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 rounded-lg bg-[rgb(var(--color-bg-elevated))] p-1">
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
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text))] shadow-sm'
                  : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
              }`}
            >
              {tab.label}
              {count != null && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  active ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
                    : 'bg-[rgb(var(--color-border))]/50'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Match list */}
      {loading ? (
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
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
                      m.matchType === 'exact'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-yellow-500/10 text-yellow-400'
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
                      <span className="font-medium text-red-400">Stilkonflikt</span>
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
                  title="Visa pa folkwiki.se"
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
                      Bekrafta
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
                  <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${
                    m.matchStatus === 'confirmed'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {m.matchStatus === 'confirmed' ? 'Bekraftad' : 'Avvisad'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

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
        onClose={() => setStyleModal(null)}
        title="Okand stil"
      >
        {styleModal && (
          <div className="space-y-4">
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Stilen <span className="font-medium text-[rgb(var(--color-text))]">{styleModal.folkwikiStyle}</span> finns
              inte bland nyckelorden. Valj hur den ska laggas till:
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
                  onClick={() => setStyleModalMode(tab.value)}
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
                <label className="block text-sm font-medium">
                  Rätt stavning
                </label>
                <input
                  type="text"
                  value={correctedStyle}
                  onChange={(e) => setCorrectedStyle(e.target.value)}
                  className="w-full rounded-md border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))]/50 focus:border-[rgb(var(--color-accent))] focus:outline-none"
                />
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  Sparar <span className="font-medium">{correctedStyle || '...'}</span> direkt i folkwiki-tabellen och bekräftar sedan matchningen.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setStyleModal(null)}>
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
                    Nyckelord <span className="font-medium">{styleModal.folkwikiStyle}</span> laggs
                    till som substil under <span className="font-medium">{selectedMainStyle}</span>
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setStyleModal(null)}>
                    Avbryt
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!selectedMainStyle || addingKeyword}
                    onClick={() => handleAddKeywordAndConfirm(selectedMainStyle, styleModal.folkwikiStyle)}
                  >
                    {addingKeyword ? 'Sparar...' : 'Lagg till och bekrafta'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Namn pa ny huvudstil
                </label>
                <input
                  type="text"
                  value={newMainStyle}
                  onChange={(e) => setNewMainStyle(e.target.value)}
                  placeholder={styleModal.folkwikiStyle}
                  className="w-full rounded-md border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))]/50 focus:border-[rgb(var(--color-accent))] focus:outline-none"
                />
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  Nyckelord <span className="font-medium">{styleModal.folkwikiStyle}</span> laggs
                  till som ny huvudstil <span className="font-medium">{newMainStyle || styleModal.folkwikiStyle}</span>
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setStyleModal(null)}>
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
                    {addingKeyword ? 'Sparar...' : 'Lagg till och bekrafta'}
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
        onClose={() => setRejectModal(null)}
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
                Behall nuvarande stil: {rejectModal.match.dbStyle ?? '(ingen)'}
                {rejectModal.match.dbSubStyle && ` / ${rejectModal.match.dbSubStyle}`}
              </span>
            </button>

            {/* Option 2: Override with a different style */}
            <div className="space-y-2">
              <span className="block text-sm font-medium">Det ar en annan stil:</span>
              <select
                value={overrideStyle}
                onChange={(e) => setOverrideStyle(e.target.value)}
                className="w-full rounded-md border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-accent))] focus:outline-none"
              >
                <option value="">Valj stil...</option>
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
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setRejectModal(null)}>
                  Avbryt
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!overrideStyle || rejecting}
                  onClick={handleRejectWithOverride}
                >
                  {rejecting ? 'Sparar...' : `Avvisa och satt ${overrideStyle || '...'}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
