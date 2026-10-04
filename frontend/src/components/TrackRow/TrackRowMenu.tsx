import { Link } from 'react-router-dom';
import { IconButton } from '@/ui';
import { MoreVerticalIcon } from '@/icons';
import type { TrackListDto } from '@/api/models/trackListDto';
import { getTrackRowMenuItems, isActionItem, type ExtraMenuItem } from './trackRowMenuItems';

interface TrackRowMenuProps {
  track: TrackListDto;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAddToQueue: () => void;
  onFlag: () => void;
  onAddToPlaylist?: () => void;
  extraItems?: ExtraMenuItem[];
  isPrivate?: boolean;
}

const itemClassName =
  'flex w-full min-h-11 items-center px-4 text-left text-[15px] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))] focus:outline-none focus-visible:bg-[rgb(var(--color-accent-muted))]';

export function TrackRowMenu({
  track,
  open,
  onToggle,
  onClose,
  onAddToQueue,
  onFlag,
  onAddToPlaylist,
  extraItems,
  isPrivate,
}: TrackRowMenuProps) {
  const items = getTrackRowMenuItems({
    track,
    onAddToQueue,
    onFlag,
    onAddToPlaylist,
    extraItems,
    isPrivate,
  });

  return (
    <div className="relative shrink-0">
      <IconButton aria-label="Mer" aria-haspopup="menu" aria-expanded={open} onClick={onToggle}>
        <MoreVerticalIcon className="w-5 h-5" aria-hidden />
      </IconButton>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={onClose}
          />
          <ul
            className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-[var(--color-card-shadow)]"
            role="menu"
          >
            {items.map((item) => (
              <li key={item.key} role="none">
                {isActionItem(item) ? (
                  <button
                    type="button"
                    role="menuitem"
                    className={itemClassName}
                    onClick={async () => {
                      await item.onSelect();
                      onClose();
                    }}
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    to={item.to}
                    role="menuitem"
                    className={itemClassName}
                    onClick={onClose}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
