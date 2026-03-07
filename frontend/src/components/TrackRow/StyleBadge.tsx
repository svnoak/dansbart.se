import { CheckIcon, SparklesIcon } from '@/icons';
import { useTheme } from '@/theme/useTheme';
import type { DanceStyleColor } from '@/styles/danceStyleColors';

interface StyleBadgeProps {
  danceStyle: string | null | undefined;
  confidence: number;
  styleColor: DanceStyleColor;
  onApplyStyleFilter?: (style: string) => void;
}

export function StyleBadge({
  danceStyle,
  confidence,
  styleColor,
  onApplyStyleFilter,
}: StyleBadgeProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const hasValidStyle = typeof danceStyle === 'string' && danceStyle.length > 0;

  const isVerified = confidence >= 1.0;
  const isAiHigh = hasValidStyle && confidence >= 0.7 && !isVerified;

  const textColor = isDark ? styleColor.textDark : styleColor.text;
  const bgColor = isDark ? styleColor.bgDark : styleColor.bg;

  const handleClick = () => {
    if (onApplyStyleFilter && hasValidStyle) {
      onApplyStyleFilter(danceStyle!);
    }
  };

  const badgeContent = hasValidStyle ? danceStyle : 'Okänd stil';

  let badgeStyle: React.CSSProperties;
  let badgeClasses: string;

  if (!hasValidStyle) {
    badgeStyle = {};
    badgeClasses =
      'rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-pill-bg))] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))]';
  } else if (isVerified || isAiHigh) {
    badgeStyle = { backgroundColor: bgColor, color: textColor };
    badgeClasses =
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80';
  } else {
    // AI Low (<70%) - 1px dashed border, white background
    badgeStyle = {
      borderColor: textColor,
      color: textColor,
    };
    badgeClasses =
      'inline-flex items-center gap-1 rounded-full border border-dashed bg-[rgb(var(--color-bg-elevated))] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80';
  }

  const isClickable = !!onApplyStyleFilter && hasValidStyle;
  const Tag = isClickable ? 'button' : 'span';

  return (
    <Tag
      {...(isClickable ? { type: 'button' as const, onClick: handleClick, title: 'Filtrera på stil' } : {})}
      className={badgeClasses + (isClickable ? ' cursor-pointer' : ' cursor-default')}
      style={badgeStyle}
    >
      {badgeContent}
      {isVerified && <CheckIcon className="h-3 w-3" aria-hidden />}
      {!isVerified && hasValidStyle && <SparklesIcon className="h-3 w-3" aria-hidden />}
    </Tag>
  );
}
