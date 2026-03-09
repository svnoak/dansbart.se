import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, IconButton, toast } from '@/ui';
import { usePlayer } from '@/player/usePlayer';
import {
  PauseIcon,
  PlayIcon,
  MoreVerticalIcon,
  SparklesIcon,
  SpotifyIcon,
  YouTubeIcon,
} from '@/icons';
import type { TrackListDto } from '@/api/models/trackListDto';
import { formatDurationMs } from '@/utils/formatDuration';
import { FlagTrackModal } from './FlagTrackModal';

const TEMPO_LABELS: Record<string, string> = {
  Slow: 'Långsamt',
  SlowMed: 'Lugnt',
  Medium: 'Lagom',
  Fast: 'Snabbt',
  Turbo: 'Väldigt snabbt',
};

function tempoLabel(track: TrackListDto): string {
  return (track.tempoCategory && (TEMPO_LABELS[track.tempoCategory] ?? track.tempoCategory)) ?? '';
}

interface TrackCardProps {
  track: TrackListDto;
  contextTracks?: TrackListDto[];
  onApplyStyleFilter?: (style: string) => void;
}

export function TrackCard({ track, contextTracks, onApplyStyleFilter }: TrackCardProps) {
  const { play, addToQueue, currentTrack, isPlaying } = usePlayer();
  const [menuOpen, setMenuOpen] = useState(false);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const isCurrent = currentTrack?.id === track.id;

  const hasValidStyle =
    typeof track.danceStyle === 'string' && track.danceStyle.length > 0;
  const styleConfidence = track.confidence ?? 0;
  const hasSubStyle =
    !!track.subStyle && track.subStyle !== track.danceStyle;

  const isHumanVerified = styleConfidence >= 1.0;
  const isMlHigh = styleConfidence > 0.75 && !isHumanVerified;
  const isMlLow = hasValidStyle && !isHumanVerified && !isMlHigh;

  return (
    <Card className="flex items-center gap-3 p-4 shadow-sm">
      {/* Left: Play button */}
      <button
        type="button"
        onClick={() => play(track, contextTracks)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent))] text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] focus-visible:ring-offset-2"
        aria-label={isCurrent && isPlaying ? 'Pausa' : 'Spela'}
      >
        {isCurrent && isPlaying ? (
          <PauseIcon className="h-5 w-5" aria-hidden />
        ) : (
          <PlayIcon className="h-5 w-5 ml-0.5" aria-hidden />
        )}
      </button>

      {/* Center: Content rows */}
      <div className="min-w-0 flex-1">
        {/* Row 1: Dance style + tempo */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          {hasValidStyle ? (
            <span className="flex items-center gap-1">
              {isHumanVerified && (
                <>
                  <button
                    type="button"
                    onClick={() => onApplyStyleFilter?.(track.danceStyle!)}
                    className="rounded-full border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200 transition-colors hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    title="Filtrera på huvudstil"
                  >
                    {track.danceStyle}
                  </button>
                  {hasSubStyle && (
                    <>
                      <span className="text-[10px] font-bold text-[rgb(var(--color-text-muted))]">›</span>
                      <button
                        type="button"
                        onClick={() => onApplyStyleFilter?.(track.subStyle!)}
                        className="rounded-full border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200 transition-colors hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        title="Filtrera på understil"
                      >
                        {track.subStyle}
                      </button>
                    </>
                  )}
                </>
              )}
              {isMlHigh && (
                <>
                  <button
                    type="button"
                    onClick={() => onApplyStyleFilter?.(track.danceStyle!)}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200 transition-colors hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    title="Filtrera på huvudstil (AI-gissning)"
                  >
                    {track.danceStyle}
                    <SparklesIcon className="h-3 w-3 text-blue-400 dark:text-blue-300" aria-hidden />
                  </button>
                  {hasSubStyle && (
                    <>
                      <span className="text-[10px] font-bold text-[rgb(var(--color-text-muted))]">›</span>
                      <button
                        type="button"
                        onClick={() => onApplyStyleFilter?.(track.subStyle!)}
                        className="rounded-full border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200 transition-colors hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        title="Filtrera på understil (AI-gissning)"
                      >
                        {track.subStyle}
                      </button>
                    </>
                  )}
                </>
              )}
              {isMlLow && (
                <>
                  <button
                    type="button"
                    onClick={() => onApplyStyleFilter?.(track.danceStyle!)}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200 transition-colors hover:border-amber-300 dark:hover:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                    title="Filtrera på huvudstil (Osäker)"
                  >
                    {track.danceStyle}
                    <SparklesIcon className="h-3 w-3 text-amber-400 dark:text-amber-300" aria-hidden />
                  </button>
                  {hasSubStyle && (
                    <>
                      <span className="text-[10px] font-bold text-[rgb(var(--color-text-muted))]">›</span>
                      <button
                        type="button"
                        onClick={() => onApplyStyleFilter?.(track.subStyle!)}
                        className="rounded-full border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200 transition-colors hover:border-amber-300 dark:hover:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                        title="Filtrera på understil (Osäker)"
                      >
                        {track.subStyle}
                      </button>
                    </>
                  )}
                </>
              )}
            </span>
          ) : (
            <span
              className="inline-flex cursor-help items-center gap-1 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-pill-bg))] px-2 py-0.5 text-xs font-bold text-[rgb(var(--color-text-muted))]"
              title="Kunde inte avgöra stil"
            >
              Okänd stil
            </span>
          )}
          {track.tempoCategory != null && (
            <span className="whitespace-nowrap rounded-full border border-[rgb(var(--color-border))]/50 bg-[rgb(var(--color-pill-bg))] px-2 py-0.5 text-xs font-medium text-[rgb(var(--color-text-muted))]">
              {tempoLabel(track)}
            </span>
          )}
        </div>

        {/* Row 2: Title – Artist */}
        <p className="mt-1 truncate text-sm text-[rgb(var(--color-text))]">
          <span className="font-semibold">{track.title ?? 'Okänd låt'}</span>
          <span className="text-[rgb(var(--color-text-muted))]"> – {track.artistName ?? 'Okänd artist'}</span>
        </p>

        {/* Row 3: Duration + source availability icons */}
        <div className="mt-1 flex items-center gap-2">
          {track.durationMs != null && (
            <span className="rounded-full border border-[rgb(var(--color-border))]/50 bg-[rgb(var(--color-pill-bg))] px-2 py-0.5 font-mono text-xs text-[rgb(var(--color-text-muted))]">
              {formatDurationMs(track.durationMs)}
            </span>
          )}
          {track.playbackLinks?.some((l) => l.platform?.toUpperCase() === 'SPOTIFY') && (
            <span className="text-[rgb(var(--color-text-muted))]" title="Spotify">
              <SpotifyIcon className="h-4 w-4" aria-hidden />
            </span>
          )}
          {track.playbackLinks?.some((l) => l.platform?.toUpperCase() === 'YOUTUBE') && (
            <span className="text-[rgb(var(--color-text-muted))]" title="YouTube">
              <YouTubeIcon className="h-4 w-4" aria-hidden />
            </span>
          )}
        </div>
      </div>

      {/* Right: Menu (vertically centered) */}
      <div className="shrink-0">
        <div className="relative">
          <IconButton
            aria-label="Mer"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreVerticalIcon className="w-5 h-5" aria-hidden />
          </IconButton>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setMenuOpen(false)}
              />
              <ul
                className="absolute right-0 top-full z-20 mt-1 w-48 rounded-[var(--radius)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-lg"
                role="menu"
              >
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
                    onClick={() => {
                      addToQueue(track);
                      setMenuOpen(false);
                    }}
                  >
                    Lägg i kö
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
                    onClick={async () => {
                      const url = `${window.location.origin}?track=${track.id ?? ''}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast('Länk kopierad');
                      } catch {
                        toast('Kunde inte kopiera länk', 'error');
                      }
                      setMenuOpen(false);
                    }}
                  >
                    Dela
                  </button>
                </li>
                {track.artistId && (
                  <li role="none">
                    <Link
                      to={`/artist/${track.artistId}`}
                      role="menuitem"
                      className="block w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Gå till artist
                    </Link>
                  </li>
                )}
                {track.albumId && (
                  <li role="none">
                    <Link
                      to={`/album/${track.albumId}`}
                      role="menuitem"
                      className="block w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Gå till album
                    </Link>
                  </li>
                )}
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
                    onClick={() => {
                      setFlagModalOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    Rapportera problem
                  </button>
                </li>
              </ul>
            </>
          )}
        </div>
      </div>
      <FlagTrackModal
        open={flagModalOpen}
        onClose={() => setFlagModalOpen(false)}
        track={track}
      />
    </Card>
  );
}
