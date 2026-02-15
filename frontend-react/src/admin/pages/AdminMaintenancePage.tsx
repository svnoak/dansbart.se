import { useState } from 'react';
import {
  queuePendingTracks,
  cleanupOrphaned,
  backfillIsrcs,
  reclassifyAll,
} from '@/api/generated/admin-maintenance/admin-maintenance';
import { adminRequestOptions } from '@/admin/api/client';
import { Modal } from '@/admin/components/Modal';
import { Button } from '@/ui';
import { toast } from '@/admin/components/toastEmitter';

interface OperationResult {
  label: string;
  result: string;
  time: string;
}

export function AdminMaintenancePage() {
  const [running, setRunning] = useState<string | null>(null);
  const [history, setHistory] = useState<OperationResult[]>([]);
  const [confirmOp, setConfirmOp] = useState<string | null>(null);

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

  const operations = [
    {
      id: 'queue-pending',
      label: 'Köa väntande spår',
      description: 'Skicka PENDING-spår till analysarbetaren (max 500)',
      action: () => run('Köa väntande', () => queuePendingTracks({ limit: 500 }, adminRequestOptions())),
    },
    {
      id: 'cleanup-orphaned',
      label: 'Rensa fastsittande spår',
      description: 'Återställ spår som fastnat i PROCESSING-status (30 min gräns)',
      action: () => run('Rensa fastsittande', () => cleanupOrphaned({ stuckThresholdMinutes: 30 }, adminRequestOptions())),
    },
    {
      id: 'backfill-isrcs',
      label: 'Komplettera ISRC',
      description: 'Hämta saknade ISRC-koder från Spotify (max 100)',
      action: () => run('Komplettera ISRC', () => backfillIsrcs({ limit: 100 }, adminRequestOptions())),
    },
    {
      id: 'reclassify-all',
      label: 'Omklassificera alla',
      description: 'Kör om dansstilsklassificering för hela biblioteket',
      needsConfirm: true,
      action: () => run('Omklassificera', () => reclassifyAll(adminRequestOptions())),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Underhåll</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {operations.map((op) => (
          <div
            key={op.id}
            className="rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4"
          >
            <h3 className="text-sm font-medium text-[rgb(var(--color-text))]">{op.label}</h3>
            <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{op.description}</p>
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
