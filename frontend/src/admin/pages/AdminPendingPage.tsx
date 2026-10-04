import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getPendingArtistsForApproval,
  approvePendingArtist,
  rejectPendingArtist,
  getPendingAlbums,
} from '@/api/generated/admin-pending/admin-pending';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { Pagination } from '@/admin/components/Pagination';
import { Modal } from '@/admin/components/Modal';
import { TextInput } from '@/admin/components/forms/TextInput';
import { FormField } from '@/admin/components/forms/FormField';
import { Button, InlineError, LoadError, Pill } from '@/ui';
import { toast } from '@/admin/components/toastEmitter';

interface PendingArtistRow {
  id: string;
  name: string;
  spotifyId?: string;
  pendingTrackCount?: number;
}

interface PendingAlbumRow {
  id: string;
  name: string;
  artistName?: string;
  pendingTrackCount?: number;
}

type Tab = 'artists' | 'albums';

const fieldClass = 'min-h-11 border-[rgb(var(--color-border-strong))] text-[15px]';

export function AdminPendingPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'artists';
  const limit = parseInt(params.get('limit') ?? '50', 10);
  const offset = parseInt(params.get('offset') ?? '0', 10);

  const [artists, setArtists] = useState<PendingArtistRow[]>([]);
  const [artistsTotal, setArtistsTotal] = useState(0);
  const [artistsLoadError, setArtistsLoadError] = useState<string | null>(null);
  const [albums, setAlbums] = useState<PendingAlbumRow[]>([]);
  const [albumsTotal, setAlbumsTotal] = useState(0);
  const [albumsLoadError, setAlbumsLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [rejectModal, setRejectModal] = useState<PendingArtistRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchArtists = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPendingArtistsForApproval(
        { limit, offset },
      );
      const r = result as unknown as { items: PendingArtistRow[]; total: number };
      setArtists(Array.isArray(r?.items) ? r.items : []);
      setArtistsTotal(r?.total ?? 0);
      setArtistsLoadError(null);
    } catch {
      setArtistsLoadError('Kunde inte hämta väntande artister');
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  const fetchAlbums = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPendingAlbums(
        { limit, offset },
      );
      const r = result as unknown as { items: PendingAlbumRow[]; total: number };
      setAlbums(Array.isArray(r?.items) ? r.items : []);
      setAlbumsTotal(r?.total ?? 0);
      setAlbumsLoadError(null);
    } catch {
      setAlbumsLoadError('Kunde inte hämta väntande album');
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    if (tab === 'artists') fetchArtists();
    else fetchAlbums();
  }, [tab, fetchArtists, fetchAlbums]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'offset') next.set('offset', '0');
    setParams(next, { replace: true });
  };

  const handleApprove = async (artist: PendingArtistRow) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[artist.id];
      return next;
    });
    try {
      await approvePendingArtist(artist.id);
      toast(`${artist.name} godkänd, importerar diskografi`);
      fetchArtists();
    } catch {
      setRowErrors((prev) => ({ ...prev, [artist.id]: 'Kunde inte godkänna' }));
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setRejectError(null);
    try {
      await rejectPendingArtist(
        rejectModal.id,
        { reason: rejectReason || undefined },
      );
      toast(`${rejectModal.name} avvisad`);
      setRejectModal(null);
      setRejectReason('');
      fetchArtists();
    } catch {
      setRejectError('Kunde inte avvisa');
    }
  };

  const pendingCount = (value?: number) => (
    <span className="text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">
      {value ?? '-'}
    </span>
  );

  const artistColumns: Column<PendingArtistRow>[] = [
    {
      key: 'name',
      header: 'Namn',
      render: (a) => (
        <span className="text-[15px] font-semibold text-[rgb(var(--color-text))]">{a.name}</span>
      ),
    },
    {
      key: 'pending',
      header: 'Väntande spår',
      render: (a) => pendingCount(a.pendingTrackCount),
    },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="primary" size="sm" onClick={() => handleApprove(a)}>
              Godkänn & importera
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRejectModal(a); setRejectError(null); }}
            >
              Avvisa
            </Button>
          </div>
          {rowErrors[a.id] && <InlineError>{rowErrors[a.id]}</InlineError>}
        </div>
      ),
      className: 'w-72',
    },
  ];

  const albumColumns: Column<PendingAlbumRow>[] = [
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
      key: 'pending',
      header: 'Väntande spår',
      render: (a) => pendingCount(a.pendingTrackCount),
    },
  ];

  const total = tab === 'artists' ? artistsTotal : albumsTotal;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Väntande
        </h1>
        <p className="mt-1 text-[15px] text-[rgb(var(--color-text-muted))]">
          Artister och album som väntar på godkännande innan deras spår analyseras.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Visa väntande">
        <Pill
          active={tab === 'artists'}
          aria-pressed={tab === 'artists'}
          onClick={() => updateParam('tab', 'artists')}
        >
          Artister
        </Pill>
        <Pill
          active={tab === 'albums'}
          aria-pressed={tab === 'albums'}
          onClick={() => updateParam('tab', 'albums')}
        >
          Album
        </Pill>
      </div>

      {tab === 'artists' ? (
        <>
          {artistsLoadError && <LoadError message={artistsLoadError} onRetry={fetchArtists} />}
          {!artistsLoadError && (
            <DataTable
              columns={artistColumns}
              data={artists}
              keyFn={(a) => a.id}
              loading={loading}
              emptyMessage="Inga väntande artister."
            />
          )}
        </>
      ) : (
        <>
          {albumsLoadError && <LoadError message={albumsLoadError} onRetry={fetchAlbums} />}
          {!albumsLoadError && (
            <DataTable
              columns={albumColumns}
              data={albums}
              keyFn={(a) => a.id}
              loading={loading}
              emptyMessage="Inga väntande album."
            />
          )}
        </>
      )}

      {total > 0 && (
        <Pagination
          offset={offset}
          limit={limit}
          total={total}
          onChange={(newOffset) => updateParam('offset', String(newOffset))}
        />
      )}

      <Modal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(''); }}
        title="Avvisa artist"
      >
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Avvisa <strong>{rejectModal?.name}</strong>?
        </p>
        <div className="mt-4">
          <FormField label="Orsak (valfritt)" htmlFor="pending-reject-reason">
            <TextInput
              id="pending-reject-reason"
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
              Avvisa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
