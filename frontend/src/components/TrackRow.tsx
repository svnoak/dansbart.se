import { useState, type ReactNode } from 'react';
import { usePlayer } from '@/player/usePlayer';
import { useAuth } from '@/auth/useAuth';
import { useFavorites } from '@/favorites/useFavorites';
import { useLongPress } from '@/hooks/useLongPress';
import { getStyleColor } from '@/styles/danceStyleColors';
import { formatDurationMs } from '@/utils/formatDuration';
import { tempoCategoryLabel } from '@/utils/tempoLabel';
import type { TrackListDto } from '@/api/models/trackListDto';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { FlagTrackModal } from './FlagTrackModal';
import { LoginRequiredModal } from './LoginRequiredModal';
import { PlayButton } from './TrackRow/PlayButton';
import { RelinkButton } from './TrackRow/RelinkButton';
import { UnavailableLabel } from './TrackRow/UnavailableLabel';
import { requestLocalFile } from '@/library/requestLocalFile';
import { useMissingLocalFile } from '@/library/useMissingLocalFile';
import { StyleBadge } from './TrackRow/StyleBadge';
import { TrackActionsModal } from './TrackRow/TrackActionsModal';
import { TrackRowMenu } from './TrackRow/TrackRowMenu';
import type { ExtraMenuItem } from './TrackRow/trackRowMenuItems';
import { Button, IconButton, toast } from '@/ui';
import { HeartIcon, HeartFilledIcon } from '@/icons';
import { addTrack } from '@/api/generated/playlists/playlists';

interface TrackRowProps {
  track: TrackListDto;
  contextTracks?: TrackListDto[];
  addToPlaylistId?: string;
  /** Replaces the heart in the action slot. Manage contexts pass Lägg till, Ta bort, Primär, Passar here. */
  action?: ReactNode;
  showAlbum?: boolean;
  badges?: ReactNode;
  extraMenuItems?: ExtraMenuItem[];
  isPrivate?: boolean;
}

/**
 * The one track row, used by every list on the site.
 *
 * Slots, left to right: play (style colour), title and artist, style pill and
 * tempo (right on desktop, under the artist on a phone), duration, the action
 * slot (heart by default) and the menu.
 */
