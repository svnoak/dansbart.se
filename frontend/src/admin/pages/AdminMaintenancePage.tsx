import { useCallback, useEffect, useState } from 'react';
import {
  queuePendingTracks,
  cleanupOrphaned,
  backfillIsrcs,
  reclassifyAll,
} from '@/api/generated/admin-maintenance/admin-maintenance';
import { apiFetch } from '@/api/http-client';
import { Modal } from '@/admin/components/Modal';
import { Button, Card, InlineError, Pill } from '@/ui';
import { toast } from '@/admin/components/toastEmitter';

type PauseStatus = Record<string, boolean>;

const QUEUE_LABELS: Record<string, string> = {
  audio: 'Audio',
  feature: 'Feature',
  light: 'Light',
};

async function fetchPauseStatus(): Promise<PauseStatus> {
  const res = await apiFetch('/api/admin/maintenance/pause-status');
  if (!res.ok) throw new Error('Failed to fetch pause status');
  const data = await res.json();
  return data.queues;
}

async function togglePause(queue: string, paused: boolean): Promise<void> {
  const endpoint = paused ? 'resume' : 'pause';
  const res = await apiFetch(
    `/api/admin/maintenance/${endpoint}?queue=${queue}`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error(`Failed to ${endpoint} queue`);
}

async function togglePauseAll(anyActive: boolean): Promise<void> {
  const endpoint = anyActive ? 'pause' : 'resume';
  const res = await apiFetch(`/api/admin/maintenance/${endpoint}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to ${endpoint} all queues`);
}

interface OperationResult {
  label: string;
  result: string;
  time: string;
}

export function AdminMaintenancePage() {
  const [running, setRunning] = useState<string | null>(null);
  const [history, setHistory] = useState<OperationResult[]>([]);
  const [confirmOp, setConfirmOp] = useState<string | null>(null);
  const [pauseStatus, setPauseStatus] = useState<PauseStatus>({});
  const [pauseLoading, setPauseLoading] = useState<string | null>(null);
  const [retrainReclassify, setRetrainReclassify] = useState(false);
  const [queueErrors, setQueueErrors] = useState<Record<string, string>>({});
  const [toggleAllError, setToggleAllError] = useState<string | null>(null);
  const [opErrors, setOpErrors] = useState<Record<string, string>>({});

  const loadPauseStatus = useCallback(async () => {
    try {
      setPauseStatus(await fetchPauseStatus());
    } catch {
      // silent on load failure
    }
  }, []);

  useEffect(() => {
    loadPauseStatus();
  }, [loadPauseStatus]);

  const handleToggleQueue = async (queue: string) => {
    setPauseLoading(queue);
    setQueueErrors((prev) => {
      const next = { ...prev };
      delete next[queue];
      return next;
    });
    try {
      await togglePause(queue, pauseStatus[queue]);
      await loadPauseStatus();
      toast(pauseStatus[queue] ? `${QUEUE_LABELS[queue]}: återupptagen` : `${QUEUE_LABELS[queue]}: pausad`);
    } catch {
      setQueueErrors((prev) => ({ ...prev, [queue]: 'Kunde inte ändra kö-status' }));
    } finally {
      setPauseLoading(null);
    }
  };

  const handleToggleAll = async () => {
    const anyActive = Object.values(pauseStatus).some((v) => !v);
    setPauseLoading('all');
    setToggleAllError(null);
    try {
      await togglePauseAll(anyActive);
      await loadPauseStatus();
      toast(anyActive ? 'Alla köer pausade' : 'Alla köer återupptagna');
    } catch {
      setToggleAllError('Kunde inte ändra kö-status');
    } finally {
      setPauseLoading(null);
    }
  };

  const addResult = (label: string, result: string) => {
    setHistory((prev) => [
      { label, result, time: new Date().toLocaleTimeString('sv-SE') },
      ...prev,
    ]);
  };

  const run = async (id: string, name: string, fn: () => Promise<unknown>) => {
    setRunning(id);
    setConfirmOp(null);
    setOpErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const result = await fn();
      const msg = typeof result === 'object' && result
        ? JSON.stringify(result)
        : String(result ?? 'OK');
      addResult(name, msg);
      toast(`${name}: klar`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Misslyckades';
      addResult(name, `Fel: ${msg}`);
      setOpErrors((prev) => ({ ...prev, [id]: `${name} misslyckades. Försök igen.` }));
    } finally {
      setRunning(null);
    }
  };

  const operations: {
    id: string;
    label: string;
    description: string;
    action: () => void;
    needsConfirm?: boolean;
    extraContent?: React.ReactNode;
  }[] = [
    {
      id: 'queue-pending',
      label: 'Köa väntande spår',
      description: 'Skicka spår med status PENDING till analysarbetaren (högst 500).',
      action: () => run('queue-pending', 'Köa väntande', () => queuePendingTracks({ limit: 500 })),
    },
    {
      id: 'queue-failed',
      label: 'Köa om misslyckade spår',
      description: 'Återställ spår med status FAILED till PENDING och skicka dem till analysarbetaren (högst 500).',
      action: () => run('queue-failed', 'Köa om misslyckade', () => queuePendingTracks({ limit: 500, status: 'FAILED' })),
    },
    {
      id: 'cleanup-orphaned',
      label: 'Rensa fastsittande spår',
      description: 'Återställ spår som fastnat i status PROCESSING i mer än 30 minuter.',
      action: () => run('cleanup-orphaned', 'Rensa fastsittande', () => cleanupOrphaned({ stuckThresholdMinutes: 30 })),
    },
    {
      id: 'backfill-isrcs',
      label: 'Komplettera ISRC',
      description: 'Hämta saknade ISRC-koder från Spotify (högst 100).',
      action: () => run('backfill-isrcs', 'Komplettera ISRC', () => backfillIsrcs({ limit: 100 })),
    },
    {
      id: 'backfill-duration',
      label: 'Komplettera spellängd',
      description: 'Hämta saknad spellängd från Spotify (högst 200).',
      action: () => run('backfill-duration', 'Komplettera spellängd', async () => {
        const res = await apiFetch('/api/admin/maintenance/backfill-duration?batchSize=200', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to backfill duration');
        return res.json();
      }),
    },
    {
      id: 'retrain-model',
      label: 'Omträna modell',
      description: 'Träna om klassificeringsmodellen på de spår som har en bekräftad dansstil.',
      action: () => run('retrain-model', 'Omträna modell', async () => {
        const res = await apiFetch(
          `/api/admin/maintenance/retrain-model?reclassify=${retrainReclassify}`,
          { method: 'POST' },
        );
        if (!res.ok) throw new Error('Failed to retrain model');
        return res.json();
      }),
      extraContent: (
        <label className="flex min-h-11 items-center gap-3 text-[15px] text-[rgb(var(--color-text))] sm:col-start-1">
          <input
            type="checkbox"
            checked={retrainReclassify}
            onChange={(e) => setRetrainReclassify(e.target.checked)}
            className="h-5 w-5 rounded-[4px] border-[rgb(var(--color-border-strong))] accent-[rgb(var(--color-accent))]"
          />
          Omklassificera alla spår efteråt
        </label>
      ),
    },
    {
      id: 'reclassify-all',
      label: 'Omklassificera alla',
      description: 'Kör om dansstilsklassificeringen för hela biblioteket och räkna om taktpositionerna för alla spår med en bekräftad dansstil. Det tar lång tid.',
      needsConfirm: true,
      action: () => run('reclassify-all', 'Omklassificera', async () => {
        const [reclassify, bars] = await Promise.all([
          reclassifyAll(),
          apiFetch('/api/admin/folkwiki/backfill-bars', { method: 'POST' }).then((r) => r.json()),
        ]);
        return { ...reclassify as object, barsDispatched: (bars as { dispatched: number }).dispatched };
      }),
    },
  ];

  const anyQueueActive = Object.values(pauseStatus).some((v) => !v);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Underhåll
        </h1>
        <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-muted))]">
          Pausa och starta arbetsköerna och kör de åtgärder som håller biblioteket i ordning.
          Varje körning visar sitt resultat längst ner på sidan.
        </p>
      </div>

      {/* Queue pause/resume controls */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">Köer</h2>
            <p className="mt-1 text-[13px] text-[rgb(var(--color-text-muted))]">
              En pausad kö tar inte emot nya jobb förrän den startas igen.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              disabled={pauseLoading !== null}
              onClick={handleToggleAll}
            >
              {anyQueueActive ? 'Pausa alla' : 'Starta alla'}
            </Button>
            {toggleAllError && <InlineError>{toggleAllError}</InlineError>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3" role="group" aria-label="Köer">
          {Object.entries(pauseStatus).map(([queue, paused]) => {
            const label = QUEUE_LABELS[queue] ?? queue;
            return (
              <div key={queue} className="flex flex-col gap-1">
                <Pill
                  active={!paused}
                  aria-pressed={!paused}
                  aria-label={paused ? `Starta kön ${label}` : `Pausa kön ${label}`}
                  onClick={() => handleToggleQueue(queue)}
                  disabled={pauseLoading !== null}
                  className="disabled:opacity-50"
                >
                  {label}
                  <span className="ml-1.5 font-normal opacity-80">{paused ? '· Pausad' : '· Aktiv'}</span>
                </Pill>
                {queueErrors[queue] && <InlineError>{queueErrors[queue]}</InlineError>}
              </div>
            );
          })}
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">Åtgärder</h2>
        <div className="grid gap-3">
          {operations.map((op) => (
            <Card
              key={op.id}
              className="grid gap-x-6 gap-y-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5"
            >
              <h3 className="text-[15px] font-semibold text-[rgb(var(--color-text))] sm:col-start-1">{op.label}</h3>
              <p className="text-[13px] leading-relaxed text-[rgb(var(--color-text-muted))] sm:col-start-1">{op.description}</p>
              {op.extraContent}
              <div className="flex flex-col items-start gap-1 sm:col-start-2 sm:row-start-1 sm:row-span-3 sm:items-end sm:self-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (op.needsConfirm) {
                      setConfirmOp(op.id);
                    } else {
                      op.action();
                    }
                  }}
                  disabled={running !== null}
                >
                  {running === op.id ? 'Kör...' : 'Kör'}
                </Button>
                {opErrors[op.id] && <InlineError>{opErrors[op.id]}</InlineError>}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Results history */}
      {history.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 text-xl font-bold leading-tight text-[rgb(var(--color-text))]">Resultat</h2>
          <ul className="divide-y divide-[rgb(var(--color-border))]">
            {history.map((h, i) => {
              const failed = h.result.startsWith('Fel:');
              return (
                <li key={i} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[15px] font-medium text-[rgb(var(--color-text))]">
                      {h.label}
                      <span
                        className={`ml-2 text-[13px] font-medium ${
                          failed ? 'text-[rgb(var(--color-error))]' : 'text-[rgb(var(--color-success))]'
                        }`}
                      >
                        {failed ? 'Misslyckades' : 'Klar'}
                      </span>
                    </p>
                    <span className="text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">{h.time}</span>
                  </div>
                  <pre className="mt-1 max-h-24 overflow-auto rounded-[var(--radius)] bg-[rgb(var(--color-bg))] px-3 py-2 text-[13px] whitespace-pre-wrap break-all text-[rgb(var(--color-text-muted))]">
                    {h.result}
                  </pre>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Confirmation modal for dangerous operations */}
      <Modal
        open={!!confirmOp}
        onClose={() => setConfirmOp(null)}
        title="Bekräfta åtgärd"
      >
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          {confirmOp === 'reclassify-all'
            ? 'Det här omklassificerar hela biblioteket och kan ta lång tid. Vill du fortsätta?'
            : 'Vill du köra den här åtgärden?'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOp(null)}>Avbryt</Button>
          <Button
            variant="danger"
            onClick={() => {
              const op = operations.find((o) => o.id === confirmOp);
              if (op) op.action();
            }}
          >
            Kör
          </Button>
        </div>
      </Modal>
    </div>
  );
}
