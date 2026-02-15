import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminTrackDto } from '@/api/models/adminTrackDto';
import type { AdminTrackPageResponse } from '@/api/models/adminTrackPageResponse';
import {
  getTracks1,
  reanalyzeTrack,
  reclassifyTrack,
  deleteTrack,
  rejectTrack,
  unflagTrack1,
} from '@/api/generated/admin-tracks/admin-tracks';
import { adminRequestOptions } from '@/admin/api/client';
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

export function AdminLibraryPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? '';
  const flagged = params.get('flagged');
  const limit = parseInt(params.get('limit') ?? '50', 10);
  const offset = parseInt(params.get('offset') ?? '0', 10);

  const [data, setData] = useState<AdminTrackPageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [deleteModal, setDeleteModal] = useState<AdminTrackDto | null>(null);
  const [rejectModal, setRejectModal] = useState<AdminTrackDto | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

  const handleReanalyze = async (track: AdminTrackDto) => {
    try {
      await reanalyzeTrack(track.id!, adminRequestOptions());
      toast('Omanalys startad');
      fetchData();
    } catch {
      toast('Omanalys misslyckades', 'error');
    }
  };

  const handleReclassify = async (track: AdminTrackDto) => {
    try {
      await reclassifyTrack(track.id!, adminRequestOptions());
      toast('Omklassificering startad');
      fetchData();
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
        <div>
          <span className="text-xs text-[rgb(var(--color-text))]">
            {t.danceStyle ?? '-'}
          </span>
          {t.subStyle && (
            <span className="text-xs text-[rgb(var(--color-text-muted))]">
              {' '}/ {t.subStyle}
            </span>
          )}
        </div>
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Bibliotek</h1>

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

      <DataTable
        columns={columns}
        data={tracks}
        keyFn={(t) => t.id!}
        loading={loading}
        emptyMessage="Inga spår hittades. Prova att ändra filter."
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
    </div>
  );
}
