import { useState } from 'react';
import { PlayIcon, PauseIcon, SpotifyIcon, YouTubeIcon } from '@/icons';
import type { DanceStyleColor } from '@/styles/danceStyleColors';
import type { TrackListDto } from '@/api/models/trackListDto';

interface PlayButtonProps {
  track: TrackListDto;
  isCurrent: boolean;
  isPlaying: boolean;
  styleColor: DanceStyleColor;
  onPlay: () => void;
}

type Platform = 'SPOTIFY' | 'YOUTUBE';

const PLATFORM_ICON = {
  SPOTIFY: { Icon: SpotifyIcon, label: 'Spotify' },
  YOUTUBE: { Icon: YouTubeIcon, label: 'YouTube' },
} as const;

function getSourcePlatforms(track: TrackListDto): Platform[] {
  if (!track.playbackLinks?.length) return [];
  const platforms: Platform[] = [];
  if (track.playbackLinks.some((l) => l.platform?.toUpperCase() === 'SPOTIFY')) platforms.push('SPOTIFY');
  if (track.playbackLinks.some((l) => l.platform?.toUpperCase() === 'YOUTUBE')) platforms.push('YOUTUBE');
  return platforms;
}

export function PlayButton({
  track,
  isCurrent,
  isPlaying,
  styleColor,
  onPlay,
}: PlayButtonProps) {
  const [hovered, setHovered] = useState(false);
  const platforms = getSourcePlatforms(track);
  const playing = isCurrent && isPlaying;

  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={onPlay}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex h-12 w-12 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-accent))]"
        style={{
          backgroundColor: playing ? styleColor.bg : 'rgb(var(--color-bg-elevated))',
          color: playing ? styleColor.text : 'rgb(var(--color-text))',
          border: hovered || playing ? `1.5px solid ${styleColor.text}` : '1.5px solid rgb(var(--color-border))',
        }}
        aria-label={playing ? 'Pausa' : 'Spela'}
      >
        {playing ? (
          <PauseIcon className="h-5 w-5" aria-hidden />
        ) : (
          <PlayIcon className="h-5 w-5 ml-0.5" aria-hidden />
        )}
      </button>
      {platforms.length > 0 && (
        <div className="flex items-center gap-1">
          {platforms.map((platform) => {
            const { Icon } = PLATFORM_ICON[platform];
            return (
              <Icon
                key={platform}
                className="h-3 w-3 text-[rgb(var(--color-text-muted))]"
                aria-hidden
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
