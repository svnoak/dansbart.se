import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  approveTrackSubmission,
  approveTrackSubmissionBatch,
  listTrackSubmissions,
  rejectTrackSubmission,
} from '@/api/generated/admin-track-submissions/admin-track-submissions';
import { getStyleTree } from '@/api/generated/styles/styles';
import type { StyleNode } from '@/api/models/styleNode';
import type { TrackSubmissionDto } from '@/api/models/trackSubmissionDto';
import { Modal } from '@/admin/components/Modal';
import { Pagination } from '@/admin/components/Pagination';
import { FormActions } from '@/admin/components/forms/FormActions';
import { FormField } from '@/admin/components/forms/FormField';
import { Select } from '@/admin/components/forms/Select';
import { TextInput } from '@/admin/components/forms/TextInput';
import { toast } from '@/admin/components/toastEmitter';
import { SpotifyIcon, YouTubeIcon } from '@/icons';
import { Badge, Button, Card, EmptyState, InlineError, LoadError, Pill, RowSkeleton } from '@/ui';
import { submissionStatusWord } from '@/pages/addmusic/submissionStatus';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'exists' | '';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Väntande' },
  { value: 'approved', label: 'Godkända' },
  { value: 'rejected', label: 'Avvisade' },
  { value: 'exists', label: 'Fanns redan' },
  { value: '', label: 'Alla' },
];

const NO_STYLE = '';

/** "Polska" or "Polska|Slängpolska": the select's value for one style choice. */
function styleKey(main: string | null | undefined, sub: string | null | undefined): string {
  if (!main) return NO_STYLE;
  return sub ? `${main}|${sub}` : main;
}

function splitStyleKey(key: string): { mainStyle: string; subStyle: string } {
  if (!key) return { mainStyle: '', subStyle: '' };
  const [main, sub] = key.split('|');
  return { mainStyle: main, subStyle: sub ?? '' };
}

function sourceLabel(item: TrackSubmissionDto): string {
  const kind: Record<string, string> = {
    track: 'Låt',
    album: 'Album',
    artist: 'Artist',
    playlist: 'Spellista',
    channel: 'Kanal',
  };
  const what = kind[item.sourceKind ?? ''] ?? 'Länk';
  return item.sourceName ? `${what}: ${item.sourceName}` : what;
}

function formatDate(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
}

interface Group {
  batchId: string;
  items: TrackSubmissionDto[];
}

function groupByBatch(items: TrackSubmissionDto[]): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const key = item.batchId ?? item.id ?? '';
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { batchId: key, items: [item] });
  }
  return Array.from(groups.values());
}

/**
 * Review queue for tracks people added from Spotify and YouTube links. Each link is one
 * group. Approving creates the track, sends it for analysis, casts the chosen style as a
 * vote and lifts a signed-in submitter's trust, so their next links skip the queue.
 */
