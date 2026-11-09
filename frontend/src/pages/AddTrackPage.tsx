import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { previewContributionLink, submitTrack } from '@/api/generated/contributions/contributions';
import type { LinkPreviewDto } from '@/api/models/linkPreviewDto';
import { ApiError } from '@/api/http-client';
import { useAuth } from '@/auth/useAuth';
import { AddDanceStyleForm } from '@/components/AddDanceStyleForm';
import { useStyleVote } from '@/hooks/useStyleVote';
import { PlusIcon, SpotifyIcon, YouTubeIcon } from '@/icons';
import { Button, Card, InlineError, toast } from '@/ui';

const TEMPO_OPTIONS = ['Långsamt', 'Lugnt', 'Lagom', 'Snabbt', 'Väldigt snabbt'];
const PREVIEW_DELAY_MS = 500;

const labelClass = 'mb-1 block text-[14px] font-semibold text-[rgb(var(--color-text))]';
const hintClass = 'mb-2 text-[14px] text-[rgb(var(--color-text-muted))]';
const inputClass =
  'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] disabled:opacity-50';

/** Looks like a YouTube or Spotify link, so it is worth asking the API about. */
function looksLikeTrackLink(url: string): boolean {
  return /(youtube\.com|youtu\.be|spotify\.com|^spotify:track:)/i.test(url.trim());
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof ApiError && e.detail ? e.detail : fallback;
}

/**
 * A signed-in person adds a track to the public library from a YouTube or Spotify
 * link and says which dance it is. The track is public at once; the audio analysis
 * then runs as for every other track.
 */
