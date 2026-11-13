import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addGuestDance, addGuestTrack, getGuestList } from '@/api/generated/guest-codes/guest-codes';
import { getDances, getMatchingTracks } from '@/api/generated/dances/dances';
import { searchTracks } from '@/api/generated/tracks/tracks';
import { ApiError } from '@/api/http-client';
import type { Dance } from '@/api/models/dance';
import type { GuestListDto } from '@/api/models/guestListDto';
import type { TrackListDto } from '@/api/models/trackListDto';
import { SelectableSearchResults, TrackRow } from '@/components';
import { PlaylistIcon, PlusIcon, QueueListIcon } from '@/icons';
import { Button, Card, EmptyState, InlineError, LoadError, RowSkeleton, toast } from '@/ui';
import { GUEST_CODE_LENGTH, formatGuestCode, normalizeGuestCode } from '@/utils/guestCode';
import { getVoterId } from '@/utils/voter';

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

/** Runs `run` 300 ms after the person stops typing. An empty query gives no results. */
function useDebouncedSearch<T>(query: string, run: (query: string) => Promise<T[]>) {
  // The outcome of the latest finished search, with the query it answers.
  const [outcome, setOutcome] = useState<{ query: string; results: T[]; failed: boolean } | null>(null);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      runRef
        .current(trimmed)
        .then((results) => {
          if (!cancelled) setOutcome({ query: trimmed, results, failed: false });
        })
        .catch(() => {
          if (!cancelled) setOutcome({ query: trimmed, results: [], failed: true });
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const current = outcome && outcome.query === trimmed ? outcome : null;
  return {
    results: current?.results ?? [],
    searching: !!trimmed && !current,
    failed: current?.failed ?? false,
    trimmed,
  };
}

function searchPublicTracks(query: string): Promise<TrackListDto[]> {
  return searchTracks({ q: query, pageable: { page: 0, size: 20 } }).then((result) => result?.items ?? []);
}

function trackLabel(track: TrackListDto): string {
  return track.artistName ? `${track.title} – ${track.artistName}` : (track.title ?? '');
}

const MUTED_TEXT = 'text-sm text-[rgb(var(--color-text-muted))]';

/** The search that adds a track to a playlist. */
function PlaylistAdder({
  presentTrackIds,
  adding,
  onAdd,
  onInput,
}: {
  presentTrackIds: Set<string>;
  adding: boolean;
  onAdd: (track: TrackListDto) => void;
  onInput: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { results, searching, failed, trimmed } = useDebouncedSearch(query, searchPublicTracks);

  return (
    <>
      <label htmlFor="guest-add-track" className="block text-base font-bold text-[rgb(var(--color-text))]">
        Lägg till en låt
      </label>
      <input
        id="guest-add-track"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedId(null);
          onInput();
        }}
        placeholder="Sök på låt eller artist"
        className={INPUT_CLASS}
      />
      {searching && <p className={MUTED_TEXT}>Söker...</p>}
      {!searching && (
        <SelectableSearchResults
          results={results}
          getId={(track) => track.id}
          renderResult={trackLabel}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onConfirm={onAdd}
          confirming={adding}
          disabledIds={presentTrackIds}
          disabledLabel="Finns redan"
        />
      )}
      {!searching && failed && <p className={MUTED_TEXT}>Sökningen misslyckades. Försök igen.</p>}
      {!searching && !failed && !!trimmed && results.length === 0 && (
        <p className={MUTED_TEXT}>Ingen låt matchar sökningen. Pröva med ett annat ord.</p>
      )}
    </>
  );
}

interface PickedDance {
  danceId?: string;
  name: string;
}

/**
 * Adds a dance to a dance list in two steps: pick the dance, then pick a track for it
 * or add the dance without one.
 */
function DanceAdder({
  presentDanceIds,
  adding,
  onAdd,
  onInput,
}: {
  presentDanceIds: Set<string>;
  adding: boolean;
  onAdd: (dance: PickedDance, track: TrackListDto | null) => void;
  onInput: () => void;
}) {
  const [picked, setPicked] = useState<PickedDance | null>(null);
  const [danceQuery, setDanceQuery] = useState('');
  const [trackQuery, setTrackQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ danceId: string; tracks: TrackListDto[] } | null>(null);

  const dances = useDebouncedSearch(danceQuery, (query) =>
    getDances({ search: query }).then((result) => result?.items ?? []),
  );
  const tracks = useDebouncedSearch(trackQuery, searchPublicTracks);

  // Tracks other people have chosen for the dance are the likeliest picks.
  const pickedDanceId = picked?.danceId;
  useEffect(() => {
    if (!pickedDanceId) return;
    let cancelled = false;
    getMatchingTracks(pickedDanceId)
      .then((found) => {
        if (!cancelled) setSuggestion({ danceId: pickedDanceId, tracks: (found ?? []).slice(0, 5) });
      })
      .catch(() => {
        // The suggestions are a shortcut; the search below works without them.
      });
    return () => {
      cancelled = true;
    };
  }, [pickedDanceId]);

  function pick(dance: PickedDance) {
    setPicked(dance);
    setSelectedId(null);
    setTrackQuery('');
    onInput();
  }

  if (!picked) {
    return (
      <>
        <label htmlFor="guest-add-dance" className="block text-base font-bold text-[rgb(var(--color-text))]">
          Lägg till en dans
        </label>
        <input
          id="guest-add-dance"
          type="search"
          value={danceQuery}
          onChange={(e) => {
            setDanceQuery(e.target.value);
            setSelectedId(null);
            onInput();
          }}
          placeholder="Skriv dansens namn"
          className={INPUT_CLASS}
        />
        {dances.searching && <p className={MUTED_TEXT}>Söker...</p>}
        {!dances.searching && (
          <SelectableSearchResults
            results={dances.results}
            getId={(dance: Dance) => dance.id}
            renderResult={(dance) => dance.name}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onConfirm={(dance) => pick({ danceId: dance.id, name: dance.name ?? '' })}
            confirming={false}
            disabledIds={presentDanceIds}
            disabledLabel="Finns redan"
            confirmLabel="Välj dansen"
          />
        )}
        {!dances.searching && dances.failed && <p className={MUTED_TEXT}>Sökningen misslyckades. Försök igen.</p>}
        {!dances.searching && !dances.failed && !!dances.trimmed && dances.results.length === 0 && (
          <div className="space-y-2">
            <p className={MUTED_TEXT}>Dansen finns inte på sidan. Lägg till den med namnet du skrev:</p>
            <Button variant="secondary" onClick={() => pick({ name: dances.trimmed })}>
              <PlusIcon className="h-4 w-4" aria-hidden />
              Välj ”{dances.trimmed}”
            </Button>
          </div>
        )}
      </>
    );
  }

  const suggested = suggestion && suggestion.danceId === picked.danceId ? suggestion.tracks : [];
  const showSuggested = !tracks.trimmed && suggested.length > 0;
  const trackResults = showSuggested ? suggested : tracks.results;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-base text-[rgb(var(--color-text))]">
          Dans: <span className="font-bold">{picked.name}</span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => setPicked(null)} disabled={adding}>
          Byt dans
        </Button>
      </div>

      <label htmlFor="guest-add-dance-track" className="block text-base font-bold text-[rgb(var(--color-text))]">
        Välj en låt till dansen, om du vill
      </label>
      <input
        id="guest-add-dance-track"
        type="search"
        value={trackQuery}
        onChange={(e) => {
          setTrackQuery(e.target.value);
          setSelectedId(null);
          onInput();
        }}
        placeholder="Sök på låt eller artist"
        className={INPUT_CLASS}
      />
      {tracks.searching && <p className={MUTED_TEXT}>Söker...</p>}
      {showSuggested && <p className={MUTED_TEXT}>Låtar som andra har valt till dansen:</p>}
      {!tracks.searching && (
        <SelectableSearchResults
          results={trackResults}
          getId={(track) => track.id}
          renderResult={trackLabel}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onConfirm={(track) => onAdd(picked, track)}
          confirming={adding}
          confirmLabel="Lägg till dansen med låten"
        />
      )}
      {!tracks.searching && tracks.failed && <p className={MUTED_TEXT}>Sökningen misslyckades. Försök igen.</p>}
      {!tracks.searching && !tracks.failed && !!tracks.trimmed && tracks.results.length === 0 && (
        <p className={MUTED_TEXT}>Ingen låt matchar sökningen. Pröva med ett annat ord.</p>
      )}

      <Button variant="secondary" onClick={() => onAdd(picked, null)} disabled={adding}>
        <PlusIcon className="h-4 w-4" aria-hidden />
        Lägg till dansen utan låt
      </Button>
    </>
  );
}

