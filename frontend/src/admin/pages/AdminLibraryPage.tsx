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
import { adminFetch, adminRequestOptions } from '@/admin/api/client';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { StatusBadge } from '@/admin/components/StatusBadge';
import { ConfidenceBadge } from '@/admin/components/ConfidenceBadge';
import { ActionMenu } from '@/admin/components/ActionMenu';
import type { ActionItem } from '@/admin/components/ActionMenu';
import { FilterBar } from '@/admin/components/FilterBar';
import { Pagination } from '@/admin/components/Pagination';
import { Modal } from '@/admin/components/Modal';
import { TextInput } from '@/admin/components/forms/TextInput';
import { Select } from '@/admin/components/forms/Select';
import { Button } from '@/ui';
import { toast } from '@/admin/components/toastEmitter';
import { formatDurationMs } from '@/utils/formatDuration';
import { usePlayer } from '@/player/usePlayer';
import { PlayIcon, PauseIcon } from '@/icons';

type StatusCounts = Record<string, number>;

const STATUS_ORDER = ['PENDING', 'PROCESSING', 'REANALYZING', 'DONE', 'FAILED'] as const;

async function fetchStatusCounts(): Promise<StatusCounts> {
  const res = await adminFetch('/api/admin/tracks/status-counts');
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
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({});

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOp, setBulkOp] = useState<{
    label: string;
    done: number;
    total: number;
  } | null>(null);

  const [deleteModal, setDeleteModal] = useState<AdminTrackDto | null>(null);
  const [rejectModal, setRejectModal] = useState<AdminTrackDto | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [bulkRejectModal, setBulkRejectModal] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);

  // Style edit state
  const [styleEditTrack, setStyleEditTrack] = useState<AdminTrackDto | null>(null);
  const [styleEditMain, setStyleEditMain] = useState('');
  const [styleEditSub, setStyleEditSub] = useState('');
  const [styleEditTempo, setStyleEditTempo] = useState('');
  const [styleTree, setStyleTree] = useState<Record<string, string[]>>({});

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
        },
        adminRequestOptions(),
      );
      setData(result);
    } catch {
      toast('Kunde inte hämta spår', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, status, flagged, limit, offset]);

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
  };

  const handleStyleEditSave = async () => {
    if (!styleEditTrack?.id || !styleEditMain) return;
    try {
      await adminFetch(`/api/admin/tracks/${styleEditTrack.id}/dance-style`, {
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
      toast('Kunde inte uppdatera dansstil', 'error');
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
      await reanalyzeTrack(track.id!, adminRequestOptions());
      toast('Omanalys startad');
      fetchData();
      loadStatusCounts();
    } catch {
      toast('Omanalys misslyckades', 'error');
    }
  };

  const handleReclassify = async (track: AdminTrackDto) => {
    try {
      await reclassifyTrack(track.id!, adminRequestOptions());
      toast('Omklassificering startad');
      fetchData();
      loadStatusCounts();
    } catch {
      toast('Omklassificering misslyckades', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await deleteTrack(deleteModal.id!, adminRequestOptions());
      toast('Spår raderat');
      setDeleteModal(null);
      fetchData();
      loadStatusCounts();
    } catch {
      toast('Kunde inte radera spår', 'error');
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      await rejectTrack(
        rejectModal.id!,
        { reason: rejectReason || undefined },
        adminRequestOptions(),
      );
      toast('Spår avvisat');
      setRejectModal(null);
      setRejectReason('');
      fetchData();
      loadStatusCounts();
    } catch {
      toast('Kunde inte avvisa spår', 'error');
    }
  };

  const handleUnflag = async (track: AdminTrackDto) => {
    try {
      await unflagTrack1(track.id!, adminRequestOptions());
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
    setBulkOp({ label, done: 0, total: ids.length });
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      try {
        await action(ids[i]);
      } catch {
        failed++;
      }
      setBulkOp({ label, done: i + 1, total: ids.length });
    }
    setBulkOp(null);
    setSelectedIds(new Set());
    fetchData();
    loadStatusCounts();
    if (failed > 0) {
      toast(`${label}: ${failed} av ${ids.length} misslyckades`, 'error');
    } else {
      toast(`${label}: ${ids.length} klara`);
    }
  };

  const handleBulkReanalyze = () => {
    runBulkAction('Omanalysera', (id) =>
      reanalyzeTrack(id, adminRequestOptions()),
    );
  };

  const handleBulkReclassify = () => {
    runBulkAction('Omklassificera', (id) =>
      reclassifyTrack(id, adminRequestOptions()),
    );
  };

  const handleBulkReject = () => {
    setBulkRejectModal(false);
    setBulkRejectReason('');
    runBulkAction('Avvisa', (id) =>
      rejectTrack(id, { reason: bulkRejectReason || undefined }, adminRequestOptions()),
    );
  };

  const handleBulkDelete = () => {
    setBulkDeleteModal(false);
    runBulkAction('Radera', (id) =>
      deleteTrack(id, adminRequestOptions()),
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
      { label: 'Avvisa', onClick: () => setRejectModal(track), variant: 'danger' },
      { label: 'Radera', onClick: () => setDeleteModal(track), variant: 'danger' },
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
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handlePlay(t); }}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[rgb(var(--color-border))]/50 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
            aria-label={isPlaying ? 'Pausa' : 'Spela'}
          >
            {isPlaying ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4 ml-0.5" />
            )}
          </button>
        );
      },
      className: 'w-10',
    },
    {
      key: 'title',
      header: 'Titel',
      render: (t) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-[rgb(var(--color-text))] truncate max-w-[260px]">
            {t.title}
          </p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] truncate max-w-[260px]">
            {t.artists?.map((a) => a.name).join(', ') || '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'album',
      header: 'Album',
      render: (t) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))] truncate max-w-[160px] block">
          {t.album?.title || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={t.processingStatus} />
          {t.isFlagged && (
            <span
              className="text-orange-500"
              title={t.flagReason ?? 'Flaggad'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M3.5 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0v-4.392l1.657-.348a6.449 6.449 0 014.271.572 7.948 7.948 0 005.965.524l2.078-.64A.75.75 0 0018 11.75V3.24a.75.75 0 00-.994-.708 6.948 6.948 0 01-5.152-.174 7.949 7.949 0 00-5.57-.71L3.5 2.26V2.75z" />
              </svg>
            </span>
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
          className="text-left group cursor-pointer"
          title="Klicka for att redigera"
        >
          <span className="text-xs text-[rgb(var(--color-text))] group-hover:underline">
            {t.danceStyle ?? '-'}
          </span>
          {t.subStyle && (
            <span className="text-xs text-[rgb(var(--color-text-muted))]">
              {' '}/ {t.subStyle}
            </span>
          )}
          {t.tempoCategory && (
            <span className="text-xs text-[rgb(var(--color-text-muted))] block">
              {t.tempoCategory}
            </span>
          )}
        </button>
      ),
    },
    {
      key: 'confidence',
      header: 'Konf.',
      render: (t) => <ConfidenceBadge value={t.confidence} />,
    },
    {
      key: 'bpm',
      header: 'BPM',
      render: (t) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">
          {t.tempoBpm ? Math.round(t.tempoBpm) : '-'}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Längd',
      render: (t) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">
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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Bibliotek</h1>

      {/* Status counts bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => updateParam('status', '')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !status
              ? 'bg-[rgb(var(--color-text))]/10 text-[rgb(var(--color-text))] ring-1 ring-[rgb(var(--color-text))]/20'
              : 'bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50'
          }`}
        >
          Alla
          <span className="tabular-nums">{totalTracks}</span>
        </button>
        {STATUS_ORDER.map((s) => {
          const count = statusCounts[s] ?? 0;
          const isActive = status === s;
          return (
            <button
              key={s}
              onClick={() => updateParam('status', isActive ? '' : s)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'ring-1 ring-current'
                  : 'opacity-80 hover:opacity-100'
              } ${statusStyle(s)}`}
            >
              {s}
              <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      <FilterBar>
        <div className="flex-1 min-w-[200px]">
          <TextInput
            type="search"
            placeholder="Sök titel, artist..."
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
          />
        </div>
        <Select
          value={status}
          onChange={(e) => updateParam('status', e.target.value)}
          className="w-auto min-w-[140px]"
        >
          <option value="">Alla statusar</option>
          <option value="PENDING">PENDING</option>
          <option value="PROCESSING">PROCESSING</option>
          <option value="REANALYZING">REANALYZING</option>
          <option value="DONE">DONE</option>
          <option value="FAILED">FAILED</option>
        </Select>
        <Select
          value={flagged ?? ''}
          onChange={(e) => updateParam('flagged', e.target.value)}
          className="w-auto min-w-[120px]"
        >
          <option value="">Alla</option>
          <option value="true">Flaggade</option>
          <option value="false">Oflaggade</option>
        </Select>
      </FilterBar>

      {/* Bulk action bar */}
      {hasSelection && !bulkOp && (
        <div className="sticky top-0 z-10 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium text-[rgb(var(--color-text))]">
            {selectedIds.size} markerade
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleBulkReanalyze}>
              Omanalysera
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBulkReclassify}>
              Omklassificera
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => setBulkRejectModal(true)}
            >
              Avvisa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => setBulkDeleteModal(true)}
            >
              Radera
            </Button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
          >
            Avmarkera alla
          </button>
        </div>
      )}

      {/* Bulk operation progress */}
      {bulkOp && (
        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-2.5">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[rgb(var(--color-text-muted))] border-t-transparent" />
          <span className="text-sm text-[rgb(var(--color-text))]">
            {bulkOp.label}: {bulkOp.done}/{bulkOp.total} klara...
          </span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={tracks}
        keyFn={(t) => t.id!}
        loading={loading}
        emptyMessage="Inga spår hittades. Prova att ändra filter."
        selectable
        selectedKeys={selectedIds}
        onSelectionChange={setSelectedIds}
      />

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
        onClose={() => setDeleteModal(null)}
        title="Radera spår"
      >
        <p className="text-sm text-[rgb(var(--color-text))]">
          Vill du verkligen radera{' '}
          <strong>{deleteModal?.title}</strong>? Denna åtgärd kan inte ångras.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteModal(null)}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            className="bg-red-600 hover:bg-red-700"
            onClick={handleDelete}
          >
            Radera
          </Button>
        </div>
      </Modal>

      {/* Reject confirmation modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(''); }}
        title="Avvisa spår"
      >
        <p className="text-sm text-[rgb(var(--color-text))]">
          Avvisa <strong>{rejectModal?.title}</strong> och lägg till på blocklistan?
        </p>
        <div className="mt-3">
          <TextInput
            placeholder="Orsak (valfritt)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { setRejectModal(null); setRejectReason(''); }}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            className="bg-red-600 hover:bg-red-700"
            onClick={handleReject}
          >
            Avvisa
          </Button>
        </div>
      </Modal>

      {/* Bulk reject modal */}
      <Modal
        open={bulkRejectModal}
        onClose={() => { setBulkRejectModal(false); setBulkRejectReason(''); }}
        title="Avvisa spår"
      >
        <p className="text-sm text-[rgb(var(--color-text))]">
          Avvisa {selectedIds.size} markerade spår och lägg till på blocklistan?
        </p>
        <div className="mt-3">
          <TextInput
            placeholder="Orsak (valfritt)"
            value={bulkRejectReason}
            onChange={(e) => setBulkRejectReason(e.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { setBulkRejectModal(false); setBulkRejectReason(''); }}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            className="bg-red-600 hover:bg-red-700"
            onClick={handleBulkReject}
          >
            Avvisa {selectedIds.size} spår
          </Button>
        </div>
      </Modal>

      {/* Bulk delete modal */}
      <Modal
        open={bulkDeleteModal}
        onClose={() => setBulkDeleteModal(false)}
        title="Radera spår"
      >
        <p className="text-sm text-[rgb(var(--color-text))]">
          Vill du verkligen radera {selectedIds.size} markerade spår? Denna åtgärd kan inte ångras.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setBulkDeleteModal(false)}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            className="bg-red-600 hover:bg-red-700"
            onClick={handleBulkDelete}
          >
            Radera {selectedIds.size} spår
          </Button>
        </div>
      </Modal>

      {/* Style edit modal */}
      <Modal
        open={!!styleEditTrack}
        onClose={() => setStyleEditTrack(null)}
        title="Redigera dansstil"
      >
        <p className="text-sm text-[rgb(var(--color-text))] mb-4">
          <strong>{styleEditTrack?.title}</strong>
          {styleEditTrack?.artists?.[0]?.name && (
            <span className="text-[rgb(var(--color-text-muted))]">
              {' '}- {styleEditTrack.artists[0].name}
            </span>
          )}
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
              Huvudstil
            </label>
            <Select
              value={styleEditMain}
              onChange={(e) => {
                setStyleEditMain(e.target.value);
                setStyleEditSub('');
              }}
            >
              <option value="">Välj stil...</option>
              {Object.keys(styleTree).sort().map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          {styleEditMain && (styleTree[styleEditMain]?.length ?? 0) > 0 && (
            <div>
              <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
                Understil
              </label>
              <Select
                value={styleEditSub}
                onChange={(e) => setStyleEditSub(e.target.value)}
              >
                <option value="">Ingen / Allman {styleEditMain}</option>
                {styleTree[styleEditMain]?.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1">
              Tempo
            </label>
            <Select
              value={styleEditTempo}
              onChange={(e) => setStyleEditTempo(e.target.value)}
            >
              <option value="">Inget valt</option>
              <option value="Slow">Långsamt</option>
              <option value="SlowMed">Lugnt</option>
              <option value="Medium">Lagom</option>
              <option value="Fast">Snabbt</option>
              <option value="Turbo">Väldigt snabbt</option>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setStyleEditTrack(null)}>
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
      </Modal>
    </div>
  );
}

function statusStyle(s: string): string {
  switch (s) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    case 'REANALYZING':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300';
    case 'DONE':
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300';
  }
}
