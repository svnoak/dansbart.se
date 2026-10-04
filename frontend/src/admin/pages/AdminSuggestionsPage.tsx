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
import { FormField } from '@/admin/components/forms/FormField';
import { FormActions } from '@/admin/components/forms/FormActions';
import { Badge, Button, Card, InlineError, LoadError, Pill } from '@/ui';
import { StylePill } from '@/components/TrackRow/StylePill';
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

  const pendingActions = (s: SuggestionDto) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => handleAccept(s)}>
          Godkänn
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setRejectTarget(s); setRejectError(null); }}
        >
          Avvisa
        </Button>
      </div>
      {rowErrors[s.id] && <InlineError>{rowErrors[s.id]}</InlineError>}
    </div>
  );

  const contentColumns: Column<SuggestionDto>[] = [
    {
      key: 'title',
      header: 'Titel',
      render: (s) => (
        <div>
          <span className="text-[15px] font-medium text-[rgb(var(--color-text))]">
            {String(s.payload.title ?? '–')}
          </span>
          {!!s.payload.artistName && (
            <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
              {String(s.payload.artistName)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'style',
      header: 'Föreslagen stil',
      render: (s) =>
        s.payload.suggestedMainStyle ? (
          <div className="flex flex-wrap items-center gap-2">
            <StylePill style={String(s.payload.suggestedMainStyle)} state="guess" />
            {!!s.payload.suggestedSubStyle && (
              <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
                {String(s.payload.suggestedSubStyle)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[13px] text-[rgb(var(--color-text-muted))]">–</span>
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
            className="inline-flex min-h-11 items-center text-sm font-medium text-[rgb(var(--color-link))] hover:underline"
          >
            Öppna länk
          </a>
        ) : (
          <span className="text-[13px] text-[rgb(var(--color-text-muted))]">–</span>
        ),
    },
    { key: 'status', header: 'Status', render: (s) => <SuggestionStatusBadge status={s.status} /> },
    {
      key: 'actions',
      header: '',
      render: (s) => (s.status === 'pending' ? pendingActions(s) : null),
      className: 'w-52',
    },
  ];

  const styleColumns: Column<SuggestionDto>[] = [
    {
      key: 'style',
      header: 'Dansstil',
      render: (s) => (
        <div className="flex flex-wrap items-center gap-2">
          <StylePill style={String(s.payload.proposedMainStyle ?? '')} state={s.payload.proposedMainStyle ? 'guess' : 'unknown'} />
          {!!s.payload.proposedSubStyle && (
            <span className="text-[13px] text-[rgb(var(--color-text-muted))]">
              {String(s.payload.proposedSubStyle)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'bpb',
      header: 'Taktslag per takt',
      render: (s) => (
        <span className="text-[15px] tabular-nums text-[rgb(var(--color-text))]">
          {String(s.payload.proposedBeatsPerBar ?? '–')}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (s) => <SuggestionStatusBadge status={s.status} /> },
    {
      key: 'actions',
      header: '',
      render: (s) => {
        if (s.status === 'pending') {
          return pendingActions(s);
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
      className: 'w-52',
    },
  ];

  const segment = (active: boolean) =>
    `inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))] ${
      active
        ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-foreground))]'
        : 'text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]'
    }`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Förslag
        </h1>
        <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-muted))]">
          Låtar, album och dansstilar som besökare föreslagit. Godkänn det som hör hemma i
          biblioteket och avvisa resten med en kort motivering.
        </p>
      </div>

      <Card className="flex flex-wrap items-end gap-x-6 gap-y-4 px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <span id="suggestion-kind-label" className="text-sm font-medium text-[rgb(var(--color-text))]">
            Typ av förslag
          </span>
          <div
            role="group"
            aria-labelledby="suggestion-kind-label"
            className="inline-flex rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] p-0.5"
          >
            {(['content', 'dance_style'] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => updateParam('kind', k)}
                className={segment(kind === k)}
              >
                {k === 'content' ? 'Låtar/album' : 'Dansstilar'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span id="suggestion-status-label" className="text-sm font-medium text-[rgb(var(--color-text))]">
            Status
          </span>
          <div role="group" aria-labelledby="suggestion-status-label" className="flex flex-wrap gap-2">
            {(['pending', 'accepted', 'activated', 'rejected', ''] as StatusFilter[]).map((s) => (
              <Pill
                key={s || 'all'}
                active={status === s}
                aria-pressed={status === s}
                onClick={() => updateParam('status', s)}
              >
                {s ? statusLabel[s] : 'Alla'}
              </Pill>
            ))}
          </div>
        </div>
      </Card>

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
        <FormField label="Motivering (valfritt)" htmlFor="reject-note">
          <TextInput
            id="reject-note"
            placeholder="Till exempel: finns redan i biblioteket"
            value={rejectNote}
            onChange={(e) => { setRejectNote(e.target.value); setRejectError(null); }}
            className="min-h-11"
          />
        </FormField>
        {rejectError && (
          <div className="mt-3">
            <InlineError>{rejectError}</InlineError>
          </div>
        )}
        <FormActions>
          <Button variant="ghost" onClick={() => { setRejectTarget(null); setRejectNote(''); setRejectError(null); }}>
            Avbryt
          </Button>
          <Button variant="primary" onClick={handleReject}>
            Avvisa
          </Button>
        </FormActions>
      </Modal>

      <Modal
        open={!!activatePreview}
        onClose={() => { setActivatePreview(null); setActivateError(null); }}
        title="Aktivera dansstil"
      >
        {activatePreview && (
          <>
            <p className="text-[15px] text-[rgb(var(--color-text))]">
              Aktivera <strong>{activatePreview.preview.mainStyle}</strong>
              {activatePreview.preview.subStyle ? ` / ${activatePreview.preview.subStyle}` : ''} med{' '}
              <strong>{activatePreview.preview.proposedBeatsPerBar}</strong> taktslag per takt?
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-[rgb(var(--color-text-muted))]">
              Det här uppdaterar produktion och kan ta upp till fem minuter innan det påverkar
              bearbetningen. Det påverkar {activatePreview.preview.affectedTrackCount} redan
              klassificerade {activatePreview.preview.affectedTrackCount === 1 ? 'låt' : 'låtar'}{' '}
              i den här stilen.
            </p>
            {activateError && (
              <div className="mt-3">
                <InlineError>{activateError}</InlineError>
              </div>
            )}
            <FormActions>
              <Button variant="ghost" onClick={() => { setActivatePreview(null); setActivateError(null); }}>
                Avbryt
              </Button>
              <Button variant="primary" disabled={activating} onClick={confirmActivate}>
                {activating ? 'Aktiverar...' : 'Aktivera'}
              </Button>
            </FormActions>
          </>
        )}
      </Modal>
    </div>
  );
}

/** The status as a word. Amber is kept for the one state that still waits on someone. */
function SuggestionStatusBadge({ status }: { status: string }) {
  const label = statusLabel[status] ?? status;
  if (status === 'pending') {
    return (
      <Badge
        style={{
          backgroundColor: 'rgb(var(--color-now-playing) / 0.16)',
          color: 'rgb(var(--color-now-playing-text))',
        }}
      >
        {label}
      </Badge>
    );
  }
  if (status === 'activated') {
    return <Badge style={{ color: 'rgb(var(--color-success))' }}>{label}</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="muted">{label}</Badge>;
  }
  return <Badge>{label}</Badge>;
}