export function AdminSubmissionsPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? 'pending') as StatusFilter;
  const limit = parseInt(params.get('limit') ?? '50', 10);
  const offset = parseInt(params.get('offset') ?? '0', 10);

  const [items, setItems] = useState<TrackSubmissionDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [styleTree, setStyleTree] = useState<StyleNode[]>([]);
  const [styleChoice, setStyleChoice] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<TrackSubmissionDto | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listTrackSubmissions({ status: status || undefined, limit, offset });
      setItems(result.items ?? []);
      setTotal(result.total ?? 0);
      setLoadError(null);
    } catch {
      setLoadError('Kunde inte hämta inskickade låtar');
    } finally {
      setLoading(false);
    }
  }, [status, limit, offset]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    getStyleTree()
      .then(setStyleTree)
      .catch(() => {});
  }, []);

  const styleOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (const node of [...styleTree].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'sv'))) {
      if (!node.name) continue;
      options.push({ value: styleKey(node.name, null), label: node.name });
      for (const sub of node.subStyles ?? []) {
        options.push({ value: styleKey(node.name, sub), label: `${node.name} · ${sub}` });
      }
    }
    return options;
  }, [styleTree]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'offset') next.set('offset', '0');
    setParams(next, { replace: true });
  };

  const chosenStyle = (item: TrackSubmissionDto) =>
    styleChoice[item.id ?? ''] ?? styleKey(item.suggestedMainStyle, item.suggestedSubStyle);

  const setBusyFor = (key: string, value: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });

  const clearRowError = (key: string) =>
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleApprove = async (item: TrackSubmissionDto) => {
    const key = item.id ?? '';
    clearRowError(key);
    setBusyFor(key, true);
    try {
      const choice = chosenStyle(item);
      const suggested = styleKey(item.suggestedMainStyle, item.suggestedSubStyle);
      const body = choice === suggested ? {} : splitStyleKey(choice);
      await approveTrackSubmission(key, body);
      toast('Låten är godkänd och analyseras nu');
      fetchItems();
    } catch {
      setRowErrors((prev) => ({ ...prev, [key]: 'Kunde inte godkänna låten' }));
    } finally {
      setBusyFor(key, false);
    }
  };

  const handleApproveBatch = async (group: Group) => {
    const key = `batch:${group.batchId}`;
    clearRowError(key);
    setBusyFor(key, true);
    try {
      await approveTrackSubmissionBatch(group.batchId);
      toast('Alla väntande låtar i gruppen är godkända');
      fetchItems();
    } catch {
      setRowErrors((prev) => ({ ...prev, [key]: 'Kunde inte godkänna låtarna' }));
    } finally {
      setBusyFor(key, false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget?.id) return;
    setRejectError(null);
    try {
      await rejectTrackSubmission(rejectTarget.id, { reviewNote: rejectNote || undefined });
      toast('Låten är avvisad');
      setRejectTarget(null);
      setRejectNote('');
      fetchItems();
    } catch {
      setRejectError('Kunde inte avvisa låten');
    }
  };

  const groups = useMemo(() => groupByBatch(items), [items]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-[28px] font-bold leading-tight text-[rgb(var(--color-text))]">Inskickat</h1>
        <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
          Låtar som besökare lagt till från Spotify- och YouTube-länkar. Godkända låtar skapas och analyseras, och
          personen som skickade in dem får större förtroende för nästa gång.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrera på status">
        {FILTERS.map((f) => (
          <Pill key={f.value} active={status === f.value} onClick={() => updateParam('status', f.value)}>
            {f.label}
          </Pill>
        ))}
      </div>

      {loadError && <LoadError message={loadError} onRetry={fetchItems} />}

      {loading ? (
        <RowSkeleton rows={6} label="Laddar inskickade låtar" />
      ) : groups.length === 0 ? (
        <EmptyState
          title={status === 'pending' ? 'Inga låtar väntar på granskning' : 'Inga låtar att visa'}
          description="Låtar som läggs till via Lägg till musik hamnar här."
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const first = group.items[0];
            const pendingCount = group.items.filter((i) => i.status === 'pending').length;
            const batchKey = `batch:${group.batchId}`;
            return (
              <Card key={group.batchId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[15px] font-semibold text-[rgb(var(--color-text))]">
                      {first.provider === 'youtube' ? (
                        <YouTubeIcon className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <SpotifyIcon className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      <span className="truncate">{sourceLabel(first)}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] text-[rgb(var(--color-text-muted))]">
                      {first.submitterName ? `Från ${first.submitterName}` : 'Från en anonym besökare'}
                      {first.createdAt ? ` · ${formatDate(first.createdAt)}` : ''}
                      {' · '}
                      {group.items.length === 1 ? '1 låt' : `${group.items.length} låtar`}
                      {first.sourceUrl && (
                        <>
                          {' · '}
                          <a
                            href={first.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[rgb(var(--color-link))] hover:underline"
                          >
                            Öppna länken
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  {pendingCount > 1 && (
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        variant="secondary"
                        disabled={busy.has(batchKey)}
                        onClick={() => handleApproveBatch(group)}
                      >
                        Godkänn alla ({pendingCount})
                      </Button>
                      <InlineError>{rowErrors[batchKey]}</InlineError>
                    </div>
                  )}
                </div>

                <ul className="mt-3 divide-y divide-[rgb(var(--color-border))]">
                  {group.items.map((item) => {
                    const key = item.id ?? '';
                    const selectId = `style-${key}`;
                    return (
                      <li key={key} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-[rgb(var(--color-text))]">{item.title}</p>
                          <p className="truncate text-sm text-[rgb(var(--color-text-muted))]">
                            {[item.artistName, item.albumName].filter(Boolean).join(' · ') || 'Okänd artist'}
                          </p>
                          {item.status === 'rejected' && item.reviewNote && (
                            <p className="text-sm text-[rgb(var(--color-text-muted))]">Anledning: {item.reviewNote}</p>
                          )}
                        </div>
                        {item.status === 'pending' ? (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="sm:w-56">
                              <label htmlFor={selectId} className="sr-only">
                                Dansstil för {item.title}
                              </label>
                              <Select
                                id={selectId}
                                value={chosenStyle(item)}
                                onChange={(e) => setStyleChoice((prev) => ({ ...prev, [key]: e.target.value }))}
                              >
                                <option value={NO_STYLE}>Ingen dansstil</option>
                                {styleOptions.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div className="flex gap-2">
                              <Button disabled={busy.has(key)} onClick={() => handleApprove(item)}>
                                Godkänn
                              </Button>
                              <Button variant="outline" onClick={() => setRejectTarget(item)}>
                                Avvisa
                              </Button>
                            </div>
                            <InlineError>{rowErrors[key]}</InlineError>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {(item.suggestedMainStyle || item.suggestedSubStyle) && (
                              <Badge variant="muted">{item.suggestedSubStyle ?? item.suggestedMainStyle}</Badge>
                            )}
                            <Badge>{submissionStatusWord(item)}</Badge>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      {total > limit && (
        <Pagination offset={offset} limit={limit} total={total} onChange={(o) => updateParam('offset', String(o))} />
      )}

      <Modal
        open={rejectTarget !== null}
        onClose={() => {
          setRejectTarget(null);
          setRejectNote('');
          setRejectError(null);
        }}
        title="Avvisa låt"
      >
        <p className="mb-4 text-[15px] text-[rgb(var(--color-text))]">
          Avvisa <strong>{rejectTarget?.title}</strong>? Låten skapas inte.
        </p>
        <FormField label="Anledning (valfritt)" htmlFor="reject-note">
          <TextInput id="reject-note" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
        </FormField>
        <InlineError>{rejectError}</InlineError>
        <FormActions>
          <Button
            variant="outline"
            onClick={() => {
              setRejectTarget(null);
              setRejectNote('');
            }}
          >
            Avbryt
          </Button>
          <Button variant="danger" onClick={handleReject}>
            Avvisa
          </Button>
        </FormActions>
      </Modal>
    </div>
  );
}
