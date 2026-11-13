import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  createDanceListGuestCode,
  createPlaylistGuestCode,
  removeDanceListGuestCode,
  removePlaylistGuestCode,
} from '@/api/generated/guest-codes/guest-codes';
import { Button, InlineError, toast } from '@/ui';
import { formatGuestCode, guestCodeUrl } from '@/utils/guestCode';

interface GuestCodePanelProps {
  kind: 'playlist' | 'danceList';
  listId: string;
  /** The code the list has now, if it has one. */
  code: string | null;
  /** Called with the new code, or null when the code was turned off. */
  onChange: (code: string | null) => void;
}

const WORDS = {
  playlist: { things: 'låtar', list: 'spellistan' },
  danceList: { things: 'danser', list: 'danslistan' },
};

/**
 * The code and QR code that let anyone add to a list without an account, with the
 * buttons that create, replace and turn off the code.
 */
export function GuestCodePanel({ kind, listId, code, onChange }: GuestCodePanelProps) {
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const words = WORDS[kind];

  async function handleCreate(replacing: boolean) {
    if (busy) return;
    setBusy(true);
    setCreateError(null);
    setRemoveError(null);
    try {
      const created =
        kind === 'playlist' ? await createPlaylistGuestCode(listId) : await createDanceListGuestCode(listId);
      onChange(created.code ?? null);
      toast(replacing ? 'Koden är bytt. Den gamla koden gäller inte längre.' : 'Koden är skapad');
    } catch {
      setCreateError(replacing ? 'Det gick inte att byta kod. Försök igen.' : 'Det gick inte att skapa en kod. Försök igen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (busy) return;
    setBusy(true);
    setCreateError(null);
    setRemoveError(null);
    try {
      if (kind === 'playlist') await removePlaylistGuestCode(listId);
      else await removeDanceListGuestCode(listId);
      onChange(null);
      toast('Koden är avstängd');
    } catch {
      setRemoveError('Det gick inte att stänga av koden. Försök igen.');
    } finally {
      setBusy(false);
    }
  }

  function handleCopy(url: string) {
    setCopyError(null);
    navigator.clipboard
      .writeText(url)
      .then(() => toast('Länk kopierad'))
      .catch(() => setCopyError('Det gick inte att kopiera länken.'));
  }

  if (!code) {
    return (
      <div className="space-y-3">
        <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
          Skapa en kod till en danskväll eller kurs. Alla som har koden kan lägga till {words.things} i{' '}
          {words.list}, även utan konto. De kan inte ta bort eller ändra något.
        </p>
        <Button onClick={() => handleCreate(false)} disabled={busy}>
          Skapa kod
        </Button>
        <InlineError>{createError}</InlineError>
      </div>
    );
  }

  const url = guestCodeUrl(code);
  const urlInputId = `guest-code-url-${listId}`;

  return (
    <div className="space-y-4">
      <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
        Alla som har koden kan lägga till {words.things} i {words.list}, även utan konto. De kan inte ta bort
        eller ändra något.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        {/* A QR code needs dark squares on a light ground to scan, in both themes. */}
        <div className="shrink-0 rounded-[var(--radius)] bg-white p-3">
          <QRCodeSVG
            value={url}
            size={168}
            level="M"
            fgColor="#000000"
            bgColor="#ffffff"
            role="img"
            title={`QR-kod för att lägga till ${words.things} i ${words.list}`}
          />
        </div>
        <div className="min-w-[14rem] flex-1 space-y-2">
          <p className="text-sm font-medium text-[rgb(var(--color-text))]">Kod</p>
          <p
            className="whitespace-nowrap font-mono text-[40px] font-bold leading-none tracking-[0.08em] text-[rgb(var(--color-text))]"
            aria-label={`Koden är ${code.split('').join(' ')}`}
          >
            {formatGuestCode(code)}
          </p>
          <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
            Skanna QR-koden, eller gå till{' '}
            <span className="font-semibold text-[rgb(var(--color-text))]">{window.location.host}/kod</span> och
            skriv koden.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor={urlInputId} className="block text-sm font-medium text-[rgb(var(--color-text))]">
          Länk att skicka
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={urlInputId}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 min-w-0 flex-1 rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
          />
          <Button variant="secondary" onClick={() => handleCopy(url)}>
            Kopiera länk
          </Button>
        </div>
        <InlineError>{copyError}</InlineError>
      </div>

      <div className="space-y-2 border-t border-[rgb(var(--color-border))] pt-4">
        <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
          Stäng av koden när kvällen är slut. Det som har lagts till ligger kvar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRemove} disabled={busy}>
            Stäng av koden
          </Button>
          <Button variant="ghost" onClick={() => handleCreate(true)} disabled={busy}>
            Byt till en ny kod
          </Button>
        </div>
        <InlineError>{removeError ?? createError}</InlineError>
      </div>
    </div>
  );
}
