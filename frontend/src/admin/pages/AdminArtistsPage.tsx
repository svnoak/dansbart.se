import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getArtists1,
  approveArtist,
  rejectArtist,
} from '@/api/generated/admin-artists/admin-artists';
import { httpClient } from '@/api/http-client';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { FilterBar } from '@/admin/components/FilterBar';
import { Pagination } from '@/admin/components/Pagination';
import { Modal } from '@/admin/components/Modal';
import { ActionMenu } from '@/admin/components/ActionMenu';
import type { ActionItem } from '@/admin/components/ActionMenu';
import { TextInput } from '@/admin/components/forms/TextInput';
import { Button } from '@/ui';
import { toast } from '@/admin/components/toastEmitter';

interface ArtistRow {
  id: string;
  name: string;
  spotifyId?: string;
  trackCount?: number;
  approvedTrackCount?: number;
  pendingTrackCount?: number;
  description?: string;
}

interface ArtistPageData {
  items: ArtistRow[];
  total: number;
}

export function AdminArtistsPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const limit = parseInt(params.get('limit') ?? '50', 10);
  const offset = parseInt(params.get('offset') ?? '0', 10);

  const [data, setData] = useState<ArtistPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<ArtistRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editModal, setEditModal] = useState<ArtistRow | null>(null);
  const [editDescription, setEditDescription] = useState('');

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
    } catch {
      toast('Kunde inte hämta artister', 'error');
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
    try {
      await approveArtist(artist.id);
      toast(`${artist.name} godkänd`);
      fetchData();
    } catch {
      toast('Kunde inte godkänna artist', 'error');
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
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
      toast('Kunde inte avvisa artist', 'error');
    }
  };

  const handleEdit = async () => {
    if (!editModal) return;
    try {
      await httpClient(`/api/admin/artists/${editModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editDescription }),
      });
      toast(`${editModal.name} uppdaterad`);
      setEditModal(null);
      setEditDescription('');
      fetchData();
    } catch {
      toast('Kunde inte uppdatera artist', 'error');
    }
  };

  const actionsFor = (artist: ArtistRow): ActionItem[] => [
    { label: 'Godkänn & analysera', onClick: () => handleApprove(artist) },
    {
      label: 'Redigera beskrivning',
      onClick: () => { setEditModal(artist); setEditDescription(artist.description ?? ''); },
    },
    { label: 'Radera & blockera', onClick: () => setRejectModal(artist), variant: 'danger' },
  ];

  const columns: Column<ArtistRow>[] = [
    {
      key: 'name',
      header: 'Namn',
      render: (a) => (
        <span className="font-medium text-[rgb(var(--color-text))]">{a.name}</span>
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
      key: 'approved',
      header: 'Godkända',
      render: (a) => (
        <span className="text-xs text-green-600 dark:text-green-400">
          {a.approvedTrackCount ?? '-'}
        </span>
      ),
    },
    {
      key: 'pending',
      header: 'Väntande',
      render: (a) => (
        <span className="text-xs text-yellow-600 dark:text-yellow-400">
          {a.pendingTrackCount ?? '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (a) => <ActionMenu actions={actionsFor(a)} />,
      className: 'w-10',
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Artister</h1>

      <FilterBar>
        <div className="flex-1 min-w-[200px]">
          <TextInput
            type="search"
            placeholder="Sök artist..."
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
        emptyMessage="Inga artister hittades."
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
        title="Radera & blockera artist"
      >
        <p className="text-sm text-[rgb(var(--color-text))]">
          Radera <strong>{rejectModal?.name}</strong> och blockera artisten? Väntande spår raderas.
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
            Radera & blockera
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!editModal}
        onClose={() => { setEditModal(null); setEditDescription(''); }}
        title={`Redigera: ${editModal?.name}`}
      >
        <p className="text-xs text-[rgb(var(--color-text-muted))] mb-2">
          Stödjer markdown. Lägg till länkar med{' '}
          <code className="font-mono">[text](url)</code>, t.ex.{' '}
          <code className="font-mono">[Facebook](https://facebook.com/...)</code>
        </p>
        <textarea
          className="w-full rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] text-sm p-2 min-h-[140px] resize-y focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
          placeholder="Beskrivning av artisten..."
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { setEditModal(null); setEditDescription(''); }}>
            Avbryt
          </Button>
          <Button variant="primary" onClick={handleEdit}>
            Spara
          </Button>
        </div>
      </Modal>
    </div>
  );
}
