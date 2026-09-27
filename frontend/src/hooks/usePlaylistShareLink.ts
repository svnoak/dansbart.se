import { useCallback, useState } from 'react';
import { generateShareToken, invalidateShareToken } from '@/api/generated/playlists/playlists';
import { toast } from '@/ui';

export interface UsePlaylistShareLinkResult {
  shareToken: string | null;
  shareUrl: string | null;
  createLink: () => Promise<void>;
  removeLink: () => Promise<void>;
  copyLink: () => void;
  createLinkError: string | null;
  copyLinkError: string | null;
  removeLinkError: string | null;
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

  const [createLinkError, setCreateLinkError] = useState<string | null>(null);
  const [copyLinkError, setCopyLinkError] = useState<string | null>(null);
  const [removeLinkError, setRemoveLinkError] = useState<string | null>(null);

  const createLink = useCallback(async () => {
    if (!playlistId) return;
    setCreateLinkError(null);
    try {
      const updated = await generateShareToken(playlistId);
      setShareToken(updated.shareToken ?? null);
      toast('Delningslänk skapad');
    } catch {
      setCreateLinkError('Kunde inte skapa delningslänk');
    }
  }, [playlistId]);

  const removeLink = useCallback(async () => {
    if (!playlistId) return;
    setRemoveLinkError(null);
    try {
      await invalidateShareToken(playlistId);
      setShareToken(null);
      toast('Delningslänk ogiltigförklarad');
    } catch {
      setRemoveLinkError('Kunde inte ogiltigförklara länk');
    }
  }, [playlistId]);

  const copyLink = useCallback(() => {
    if (!shareToken) return;
    setCopyLinkError(null);
    const url = `${window.location.origin}/shared/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => toast('Länk kopierad')).catch(() => setCopyLinkError('Det gick inte att kopiera länken.'));
  }, [shareToken]);

  const shareUrl = shareToken ? `${window.location.origin}/shared/${shareToken}` : null;

  return {
    shareToken,
    shareUrl,
    createLink,
    removeLink,
    copyLink,
    createLinkError,
    copyLinkError,
    removeLinkError,
  };
}
