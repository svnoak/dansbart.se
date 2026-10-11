import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { getSubmissionBatch, submitMusicLink } from '@/api/generated/track-submissions/track-submissions';
import { ApiError } from '@/api/http-client';
import type { TrackSubmissionBatchDto } from '@/api/models/trackSubmissionBatchDto';
import { useAuth } from '@/auth/useAuth';
import { PlusIcon, SpotifyIcon, YouTubeIcon } from '@/icons';
import { Button, Card, InlineError, toast } from '@/ui';
import { getVoterId } from '@/utils/voter';
import { SubmissionTrackList } from './addmusic/SubmissionTrackList';
import { isStillAnalysing } from './addmusic/submissionStatus';

const POLL_INTERVAL_MS = 10_000;
const POLL_LIMIT = 30;

const inputClass =
  'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] disabled:opacity-50';

function errorMessage(error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0;
  switch (status) {
    case 400:
      return 'Länken känns inte igen. Klistra in en länk till en låt, ett album, en artist eller en spellista på Spotify eller YouTube.';
    case 404:
      return 'Hittade ingen musik bakom länken. Kontrollera att den går att öppna.';
    case 502:
      return 'Kunde inte hämta från Spotify eller YouTube just nu. Försök igen om en stund.';
    default:
      return 'Kunde inte lägga till musiken, försök igen.';
  }
}

function sourceHeading(batch: TrackSubmissionBatchDto): string {
  const name = batch.sourceName;
  switch (batch.sourceKind) {
    case 'album':
      return name ? `Albumet ${name}` : 'Album';
    case 'artist':
      return name ? `Artisten ${name}` : 'Artist';
    case 'playlist':
      return name ? `Spellistan ${name}` : 'Spellista';
    case 'channel':
      return name ? `Kanalen ${name}` : 'Kanal';
    default:
      return batch.items?.[0]?.title ?? 'Låt';
  }
}

function summary(batch: TrackSubmissionBatchDto): string {
  const items = batch.items ?? [];
  const pending = items.filter((i) => i.status === 'pending').length;
  const added = items.filter((i) => i.status === 'approved').length;
  const existing = items.filter((i) => i.status === 'exists').length;
  const parts: string[] = [];
  if (added > 0) parts.push(added === 1 ? '1 låt hämtas och analyseras' : `${added} låtar hämtas och analyseras`);
  if (pending > 0) parts.push(pending === 1 ? '1 låt väntar på granskning' : `${pending} låtar väntar på granskning`);
  if (existing > 0) parts.push(existing === 1 ? '1 låt fanns redan' : `${existing} låtar fanns redan`);
  return parts.join(', ') + '.';
}

/**
 * "Lägg till musik": paste a Spotify or YouTube link, see the tracks it holds with a
 * suggested dance style each, and follow them until they are analysed. People who are
 * not yet trusted see their tracks wait for an admin instead. No login needed.
 */
export function AddMusicPage() {
  const { isAuthenticated } = useAuth();
  const id = useId();
  const inputId = `${id}-link`;
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<TrackSubmissionBatchDto | null>(null);
  const polls = useRef(0);

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Klistra in en länk först.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitMusicLink({ url: trimmed }, { headers: { 'X-Voter-ID': getVoterId() } });
      setBatch(result);
      polls.current = 0;
      setUrl('');
      const count = result.items?.length ?? 0;
      toast(
        result.needsReview
          ? count === 1
            ? 'Tack! Låten granskas av en administratör innan den syns.'
            : `Tack! ${count} låtar granskas av en administratör innan de syns.`
          : count === 1
            ? 'Låten är tillagd och analyseras nu.'
            : `${count} låtar är tillagda och analyseras nu.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const refresh = useCallback(async (batchId: string) => {
    try {
      const next = await getSubmissionBatch(batchId);
      setBatch(next);
    } catch {
      // Keep what we have; the next tick tries again.
    }
  }, []);

  useEffect(() => {
    if (!batch?.batchId || !(batch.items ?? []).some(isStillAnalysing) || polls.current >= POLL_LIMIT) return;
    const timer = setTimeout(() => {
      polls.current += 1;
      void refresh(batch.batchId as string);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [batch, refresh]);

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Lägg till musik
        </h1>
        <p className="text-base text-[rgb(var(--color-text-muted))]">
          Klistra in en länk till en låt, ett album, en artist eller en spellista på Spotify eller YouTube.
          Låtarna hämtas, får ett förslag på dansstil utifrån sina titlar och analyseras sedan så att de går att
          hitta efter dans och tempo.
        </p>
      </header>

      <Card className="p-5">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <label htmlFor={inputId} className="block text-[15px] font-semibold text-[rgb(var(--color-text))]">
            Länk till Spotify eller YouTube
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id={inputId}
              type="url"
              inputMode="url"
              autoComplete="off"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://open.spotify.com/album/… eller https://youtu.be/…"
              className={inputClass}
              disabled={submitting}
            />
            <Button type="submit" disabled={submitting} className="sm:shrink-0">
              <PlusIcon className="h-4 w-4" aria-hidden />
              {submitting ? 'Hämtar…' : 'Lägg till'}
            </Button>
          </div>
          <InlineError>{error}</InlineError>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[rgb(var(--color-text-muted))]">
          <span className="inline-flex items-center gap-1.5">
            <SpotifyIcon className="h-4 w-4" aria-hidden /> Låt, album, artist eller spellista
          </span>
          <span className="inline-flex items-center gap-1.5">
            <YouTubeIcon className="h-4 w-4" aria-hidden /> Video, spellista eller kanal
          </span>
        </div>
        {!isAuthenticated && (
          <p className="mt-3 text-sm text-[rgb(var(--color-text-muted))]">
            Du behöver inget konto. Låtar som läggs till utan inloggning granskas av en administratör innan de syns.
          </p>
        )}
      </Card>

      {batch && (
        <Card className="mt-6 p-5" aria-live="polite">
          <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">{sourceHeading(batch)}</h2>
          <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">{summary(batch)}</p>
          {batch.needsReview && (
            <p className="mt-2 text-sm text-[rgb(var(--color-text))]">
              En administratör tittar på låtarna innan de analyseras. Inloggade personer vars bidrag har godkänts
              tidigare slipper det steget.
            </p>
          )}
          {batch.truncated && (
            <p className="mt-2 text-sm text-[rgb(var(--color-text))]">
              {batch.provider === 'youtube'
                ? `YouTube lämnar bara ut de ${batch.items?.length ?? 0} senaste videorna i en spellista eller kanal. Klistra in enskilda videor för att ta med äldre.`
                : `Länken hade fler låtar än vad som ryms i en omgång. De första ${batch.items?.length ?? 0} lades till. Klistra in ett album eller en spellista i taget för att ta med resten.`}
            </p>
          )}
          <div className="mt-4">
            <SubmissionTrackList items={batch.items ?? []} />
          </div>
          <p className="mt-3 text-sm text-[rgb(var(--color-text-muted))]">
            Dansstilen är ett förslag utifrån låttiteln. När låten är analyserad kan du och andra bekräfta eller ändra
            den som vanligt.
          </p>
        </Card>
      )}
    </div>
  );
}
