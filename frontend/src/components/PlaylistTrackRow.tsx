import { GripIcon } from '@/icons';
import { TrackRow } from './TrackRow';
import type { TrackListDto } from '@/api/models/trackListDto';

interface PlaylistTrackRowProps {
  track: TrackListDto;
  contextTracks: TrackListDto[];
  isDragOver: boolean;
  /** When false, the grip handle is invisible but still reserves its space so layout stays stable. */
  showGrip?: boolean;
  onRemove?: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export function PlaylistTrackRow({
  track,
  contextTracks,
  isDragOver,
  showGrip = true,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: PlaylistTrackRowProps) {
  return (
    <li
      draggable={showGrip}
      onDragStart={showGrip ? onDragStart : undefined}
      onDragOver={showGrip ? onDragOver : undefined}
      onDrop={showGrip ? onDrop : undefined}
      onDragEnd={showGrip ? onDragEnd : undefined}
      className={`group relative flex items-center border-t-2 ${
        isDragOver ? 'border-[rgb(var(--color-accent))]' : 'border-transparent'
      }`}
    >
      <span
        onMouseDown={(e) => e.stopPropagation()}
        className={`shrink-0 px-1 transition-colors ${
          showGrip
            ? 'cursor-grab text-[rgb(var(--color-text-muted))]/40 hover:text-[rgb(var(--color-text-muted))]'
            : 'invisible'
        }`}
        aria-hidden
      >
        <GripIcon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <TrackRow track={track} contextTracks={contextTracks} />
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-10 top-1/2 -translate-y-1/2 hidden rounded px-2 py-1 text-xs text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50 hover:text-[rgb(var(--color-text))] group-hover:block"
          aria-label="Ta bort från spellista"
        >
          Ta bort
        </button>
      )}
    </li>
  );
}
