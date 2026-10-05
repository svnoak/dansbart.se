import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnchoredMenu, Card, IconButton, menuItemClassName, toast } from '@/ui';
import { usePlayer } from '@/player/usePlayer';
import { useAuth } from '@/auth/useAuth';
import { useFavorites } from '@/favorites/useFavorites';
import { useLongPress } from '@/hooks/useLongPress';
import { useTheme } from '@/theme/useTheme';
import { getStyleColor } from '@/styles/danceStyleColors';
import { tempoCategoryLabel } from '@/utils/tempoLabel';
import {
  PauseIcon,
  PlayIcon,
  MoreVerticalIcon,
  HeartIcon,
  HeartFilledIcon,
} from '@/icons';
import type { TrackListDto } from '@/api/models/trackListDto';
import { formatDurationMs } from '@/utils/formatDuration';
import { FlagTrackModal } from './FlagTrackModal';
import { LoginRequiredModal } from './LoginRequiredModal';
import { StylePill } from './TrackRow/StylePill';
import { stylePillState } from './TrackRow/stylePillState';
import { TrackActionsModal } from './TrackRow/TrackActionsModal';
import { UnavailableLabel } from './TrackRow/UnavailableLabel';

interface TrackCardProps {
  track: TrackListDto;
  contextTracks?: TrackListDto[];
  onApplyStyleFilter?: (style: string) => void;
}

/**
 * A track as a card, for grids. Same slots as the row: play in the style
 * colour, title and artist, the style pill (a filter when a handler is given),
 * tempo, duration, heart and menu.
 */
export function TrackCard({ track, contextTracks, onApplyStyleFilter }: TrackCardProps) {
  const { play, addToQueue, currentTrack, isPlaying } = usePlayer();
  const { isAuthenticated } = useAuth();
  const { isFavorited, toggleFavorite } = useFavorites();
  const { theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const longPress = useLongPress(() => setOptionsOpen(true));
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isCurrent = currentTrack?.id === track.id;
  const favorited = track.id != null && isFavorited(track.id);

  const state = stylePillState(track.danceStyle, track.confidence);
  const hasSubStyle = !!track.subStyle && track.subStyle !== track.danceStyle;
  const color = getStyleColor(track.danceStyle);
  const isDark = theme === 'dark';
  const playStyle =
    state === 'confirmed'
      ? { backgroundColor: isDark ? color.bgDark : color.bg, color: isDark ? color.textDark : color.text }
      : {
          border: `1.5px dashed ${state === 'guess' ? (isDark ? color.textDark : color.text) : 'rgb(var(--color-border-strong))'}`,
          color: state === 'guess' ? (isDark ? color.textDark : color.text) : 'rgb(var(--color-text-muted))',
        };
  const tempo = tempoCategoryLabel(track.tempoCategory);

  const pill = (
    <StylePill style={hasSubStyle ? track.subStyle : track.danceStyle} state={state} />
  );

  return (
    <Card
      className={`flex items-center gap-3 p-3 select-none [-webkit-touch-callout:none] ${
        track.playable === false ? 'bg-[rgb(var(--color-border))]/30' : isCurrent ? 'bg-[rgb(var(--color-now-playing))]/10' : ''
      }`}
      {...longPress}
    >
      {track.playable === false ? (
        <UnavailableLabel />
      ) : (
        <button
          type="button"
          onClick={() => play(track, contextTracks)}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] focus-visible:ring-offset-2 ${
            isCurrent ? 'ring-[3px] ring-[rgb(var(--color-now-playing))]' : ''
          }`}
          style={playStyle}
          aria-label={isCurrent && isPlaying ? 'Pausa' : 'Spela'}
        >
          {isCurrent && isPlaying ? (
            <PauseIcon className="h-5 w-5" aria-hidden />
          ) : (
            <PlayIcon className="h-5 w-5 ml-0.5" aria-hidden />
          )}
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-snug text-[rgb(var(--color-text))]">
          {track.title ?? 'Okänd låt'}
        </p>
        <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">
          {track.artistName ?? 'Okänd artist'}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {onApplyStyleFilter && state !== 'unknown' && track.danceStyle ? (
            <button
              type="button"
              onClick={() => onApplyStyleFilter(hasSubStyle ? track.subStyle! : track.danceStyle!)}
              aria-label={`Filtrera på ${hasSubStyle ? track.subStyle : track.danceStyle}`}
              className="-my-2 inline-flex min-h-11 items-center rounded-[var(--radius-full)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
            >
              {pill}
            </button>
          ) : (
            pill
          )}
          {tempo && (
            <span className="text-[13px] text-[rgb(var(--color-text-muted))]">{tempo}</span>
          )}
          {track.durationMs != null && (
            <span className="text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">
              {formatDurationMs(track.durationMs)}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton
          aria-label={favorited ? 'Sluta favoritmarkera' : 'Favoritmarkera'}
          onClick={() => {
            if (!isAuthenticated) {
              setLoginModalOpen(true);
            } else if (track.id != null) {
              toggleFavorite(track.id);
            }
          }}
        >
          {favorited ? (
            <HeartFilledIcon className="h-5 w-5 text-[rgb(var(--color-text))]" aria-hidden />
          ) : (
            <HeartIcon className="h-5 w-5 text-[rgb(var(--color-text-muted))]" aria-hidden />
          )}
        </IconButton>
        <div>
          <IconButton
            ref={menuButtonRef}
            aria-label="Mer"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreVerticalIcon className="w-5 h-5" aria-hidden />
          </IconButton>
          <AnchoredMenu open={menuOpen} anchorRef={menuButtonRef} onClose={() => setMenuOpen(false)} width={208}>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className={menuItemClassName}
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
                className={menuItemClassName}
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
                  className={menuItemClassName}
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
                  className={menuItemClassName}
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
                className={menuItemClassName}
                onClick={() => {
                  setFlagModalOpen(true);
                  setMenuOpen(false);
                }}
              >
                Rapportera problem
              </button>
            </li>
          </AnchoredMenu>
        </div>
      </div>
      <FlagTrackModal
        open={flagModalOpen}
        onClose={() => setFlagModalOpen(false)}
        track={track}
      />
      <LoginRequiredModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        message="Du behöver skapa ett konto eller logga in för att favoritmarkera en låt."
      />
      <TrackActionsModal
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        track={track}
        onAddToQueue={() => addToQueue(track)}
        onFlag={() => setFlagModalOpen(true)}
      />
    </Card>
  );
}
