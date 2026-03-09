import { useRef, useState } from 'react';
import { CloseIcon, GripIcon } from '@/icons';
import type { TrackListDto } from '@/api/models/trackListDto';

interface QueuePanelProps {
  queue: TrackListDto[];
  currentTrack: TrackListDto | null;
  onPlayFromQueue: (index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
  onClose?: () => void;
}

export function QueuePanel({
  queue,
  currentTrack,
  onPlayFromQueue,
  onRemoveFromQueue,
  onClearQueue,
  onReorderQueue,
  onClose,
}: QueuePanelProps) {
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDragStart(i: number) {
    dragIndex.current = i;
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOverIndex(i);
  }

  function handleDrop(i: number) {
    const from = dragIndex.current;
    if (from !== null && from !== i) {
      // Blue indicator is at the top of element i ("insert before i").
      // After splice removes the dragged item the array shrinks by 1,
      // so elements below fromIndex shift left. When moving down we
      // therefore insert at i-1 to land in the correct slot.
      const to = from < i ? i - 1 : i;
      onReorderQueue(from, to);
    }
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--color-border))] shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Kö ({queue.length})
          </h3>
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
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))]"
            aria-label="Stäng kö"
          >
            <CloseIcon className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>
      {queue.length === 0 ? (
        <p className="flex-1 flex items-center justify-center text-sm text-[rgb(var(--color-text-muted))]">
          Kön är tom
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {queue.map((t, i) => (
            <QueueItem
              key={t.id ?? i}
              track={t}
              isCurrent={currentTrack?.id === t.id}
              isDragOver={dragOverIndex === i}
              onPlay={() => onPlayFromQueue(i)}
              onRemove={() => onRemoveFromQueue(i)}
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
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
  isDragOver,
  onPlay,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  track: TrackListDto;
  isCurrent: boolean;
  isDragOver: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 rounded-[var(--radius)] py-2 px-2 hover:bg-[rgb(var(--color-border))]/30 ${
        isDragOver ? 'border-t-2 border-[rgb(var(--color-accent))]' : 'border-t-2 border-transparent'
      }`}
    >
      <span
        onMouseDown={(e) => e.stopPropagation()}
        className="shrink-0 cursor-grab text-[rgb(var(--color-text-muted))]/50 hover:text-[rgb(var(--color-text-muted))]"
        aria-hidden
      >
        <GripIcon className="h-4 w-4" aria-hidden />
      </span>
      <button
        type="button"
        onClick={onPlay}
        className="min-w-0 flex-1 text-left"
      >
        <span className={`block text-sm truncate ${isCurrent ? 'font-medium text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text))]'}`}>
          {track.title ?? 'Okänd låt'}
        </span>
        <span className="block text-xs truncate text-[rgb(var(--color-text-muted))]">
          {track.artistName ?? 'Okänd artist'}
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
        aria-label="Ta bort från kö"
      >
        <CloseIcon className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}
