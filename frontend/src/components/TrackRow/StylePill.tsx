import type { CSSProperties } from 'react';
import { CheckIcon, PlusIcon } from '@/icons';
import { useTheme } from '@/theme/useTheme';
import { getStyleColor } from '@/styles/danceStyleColors';

import { type StylePillState } from './stylePillState';

interface StylePillProps {
  style: string | null | undefined;
  state: StylePillState;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The one way a dance style is shown on the site. Colour comes from the
 * style; the state comes from shape, never hue: filled with a check when the
 * community has confirmed it, a dashed outline with a question mark when it is
 * the analysis guess, a grey dashed outline with a plus when nobody knows yet.
 */
export function StylePill({ style, state, size = 'sm', className = '' }: StylePillProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const color = getStyleColor(state === 'unknown' ? null : style);
  const fg = isDark ? color.textDark : color.text;
  const bg = isDark ? color.bgDark : color.bg;

  const sizeClasses = size === 'md' ? 'h-8 px-3 text-sm' : 'h-7 px-2.5 text-[13px]';
  const base = `inline-flex items-center gap-1.5 rounded-[var(--radius-full)] font-semibold whitespace-nowrap ${sizeClasses} ${className}`;

  if (state === 'unknown') {
    return (
      <span
        className={`${base} border border-dashed border-[rgb(var(--color-border-strong))] text-[rgb(var(--color-text-muted))]`}
      >
        <PlusIcon className="h-3 w-3" aria-hidden />
        Ange stil
      </span>
    );
  }

  if (state === 'guess') {
    const guessStyle: CSSProperties = { borderColor: fg, color: fg };
    return (
      <span className={`${base} border border-dashed bg-transparent`} style={guessStyle}>
        {style}?
      </span>
    );
  }

  const confirmedStyle: CSSProperties = { backgroundColor: bg, color: fg };
  return (
    <span className={base} style={confirmedStyle}>
      {style}
      <CheckIcon className="h-3 w-3" aria-hidden />
    </span>
  );
}
