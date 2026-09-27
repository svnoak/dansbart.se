import { useState } from 'react';
import { Button, InlineError, toast } from '@/ui';

interface SharePlaylistPanelProps {
  playlistId: string;
  canEdit: boolean;
  shareToken: string | null;
  shareUrl: string | null;
  createLink: () => Promise<void>;
  copyLink: () => void;
  createLinkError?: string | null;
  copyLinkError?: string | null;
}

export function SharePlaylistPanel({
  playlistId,
  canEdit,
  shareToken,
  shareUrl,
  createLink,
  copyLink,
  createLinkError,
  copyLinkError,
}: SharePlaylistPanelProps) {
  const pageUrl = `${window.location.origin}/playlists/${playlistId}`;
  const [pageLinkCopyError, setPageLinkCopyError] = useState<string | null>(null);

  function handleCopy() {
    if (shareUrl) {
      setPageLinkCopyError(null);
      copyLink();
    } else {
      setPageLinkCopyError(null);
      navigator.clipboard
        .writeText(pageUrl)
        .then(() => toast('Länk kopierad'))
        .catch(() => setPageLinkCopyError('Det gick inte att kopiera länken.'));
    }
  }

  if (canEdit && !shareToken) {
    return (
      <div>
        <Button size="sm" onClick={createLink}>
          Skapa länk
        </Button>
        <InlineError>{createLinkError}</InlineError>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="break-all text-sm text-[rgb(var(--color-text-muted))]">{shareUrl ?? pageUrl}</p>
      <Button size="sm" variant="secondary" onClick={handleCopy}>
        Kopiera länk
      </Button>
      <InlineError>{shareUrl ? copyLinkError : pageLinkCopyError}</InlineError>
    </div>
  );
}
