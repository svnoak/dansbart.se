import { Link } from 'react-router-dom';
import { Button, Modal } from '@/ui';
import type { TrackListDto } from '@/api/models/trackListDto';
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

const controlClassName = 'w-full min-h-11 justify-start text-left';

export function TrackActionsModal({
  open,
  track,
  onAddToQueue,
  onFlag,
  onAddToPlaylist,
  extraItems,
  isPrivate,
  onClose,
}: TrackActionsModalProps) {
  const title = track.title ?? 'Okänd låt';

  if (!open) return null;

  const items = getTrackRowMenuItems({
    track,
    onAddToQueue,
    onFlag,
    onAddToPlaylist,
    extraItems,
    isPrivate,
  });

  return (
    <Modal open={open} onClose={onClose} label={title}>
      <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--color-text))]">{title}</h2>
      <div className="flex flex-col gap-2">
        {items.map((item, index) =>
          isActionItem(item) ? (
            <Button
              key={item.key}
              autoFocus={index === 0}
              variant="secondary"
              className={controlClassName}
              onClick={async () => {
                await item.onSelect();
                onClose();
              }}
            >
              {item.label}
            </Button>
          ) : (
            <Link
              key={item.key}
              autoFocus={index === 0}
              to={item.to}
              onClick={onClose}
              className={`inline-flex items-center rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-accent-muted))] px-4 py-2 text-sm font-medium text-[rgb(var(--color-accent))] hover:opacity-90 ${controlClassName}`}
            >
              {item.label}
            </Link>
          ),
        )}
      </div>
    </Modal>
  );
}
