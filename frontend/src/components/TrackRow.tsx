import { useState } from 'react';
import { usePlayer } from '@/player/usePlayer';
import { getStyleColor } from '@/styles/danceStyleColors';
import { formatDurationMs } from '@/utils/formatDuration';
import type { TrackListDto } from '@/api/models/trackListDto';
import { FlagTrackModal } from './FlagTrackModal';
import { PlayButton } from './TrackRow/PlayButton';
import { StyleBadge } from './TrackRow/StyleBadge';
import { TrackRowMenu } from './TrackRow/TrackRowMenu';

const TEMPO_LABELS: Record<string, string> = {
  Slow: 'Långsamt',
  SlowMed: 'Lugnt',
  Medium: 'Lagom',
  Fast: 'Snabbt',
  Turbo: 'Väldigt snabbt',
};

function tempoLabel(track: TrackListDto): string {
  return (
    (track.tempoCategory &&
      (TEMPO_LABELS[track.tempoCategory] ?? track.tempoCategory)) ??
    ''
  );
}

interface TrackRowProps {
  track: TrackListDto;
  contextTracks?: TrackListDto[];
  onApplyStyleFilter?: (style: string) => void;
}

export function TrackRow({
  track,
  contextTracks,
  onApplyStyleFilter,
}: TrackRowProps) {
  const { play, addToQueue, currentTrack, isPlaying } = usePlayer();
  const [menuOpen, setMenuOpen] = useState(false);
  const [flagModalOpen, setFlagModalOpen] = useState(false);

  const isCurrent = currentTrack?.id === track.id;
  const styleColor = getStyleColor(track.danceStyle);
  const tempo = tempoLabel(track);
  const hasDuration = !!track.durationMs && track.durationMs > 0;

  return (
    <>
      <div className="flex items-center gap-3 px-2 py-2.5 border-b border-[rgb(var(--color-border))]/30">
        {/* Left: Play button (fixed, spans all lines) */}
        <PlayButton
          track={track}
          isCurrent={isCurrent}
          isPlaying={isPlaying}
          styleColor={styleColor}
          onPlay={() => play(track, contextTracks)}
        />

        {/* Center: Vertical text stack */}
        <div className="min-w-0 flex-1 flex flex-col">
          {/* Top line: Metadata - badge + tempo */}
          <div className="flex items-center gap-1.5">
            <StyleBadge
              danceStyle={track.danceStyle}
              confidence={track.confidence ?? 0}
              styleColor={styleColor}
              onApplyStyleFilter={onApplyStyleFilter}
            />
            {tempo && (
              <span className="text-[11px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
                {tempo}
              </span>
            )}
          </div>

          {/* Middle line: Track title (bold, full width) */}
          <p className="mt-0.5 truncate text-sm font-bold text-[rgb(var(--color-text))]">
            {track.title ?? 'Okänd låt'}
          </p>

          {/* Bottom line: Artist + duration */}
          <div className="flex items-center gap-1 text-xs text-[rgb(var(--color-text-muted))]">
            <span className="truncate">{track.artistName ?? 'Okänd artist'}</span>
            {hasDuration && (
              <span className="ml-auto shrink-0 font-mono">{formatDurationMs(track.durationMs!)}</span>
            )}
          </div>
        </div>

        {/* Right: Menu */}
        <TrackRowMenu
          track={track}
          open={menuOpen}
          onToggle={() => setMenuOpen((o) => !o)}
          onClose={() => setMenuOpen(false)}
          onAddToQueue={() => addToQueue(track)}
          onFlag={() => setFlagModalOpen(true)}
        />
      </div>

      <FlagTrackModal
        open={flagModalOpen}
        onClose={() => setFlagModalOpen(false)}
        track={track}
      />
    </>
  );
}
