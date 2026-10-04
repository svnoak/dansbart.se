import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getAlbums1,
  rejectAlbum,
} from '@/api/generated/admin-albums/admin-albums';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { Pagination } from '@/admin/components/Pagination';
import { Modal } from '@/admin/components/Modal';
import { TextInput } from '@/admin/components/forms/TextInput';
import { FormField } from '@/admin/components/forms/FormField';
import { Button, Card, InlineError, LoadError } from '@/ui';
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

const fieldClass = 'min-h-11 border-[rgb(var(--color-border-strong))] text-[15px]';

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
        <div>
          <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">{a.name}</p>
          <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{a.artistName ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'trackCount',
      header: 'Spår',
      render: (a) => (
        <span className="text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">{a.trackCount ?? '-'}</span>
      ),
    },
    {
      key: 'release',
      header: 'Utgivning',
      render: (a) => (
        <span className="text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">{a.releaseDate ?? '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRejectModal(a); setRejectError(null); }}
          >
            Radera & blockera
          </Button>
        </div>
      ),
      className: 'w-44',
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Album
        </h1>
        <p className="mt-1 text-[15px] text-[rgb(var(--color-text-muted))]">
          Alla album i biblioteket. Radera och blockera ett album för att ta bort dess väntande spår.
        </p>
      </header>

      <Card className="flex flex-wrap items-end gap-3 px-4 py-3">
        <div className="min-w-50 flex-1">
          <label htmlFor="albums-search" className="sr-only">
            Sök album
          </label>
          <TextInput
            id="albums-search"
            type="search"
            placeholder="Sök album…"
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
            className={fieldClass}
          />
        </div>
      </Card>

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
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Radera <strong>{rejectModal?.name}</strong> och blockera albumet? Väntande spår raderas.
        </p>
        <div className="mt-4">
          <FormField label="Orsak (valfritt)" htmlFor="album-reject-reason">
            <TextInput
              id="album-reject-reason"
              value={rejectReason}
              onChange={(e) => { setRejectReason(e.target.value); setRejectError(null); }}
              className={fieldClass}
            />
          </FormField>
        </div>
        <div className="mt-5 space-y-3">
          {rejectError && <InlineError>{rejectError}</InlineError>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectModal(null); setRejectReason(''); }}>
              Avbryt
            </Button>
            <Button variant="danger" onClick={handleReject}>
              Radera & blockera
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
