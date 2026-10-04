import { GripIcon } from '@/icons';
import { TrackRow } from './TrackRow';
import { InlineError } from '@/ui';
import type { TrackListDto } from '@/api/models/trackListDto';

interface PlaylistTrackRowProps {
  track: TrackListDto;
  contextTracks: TrackListDto[];
  /** One-based position shown before the row and read in the handle's name. */
  position: number;
  isDragOver: boolean;
  /** When false, the grip handle is invisible but still reserves its space so layout stays stable. */
  showGrip?: boolean;
  error?: string | null;
  /** When given, the row menu gets a "Ta bort från spellistan" item. The heart stays in the row. */
  onRemove?: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

/**
 * A track row inside a playlist: a drag handle, the position number and the
 * one track row. Removal lives in the row menu so the heart keeps its place.
 */
export function PlaylistTrackRow({
  track,
  contextTracks,
  position,
  isDragOver,
  showGrip = true,
  error,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: PlaylistTrackRowProps) {
  const extraMenuItems = onRemove
    ? [{ label: 'Ta bort från spellistan', onClick: onRemove }]
    : undefined;

  return (
    <li
      draggable={showGrip}
      onDragStart={showGrip ? onDragStart : undefined}
      onDragOver={showGrip ? onDragOver : undefined}
      onDrop={showGrip ? onDrop : undefined}
      onDragEnd={showGrip ? onDragEnd : undefined}
      className={`group flex flex-wrap items-center border-t-2 ${
        isDragOver ? 'border-[rgb(var(--color-selected))]' : 'border-transparent'
      }`}
    >
      <button
        type="button"
        aria-label={`Flytta låt ${position}`}
        className={`flex h-11 w-8 shrink-0 items-center justify-center rounded-[var(--radius)] text-[rgb(var(--color-text-muted))] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] ${
          showGrip ? 'cursor-grab hover:bg-[rgb(var(--color-accent-muted))] active:cursor-grabbing' : 'invisible'
        }`}
        tabIndex={showGrip ? 0 : -1}
      >
        <GripIcon className="h-4 w-4" aria-hidden />
      </button>
      <span
        className="w-6 shrink-0 text-right text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]"
        aria-hidden
      >
        {position}
      </span>
      <div className="min-w-0 flex-1">
        <TrackRow track={track} contextTracks={contextTracks} extraMenuItems={extraMenuItems} />
      </div>
      {error && (
        <div className="w-full px-4 pb-2">
          <InlineError>{error}</InlineError>
        </div>
      )}
    </li>
  );
}
