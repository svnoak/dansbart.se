import { CloseIcon } from '@/icons';
import type { TrackListDto } from '@/api/models/trackListDto';

interface QueuePanelProps {
  queue: TrackListDto[];
  currentTrack: TrackListDto | null;
  onPlayFromQueue: (index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
}

export function QueuePanel({
  queue,
  currentTrack,
  onPlayFromQueue,
  onRemoveFromQueue,
  onClearQueue,
}: QueuePanelProps) {
  if (queue.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
          Kö ({queue.length})
        </h3>
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
      </div>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
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
