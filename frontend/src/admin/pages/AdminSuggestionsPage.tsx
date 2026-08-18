import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getAdminSuggestions,
  acceptSuggestion,
  rejectSuggestion,
  getActivationPreview,
  activateSuggestion,
  type SuggestionDto,
  type SuggestionActivationPreviewDto,
} from '@/api/manual/suggestions';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { Pagination } from '@/admin/components/Pagination';
import { Modal } from '@/admin/components/Modal';
import { TextInput } from '@/admin/components/forms/TextInput';
import { Button } from '@/ui';
import { toast } from '@/admin/components/toastEmitter';

type Kind = 'content' | 'dance_style';
type StatusFilter = 'pending' | 'accepted' | 'activated' | 'rejected' | '';

const statusLabel: Record<string, string> = {
  pending: 'Väntande',
  accepted: 'Godkänd',
  activated: 'Aktiverad',
  rejected: 'Avvisad',
};

export function AdminSuggestionsPage() {
  const [params, setParams] = useSearchParams();
  const kind = (params.get('kind') as Kind) ?? 'content';
  const status = (params.get('status') as StatusFilter) ?? 'pending';
  const limit = parseInt(params.get('limit') ?? '20', 10);
  const offset = parseInt(params.get('offset') ?? '0', 10);

  const [items, setItems] = useState<SuggestionDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<SuggestionDto | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [activatePreview, setActivatePreview] = useState<{
    suggestion: SuggestionDto;
    preview: SuggestionActivationPreviewDto;
  } | null>(null);
  const [activating, setActivating] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminSuggestions(kind, status || undefined, limit, offset);
      setItems(result.items ?? []);
      setTotal(result.total ?? 0);
    } catch {
      toast('Kunde inte hämta förslag', 'error');
    } finally {
      setLoading(false);
    }
  }, [kind, status, limit, offset]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'offset') next.set('offset', '0');
    setParams(next, { replace: true });
  };

  const handleAccept = async (s: SuggestionDto) => {
    try {
      await acceptSuggestion(s.id);
      toast('Förslag godkänt');
      fetchItems();
    } catch {
      toast('Kunde inte godkänna förslaget', 'error');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await rejectSuggestion(rejectTarget.id, rejectNote || undefined);
      toast('Förslag avvisat');
      setRejectTarget(null);
      setRejectNote('');
      fetchItems();
    } catch {
      toast('Kunde inte avvisa förslaget', 'error');
    }
  };

  const openActivatePreview = async (s: SuggestionDto) => {
    try {
      const preview = await getActivationPreview(s.id);
      setActivatePreview({ suggestion: s, preview });
    } catch {
      toast('Kunde inte hämta förhandsgranskning', 'error');
    }
  };

  const confirmActivate = async () => {
    if (!activatePreview) return;
    setActivating(true);
    try {
      await activateSuggestion(activatePreview.suggestion.id);
      toast('Dansstil aktiverad');
      setActivatePreview(null);
      fetchItems();
    } catch {
      toast('Kunde inte aktivera förslaget', 'error');
    } finally {
      setActivating(false);
    }
  };

  const contentColumns: Column<SuggestionDto>[] = [
    {
      key: 'title',
      header: 'Titel',
      render: (s) => (
        <div>
          <span className="font-medium text-[rgb(var(--color-text))]">
            {String(s.payload.title ?? '-')}
          </span>
          {!!s.payload.artistName && (
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
              {String(s.payload.artistName)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'style',
      header: 'Föreslagen stil',
      render: (s) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">
          {[s.payload.suggestedMainStyle, s.payload.suggestedSubStyle].filter(Boolean).join(' / ') || '-'}
        </span>
      ),
    },
    {
      key: 'link',
      header: 'Länk',
      render: (s) =>
        s.payload.externalUrl ? (
          <a
            href={String(s.payload.externalUrl)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[rgb(var(--color-accent))] hover:underline"
          >
            Öppna
          </a>
        ) : (
          <span className="text-xs text-[rgb(var(--color-text-muted))]">-</span>
        ),
    },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    {
      key: 'actions',
      header: '',
      render: (s) =>
        s.status === 'pending' ? (
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => handleAccept(s)}>
              Godkänn
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 dark:text-red-400"
              onClick={() => setRejectTarget(s)}
            >
              Avvisa
            </Button>
          </div>
        ) : null,
      className: 'w-48',
    },
  ];

  const styleColumns: Column<SuggestionDto>[] = [
    {
      key: 'style',
      header: 'Dansstil',
      render: (s) => (
        <div>
          <span className="font-medium text-[rgb(var(--color-text))]">
            {String(s.payload.proposedMainStyle ?? '-')}
          </span>
          {!!s.payload.proposedSubStyle && (
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
              {String(s.payload.proposedSubStyle)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'bpb',
      header: 'Taktslag',
      render: (s) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">
          {String(s.payload.proposedBeatsPerBar ?? '-')}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    {
      key: 'actions',
      header: '',
      render: (s) => {
        if (s.status === 'pending') {
          return (
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => handleAccept(s)}>
                Godkänn
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 dark:text-red-400"
                onClick={() => setRejectTarget(s)}
              >
                Avvisa
              </Button>
            </div>
          );
        }
        if (s.status === 'accepted') {
          return (
            <Button variant="primary" size="sm" onClick={() => openActivatePreview(s)}>
              Aktivera...
            </Button>
          );
        }
        return null;
      },
      className: 'w-48',
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Förslag</h1>

      <div className="flex gap-1 border-b border-[rgb(var(--color-border))]">
        {(['content', 'dance_style'] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => updateParam('kind', k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              kind === k
                ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))]'
                : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
            }`}
          >
            {k === 'content' ? 'Låtar/album' : 'Dansstilar'}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(['pending', 'accepted', 'activated', 'rejected', ''] as StatusFilter[]).map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => updateParam('status', s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              status === s
                ? 'bg-[rgb(var(--color-accent))] text-white'
                : 'bg-[rgb(var(--color-border))]/30 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
            }`}
          >
            {s ? statusLabel[s] : 'Alla'}
          </button>
        ))}
      </div>

      <DataTable
        columns={kind === 'content' ? contentColumns : styleColumns}
        data={items}
        keyFn={(s) => s.id}
        loading={loading}
        emptyMessage="Inga förslag."
      />

      {total > 0 && (
        <Pagination
          offset={offset}
          limit={limit}
          total={total}
          onChange={(newOffset) => updateParam('offset', String(newOffset))}
        />
      )}

      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectNote(''); }}
        title="Avvisa förslag"
      >
        <div className="mt-1">
          <TextInput
            placeholder="Motivering (valfritt)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { setRejectTarget(null); setRejectNote(''); }}>
            Avbryt
          </Button>
          <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={handleReject}>
            Avvisa
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!activatePreview}
        onClose={() => setActivatePreview(null)}
        title="Aktivera dansstil"
      >
        {activatePreview && (
          <>
            <p className="text-sm text-[rgb(var(--color-text))]">
              Aktivera <strong>{activatePreview.preview.mainStyle}</strong>
              {activatePreview.preview.subStyle ? ` / ${activatePreview.preview.subStyle}` : ''} med{' '}
              <strong>{activatePreview.preview.proposedBeatsPerBar}</strong> taktslag per takt?
            </p>
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              Detta uppdaterar produktion och kan ta upp till 5 minuter innan det påverkar
              bearbetning. Det påverkar {activatePreview.preview.affectedTrackCount} redan
              klassificerade {activatePreview.preview.affectedTrackCount === 1 ? 'låt' : 'låtar'}{' '}
              i den här stilen.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setActivatePreview(null)}>
                Avbryt
              </Button>
              <Button variant="primary" disabled={activating} onClick={confirmActivate}>
                {activating ? 'Aktiverar...' : 'Aktivera'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    activated: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colors[status] ?? ''}`}>
      {statusLabel[status] ?? status}
    </span>
  );
}
