import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getAlbums1,
  rejectAlbum,
} from '@/api/generated/admin-albums/admin-albums';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { FilterBar } from '@/admin/components/FilterBar';
import { Pagination } from '@/admin/components/Pagination';
import { Modal } from '@/admin/components/Modal';
import { TextInput } from '@/admin/components/forms/TextInput';
import { Button, InlineError, LoadError, PageHeader } from '@/ui';
import { toast } from '@/admin/components/toastEmitter';

interface AlbumRow {
  id: string;
  name: string;
  artistName?: string;
  trackCount?: number;
  releaseDate?: string;
}

interface AlbumPageData {
  items: AlbumRow[];
  total: number;
}

export function AdminAlbumsPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const artistId = params.get('artistId') ?? '';
  const limit = parseInt(params.get('limit') ?? '50', 10);
  const offset = parseInt(params.get('offset') ?? '0', 10);

  const [data, setData] = useState<AlbumPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<AlbumRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAlbums1(
        {
          search: search || undefined,
          artistId: artistId || undefined,
          limit,
          offset,
        },
      );
      const r = result as unknown as AlbumPageData;
      setData({
        items: Array.isArray(r?.items) ? r.items : [],
        total: r?.total ?? 0,
      });
      setLoadError(null);
    } catch {
      setLoadError('Kunde inte hämta album');
    } finally {
      setLoading(false);
    }
  }, [search, artistId, limit, offset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'offset') next.set('offset', '0');
    setParams(next, { replace: true });
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setRejectError(null);
    try {
      await rejectAlbum(
        rejectModal.id,
        { reason: rejectReason || undefined },
      );
      toast('Album raderat & blockerat');
      setRejectModal(null);
      setRejectReason('');
      fetchData();
    } catch {
      setRejectError('Kunde inte avvisa album');
    }
  };

  const columns: Column<AlbumRow>[] = [
    {
      key: 'name',
      header: 'Album',
      render: (a) => (
        <span className="font-medium text-[rgb(var(--color-text))]">{a.name}</span>
      ),
    },
    {
      key: 'artist',
      header: 'Artist',
      render: (a) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">{a.artistName ?? '-'}</span>
      ),
    },
    {
      key: 'trackCount',
      header: 'Spår',
      render: (a) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">{a.trackCount ?? '-'}</span>
      ),
    },
    {
      key: 'release',
      header: 'Utgivning',
      render: (a) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">{a.releaseDate ?? '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <button
          type="button"
          onClick={() => { setRejectModal(a); setRejectError(null); }}
          className="min-h-9 px-2 py-1 text-sm font-medium text-[rgb(var(--color-error))] hover:underline"
        >
          Radera & blockera
        </button>
      ),
      className: 'w-20',
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Album" />

      <FilterBar>
        <div className="flex-1 min-w-50">
          <TextInput
            type="search"
            placeholder="Sök album..."
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
          />
        </div>
      </FilterBar>

      {loadError && <LoadError message={loadError} onRetry={fetchData} />}

      {!loadError && (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyFn={(a) => a.id}
          loading={loading}
          emptyMessage="Inga album hittades."
        />
      )}

      {(data?.total ?? 0) > 0 && (
        <Pagination
          offset={offset}
          limit={limit}
          total={data!.total}
          onChange={(newOffset) => updateParam('offset', String(newOffset))}
        />
      )}

      <Modal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(''); }}
        title="Radera & blockera album"
      >
        <p className="text-sm text-[rgb(var(--color-text))]">
          Radera <strong>{rejectModal?.name}</strong> och blockera albumet? Väntande spår raderas.
        </p>
        <div className="mt-3">
          <TextInput
            placeholder="Orsak (valfritt)"
            value={rejectReason}
            onChange={(e) => { setRejectReason(e.target.value); setRejectError(null); }}
          />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          {rejectError && <InlineError>{rejectError}</InlineError>}
          <Button variant="ghost" onClick={() => { setRejectModal(null); setRejectReason(''); }}>
            Avbryt
          </Button>
          <Button
            variant="danger"
            onClick={handleReject}
          >
            Radera & blockera
          </Button>
        </div>
      </Modal>
    </div>
  );
}
