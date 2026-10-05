import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnchoredMenu, IconButton, menuItemClassName } from '@/ui';
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const items = getTrackRowMenuItems({
    track,
    onAddToQueue,
    onFlag,
    onAddToPlaylist,
    extraItems,
    isPrivate,
  });

  return (
    <div className="shrink-0">
      <IconButton ref={buttonRef} aria-label="Mer" aria-haspopup="menu" aria-expanded={open} onClick={onToggle}>
        <MoreVerticalIcon className="w-5 h-5" aria-hidden />
      </IconButton>
      <AnchoredMenu open={open} anchorRef={buttonRef} onClose={onClose}>
        {items.map((item) => (
          <li key={item.key} role="none">
            {isActionItem(item) ? (
              <button
                type="button"
                role="menuitem"
                className={menuItemClassName}
                onClick={async () => {
                  await item.onSelect();
                  onClose();
                }}
              >
                {item.label}
              </button>
            ) : (
              <Link to={item.to} role="menuitem" className={menuItemClassName} onClick={onClose}>
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </AnchoredMenu>
    </div>
  );
}