export function AddTrackPage() {
  const id = useId();
  const { user } = useAuth();
  const styles = useStyleVote(undefined, true);

  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<LinkPreviewDto | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [mainStyle, setMainStyle] = useState('');
  const [subStyle, setSubStyle] = useState('');
  const [tempo, setTempo] = useState('');
  const [addingStyle, setAddingStyle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const trimmed = url.trim();
    setPreview(null);
    setPreviewError(null);
    if (!trimmed) {
      setPreviewLoading(false);
      return;
    }
    if (!looksLikeTrackLink(trimmed)) {
      setPreviewLoading(false);
      setPreviewError('Klistra in en länk till en låt på YouTube eller Spotify.');
      return;
    }
    const request = ++requestRef.current;
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      previewContributionLink({ url: trimmed })
        .then((result) => {
          if (request !== requestRef.current) return;
          setPreview(result);
          if (result.title) setTitle(result.title);
          if (result.artistName) setArtistName(result.artistName);
        })
        .catch((e: unknown) => {
          if (request !== requestRef.current) return;
          setPreviewError(errorText(e, 'Det gick inte att läsa länken. Kontrollera den och försök igen.'));
        })
        .finally(() => {
          if (request === requestRef.current) setPreviewLoading(false);
        });
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [url]);

  if (user?.banned) {
    return (
      <div className="mx-auto max-w-xl py-4 sm:py-8">
        <h1 className="mb-3 text-[28px] font-bold text-[rgb(var(--color-text))]">Lägg till en låt</h1>
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Ditt konto kan inte lägga till låtar. Du kan fortfarande lyssna och rösta på dansstilar.
        </p>
      </div>
    );
  }

  const existing = preview?.existingTrackId ? preview : null;
  const subOptions = mainStyle ? styles.subStylesFor(mainStyle) : [];
  const canSubmit = !!preview && !!mainStyle && (!!existing || !!title.trim()) && !submitting;

  function resetForm() {
    setUrl('');
    setPreview(null);
    setTitle('');
    setArtistName('');
    setMainStyle('');
    setSubStyle('');
    setTempo('');
    setSubmitError(null);
  }

  async function handleSubmit() {
    if (!mainStyle) {
      setSubmitError('Välj vilken dans låten passar till.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitTrack({
        url: url.trim(),
        title: title.trim() || undefined,
        artistName: artistName.trim() || undefined,
        mainStyle,
        subStyle: subStyle || undefined,
        tempoCategory: tempo || undefined,
      });
      if (result.status === 'EXISTS') {
        toast('Låten fanns redan. Din dansstil är sparad som en röst.');
      } else if (result.status === 'QUEUED') {
        toast('Tack! Vi hämtar låten från Spotify och letar upp den på YouTube. Den syns om några minuter.');
      } else {
        toast('Tack! Låten är tillagd och analyseras nu. Den syns om några minuter.');
      }
      resetForm();
    } catch (e) {
      setSubmitError(errorText(e, 'Det gick inte att lägga till låten. Försök igen.'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleStyleCreated(main: string, sub: string | null) {
    void styles.reload().then(() => {
      setMainStyle(main);
      setSubStyle(sub ?? '');
      setAddingStyle(false);
      toast(sub ? `${sub} är tillagd under ${main}.` : `${main} är tillagd som dansstil.`);
    });
  }

  const SourceIcon = preview?.source === 'SPOTIFY' ? SpotifyIcon : YouTubeIcon;

  return (
    <div className="mx-auto max-w-xl py-4 sm:py-8">
      <h1 className="mb-2 text-[28px] font-bold leading-tight text-[rgb(var(--color-text))]">Lägg till en låt</h1>
      <p className="mb-6 text-[15px] text-[rgb(var(--color-text-muted))]">
        Saknas en låt i Dansbart? Klistra in en länk från YouTube eller Spotify och berätta vilken
        dans den passar till. Låten blir synlig för alla och analyseras som alla andra låtar.
      </p>

      <div className="space-y-6">
        <div>
          <label htmlFor={`${id}-url`} className={labelClass}>Länk till låten</label>
          <p id={`${id}-url-hint`} className={hintClass}>Från YouTube eller Spotify.</p>
          <input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.youtube.com/watch?v=..."
            aria-describedby={`${id}-url-hint`}
            value={url}
            onChange={(e) => { setUrl(e.target.value); setSubmitError(null); }}
            className={inputClass}
          />
          <div className="mt-2 space-y-2">
            {previewLoading && (
              <p className="text-[14px] text-[rgb(var(--color-text-muted))]" role="status">Läser länken...</p>
            )}
            <InlineError>{previewError}</InlineError>
            {existing && (
              <Card className="p-4">
                <p className="text-[15px] text-[rgb(var(--color-text))]">
                  <span className="font-semibold">Den här låten finns redan:</span>{' '}
                  {existing.existingTrackTitle ?? 'okänd titel'}.
                </p>
                <p className="mt-1 text-[14px] text-[rgb(var(--color-text-muted))]">
                  Välj ändå vilken dans den passar till, så räknas det som din röst.
                </p>
              </Card>
            )}
            {preview && !existing && (
              <p className="flex items-center gap-2 text-[14px] text-[rgb(var(--color-text-muted))]">
                <SourceIcon className="h-5 w-5 shrink-0" aria-hidden />
                {preview.source === 'SPOTIFY'
                  ? 'Låten hittades på Spotify. Vi letar upp den på YouTube när du lagt till den.'
                  : 'Videon hittades på YouTube.'}
              </p>
            )}
          </div>
        </div>

        {preview && !existing && (
          <>
            <div>
              <label htmlFor={`${id}-title`} className={labelClass}>Låtens titel</label>
              <input
                id={`${id}-title`}
                type="text"
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor={`${id}-artist`} className={labelClass}>Artist eller grupp</label>
              <input
                id={`${id}-artist`}
                type="text"
                value={artistName}
                maxLength={200}
                onChange={(e) => setArtistName(e.target.value)}
                className={inputClass}
              />
            </div>
          </>
        )}

        {preview && (
          <>
            <div>
              <label htmlFor={`${id}-main`} className={labelClass}>Vilken dans passar låten till?</label>
              <select
                id={`${id}-main`}
                value={mainStyle}
                onChange={(e) => { setMainStyle(e.target.value); setSubStyle(''); setSubmitError(null); }}
                className={inputClass}
              >
                <option value="">Välj dans...</option>
                {styles.mainCategories.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {subOptions.length > 0 && (
              <div>
                <label htmlFor={`${id}-sub`} className={labelClass}>Variant</label>
                <select
                  id={`${id}-sub`}
                  value={subStyle}
                  onChange={(e) => setSubStyle(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Vet ej / allmän {mainStyle.toLowerCase()}</option>
                  {subOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {addingStyle ? (
              <AddDanceStyleForm
                mainStyles={styles.mainCategories}
                defaultParent={mainStyle || undefined}
                onCreated={handleStyleCreated}
                onCancel={() => setAddingStyle(false)}
              />
            ) : (
              <Button variant="outline" onClick={() => setAddingStyle(true)}>
                <PlusIcon className="h-5 w-5" aria-hidden />
                Dansen saknas – lägg till en ny dansstil
              </Button>
            )}

            <div>
              <label htmlFor={`${id}-tempo`} className={labelClass}>Danstempo (valfritt)</label>
              <select
                id={`${id}-tempo`}
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                className={inputClass}
              >
                <option value="">Vet ej</option>
                {TEMPO_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <InlineError>{submitError}</InlineError>
              <Button size="lg" onClick={() => void handleSubmit()} disabled={!canSubmit}>
                {submitting ? 'Lägger till...' : existing ? 'Spara min röst' : 'Lägg till låten'}
              </Button>
            </div>
          </>
        )}
      </div>

      <p className="mt-8 text-[14px] text-[rgb(var(--color-text-muted))]">
        Vill du hellre lägga till låtar bara för dig själv? Använd{' '}
        <Link to="/mina-latar" className="font-semibold text-[rgb(var(--color-link))] hover:underline">
          Mina låtar
        </Link>
        .
      </p>
    </div>
  );
}
