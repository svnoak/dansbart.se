import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminTrackDto } from '@/api/models/adminTrackDto';
import type { AdminTrackPageResponse } from '@/api/models/adminTrackPageResponse';
import type { StyleNode } from '@/api/models/styleNode';
import type { TrackListDto } from '@/api/models/trackListDto';
import {
  getTracks1,
  reanalyzeTrack,
  reclassifyTrack,
  deleteTrack,
  rejectTrack,
  unflagTrack1,
} from '@/api/generated/admin-tracks/admin-tracks';
import { getStyleTree } from '@/api/generated/styles/styles';
import { apiFetch } from '@/api/http-client';
import { DataTable } from '@/admin/components/DataTable';
import type { Column, SortState } from '@/admin/components/DataTable';
import { StatusBadge } from '@/admin/components/StatusBadge';
import { ConfidenceBadge } from '@/admin/components/ConfidenceBadge';
import { ActionMenu } from '@/admin/components/ActionMenu';
import type { ActionItem } from '@/admin/components/ActionMenu';
import { Pagination } from '@/admin/components/Pagination';
import { Modal } from '@/admin/components/Modal';
import { TextInput } from '@/admin/components/forms/TextInput';
import { Select } from '@/admin/components/forms/Select';
import { FormField } from '@/admin/components/forms/FormField';
import { Badge, Button, Card, IconButton, InlineError, LoadError, Pill } from '@/ui';
import { StylePill } from '@/components/TrackRow/StylePill';
import { stylePillState } from '@/components/TrackRow/stylePillState';
import { toast } from '@/admin/components/toastEmitter';
import { formatDurationMs } from '@/utils/formatDuration';
import { usePlayer } from '@/player/usePlayer';
import { PlayIcon, PauseIcon, FlagIcon } from '@/icons';

type StatusCounts = Record<string, number>;

const STATUS_ORDER = ['PENDING', 'PROCESSING', 'REANALYZING', 'DONE', 'FAILED'] as const;

const STATUS_LABEL: Record<(typeof STATUS_ORDER)[number], string> = {
  PENDING: 'Väntar',
  PROCESSING: 'Bearbetas',
  REANALYZING: 'Omanalyseras',
  DONE: 'Klar',
  FAILED: 'Misslyckad',
};

const TEMPO_LABEL: Record<string, string> = {
  Slow: 'Långsamt',
  SlowMed: 'Lugnt',
  Medium: 'Lagom',
  Fast: 'Snabbt',
  Turbo: 'Väldigt snabbt',
};

const fieldClass = 'min-h-11 border-[rgb(var(--color-border-strong))] text-[15px]';

async function fetchStatusCounts(): Promise<StatusCounts> {
  const res = await apiFetch('/api/admin/tracks/status-counts');
  if (!res.ok) throw new Error('Failed to fetch status counts');
  return res.json();
}

