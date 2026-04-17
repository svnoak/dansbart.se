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
import { Button } from '@/ui';
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

export function AdminPendingPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'artists';
  const limit = parseInt(params.get('limit') ?? '50', 10);
  const offset = parseInt(params.get('offset') ?? '0', 10);

  const [artists, setArtists] = useState<PendingArtistRow[]>([]);
  const [artistsTotal, setArtistsTotal] = useState(0);
  const [albums, setAlbums] = useState<PendingAlbumRow[]>([]);
  const [albumsTotal, setAlbumsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<PendingArtistRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchArtists = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPendingArtistsForApproval(
        { limit, offset },
      );
      const r = result as unknown as { items: PendingArtistRow[]; total: number };
      setArtists(Array.isArray(r?.items) ? r.items : []);
      setArtistsTotal(r?.total ?? 0);
    } catch {
      toast('Kunde inte hämta väntande artister', 'error');
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
    } catch {
      toast('Kunde inte hämta väntande album', 'error');
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
    try {
      await approvePendingArtist(artist.id);
      toast(`${artist.name} godkänd, importerar diskografi`);
      fetchArtists();
    } catch {
      toast('Kunde inte godkänna', 'error');
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
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
      toast('Kunde inte avvisa', 'error');
    }
  };

  const artistColumns: Column<PendingArtistRow>[] = [
    {
      key: 'name',
      header: 'Namn',
      render: (a) => (
        <span className="font-medium text-[rgb(var(--color-text))]">{a.name}</span>
      ),
    },
    {
      key: 'pending',
      header: 'Väntande spår',
      render: (a) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">
          {a.pendingTrackCount ?? '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => handleApprove(a)}>
            Godkänn & importera
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 dark:text-red-400"
            onClick={() => setRejectModal(a)}
          >
            Avvisa
          </Button>
        </div>
      ),
      className: 'w-48',
    },
  ];

  const albumColumns: Column<PendingAlbumRow>[] = [
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
      key: 'pending',
      header: 'Väntande spår',
      render: (a) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">
          {a.pendingTrackCount ?? '-'}
        </span>
      ),
    },
  ];

  const total = tab === 'artists' ? artistsTotal : albumsTotal;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Väntande</h1>

      <div className="flex gap-1 border-b border-[rgb(var(--color-border))]">
        <button
          type="button"
          onClick={() => updateParam('tab', 'artists')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'artists'
              ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))]'
              : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
          }`}
        >
          Artister
        </button>
        <button
          type="button"
          onClick={() => updateParam('tab', 'albums')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'albums'
              ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))]'
              : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
          }`}
        >
          Album
        </button>
      </div>

      {tab === 'artists' ? (
        <DataTable
          columns={artistColumns}
          data={artists}
          keyFn={(a) => a.id}
          loading={loading}
          emptyMessage="Inga väntande artister."
        />
      ) : (
        <DataTable
          columns={albumColumns}
          data={albums}
          keyFn={(a) => a.id}
          loading={loading}
          emptyMessage="Inga väntande album."
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

      <Modal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(''); }}
        title="Avvisa artist"
      >
        <p className="text-sm text-[rgb(var(--color-text))]">
          Avvisa <strong>{rejectModal?.name}</strong>?
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