export function TrackRow({
  track,
  contextTracks,
  addToPlaylistId,
  action,
  showAlbum,
  badges,
  extraMenuItems,
  isPrivate,
}: TrackRowProps) {
  const { play, addToQueue, currentTrack, isPlaying } = usePlayer();
  const { isAuthenticated } = useAuth();
  const { isFavorited, toggleFavorite } = useFavorites();
  const [menuOpen, setMenuOpen] = useState(false);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const longPress = useLongPress(() => setOptionsOpen(true));
  const favorited = track.id != null && isFavorited(track.id);
  const { missing: fileMissing, setMissing } = useMissingLocalFile(track);
  const unavailable = track.playable === false;
  const isOwnTrack = track.playable === true && !track.playbackLinks?.length;
  const isCurrent = currentTrack?.id === track.id;

  async function handlePlay() {
    if (isOwnTrack && track.id != null && !isCurrent) {
      const access = await requestLocalFile(track.id);
      if (access === 'missing') setMissing(true);
      if (access !== 'ready') return;
    }
    play(track, contextTracks);
  }

  const handleAddToPlaylist = async () => {
    if (!addToPlaylistId || track.id == null) return;
    setAdding(true);
    try {
      await addTrack(addToPlaylistId, { trackId: track.id });
      setAdded(true);
    } catch {
      toast('Det gick inte att lägga till låten.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const styleColor = getStyleColor(track.danceStyle);
  const tempo = tempoCategoryLabel(track.tempoCategory);
  const hasDuration = !!track.durationMs && track.durationMs > 0;

  const addToPlaylistAction = addToPlaylistId && (
    <Button
      variant="secondary"
      size="sm"
      disabled={adding || added}
      onClick={handleAddToPlaylist}
    >
      {added ? 'Tillagd' : 'Lägg till'}
    </Button>
  );
  const rowAction = action ?? addToPlaylistAction;

  return (
    <>
      <div
        className={`grid grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-2 py-2.5 border-b border-[rgb(var(--color-border))] select-none [-webkit-touch-callout:none] ${
          unavailable ? 'bg-[rgb(var(--color-border))]/30' : isCurrent ? 'bg-[rgb(var(--color-now-playing))]/10' : ''
        }`}
        {...longPress}
      >
        {/* Slot 1: play control, spans both rows on a phone */}
        <div className="row-span-2 md:row-span-1 flex items-center">
          {unavailable ? (
            <UnavailableLabel />
          ) : fileMissing ? (
            <RelinkButton trackId={track.id!} onRelinked={() => setMissing(false)} />
          ) : (
            <PlayButton
              track={track}
              isCurrent={isCurrent}
              isPlaying={isPlaying}
              styleColor={styleColor}
              onPlay={() => void handlePlay()}
            />
          )}
        </div>

        {/* Slot 2: title and artist */}
        <div className="col-start-2 min-w-0 flex flex-col">
          <p className="truncate text-[15px] font-bold leading-snug text-[rgb(var(--color-text))]">
            {track.title ?? 'Okänd låt'}
          </p>
          <p className="truncate text-[13px] text-[rgb(var(--color-text-muted))]">
            {track.artistName ?? 'Okänd artist'}
            {showAlbum && track.albumTitle ? ` · ${track.albumTitle}` : ''}
          </p>
          {badges}
        </div>

        {/* Slot 3: style pill and tempo. Second line on a phone, own column on desktop. */}
        <div className="col-start-2 row-start-2 md:col-start-3 md:row-start-1 flex items-center gap-2.5 min-w-0">
          <StyleBadge
            trackId={track.id ?? ''}
            trackTitle={track.title ?? 'Okänd låt'}
            danceStyle={track.danceStyle}
            confidence={track.confidence ?? 0}
            styleColor={styleColor}
          />
          <span className="text-[13px] text-[rgb(var(--color-text-muted))] md:w-16 truncate">
            {tempo}
          </span>
        </div>

        {/* Slots 4–6: duration, action, menu */}
        <div className="col-start-3 row-span-2 md:col-start-4 md:row-span-1 flex shrink-0 items-center gap-0.5">
          {hasDuration && (
            <span className="hidden sm:inline shrink-0 w-10 text-right text-[13px] tabular-nums text-[rgb(var(--color-text-muted))]">
              {formatDurationMs(track.durationMs!)}
            </span>
          )}
          {rowAction ?? (
            <IconButton
              aria-label={favorited ? 'Sluta favoritmarkera' : 'Favoritmarkera'}
              onClick={() => {
                if (!isAuthenticated) setLoginModalOpen(true);
                else if (track.id != null) toggleFavorite(track.id);
              }}
            >
              {favorited ? (
                <HeartFilledIcon className="h-5 w-5 text-[rgb(var(--color-text))]" aria-hidden />
              ) : (
                <HeartIcon className="h-5 w-5 text-[rgb(var(--color-text-muted))]" aria-hidden />
              )}
            </IconButton>
          )}
          <TrackRowMenu
            track={track}
            open={menuOpen}
            onToggle={() => setMenuOpen((o) => !o)}
            onClose={() => setMenuOpen(false)}
            onAddToQueue={() => addToQueue(track)}
            onFlag={() => setFlagModalOpen(true)}
            onAddToPlaylist={isAuthenticated ? () => setAddToPlaylistOpen(true) : undefined}
            extraItems={extraMenuItems}
            isPrivate={isPrivate}
          />
        </div>
      </div>

      <FlagTrackModal
        open={flagModalOpen}
        onClose={() => setFlagModalOpen(false)}
        track={track}
      />
      <AddToPlaylistModal
        open={addToPlaylistOpen}
        onClose={() => setAddToPlaylistOpen(false)}
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
        onAddToPlaylist={isAuthenticated ? () => setAddToPlaylistOpen(true) : undefined}
        extraItems={extraMenuItems}
        isPrivate={isPrivate}
      />
    </>
  );
}