export function AdminLibraryPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? '';
  const flagged = params.get('flagged');
  const limit = parseInt(params.get('limit') ?? '50', 10);
  const offset = parseInt(params.get('offset') ?? '0', 10);

  const [data, setData] = useState<AdminTrackPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({});

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOp, setBulkOp] = useState<{
    label: string;
    done: number;
    total: number;
  } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [deleteModal, setDeleteModal] = useState<AdminTrackDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<AdminTrackDto | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [bulkRejectModal, setBulkRejectModal] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);

  // Style edit state
  const [styleEditTrack, setStyleEditTrack] = useState<AdminTrackDto | null>(null);
  const [styleEditMain, setStyleEditMain] = useState('');
  const [styleEditSub, setStyleEditSub] = useState('');
  const [styleEditTempo, setStyleEditTempo] = useState('');
  const [styleEditError, setStyleEditError] = useState<string | null>(null);
  const [styleTree, setStyleTree] = useState<Record<string, string[]>>({});

  // Sorting (persisted in URL params)
  const sortBy = params.get('sortBy') ?? '';
  const sortDirection = params.get('sortDirection') ?? '';
  const sort: SortState | null = sortBy
    ? { key: sortBy, direction: (sortDirection || 'asc') as 'asc' | 'desc' }
    : null;

  const handleSortChange = (next: SortState | null) => {
    const p = new URLSearchParams(params);
    if (next) {
      p.set('sortBy', next.key);
      p.set('sortDirection', next.direction);
    } else {
      p.delete('sortBy');
      p.delete('sortDirection');
    }
    p.set('offset', '0');
    setParams(p, { replace: true });
  };

  // Player
  const player = usePlayer();

  const loadStatusCounts = useCallback(async () => {
    try {
      setStatusCounts(await fetchStatusCounts());
    } catch {
      // silent - counts are supplementary
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTracks1(
        {
          search: search || undefined,
          status: status || undefined,
          flagged: flagged === 'true' ? true : flagged === 'false' ? false : undefined,
          limit,
          offset,
          sortBy: sortBy || undefined,
          sortDirection: sortDirection || undefined,
        } as Record<string, unknown>,
      );
      setData(result);
      setLoadError(null);
    } catch {
      setLoadError('Kunde inte hämta spår');
    } finally {
      setLoading(false);
    }
  }, [search, status, flagged, limit, offset, sortBy, sortDirection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    loadStatusCounts();
  }, [loadStatusCounts]);

  // Load style tree for the edit modal
  useEffect(() => {
    getStyleTree().then((nodes: StyleNode[]) => {
      const tree: Record<string, string[]> = {};
      for (const node of nodes) {
        if (node.name) tree[node.name] = node.subStyles ?? [];
      }
      setStyleTree(tree);
    }).catch(() => {});
  }, []);

  // --- Play track ---
  const handlePlay = (track: AdminTrackDto) => {
    const asTrackList: TrackListDto = {
      id: track.id,
      title: track.title,
      durationMs: track.durationMs,
      danceStyle: track.danceStyle,
      subStyle: track.subStyle,
      tempoCategory: track.tempoCategory,
      confidence: track.confidence,
      hasVocals: track.hasVocals,
      artistName: track.artists?.[0]?.name,
      playbackLinks: track.playbackLinks,
    };
    if (player.currentTrack?.id === track.id && player.isPlaying) {
      player.togglePlayPause();
    } else {
      player.play(asTrackList);
    }
  };

  // --- Style edit ---
  const openStyleEdit = (track: AdminTrackDto) => {
    setStyleEditTrack(track);
    setStyleEditMain(track.danceStyle ?? '');
    setStyleEditSub(track.subStyle ?? '');
    setStyleEditTempo(track.tempoCategory ?? '');
    setStyleEditError(null);
  };

  const handleStyleEditSave = async () => {
    if (!styleEditTrack?.id || !styleEditMain) return;
    setStyleEditError(null);
    try {
      await apiFetch(`/api/admin/tracks/${styleEditTrack.id}/dance-style`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          danceStyle: styleEditMain,
          subStyle: styleEditSub || null,
          tempoCategory: styleEditTempo || null,
        }),
      });
      toast('Dansstil uppdaterad');
      setStyleEditTrack(null);
      fetchData();
    } catch {
      setStyleEditError('Kunde inte uppdatera dansstil');
    }
  };

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'offset') next.set('offset', '0');
    setParams(next, { replace: true });
  };

  // --- Single-track actions ---

  const handleReanalyze = async (track: AdminTrackDto) => {
    try {
      await reanalyzeTrack(track.id!);
      toast('Omanalys startad');
      fetchData();
      loadStatusCounts();
    } catch {
      toast('Omanalys misslyckades', 'error');
    }
  };

  const handleReclassify = async (track: AdminTrackDto) => {
    try {
      await reclassifyTrack(track.id!);
      toast('Omklassificering startad');
      fetchData();
      loadStatusCounts();
    } catch {
      toast('Omklassificering misslyckades', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleteError(null);
    try {
      await deleteTrack(deleteModal.id!);
      toast('Spår raderat');
      setDeleteModal(null);
      fetchData();
      loadStatusCounts();
    } catch {
      setDeleteError('Kunde inte radera spår');
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setRejectError(null);
    try {
      await rejectTrack(
        rejectModal.id!,
        { reason: rejectReason || undefined },
      );
      toast('Spår raderat & blockerat');
      setRejectModal(null);
      setRejectReason('');
      fetchData();
      loadStatusCounts();
    } catch {
      setRejectError('Kunde inte avvisa spår');
    }
  };

  const handleUnflag = async (track: AdminTrackDto) => {
    try {
      await unflagTrack1(track.id!);
      toast('Flagga borttagen');
      fetchData();
    } catch {
      toast('Kunde inte ta bort flagga', 'error');
    }
  };

  // --- Bulk actions ---

  const runBulkAction = async (
    label: string,
    action: (id: string) => Promise<unknown>,
  ) => {
    const ids = Array.from(selectedIds);
    setBulkError(null);
    setBulkOp({ label, done: 0, total: ids.length });
    const failedIds = new Set<string>();
    for (let i = 0; i < ids.length; i++) {
      try {
        await action(ids[i]);
      } catch {
        failedIds.add(ids[i]);
      }
      setBulkOp({ label, done: i + 1, total: ids.length });
    }
    setBulkOp(null);
    fetchData();
    loadStatusCounts();
    if (failedIds.size > 0) {
      setSelectedIds(failedIds);
      setBulkError(`${label}: ${failedIds.size} av ${ids.length} misslyckades`);
    } else {
      setSelectedIds(new Set());
      toast(`${label}: ${ids.length} klara`);
    }
  };

  const handleBulkReanalyze = () => {
    runBulkAction('Omanalysera', (id) =>
      reanalyzeTrack(id),
    );
  };

  const handleBulkReclassify = () => {
    runBulkAction('Omklassificera', (id) =>
      reclassifyTrack(id),
    );
  };

  const handleBulkReject = () => {
    setBulkRejectModal(false);
    setBulkRejectReason('');
    runBulkAction('Radera & blockera', (id) =>
      rejectTrack(id, { reason: bulkRejectReason || undefined }),
    );
  };

  const handleBulkDelete = () => {
    setBulkDeleteModal(false);
    runBulkAction('Radera', (id) =>
      deleteTrack(id),
    );
  };

  const actionsFor = (track: AdminTrackDto): ActionItem[] => {
    const items: ActionItem[] = [
      { label: 'Omanalysera', onClick: () => handleReanalyze(track) },
      { label: 'Omklassificera', onClick: () => handleReclassify(track) },
    ];
    if (track.isFlagged) {
      items.push({ label: 'Ta bort flagga', onClick: () => handleUnflag(track) });
    }
    items.push(
      { label: 'Radera & blockera', onClick: () => { setRejectModal(track); setRejectError(null); }, variant: 'danger' },
      { label: 'Radera', onClick: () => { setDeleteModal(track); setDeleteError(null); }, variant: 'danger' },
    );
    return items;
  };

  const columns: Column<AdminTrackDto>[] = [
    {
      key: 'play',
      header: '',
      render: (t) => {
        const isCurrent = player.currentTrack?.id === t.id;
        const isPlaying = isCurrent && player.isPlaying;
        return (
          <IconButton
            onClick={(e) => { e.stopPropagation(); handlePlay(t); }}
            aria-label={isPlaying ? `Pausa ${t.title ?? 'spåret'}` : `Spela ${t.title ?? 'spåret'}`}
            className={isCurrent ? 'text-[rgb(var(--color-now-playing-text))]' : 'text-[rgb(var(--color-text-muted))]'}
          >
            {isPlaying ? (
              <PauseIcon className="h-5 w-5" aria-hidden />
            ) : (
              <PlayIcon className="ml-0.5 h-5 w-5" aria-hidden />
            )}
          </IconButton>
        );
      },
      className: 'w-14',
    },
    {
      key: 'title',
      header: 'Titel',
      sortKey: 'title',
      render: (t) => (
        <div className="min-w-45">
          <p className="max-w-65 truncate text-[15px] font-semibold text-[rgb(var(--color-text))]">
            {t.title}
          </p>
          <p className="max-w-65 truncate text-[13px] text-[rgb(var(--color-text-muted))]">
            {t.artists?.map((a) => a.name).join(', ') || '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'album',
      header: 'Album',
      render: (t) => (
        <span className="block max-w-40 truncate text-[13px] text-[rgb(var(--color-text-muted))]">
          {t.album?.title || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      render: (t) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={t.processingStatus} />
          {t.isFlagged && (
            <Badge variant="muted" className="gap-1">
              <span title={t.flagReason ?? 'Flaggad'} className="inline-flex items-center gap-1">
                <FlagIcon className="h-3.5 w-3.5 text-[rgb(var(--color-error))]" aria-hidden />
                Flaggad
              </span>
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'style',
      header: 'Dansstil',
      render: (t) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openStyleEdit(t); }}
          className="group flex min-h-11 flex-col items-start justify-center gap-0.5 rounded-[var(--radius)] px-1 text-left hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
          aria-label={`Redigera dansstil för ${t.title ?? 'spåret'}`}
          title="Redigera dansstil"
        >
          <StylePill style={t.danceStyle} state={stylePillState(t.danceStyle, t.confidence)} />
          {(t.subStyle || t.tempoCategory) && (
            <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
              {[t.subStyle, t.tempoCategory ? TEMPO_LABEL[t.tempoCategory] ?? t.tempoCategory : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </button>
      ),
    },
    {
      key: 'confidence',
      header: 'Konfidens',
      sortKey: 'confidence',
      render: (t) => <ConfidenceBadge value={t.confidence} />,
    },
    {
      key: 'bpm',
      header: 'BPM',
      sortKey: 'tempoBpm',
      render: (t) => (
        <span className="text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">
          {t.tempoBpm ? Math.round(t.tempoBpm) : '-'}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Längd',
      sortKey: 'durationMs',
      render: (t) => (
        <span className="text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">
          {t.durationMs ? formatDurationMs(t.durationMs) : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (t) => <ActionMenu actions={actionsFor(t)} />,
      className: 'w-10',
    },
  ];

  const tracks = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalTracks = STATUS_ORDER.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Bibliotek
        </h1>
        <p className="mt-1 text-[15px] text-[rgb(var(--color-text-muted))]">
          Alla spår i biblioteket. Filtrera på status, sök och markera flera spår för att analysera om eller radera dem.
        </p>
      </header>

      {/* Status counts */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrera på status">
        <Pill active={!status} aria-pressed={!status} onClick={() => updateParam('status', '')}>
          Alla <span className="tabular-nums">{totalTracks.toLocaleString('sv-SE')}</span>
        </Pill>
        {STATUS_ORDER.map((s) => {
          const count = statusCounts[s] ?? 0;
          const isActive = status === s;
          return (
            <Pill
              key={s}
              active={isActive}
              aria-pressed={isActive}
              onClick={() => updateParam('status', isActive ? '' : s)}
            >
              {STATUS_LABEL[s]} <span className="tabular-nums">{count.toLocaleString('sv-SE')}</span>
            </Pill>
          );
        })}
      </div>

      <Card className="flex flex-wrap items-end gap-3 px-4 py-3">
        <div className="min-w-50 flex-1">
          <label htmlFor="library-search" className="sr-only">
            Sök titel eller artist
          </label>
          <TextInput
            id="library-search"
            type="search"
            placeholder="Sök titel, artist…"
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="min-w-40">
          <label htmlFor="library-status" className="mb-1.5 block text-[13px] font-medium text-[rgb(var(--color-text))]">
            Status
          </label>
          <Select
            id="library-status"
            value={status}
            onChange={(e) => updateParam('status', e.target.value)}
            className={fieldClass}
          >
            <option value="">Alla statusar</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-36">
          <label htmlFor="library-flagged" className="mb-1.5 block text-[13px] font-medium text-[rgb(var(--color-text))]">
            Flaggning
          </label>
          <Select
            id="library-flagged"
            value={flagged ?? ''}
            onChange={(e) => updateParam('flagged', e.target.value)}
            className={fieldClass}
          >
            <option value="">Alla</option>
            <option value="true">Flaggade</option>
            <option value="false">Oflaggade</option>
          </Select>
        </div>
      </Card>

      {/* Bulk action bar */}
      {hasSelection && !bulkOp && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2.5">
          <span className="text-[15px] font-semibold text-[rgb(var(--color-text))]">
            {selectedIds.size} valda
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleBulkReanalyze}>
              Omanalysera
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkReclassify}>
              Omklassificera
            </Button>
            <Button variant="danger" size="sm" onClick={() => setBulkRejectModal(true)}>
              Radera & blockera
            </Button>
            <Button variant="danger" size="sm" onClick={() => setBulkDeleteModal(true)}>
              Radera
            </Button>
          </div>
          {bulkError && <InlineError>{bulkError}</InlineError>}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedIds(new Set())}>
            Avmarkera alla
          </Button>
        </div>
      )}

      {/* Bulk operation progress */}
      {bulkOp && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2.5"
        >
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-[rgb(var(--color-text-muted))] border-t-transparent"
            aria-hidden
          />
          <span className="text-[15px] text-[rgb(var(--color-text))]">
            {bulkOp.label}: {bulkOp.done} av {bulkOp.total} klara…
          </span>
        </div>
      )}

      {loadError && <LoadError message={loadError} onRetry={fetchData} />}

      {!loadError && (
        <DataTable
          columns={columns}
          data={tracks}
          keyFn={(t) => t.id!}
          loading={loading}
          emptyMessage="Inga spår hittades. Prova att ändra filter."
          selectable
          selectedKeys={selectedIds}
          onSelectionChange={(keys) => {
            setSelectedIds(keys);
            setBulkError(null);
          }}
          sort={sort}
          onSortChange={handleSortChange}
        />
      )}

      {total > 0 && (
        <Pagination
          offset={offset}
          limit={limit}
          total={total}
          onChange={(newOffset) => updateParam('offset', String(newOffset))}
        />
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteModal}
        onClose={() => { setDeleteModal(null); setDeleteError(null); }}
        title="Radera spår"
      >
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Vill du verkligen radera{' '}
          <strong>{deleteModal?.title}</strong>? Det går inte att ångra.
        </p>
        <div className="mt-5 space-y-3">
          {deleteError && <InlineError>{deleteError}</InlineError>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setDeleteModal(null); setDeleteError(null); }}>
              Avbryt
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Radera
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject confirmation modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(''); setRejectError(null); }}
        title="Radera & blockera spår"
      >
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Radera <strong>{rejectModal?.title}</strong> och lägg till det på blocklistan?
        </p>
        <div className="mt-4">
          <FormField label="Orsak (valfritt)" htmlFor="reject-reason">
            <TextInput
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => { setRejectReason(e.target.value); setRejectError(null); }}
              className={fieldClass}
            />
          </FormField>
        </div>
        <div className="mt-5 space-y-3">
          {rejectError && <InlineError>{rejectError}</InlineError>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectModal(null); setRejectReason(''); setRejectError(null); }}>
              Avbryt
            </Button>
            <Button variant="danger" onClick={handleReject}>
              Radera & blockera
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk reject modal */}
      <Modal
        open={bulkRejectModal}
        onClose={() => { setBulkRejectModal(false); setBulkRejectReason(''); }}
        title="Radera & blockera spår"
      >
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Radera {selectedIds.size} valda spår och lägg till dem på blocklistan?
        </p>
        <div className="mt-4">
          <FormField label="Orsak (valfritt)" htmlFor="bulk-reject-reason">
            <TextInput
              id="bulk-reject-reason"
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              className={fieldClass}
            />
          </FormField>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setBulkRejectModal(false); setBulkRejectReason(''); }}>
            Avbryt
          </Button>
          <Button variant="danger" onClick={handleBulkReject}>
            Radera & blockera ({selectedIds.size})
          </Button>
        </div>
      </Modal>

      {/* Bulk delete modal */}
      <Modal
        open={bulkDeleteModal}
        onClose={() => setBulkDeleteModal(false)}
        title="Radera spår"
      >
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Vill du verkligen radera {selectedIds.size} valda spår? Det går inte att ångra.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setBulkDeleteModal(false)}>
            Avbryt
          </Button>
          <Button variant="danger" onClick={handleBulkDelete}>
            Radera {selectedIds.size} spår
          </Button>
        </div>
      </Modal>

      {/* Style edit modal */}
      <Modal
        open={!!styleEditTrack}
        onClose={() => { setStyleEditTrack(null); setStyleEditError(null); }}
        title="Redigera dansstil"
      >
        <div className="mb-4">
          <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">{styleEditTrack?.title}</p>
          {styleEditTrack?.artists?.[0]?.name && (
            <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
              {styleEditTrack.artists[0].name}
            </p>
          )}
        </div>
        <div className="space-y-4">
          <FormField label="Huvudstil" htmlFor="style-edit-main">
            <Select
              id="style-edit-main"
              value={styleEditMain}
              onChange={(e) => {
                setStyleEditMain(e.target.value);
                setStyleEditSub('');
              }}
              className={fieldClass}
            >
              <option value="">Välj stil…</option>
              {Object.keys(styleTree).sort().map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </FormField>
          {styleEditMain && (styleTree[styleEditMain]?.length ?? 0) > 0 && (
            <FormField label="Understil" htmlFor="style-edit-sub">
              <Select
                id="style-edit-sub"
                value={styleEditSub}
                onChange={(e) => setStyleEditSub(e.target.value)}
                className={fieldClass}
              >
                <option value="">Ingen / allmän {styleEditMain}</option>
                {styleTree[styleEditMain]?.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Tempo" htmlFor="style-edit-tempo">
            <Select
              id="style-edit-tempo"
              value={styleEditTempo}
              onChange={(e) => setStyleEditTempo(e.target.value)}
              className={fieldClass}
            >
              <option value="">Inget valt</option>
              <option value="Slow">Långsamt</option>
              <option value="SlowMed">Lugnt</option>
              <option value="Medium">Lagom</option>
              <option value="Fast">Snabbt</option>
              <option value="Turbo">Väldigt snabbt</option>
            </Select>
          </FormField>
        </div>
        <div className="mt-5 space-y-3">
          {styleEditError && <InlineError>{styleEditError}</InlineError>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setStyleEditTrack(null); setStyleEditError(null); }}>
              Avbryt
            </Button>
            <Button
              variant="primary"
              onClick={handleStyleEditSave}
              disabled={!styleEditMain}
            >
              Spara
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
