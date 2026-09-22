import { Button, toast } from '@/ui';

interface SharePlaylistPanelProps {
  playlistId: string;
  canEdit: boolean;
  shareToken: string | null;
  shareUrl: string | null;
  createLink: () => Promise<void>;
  copyLink: () => void;
}

export function SharePlaylistPanel({ playlistId, canEdit, shareToken, shareUrl, createLink, copyLink }: SharePlaylistPanelProps) {
  const pageUrl = `${window.location.origin}/playlists/${playlistId}`;

  function handleCopy() {
    if (shareUrl) {
      copyLink();
    } else {
      navigator.clipboard.writeText(pageUrl).then(() => toast('Länk kopierad')).catch(() => toast('Det gick inte att kopiera länken.', 'error'));
    }
  }

  if (canEdit && !shareToken) {
    return (
      <div className="rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-3">
        <Button size="sm" onClick={createLink}>
          Skapa länk
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-3">
      <p className="break-all text-sm text-[rgb(var(--color-text-muted))]">{shareUrl ?? pageUrl}</p>
      <Button size="sm" variant="secondary" onClick={handleCopy}>
        Kopiera länk
      </Button>
    </div>
  );
}
