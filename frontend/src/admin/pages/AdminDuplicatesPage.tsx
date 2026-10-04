import { useCallback, useEffect, useState } from 'react';
import {
  getMergeableDuplicates,
  analyzeDuplicates,
  mergeDuplicates,
  mergeAllDuplicates,
} from '@/api/generated/admin-duplicates/admin-duplicates';
import { Modal } from '@/admin/components/Modal';
import { Button, Card, EmptyState, InlineError, LoadError, RowSkeleton } from '@/ui';
import { MusicNoteIcon } from '@/icons';
import { toast } from '@/admin/components/toastEmitter';

interface DuplicateGroup {
  isrc: string;
  count: number;
  trackTitles?: string[];
}

export function AdminDuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<Record<string, unknown> | null>(null);
  const [analyzeIsrc, setAnalyzeIsrc] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [mergeAllModal, setMergeAllModal] = useState(false);
  const [mergeAllError, setMergeAllError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMergeableDuplicates({});
      const items = Array.isArray(result) ? result : [];
      setGroups(
        items.map((item: Record<string, unknown>) => ({
          isrc: (item.isrc as string) ?? '',
          count: (item.count as number) ?? (item.duplicateCount as number) ?? 0,
          trackTitles: item.trackTitles as string[] | undefined,
        })),
      );
      setLoadError(null);
    } catch {
      setLoadError('Kunde inte hämta dubbletter');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAnalyze = async (isrc: string) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[isrc];
      return next;
    });
    try {
      const result = await analyzeDuplicates(isrc);
      setAnalyzeResult(result as Record<string, unknown>);
      setAnalyzeIsrc(isrc);
    } catch {
      setRowErrors((prev) => ({ ...prev, [isrc]: 'Kunde inte analysera dubbletter' }));
    }
  };

  const handleMerge = async (isrc: string) => {
    setMerging(true);
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[isrc];
      return next;
    });
    try {
      await mergeDuplicates(isrc, {});
      toast(`Dubbletter med ISRC ${isrc} sammanfogade`);
      fetchData();
    } catch {
      setRowErrors((prev) => ({ ...prev, [isrc]: 'Sammanslagning misslyckades' }));
    } finally {
      setMerging(false);
    }
  };

  const handleMergeAll = async () => {
    setMerging(true);
    setMergeAllError(null);
    try {
      await mergeAllDuplicates({});
      toast('Alla dubbletter sammanfogade');
      setMergeAllModal(false);
      fetchData();
    } catch {
      setMergeAllError('Masssammanslagning misslyckades');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            Dubbletter
          </h1>
          <p className="mt-1 text-[15px] text-[rgb(var(--color-text-muted))]">
            Spår som delar ISRC-kod och kan sammanfogas till ett. Analysera en grupp för att se detaljerna först.
          </p>
        </div>
        {!loading && groups.length > 0 && (
          <Button
            variant="primary"
            onClick={() => { setMergeAllModal(true); setMergeAllError(null); }}
            disabled={merging}
          >
            Sammanfoga alla
          </Button>
        )}
      </header>

      {loading && <RowSkeleton rows={4} label="Laddar dubbletter" />}

      {!loading && loadError && <LoadError message={loadError} onRetry={fetchData} />}

      {!loading && !loadError && (groups.length === 0 ? (
        <EmptyState
          icon={<MusicNoteIcon className="h-6 w-6" aria-hidden />}
          title="Inga dubbletter"
          description="Inga sammanfogningsbara dubbletter hittades."
        />
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => {
            const titles = g.trackTitles ?? [];
            return (
              <li key={g.isrc}>
                <Card className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">ISRC: {g.isrc}</p>
                      <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
                        {g.count} spår med samma kod
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleAnalyze(g.isrc)}>
                          Analysera
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleMerge(g.isrc)}
                          disabled={merging}
                        >
                          Sammanfoga
                        </Button>
                      </div>
                      {rowErrors[g.isrc] && <InlineError>{rowErrors[g.isrc]}</InlineError>}
                    </div>
                  </div>

                  {titles.length > 0 && (
                    <ol className="grid gap-2 sm:grid-cols-2">
                      {titles.map((title, i) => (
                        <li
                          key={`${g.isrc}-${i}`}
                          className="rounded-[var(--radius)] border border-[rgb(var(--color-border))] px-3 py-2"
                        >
                          <p className="text-[13px] text-[rgb(var(--color-text-muted))]">Spår {i + 1}</p>
                          <p className="truncate text-[15px] font-semibold text-[rgb(var(--color-text))]">{title}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      ))}

      {/* Analysis result modal */}
      <Modal
        open={!!analyzeIsrc}
        onClose={() => { setAnalyzeIsrc(null); setAnalyzeResult(null); }}
        title={`Analys: ${analyzeIsrc}`}
      >
        <pre className="max-h-64 overflow-auto rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] p-3 text-[13px] text-[rgb(var(--color-text))]">
          {JSON.stringify(analyzeResult, null, 2)}
        </pre>
        <div className="mt-5 flex justify-end">
          <Button variant="outline" onClick={() => { setAnalyzeIsrc(null); setAnalyzeResult(null); }}>
            Stäng
          </Button>
        </div>
      </Modal>

      {/* Merge all confirmation */}
      <Modal
        open={mergeAllModal}
        onClose={() => { setMergeAllModal(false); setMergeAllError(null); }}
        title="Sammanfoga alla dubbletter"
      >
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Detta sammanfogar alla {groups.length} grupper med dubbletter. Vill du fortsätta?
        </p>
        <div className="mt-5 space-y-3">
          {mergeAllError && <InlineError>{mergeAllError}</InlineError>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setMergeAllModal(false); setMergeAllError(null); }}>
              Avbryt
            </Button>
            <Button variant="primary" onClick={handleMergeAll} disabled={merging}>
              {merging ? 'Sammanfogar…' : 'Sammanfoga alla'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
