import { CloseIcon } from '@/icons';
import type { TrackListDto } from '@/api/models/trackListDto';

interface QueuePanelProps {
  queue: TrackListDto[];
  currentTrack: TrackListDto | null;
  onPlayFromQueue: (index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  onClose?: () => void;
}

export function QueuePanel({
  queue,
  currentTrack,
  onPlayFromQueue,
  onRemoveFromQueue,
  onClearQueue,
  onClose,
}: QueuePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--color-border))] shrink-0">
        <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
          Kö ({queue.length})
        </h3>
        <div className="flex items-center gap-3">
          {queue.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearQueue();
              }}
              className="text-xs text-[rgb(var(--color-accent))] hover:underline"
            >
              Rensa kö
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
              aria-label="Stäng kö"
            >
              <CloseIcon className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
      {queue.length === 0 ? (
        <p className="flex-1 flex items-center justify-center text-sm text-[rgb(var(--color-text-muted))]">
          Kön är tom
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {queue.map((t, i) => (
            <QueueItem
              key={t.id ?? i}
              track={t}
              isCurrent={currentTrack?.id === t.id}
              onPlay={() => onPlayFromQueue(i)}
              onRemove={() => onRemoveFromQueue(i)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function QueueItem({
  track,
  isCurrent,
  onPlay,
  onRemove,
}: {
  track: TrackListDto;
  isCurrent: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-[var(--radius)] py-1.5 px-2 hover:bg-[rgb(var(--color-border))]/30">
      <button
        type="button"
        onClick={onPlay}
        className="min-w-0 flex-1 text-left text-sm text-[rgb(var(--color-text))] hover:underline"
      >
        <span className={isCurrent ? 'font-medium' : ''}>
          {track.title ?? 'Okänd låt'}
        </span>
        {' · '}
        <span className="text-[rgb(var(--color-text-muted))]">
          {track.artistName ?? 'Okänd artist'}
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="shrink-0 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
        aria-label="Ta bort från kö"
      >
        <CloseIcon className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}
