import type { CSSProperties, MutableRefObject } from 'react';

export const YT_PLAYER_CONTAINER_ID = 'global-yt-player-container';

interface EmbedContainerProps {
  embedUrl: string | undefined;
  isYouTubeEmbed: boolean;
  style: CSSProperties;
  isPlaying: boolean;
  expanded: boolean;
  iframeRef: MutableRefObject<HTMLIFrameElement | null>;
}

export function EmbedContainer({
  embedUrl,
  isYouTubeEmbed,
  style,
  isPlaying,
  expanded,
  iframeRef,
}: EmbedContainerProps) {
  if (!embedUrl) return null;

  return (
    <div
      style={style}
      className={`overflow-hidden rounded-lg border border-[rgb(var(--color-border))] bg-black shadow-xl transition-all duration-300 ease-in-out ${
        isYouTubeEmbed && !isPlaying && !expanded
          ? 'opacity-0 pointer-events-none'
          : 'opacity-100 pointer-events-auto'
      }`}
      aria-hidden={isYouTubeEmbed && !isPlaying && !expanded}
    >
      {/* Wrapper div React controls – the YT IFrame API replaces the inner div so we hide/show via the wrapper */}
      <div
        className="h-full w-full"
        style={{ display: isYouTubeEmbed ? 'block' : 'none' }}
      >
        <div id={YT_PLAYER_CONTAINER_ID} className="h-full w-full" />
      </div>
      {!isYouTubeEmbed && (
        <iframe
          ref={iframeRef}
          title="Uppspelning"
          src={embedUrl}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
}
