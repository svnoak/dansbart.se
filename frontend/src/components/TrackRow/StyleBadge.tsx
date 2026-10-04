import { useState } from 'react';
import type { DanceStyleColor } from '@/styles/danceStyleColors';
import { StylePill } from './StylePill';
import { stylePillState } from './stylePillState';
import { StyleVotePanel } from './StyleVotePanel';

interface StyleBadgeProps {
  trackId: string;
  trackTitle: string;
  danceStyle: string | null | undefined;
  confidence: number;
  /** Kept for callers that already resolve the colour; the pill resolves it itself. */
  styleColor?: DanceStyleColor;
}

/**
 * The style pill on a track row. The whole pill is the control that opens the
 * vote dialog, and its name says what pressing it does.
 */
export function StyleBadge({
  trackId,
  trackTitle,
  danceStyle,
  confidence,
}: StyleBadgeProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmedStyle, setConfirmedStyle] = useState<string | null>(null);
  const shownStyle = confirmedStyle ?? danceStyle;
  const shownConfidence = confirmedStyle ? 1.0 : confidence;
  const state = stylePillState(shownStyle, shownConfidence);

  const ariaLabel = state === 'unknown' ? 'Ange dansstil' : 'Ändra dansstil';

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setPanelOpen(true)}
        className="-my-2 inline-flex min-h-11 items-center rounded-[var(--radius-full)] bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
      >
        <StylePill style={shownStyle} state={state} />
      </button>
      <StyleVotePanel
        trackId={trackId}
        trackTitle={trackTitle}
        currentStyle={shownStyle}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onVoted={(style, confirmed) => {
          if (confirmed) setConfirmedStyle(style);
        }}
      />
    </>
  );
}
