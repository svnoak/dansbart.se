import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, IconButton } from '@/ui';
import { usePlayer } from '@/player/PlayerContext';
import {
  FlagIcon,
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

interface TrackCardProps {
  track: TrackListDto;
  onApplyStyleFilter?: (style: string) => void;
}

export function TrackCard({ track, onApplyStyleFilter }: TrackCardProps) {
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
    <Card className="flex items-center gap-4 p-4 shadow-sm">
      <button
        type="button"
        onClick={() => play(track)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--color-accent))] text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] focus-visible:ring-offset-2"
        aria-label={isCurrent && isPlaying ? 'Pausa' : 'Spela'}
      >
        {isCurrent && isPlaying ? (
          <PauseIcon className="h-5 w-5" aria-hidden />
        ) : (
          <PlayIcon className="h-5 w-5 ml-0.5" aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {hasValidStyle ? (
            <span className="flex items-center gap-1">
              {/* Human verified: blue, no sparkles */}
              {isHumanVerified && (
                <>
                  <button
                    type="button"
                    onClick={() => onApplyStyleFilter?.(track.danceStyle!)}
                    className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-100"
                    title="Filtrera på huvudstil"
                  >
                    {track.danceStyle}
                  </button>
                  {hasSubStyle && (
                    <>
                      <span className="text-[10px] font-bold text-gray-300">›</span>
                      <button
                        type="button"
                        onClick={() => onApplyStyleFilter?.(track.subStyle!)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-100"
                        title="Filtrera på understil"
                      >
                        {track.subStyle}
                      </button>
                    </>
                  )}
                </>
              )}
              {/* ML high confidence: blue + sparkles on main */}
              {isMlHigh && (
                <>
                  <button
                    type="button"
                    onClick={() => onApplyStyleFilter?.(track.danceStyle!)}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-100"
                    title="Filtrera på huvudstil (AI-gissning)"
                  >
                    {track.danceStyle}
                    <SparklesIcon className="h-3 w-3 text-blue-400" aria-hidden />
                  </button>
                  {hasSubStyle && (
                    <>
                      <span className="text-[10px] font-bold text-gray-300">›</span>
                      <button
                        type="button"
                        onClick={() => onApplyStyleFilter?.(track.subStyle!)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-100"
                        title="Filtrera på understil (AI-gissning)"
                      >
                        {track.subStyle}
                      </button>
                    </>
                  )}
                </>
              )}
              {/* ML low confidence: amber + sparkles on main */}
              {isMlLow && (
                <>
                  <button
                    type="button"
                    onClick={() => onApplyStyleFilter?.(track.danceStyle!)}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-800 transition-colors hover:border-amber-300 hover:bg-amber-100"
                    title="Filtrera på huvudstil (Osäker)"
                  >
                    {track.danceStyle}
                    <SparklesIcon className="h-3 w-3 text-amber-400" aria-hidden />
                  </button>
                  {hasSubStyle && (
                    <>
                      <span className="text-[10px] font-bold text-gray-300">›</span>
                      <button
                        type="button"
                        onClick={() => onApplyStyleFilter?.(track.subStyle!)}
                        className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-800 transition-colors hover:border-amber-300 hover:bg-amber-100"
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
              className="inline-flex cursor-help items-center gap-1 rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600"
              title="Kunde inte avgöra stil"
            >
              ❓ Okänd stil
            </span>
          )}
        </div>
        <h3 className="mt-1 font-semibold text-[rgb(var(--color-text))] truncate">
          {track.title ?? 'Okänd låt'}
        </h3>
        <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
          {track.artistName ?? 'Okänd artist'}
        </p>
        {track.effectiveBpm != null && (
          <p className="mt-0.5 text-xs text-[rgb(var(--color-text-muted))]">
            {Math.round(track.effectiveBpm)} BPM
            {track.durationMs != null && ` · ${formatDurationMs(track.durationMs)}`}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
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
        <button
          type="button"
          className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
          aria-label="Rapportera problem"
          onClick={() => setFlagModalOpen(true)}
        >
          <FlagIcon className="h-4 w-4" aria-hidden />
        </button>
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
                    onClick={() => {
                      if (navigator.share && track.title) {
                        navigator.share({
                          title: track.title,
                          text: `${track.title} – ${track.artistName ?? ''}`,
                          url: window.location.origin + `/track/${track.id ?? ''}`,
                        });
                      } else {
                        navigator.clipboard?.writeText(
                          window.location.origin + `/track/${track.id ?? ''}`
                        );
                      }
                      setMenuOpen(false);
                    }}
                  >
                    Dela
                  </button>
                </li>
                {track.id && (
                  <li role="none">
                    <Link
                      to={`/track/${track.id}`}
                      role="menuitem"
                      className="block w-full px-4 py-2 text-left text-sm text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-border))]/50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Gå till låt
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
