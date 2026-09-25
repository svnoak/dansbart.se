import type { TrackListDto } from '@/api/models/trackListDto';
import { toast } from '@/ui';

interface ActionItem {
  key: string;
  label: string;
  onSelect: () => void | Promise<void>;
  to?: never;
}

interface LinkItem {
  key: string;
  label: string;
  to: string;
  onSelect?: never;
}

type MenuItem = ActionItem | LinkItem;

export function isActionItem(item: MenuItem): item is ActionItem {
  return 'onSelect' in item;
}

export interface GetTrackRowMenuItemsProps {
  track: TrackListDto;
  onAddToQueue: () => void;
  onFlag: () => void;
  onAddToPlaylist?: () => void;
}

export function getTrackRowMenuItems({
  track,
  onAddToQueue,
  onFlag,
  onAddToPlaylist,
}: GetTrackRowMenuItemsProps): MenuItem[] {
  const items: MenuItem[] = [];

  items.push({
    key: 'add-to-queue',
    label: 'Lägg i kö',
    onSelect: onAddToQueue,
  });

  if (onAddToPlaylist) {
    items.push({
      key: 'add-to-playlist',
      label: 'Lägg till i spellista',
      onSelect: onAddToPlaylist,
    });
  }

  items.push({
    key: 'share',
    label: 'Dela',
    onSelect: async () => {
      const url = `${window.location.origin}?track=${track.id ?? ''}`;
      try {
        await navigator.clipboard.writeText(url);
        toast('Länk kopierad');
      } catch {
        toast('Kunde inte kopiera länk', 'error');
      }
    },
  });

  if (track.artistId) {
    items.push({
      key: 'artist-link',
      label: 'Gå till artist',
      to: `/artist/${track.artistId}`,
    });
  }

  if (track.albumId) {
    items.push({
      key: 'album-link',
      label: 'Gå till album',
      to: `/album/${track.albumId}`,
    });
  }

  items.push({
    key: 'flag',
    label: 'Rapportera problem',
    onSelect: onFlag,
  });

  return items;
}
