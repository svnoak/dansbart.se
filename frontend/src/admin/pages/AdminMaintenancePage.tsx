import { useCallback, useEffect, useState } from 'react';
import {
  queuePendingTracks,
  cleanupOrphaned,
  backfillIsrcs,
  reclassifyAll,
} from '@/api/generated/admin-maintenance/admin-maintenance';
import { apiFetch } from '@/api/http-client';
import { Modal } from '@/admin/components/Modal';
import { Button } from '@/ui';
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
    try {
      await togglePause(queue, pauseStatus[queue]);
      await loadPauseStatus();
      toast(pauseStatus[queue] ? `${QUEUE_LABELS[queue]}: återupptagen` : `${QUEUE_LABELS[queue]}: pausad`);
    } catch {
      toast(`Kunde inte ändra kö-status`, 'error');
    } finally {
      setPauseLoading(null);
    }
  };

  const handleToggleAll = async () => {
    const anyActive = Object.values(pauseStatus).some((v) => !v);
    setPauseLoading('all');
    try {
      await togglePauseAll(anyActive);
      await loadPauseStatus();
      toast(anyActive ? 'Alla köer pausade' : 'Alla köer återupptagna');
    } catch {
      toast('Kunde inte ändra kö-status', 'error');
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

  const run = async (name: string, fn: () => Promise<unknown>) => {
    setRunning(name);
    setConfirmOp(null);
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
      toast(`${name}: misslyckades`, 'error');
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
      description: 'Skicka PENDING-spår till analysarbetaren (max 500)',
      action: () => run('Köa väntande', () => queuePendingTracks({ limit: 500 })),
    },
    {
      id: 'queue-failed',
      label: 'Köa om misslyckade spår',
      description: 'Återställ FAILED-spår till PENDING och skicka till analysarbetaren (max 500)',
      action: () => run('Köa om misslyckade', () => queuePendingTracks({ limit: 500, status: 'FAILED' })),
    },
    {
      id: 'cleanup-orphaned',
      label: 'Rensa fastsittande spår',
      description: 'Återställ spår som fastnat i PROCESSING-status (30 min gräns)',
      action: () => run('Rensa fastsittande', () => cleanupOrphaned({ stuckThresholdMinutes: 30 })),
    },
    {
      id: 'backfill-isrcs',
      label: 'Komplettera ISRC',
      description: 'Hämta saknade ISRC-koder från Spotify (max 100)',
      action: () => run('Komplettera ISRC', () => backfillIsrcs({ limit: 100 })),
    },
    {
      id: 'backfill-duration',
      label: 'Komplettera spellängd',
      description: 'Hämta saknad spellängd från Spotify (max 200)',
      action: () => run('Komplettera spellängd', async () => {
        const res = await apiFetch('/api/admin/maintenance/backfill-duration?batchSize=200', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to backfill duration');
        return res.json();
      }),
    },
    {
      id: 'retrain-model',
      label: 'Omträna modell',
      description: 'Träna om klassificeringsmodellen baserat på bekräftade spår',
      action: () => run('Omträna modell', async () => {
        const res = await apiFetch(
          `/api/admin/maintenance/retrain-model?reclassify=${retrainReclassify}`,
          { method: 'POST' },
        );
        if (!res.ok) throw new Error('Failed to retrain model');
        return res.json();
      }),
      extraContent: (
        <label className="mt-2 flex items-center gap-2 text-xs text-[rgb(var(--color-text-muted))]">
          <input
            type="checkbox"
            checked={retrainReclassify}
            onChange={(e) => setRetrainReclassify(e.target.checked)}
            className="rounded border-[rgb(var(--color-border))]"
          />
          Omklassificera alla spår efteråt
        </label>
      ),
    },
    {
      id: 'reclassify-all',
      label: 'Omklassificera alla',
      description: 'Kör om dansstilsklassificering för hela biblioteket',
      needsConfirm: true,
      action: () => run('Omklassificera', () => reclassifyAll()),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Underhåll</h1>

      {/* Queue pause/resume controls */}
      <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[rgb(var(--color-text))]">Köer</h2>
          <Button
            variant="secondary"
            size="sm"
            disabled={pauseLoading !== null}
            onClick={handleToggleAll}
          >
            {Object.values(pauseStatus).some((v) => !v) ? 'Pausa alla' : 'Starta alla'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(pauseStatus).map(([queue, paused]) => (
            <button
              key={queue}
              onClick={() => handleToggleQueue(queue)}
              disabled={pauseLoading !== null}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                paused
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                  : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
              } ${pauseLoading !== null ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  paused ? 'bg-red-500' : 'bg-green-500'
                }`}
              />
              {QUEUE_LABELS[queue] ?? queue}
              <span className="font-normal">{paused ? 'Pausad' : 'Aktiv'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {operations.map((op) => (
          <div
            key={op.id}
            className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4"
          >
            <h3 className="text-sm font-medium text-[rgb(var(--color-text))]">{op.label}</h3>
            <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{op.description}</p>
            {op.extraContent}
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
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
            </div>
          </div>
        ))}
      </div>

      {/* Results history */}
      {history.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
          <h2 className="text-sm font-medium text-[rgb(var(--color-text))] mb-2">
            Resultat
          </h2>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="rounded bg-[rgb(var(--color-bg))] p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[rgb(var(--color-text))]">{h.label}</span>
                  <span className="text-xs text-[rgb(var(--color-text-muted))]">{h.time}</span>
                </div>
                <pre className="mt-1 text-xs text-[rgb(var(--color-text-muted))] whitespace-pre-wrap break-all max-h-24 overflow-auto">
                  {h.result}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation modal for dangerous operations */}
      <Modal
        open={!!confirmOp}
        onClose={() => setConfirmOp(null)}
        title="Bekräfta åtgärd"
      >
        <p className="text-sm text-[rgb(var(--color-text))]">
          {confirmOp === 'reclassify-all'
            ? 'Detta omklassificerar hela biblioteket. Det kan ta lång tid. Fortsätt?'
            : 'Är du säker på att du vill köra denna åtgärd?'}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOp(null)}>Avbryt</Button>
          <Button
            variant="primary"
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
