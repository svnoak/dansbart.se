import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { TrackListDto } from '@/api/models/trackListDto';
import { StylePill } from './StylePill';
import { stylePillState } from './stylePillState';
import { getTrackRowMenuItems, isActionItem, type ExtraMenuItem } from './trackRowMenuItems';

interface TrackActionsModalProps {
  open: boolean;
  track: TrackListDto;
  onAddToQueue: () => void;
  onFlag: () => void;
  onAddToPlaylist?: () => void;
  extraItems?: ExtraMenuItem[];
  isPrivate?: boolean;
  onClose: () => void;
}

const rowClassName =
  'flex w-full min-h-12 items-center px-3 text-left text-[15px] font-medium text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:bg-[rgb(var(--color-accent-muted))]';

/**
 * The sheet a long press on a row opens. On a phone it rises from the bottom
 * edge; on a wider screen it sits in the middle like the other dialogs.
 */
export function TrackActionsModal(props: TrackActionsModalProps) {
  return props.open ? <TrackActionsSheet {...props} /> : null;
}

function TrackActionsSheet({
  track,
  onAddToQueue,
  onFlag,
  onAddToPlaylist,
  extraItems,
  isPrivate,
  onClose,
}: TrackActionsModalProps) {
  const title = track.title ?? 'Okänd låt';
  const state = stylePillState(track.danceStyle, track.confidence);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const items = getTrackRowMenuItems({
    track,
    onAddToQueue,
    onFlag,
    onAddToPlaylist,
    extraItems,
    isPrivate,
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full rounded-t-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[var(--color-card-shadow)] sm:max-w-sm sm:rounded-[var(--radius-lg)] sm:pb-2">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[rgb(var(--color-border-strong))] sm:hidden" aria-hidden />
        <div className="flex flex-col gap-1 px-4 pb-3 pt-3">
          <h2 className="text-[20px] font-bold leading-tight text-[rgb(var(--color-text))]">
            {title}
          </h2>
          {track.artistName && (
            <p className="text-[15px] text-[rgb(var(--color-text-muted))]">{track.artistName}</p>
          )}
          <div className="mt-1">
            <StylePill style={track.danceStyle} state={state} />
          </div>
        </div>
        <ul className="divide-y divide-[rgb(var(--color-border))] border-t border-[rgb(var(--color-border))]">
          {items.map((item, index) => (
            <li key={item.key}>
              {isActionItem(item) ? (
                <button
                  type="button"
                  autoFocus={index === 0}
                  className={rowClassName}
                  onClick={async () => {
                    await item.onSelect();
                    onClose();
                  }}
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  autoFocus={index === 0}
                  to={item.to}
                  onClick={onClose}
                  className={rowClassName}
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
