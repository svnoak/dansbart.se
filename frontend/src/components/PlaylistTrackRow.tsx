import { GripIcon } from '@/icons';
import { TrackRow } from './TrackRow';
import { Button } from '@/ui';
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
      className={`group flex items-center border-t-2 ${
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
        <TrackRow
          track={track}
          contextTracks={contextTracks}
          action={
            onRemove && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onRemove}
                aria-label="Ta bort från spellista"
              >
                Ta bort
              </Button>
            )
          }
        />
      </div>
    </li>
  );
}
