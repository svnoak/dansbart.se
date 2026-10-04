import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getArtists1,
  approveArtist,
  rejectArtist,
} from '@/api/generated/admin-artists/admin-artists';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { Pagination } from '@/admin/components/Pagination';
import { Modal } from '@/admin/components/Modal';
import { ActionMenu } from '@/admin/components/ActionMenu';
import type { ActionItem } from '@/admin/components/ActionMenu';
import { TextInput } from '@/admin/components/forms/TextInput';
import { FormField } from '@/admin/components/forms/FormField';
import { Button, Card, InlineError, LoadError } from '@/ui';
import { toast } from '@/admin/components/toastEmitter';

interface ArtistRow {
  id: string;
  name: string;
  spotifyId?: string;
  trackCount?: number;
  approvedTrackCount?: number;
  pendingTrackCount?: number;
}

interface ArtistPageData {
  items: ArtistRow[];
  total: number;
}

const fieldClass = 'min-h-11 border-[rgb(var(--color-border-strong))] text-[15px]';

export function AdminArtistsPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const limit = parseInt(params.get('limit') ?? '50', 10);
  const offset = parseInt(params.get('offset') ?? '0', 10);

  const [data, setData] = useState<ArtistPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [rejectModal, setRejectModal] = useState<ArtistRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getArtists1(
        { search: search || undefined, limit, offset },
      );
      const r = result as unknown as ArtistPageData;
      setData({
        items: Array.isArray(r?.items) ? r.items : [],
        total: r?.total ?? 0,
      });
      setLoadError(null);
    } catch {
      setLoadError('Kunde inte hämta artister');
    } finally {
      setLoading(false);
    }
  }, [search, limit, offset]);

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

  const handleApprove = async (artist: ArtistRow) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[artist.id];
      return next;
    });
    try {
      await approveArtist(artist.id);
      toast(`${artist.name} godkänd`);
      fetchData();
    } catch {
      setRowErrors((prev) => ({ ...prev, [artist.id]: 'Kunde inte godkänna artist' }));
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setRejectError(null);
    try {
      await rejectArtist(
        rejectModal.id,
        { reason: rejectReason || undefined },
      );
      toast(`${rejectModal.name} raderad & blockerad`);
      setRejectModal(null);
      setRejectReason('');
      fetchData();
    } catch {
      setRejectError('Kunde inte avvisa artist');
    }
  };

  const actionsFor = (artist: ArtistRow): ActionItem[] => [
    { label: 'Godkänn & analysera', onClick: () => handleApprove(artist) },
    {
      label: 'Radera & blockera',
      onClick: () => { setRejectModal(artist); setRejectError(null); },
      variant: 'danger',
    },
  ];

  const count = (value?: number) => (
    <span className="text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">
      {value ?? '-'}
    </span>
  );

  const columns: Column<ArtistRow>[] = [
    {
      key: 'name',
      header: 'Namn',
      render: (a) => (
        <span className="text-[15px] font-semibold text-[rgb(var(--color-text))]">{a.name}</span>
      ),
    },
    {
      key: 'trackCount',
      header: 'Spår',
      render: (a) => count(a.trackCount),
    },
    {
      key: 'approved',
      header: 'Godkända',
      render: (a) => count(a.approvedTrackCount),
    },
    {
      key: 'pending',
      header: 'Väntande',
      render: (a) => (
        <span
          className={`text-[13px] tabular-nums ${
            a.pendingTrackCount
              ? 'font-medium text-[rgb(var(--color-now-playing-text))]'
              : 'text-[rgb(var(--color-text-muted))]'
          }`}
        >
          {a.pendingTrackCount ?? '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <div className="flex flex-col items-end gap-1">
          <ActionMenu actions={actionsFor(a)} />
          {rowErrors[a.id] && <InlineError>{rowErrors[a.id]}</InlineError>}
        </div>
      ),
      className: 'w-10',
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Artister
        </h1>
        <p className="mt-1 text-[15px] text-[rgb(var(--color-text-muted))]">
          Alla artister med antal spår. Godkänn en artist för att analysera dess spår, eller radera och blockera den.
        </p>
      </header>

      <Card className="flex flex-wrap items-end gap-3 px-4 py-3">
        <div className="min-w-50 flex-1">
          <label htmlFor="artists-search" className="sr-only">
            Sök artist
          </label>
          <TextInput
            id="artists-search"
            type="search"
            placeholder="Sök artist…"
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
          emptyMessage="Inga artister hittades."
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
        title="Radera & blockera artist"
      >
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Radera <strong>{rejectModal?.name}</strong> och blockera artisten? Väntande spår raderas.
        </p>
        <div className="mt-4">
          <FormField label="Orsak (valfritt)" htmlFor="artist-reject-reason">
            <TextInput
              id="artist-reject-reason"
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
