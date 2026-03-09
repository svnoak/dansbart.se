import { Link } from 'react-router-dom';
import { IconButton, toast } from '@/ui';
import { MoreVerticalIcon } from '@/icons';
import type { TrackListDto } from '@/api/models/trackListDto';

interface TrackRowMenuProps {
  track: TrackListDto;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAddToQueue: () => void;
  onFlag: () => void;
}

export function TrackRowMenu({
  track,
  open,
  onToggle,
  onClose,
  onAddToQueue,
  onFlag,
}: TrackRowMenuProps) {
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
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
                onClick={() => {
                  onAddToQueue();
                  onClose();
                }}
              >
                Lägg i kö
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
                onClick={async () => {
                  const url = `${window.location.origin}?track=${track.id ?? ''}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    toast('Länk kopierad');
                  } catch {
                    toast('Kunde inte kopiera länk', 'error');
                  }
                  onClose();
                }}
              >
                Dela
              </button>
            </li>
            {track.artistId && (
              <li role="none">
                <Link
                  to={`/artist/${track.artistId}`}
                  role="menuitem"
                  className="block w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
                  onClick={onClose}
                >
                  Gå till artist
                </Link>
              </li>
            )}
            {track.albumId && (
              <li role="none">
                <Link
                  to={`/album/${track.albumId}`}
                  role="menuitem"
                  className="block w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
                  onClick={onClose}
                >
                  Gå till album
                </Link>
              </li>
            )}
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
                onClick={() => {
                  onFlag();
                  onClose();
                }}
              >
                Rapportera problem
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
