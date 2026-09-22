import { useCallback, useState } from 'react';
import { generateShareToken, invalidateShareToken } from '@/api/generated/playlists/playlists';
import { toast } from '@/ui';

export interface UsePlaylistShareLinkResult {
  shareToken: string | null;
  shareUrl: string | null;
  createLink: () => Promise<void>;
  removeLink: () => Promise<void>;
  copyLink: () => void;
}

/** Owns the share token for a playlist and the actions that create, remove, and copy its link. */
export function usePlaylistShareLink(
  playlistId: string | undefined,
  initialShareToken: string | undefined,
): UsePlaylistShareLinkResult {
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken ?? null);
  const [syncedInitial, setSyncedInitial] = useState(initialShareToken);
  if (initialShareToken !== syncedInitial) {
    setSyncedInitial(initialShareToken);
    setShareToken(initialShareToken ?? null);
  }

  const createLink = useCallback(async () => {
    if (!playlistId) return;
    try {
      const updated = await generateShareToken(playlistId);
      setShareToken(updated.shareToken ?? null);
      toast('Delningslänk skapad');
    } catch {
      toast('Kunde inte skapa delningslänk', 'error');
    }
  }, [playlistId]);

  const removeLink = useCallback(async () => {
    if (!playlistId) return;
    try {
      await invalidateShareToken(playlistId);
      setShareToken(null);
      toast('Delningslänk ogiltigförklarad');
    } catch {
      toast('Kunde inte ogiltigförklara länk', 'error');
    }
  }, [playlistId]);

  const copyLink = useCallback(() => {
    if (!shareToken) return;
    const url = `${window.location.origin}/shared/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => toast('Länk kopierad')).catch(() => toast('Det gick inte att kopiera länken.', 'error'));
  }, [shareToken]);

  const shareUrl = shareToken ? `${window.location.origin}/shared/${shareToken}` : null;

  return { shareToken, shareUrl, createLink, removeLink, copyLink };
}
