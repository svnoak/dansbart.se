import { Link } from 'react-router-dom';
import { IconButton } from '@/ui';
import { MoreVerticalIcon } from '@/icons';
import type { TrackListDto } from '@/api/models/trackListDto';
import { getTrackRowMenuItems, isActionItem } from './trackRowMenuItems';

interface TrackRowMenuProps {
  track: TrackListDto;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAddToQueue: () => void;
  onFlag: () => void;
  onAddToPlaylist?: () => void;
}

export function TrackRowMenu({
  track,
  open,
  onToggle,
  onClose,
  onAddToQueue,
  onFlag,
  onAddToPlaylist,
}: TrackRowMenuProps) {
  const items = getTrackRowMenuItems({
    track,
    onAddToQueue,
    onFlag,
    onAddToPlaylist,
  });

  return (
    <div className="relative shrink-0">
      <IconButton aria-label="Mer" onClick={onToggle}>
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
            className="absolute right-0 top-full z-20 mt-1 w-48 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-lg"
            role="menu"
          >
            {items.map((item) => (
              <li key={item.key} role="none">
                {isActionItem(item) ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
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
                    className="block w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
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