/** `/kod/:code`: the list a code belongs to, with the one thing a guest can do: add to it. */
function GuestList({ code }: { code: string }) {
  const [list, setList] = useState<GuestListDto | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // Counts additions; a new count gives the add form a fresh start.
  const [addCount, setAddCount] = useState(0);

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

  const clearAddError = useCallback(() => setAddError(null), []);

  async function add(request: () => Promise<GuestListDto>, done: string, duplicate: string) {
    if (adding) return;
    setAdding(true);
    setAddError(null);
    try {
      setList(await request());
      setAddCount((n) => n + 1);
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

  const isPlaylist = list.type === 'playlist';
  const tracks = list.tracks ?? [];
  const dances = list.dances ?? [];
  const presentTrackIds = new Set(tracks.map((t) => t.id).filter((id): id is string => !!id));
  const presentDanceIds = new Set(dances.map((d) => d.danceId).filter((id): id is string => !!id));

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
            : 'Med koden kan du lägga till danser i danslistan, med en låt till dansen om du vill. Du behöver inget konto.'}
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        {isPlaylist ? (
          <PlaylistAdder
            key={addCount}
            presentTrackIds={presentTrackIds}
            adding={adding}
            onInput={clearAddError}
            onAdd={(track) =>
              add(
                () => addGuestTrack(code, { trackId: track.id }),
                'Låten är tillagd',
                'Låten finns redan i spellistan.',
              )
            }
          />
        ) : (
          <DanceAdder
            key={addCount}
            presentDanceIds={presentDanceIds}
            adding={adding}
            onInput={clearAddError}
            onAdd={(dance, track) =>
              add(
                () =>
                  addGuestDance(
                    code,
                    dance.danceId
                      ? { danceId: dance.danceId, trackId: track?.id }
                      : { name: dance.name, trackId: track?.id },
                    // The track counts as the guest's vote that it fits the dance.
                    { headers: { 'X-Voter-ID': getVoterId() } },
                  ),
                track ? 'Dansen och låten är tillagda' : 'Dansen är tillagd',
                'Dansen finns redan i danslistan.',
              )
            }
          />
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
                className="flex min-h-11 items-start gap-3 border-b border-[rgb(var(--color-border))] px-3 py-2.5 last:border-b-0"
              >
                <span
                  className="w-6 shrink-0 pt-0.5 text-right text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {dance.danceId ? (
                    <Link
                      to={`/dance/${dance.danceId}`}
                      className="block truncate text-[15px] font-medium text-[rgb(var(--color-text))] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
                    >
                      {dance.name}
                    </Link>
                  ) : (
                    <span className="block truncate text-[15px] font-medium text-[rgb(var(--color-text))]">
                      {dance.name}
                    </span>
                  )}
                  {(dance.tracks ?? []).map((track) => (
                    <p key={track.id} className="truncate text-sm text-[rgb(var(--color-text-muted))]">
                      {trackLabel(track)}
                    </p>
                  ))}
                </div>
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
