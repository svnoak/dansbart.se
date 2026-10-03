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
import { Button, InlineError, LoadError, PageHeader } from '@/ui';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [rejectTarget, setRejectTarget] = useState<SuggestionDto | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [activatePreview, setActivatePreview] = useState<{
    suggestion: SuggestionDto;
    preview: SuggestionActivationPreviewDto;
  } | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminSuggestions(kind, status || undefined, limit, offset);
      setItems(result.items ?? []);
      setTotal(result.total ?? 0);
      setLoadError(null);
    } catch {
      setLoadError('Kunde inte hämta förslag');
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
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[s.id];
      return next;
    });
    try {
      await acceptSuggestion(s.id);
      toast('Förslag godkänt');
      fetchItems();
    } catch {
      setRowErrors((prev) => ({ ...prev, [s.id]: 'Kunde inte godkänna förslaget' }));
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejectError(null);
    try {
      await rejectSuggestion(rejectTarget.id, rejectNote || undefined);
      toast('Förslag avvisat');
      setRejectTarget(null);
      setRejectNote('');
      fetchItems();
    } catch {
      setRejectError('Kunde inte avvisa förslaget');
    }
  };

  const openActivatePreview = async (s: SuggestionDto) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[s.id];
      return next;
    });
    try {
      const preview = await getActivationPreview(s.id);
      setActivatePreview({ suggestion: s, preview });
      setActivateError(null);
    } catch {
      setRowErrors((prev) => ({ ...prev, [s.id]: 'Kunde inte hämta förhandsgranskning' }));
    }
  };

  const confirmActivate = async () => {
    if (!activatePreview) return;
    setActivating(true);
    setActivateError(null);
    try {
      await activateSuggestion(activatePreview.suggestion.id);
      toast('Dansstil aktiverad');
      setActivatePreview(null);
      fetchItems();
    } catch {
      setActivateError('Kunde inte aktivera förslaget');
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
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => handleAccept(s)}>
                Godkänn
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[rgb(var(--color-error))]"
                onClick={() => { setRejectTarget(s); setRejectError(null); }}
              >
                Avvisa
              </Button>
            </div>
            {rowErrors[s.id] && <InlineError>{rowErrors[s.id]}</InlineError>}
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
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => handleAccept(s)}>
                  Godkänn
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[rgb(var(--color-error))]"
                  onClick={() => { setRejectTarget(s); setRejectError(null); }}
                >
                  Avvisa
                </Button>
              </div>
              {rowErrors[s.id] && <InlineError>{rowErrors[s.id]}</InlineError>}
            </div>
          );
        }
        if (s.status === 'accepted') {
          return (
            <div className="flex flex-col gap-1">
              <Button variant="primary" size="sm" onClick={() => openActivatePreview(s)}>
                Aktivera...
              </Button>
              {rowErrors[s.id] && <InlineError>{rowErrors[s.id]}</InlineError>}
            </div>
          );
        }
        return null;
      },
      className: 'w-48',
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Förslag" />

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
            className={`min-h-9 rounded-[var(--radius-full)] border px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] ${
              status === s
                ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]'
                : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-pill-bg))]'
            }`}
          >
            {s ? statusLabel[s] : 'Alla'}
          </button>
        ))}
      </div>

      {loadError && <LoadError message={loadError} onRetry={fetchItems} />}

      {!loadError && (
        <DataTable
          columns={kind === 'content' ? contentColumns : styleColumns}
          data={items}
          keyFn={(s) => s.id}
          loading={loading}
          emptyMessage="Inga förslag."
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
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectNote(''); setRejectError(null); }}
        title="Avvisa förslag"
      >
        <div className="mt-1">
          <TextInput
            placeholder="Motivering (valfritt)"
            value={rejectNote}
            onChange={(e) => { setRejectNote(e.target.value); setRejectError(null); }}
          />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          {rejectError && <InlineError>{rejectError}</InlineError>}
          <Button variant="ghost" onClick={() => { setRejectTarget(null); setRejectNote(''); setRejectError(null); }}>
            Avbryt
          </Button>
          <Button variant="danger" onClick={handleReject}>
            Avvisa
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!activatePreview}
        onClose={() => { setActivatePreview(null); setActivateError(null); }}
        title="Aktivera dansstil"
      >
        {activatePreview && (
          <>
            <p className="text-sm text-[rgb(var(--color-text))]">
              Aktivera <strong>{activatePreview.preview.mainStyle}</strong>
              {activatePreview.preview.subStyle ? ` / ${activatePreview.preview.subStyle}` : ''} med{' '}
              <strong>{activatePreview.preview.proposedBeatsPerBar}</strong> taktslag per takt?
            </p>
            <p className="mt-2 text-sm text-[rgb(var(--color-now-playing))]">
              Detta uppdaterar produktion och kan ta upp till 5 minuter innan det påverkar
              bearbetning. Det påverkar {activatePreview.preview.affectedTrackCount} redan
              klassificerade {activatePreview.preview.affectedTrackCount === 1 ? 'låt' : 'låtar'}{' '}
              i den här stilen.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              {activateError && <InlineError>{activateError}</InlineError>}
              <Button variant="ghost" onClick={() => { setActivatePreview(null); setActivateError(null); }}>
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
    pending: 'bg-[rgb(var(--color-now-playing-muted))] text-[rgb(var(--color-now-playing))]',
    accepted: 'bg-[rgb(var(--color-pill-bg))] text-[rgb(var(--color-text))]',
    activated: 'bg-[rgb(var(--color-selected-muted))] text-[rgb(var(--color-success))]',
    rejected: 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-error))]',
  };
  return (
    <span className={`inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium ${colors[status] ?? ''}`}>
      {statusLabel[status] ?? status}
    </span>
  );
}
