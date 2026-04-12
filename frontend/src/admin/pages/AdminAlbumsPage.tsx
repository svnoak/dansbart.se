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
import { Button } from '@/ui';
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
  const [rejectModal, setRejectModal] = useState<AlbumRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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
    } catch {
      toast('Kunde inte hämta album', 'error');
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
    try {
      await rejectAlbum(
        rejectModal.id,
        { reason: rejectReason || undefined },
      );
      toast(`Album avvisat`);
      setRejectModal(null);
      setRejectReason('');
      fetchData();
    } catch {
      toast('Kunde inte avvisa album', 'error');
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
          onClick={() => setRejectModal(a)}
          className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:underline"
        >
          Avvisa
        </button>
      ),
      className: 'w-20',
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Album</h1>

      <FilterBar>
        <div className="flex-1 min-w-[200px]">
          <TextInput
            type="search"
            placeholder="Sök album..."
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
          />
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyFn={(a) => a.id}
        loading={loading}
        emptyMessage="Inga album hittades."
      />

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
        title="Avvisa album"
      >
        <p className="text-sm text-[rgb(var(--color-text))]">
          Avvisa <strong>{rejectModal?.name}</strong> och radera väntande spår?
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
