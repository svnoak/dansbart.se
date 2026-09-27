import { useCallback, useEffect, useState } from 'react';
import {
  getMergeableDuplicates,
  analyzeDuplicates,
  mergeDuplicates,
  mergeAllDuplicates,
} from '@/api/generated/admin-duplicates/admin-duplicates';
import { Modal } from '@/admin/components/Modal';
import { Button, InlineError, LoadError } from '@/ui';
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

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Dubbletter</h1>
        <p className="text-[rgb(var(--color-text-muted))]">Laddar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Dubbletter</h1>
        {groups.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => { setMergeAllModal(true); setMergeAllError(null); }}
            disabled={merging}
          >
            Sammanfoga alla
          </Button>
        )}
      </div>

      {loadError && <LoadError message={loadError} onRetry={fetchData} />}

      {!loadError && (groups.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-8 text-center">
          <p className="text-[rgb(var(--color-text-muted))]">Inga sammanfogningsbara dubbletter hittades.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <div
              key={g.isrc}
              className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-[rgb(var(--color-text))]">
                  ISRC: {g.isrc}
                </p>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  {g.count} spår
                  {g.trackTitles?.length ? ` - ${g.trackTitles[0]}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleAnalyze(g.isrc)}>
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
          ))}
        </div>
      ))}

      {/* Analysis result modal */}
      <Modal
        open={!!analyzeIsrc}
        onClose={() => { setAnalyzeIsrc(null); setAnalyzeResult(null); }}
        title={`Analys: ${analyzeIsrc}`}
      >
        <pre className="max-h-64 overflow-auto rounded bg-[rgb(var(--color-bg))] p-3 text-xs text-[rgb(var(--color-text))]">
          {JSON.stringify(analyzeResult, null, 2)}
        </pre>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={() => { setAnalyzeIsrc(null); setAnalyzeResult(null); }}>
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
        <p className="text-sm text-[rgb(var(--color-text))]">
          Detta sammanfogar alla {groups.length} grupper med dubbletter. Fortsätt?
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          {mergeAllError && <InlineError>{mergeAllError}</InlineError>}
          <Button variant="ghost" onClick={() => { setMergeAllModal(false); setMergeAllError(null); }}>Avbryt</Button>
          <Button variant="primary" onClick={handleMergeAll} disabled={merging}>
            {merging ? 'Sammanfogar...' : 'Sammanfoga alla'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
