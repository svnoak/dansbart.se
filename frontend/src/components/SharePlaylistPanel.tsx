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

/** The body of the "Dela spellista" dialog: a link to copy, or the button that makes one. */
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
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">Dela spellista</h2>
        <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
          Skapa en länk så kan alla som har den se och spela spellistan.
        </p>
        <Button onClick={createLink}>Skapa länk</Button>
        <InlineError>{createLinkError}</InlineError>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">Dela spellista</h2>
      <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
        {shareUrl
          ? 'Alla som har länken kan se och spela spellistan.'
          : 'Skicka adressen till den du vill dela spellistan med.'}
      </p>
      <label htmlFor="share-playlist-url" className="sr-only">
        Länk till spellistan
      </label>
      <input
        id="share-playlist-url"
        readOnly
        value={shareUrl ?? pageUrl}
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
      />
      <Button variant="secondary" onClick={handleCopy}>
        Kopiera länk
      </Button>
      <InlineError>{shareUrl ? copyLinkError : pageLinkCopyError}</InlineError>
    </div>
  );
}
