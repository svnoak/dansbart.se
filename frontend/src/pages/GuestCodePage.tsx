import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addGuestDance, addGuestTrack, getGuestList } from '@/api/generated/guest-codes/guest-codes';
import { getDances } from '@/api/generated/dances/dances';
import { searchTracks } from '@/api/generated/tracks/tracks';
import { ApiError } from '@/api/http-client';
import type { Dance } from '@/api/models/dance';
import type { GuestListDto } from '@/api/models/guestListDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import { SelectableSearchResults, TrackRow } from '@/components';
import { PlaylistIcon, PlusIcon, QueueListIcon } from '@/icons';
import { Button, Card, EmptyState, InlineError, LoadError, RowSkeleton, toast } from '@/ui';
import { GUEST_CODE_LENGTH, formatGuestCode, normalizeGuestCode } from '@/utils/guestCode';

const INPUT_CLASS =
  'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 text-[15px] text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';

const LINK_BUTTON_CLASS =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] transition-colors hover:bg-[rgb(var(--color-accent-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';

const TOO_MANY = 'Det har kommit många tillägg på kort tid. Vänta en minut och försök igen.';

/** `/kod`: the form where a guest types the code from the screen at the dance. */
function GuestCodeEntry() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeGuestCode(value);
    if (code.length !== GUEST_CODE_LENGTH) {
      setError(`Koden har ${GUEST_CODE_LENGTH} tecken. Kontrollera att du har skrivit hela koden.`);
      return;
    }
    navigate(`/kod/${code}`);
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          Lägg till med kod
        </h1>
        <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
          Har du fått en kod på en danskväll eller kurs? Skriv den här, så kan du lägga till i listan. Du
          behöver inget konto.
        </p>
      </div>
      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="guest-code" className="block text-sm font-medium text-[rgb(var(--color-text))]">
            Kod
          </label>
          <input
            id="guest-code"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ABC 234"
            className={`${INPUT_CLASS} font-mono text-2xl tracking-[0.08em] uppercase placeholder:normal-case`}
          />
          <InlineError>{error}</InlineError>
          <Button type="submit">Öppna listan</Button>
        </form>
      </Card>
    </div>
  );
}

type LoadState = 'loading' | 'ready' | 'notFound' | 'tooMany' | 'failed';

/** `/kod/:code`: the list a code belongs to, with the one thing a guest can do: add to it. */
function GuestList({ code }: { code: string }) {
  const [list, setList] = useState<GuestListDto | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [trackResults, setTrackResults] = useState<TrackListDto[]>([]);
  const [danceResults, setDanceResults] = useState<Dance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    getGuestList(code, { signal: controller.signal })
      .then((loaded) => {
        setList(loaded);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 404) setState('notFound');
        else if (error instanceof ApiError && error.status === 429) setState('tooMany');
        else setState('failed');
      });
    return () => controller.abort();
  }, [code, loadAttempt]);

  const retryLoad = useCallback(() => {
    setState('loading');
    setLoadAttempt((n) => n + 1);
  }, []);

  const isPlaylist = list?.type === 'playlist';
  const hasList = list !== null;
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!hasList || !trimmedQuery) {
      setTrackResults([]);
      setDanceResults([]);
      setSearching(false);
      setSearchFailed(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchFailed(false);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const search = isPlaylist
        ? searchTracks({ q: trimmedQuery, pageable: { page: 0, size: 20 } }).then((result) => {
            if (!cancelled) setTrackResults(result?.items ?? []);
          })
        : getDances({ search: trimmedQuery }).then((result) => {
            if (!cancelled) setDanceResults(result?.items ?? []);
          });
      search
        .catch(() => {
          if (cancelled) return;
          setTrackResults([]);
          setDanceResults([]);
          setSearchFailed(true);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(debounceRef.current);
    };
    // Whether a list is loaded, not its contents: adding to the list must not search again.
  }, [trimmedQuery, isPlaylist, hasList]);

  async function add(request: () => Promise<GuestListDto>, done: string, duplicate: string) {
    if (adding) return;
    setAdding(true);
    setAddError(null);
    try {
      setList(await request());
      setQuery('');
      setSelectedId(null);
      toast(done);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 409) setAddError(duplicate);
      else if (status === 404) setState('notFound');
      else if (status === 429) setAddError(TOO_MANY);
      else setAddError('Det gick inte att lägga till. Försök igen.');
    } finally {
      setAdding(false);
    }
  }

  if (state === 'loading') return <RowSkeleton rows={4} label="Öppnar listan" />;

  if (state === 'notFound') {
    return (
      <EmptyState
        icon={<PlaylistIcon className="h-7 w-7" aria-hidden />}
        title="Koden gäller inte"
        description={`Ingen lista har koden ${formatGuestCode(code)}. Den kan vara felskriven, eller så har den som äger listan stängt av den.`}
        action={
          <Link to="/kod" className={LINK_BUTTON_CLASS}>
            Skriv en annan kod
          </Link>
        }
      />
    );
  }

  if (state !== 'ready' || !list) {
    return (
      <LoadError
        message={state === 'tooMany' ? TOO_MANY : 'Det gick inte att öppna listan.'}
        onRetry={retryLoad}
      />
    );
  }

  const tracks = list.tracks ?? [];
  const dances = list.dances ?? [];
  const presentTrackIds = new Set(tracks.map((t) => t.id).filter((id): id is string => !!id));
  const presentDanceIds = new Set(dances.map((d) => d.danceId).filter((id): id is string => !!id));
  const searchInputId = 'guest-add-search';
  const noResults =
    !searching && !searchFailed && !!trimmedQuery && (isPlaylist ? trackResults : danceResults).length === 0;

  return (
    <div className="space-y-6">
      <Card className="space-y-2 p-7">
        <p className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
          {isPlaylist ? 'Spellista' : 'Danslista'}
          {list.ownerName ? ` av ${list.ownerName}` : ''}
        </p>
        <h1 className="break-words text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
          {list.name}
        </h1>
        {list.description && <p className="text-[15px] text-[rgb(var(--color-text))]">{list.description}</p>}
        <p className="text-[15px] text-[rgb(var(--color-text-muted))]">
          {isPlaylist
            ? 'Med koden kan du lägga till låtar i spellistan. Du behöver inget konto.'
            : 'Med koden kan du lägga till danser i danslistan. Du behöver inget konto.'}
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <label htmlFor={searchInputId} className="block text-base font-bold text-[rgb(var(--color-text))]">
          {isPlaylist ? 'Lägg till en låt' : 'Lägg till en dans'}
        </label>
        <input
          id={searchInputId}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
            setAddError(null);
          }}
          placeholder={isPlaylist ? 'Sök på låt eller artist' : 'Skriv dansens namn'}
          className={INPUT_CLASS}
        />

        {searching && <p className="text-sm text-[rgb(var(--color-text-muted))]">Söker...</p>}

        {!searching && isPlaylist && (
          <SelectableSearchResults
            results={trackResults}
            getId={(track) => track.id}
            renderResult={(track) => (track.artistName ? `${track.title} – ${track.artistName}` : track.title)}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onConfirm={(track) =>
              add(
                () => addGuestTrack(code, { trackId: track.id }),
                'Låten är tillagd',
                'Låten finns redan i spellistan.',
              )
            }
            confirming={adding}
            disabledIds={presentTrackIds}
            disabledLabel="Finns redan"
          />
        )}

        {!searching && !isPlaylist && (
          <SelectableSearchResults
            results={danceResults}
            getId={(dance) => dance.id}
            renderResult={(dance) => dance.name}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onConfirm={(dance) =>
              add(
                () => addGuestDance(code, { danceId: dance.id }),
                'Dansen är tillagd',
                'Dansen finns redan i danslistan.',
              )
            }
            confirming={adding}
            disabledIds={presentDanceIds}
            disabledLabel="Finns redan"
          />
        )}

        {!searching && searchFailed && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">Sökningen misslyckades. Försök igen.</p>
        )}

        {noResults && isPlaylist && (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Ingen låt matchar sökningen. Pröva med ett annat ord.
          </p>
        )}

        {noResults && !isPlaylist && (
          <div className="space-y-2">
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              Dansen finns inte på sidan. Lägg till den med namnet du skrev:
            </p>
            <Button
              variant="secondary"
              disabled={adding}
              onClick={() =>
                add(
                  () => addGuestDance(code, { name: trimmedQuery }),
                  'Dansen är tillagd',
                  'Dansen finns redan i danslistan.',
                )
              }
            >
              <PlusIcon className="h-4 w-4" aria-hidden />
              Lägg till ”{trimmedQuery}”
            </Button>
          </div>
        )}

        <InlineError>{addError}</InlineError>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[rgb(var(--color-text))]">
          {isPlaylist ? 'Låtar i spellistan' : 'Danser i danslistan'}
        </h2>
        {isPlaylist && tracks.length === 0 && (
          <EmptyState
            icon={<PlaylistIcon className="h-7 w-7" aria-hidden />}
            title="Spellistan är tom"
            description="Sök efter en låt här ovanför för att lägga till den första."
          />
        )}
        {isPlaylist && tracks.length > 0 && (
          <ol className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
            {tracks.map((track, i) => (
              <li key={track.id} className="flex items-center">
                <span
                  className="w-10 shrink-0 text-center text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <TrackRow track={track} contextTracks={tracks} />
                </div>
              </li>
            ))}
          </ol>
        )}
        {!isPlaylist && dances.length === 0 && (
          <EmptyState
            icon={<QueueListIcon className="h-7 w-7" aria-hidden />}
            title="Danslistan är tom"
            description="Sök efter en dans här ovanför för att lägga till den första."
          />
        )}
        {!isPlaylist && dances.length > 0 && (
          <ol className="overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))]">
            {dances.map((dance, i) => (
              <li
                key={`${i}-${dance.danceId ?? dance.name}`}
                className="flex min-h-11 items-center gap-3 border-b border-[rgb(var(--color-border))] px-3 py-2 last:border-b-0"
              >
                <span
                  className="w-6 shrink-0 text-right text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]"
                  aria-hidden
                >
                  {i + 1}
                </span>
                {dance.danceId ? (
                  <Link
                    to={`/dance/${dance.danceId}`}
                    className="min-w-0 truncate text-[15px] font-medium text-[rgb(var(--color-text))] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
                  >
                    {dance.name}
                  </Link>
                ) : (
                  <span className="min-w-0 truncate text-[15px] font-medium text-[rgb(var(--color-text))]">
                    {dance.name}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function GuestCodePage() {
  const { code } = useParams<{ code: string }>();
  if (!code) return <GuestCodeEntry />;
  const normalized = normalizeGuestCode(code);
  // A new code is a new list: remount so no state of the previous list is left.
  return <GuestList key={normalized} code={normalized} />;
}
