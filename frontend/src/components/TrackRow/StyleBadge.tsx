import { useState } from 'react';
import { CheckIcon, EditIcon, SparklesIcon } from '@/icons';
import { useTheme } from '@/theme/useTheme';
import type { DanceStyleColor } from '@/styles/danceStyleColors';
import { StyleVotePanel } from './StyleVotePanel';

interface StyleBadgeProps {
  trackId: string;
  trackTitle: string;
  danceStyle: string | null | undefined;
  confidence: number;
  styleColor: DanceStyleColor;
}

export function StyleBadge({
  trackId,
  trackTitle,
  danceStyle,
  confidence,
  styleColor,
}: StyleBadgeProps) {
  const { theme } = useTheme();
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmedStyle, setConfirmedStyle] = useState<string | null>(null);
  const isDark = theme === 'dark';
  const shownStyle = confirmedStyle ?? danceStyle;
  const shownConfidence = confirmedStyle ? 1.0 : confidence;
  const hasValidStyle = typeof shownStyle === 'string' && shownStyle.length > 0;

  const isVerified = shownConfidence >= 1.0;
  const isAiHigh = hasValidStyle && shownConfidence >= 0.7 && !isVerified;

  const textColor = isDark ? styleColor.textDark : styleColor.text;
  const bgColor = isDark ? styleColor.bgDark : styleColor.bg;

  const badgeContent = hasValidStyle ? shownStyle : 'Okänd stil';
  const ariaLabel = hasValidStyle ? 'Ändra dansstil' : 'Ange dansstil';

  let pillStyle: React.CSSProperties;
  let pillClasses: string;

  if (!hasValidStyle) {
    pillStyle = {};
    pillClasses =
      'rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-pill-bg))] px-2 py-0.5 text-sm font-bold text-[rgb(var(--color-text-muted))]';
  } else if (isVerified || isAiHigh) {
    pillStyle = { backgroundColor: bgColor, color: textColor };
    pillClasses = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-bold';
  } else {
    // AI Low (<70%) - 1px dashed border, white background
    pillStyle = {
      borderColor: textColor,
      color: textColor,
    };
    pillClasses =
      'inline-flex items-center gap-1 rounded-full border border-dashed bg-[rgb(var(--color-bg-elevated))] px-2 py-0.5 text-sm font-bold';
  }

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setPanelOpen(true)}
        className="-my-3 inline-flex min-h-11 items-center bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-accent))]"
      >
        <span className={pillClasses} style={pillStyle}>
          {badgeContent}
          {isVerified && <CheckIcon className="h-3 w-3" aria-hidden />}
          {!isVerified && hasValidStyle && <SparklesIcon className="h-3 w-3" aria-hidden />}
          <EditIcon className="h-3 w-3" aria-hidden />
        </span>
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
