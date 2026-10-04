import { Link } from 'react-router-dom';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';

interface StyleShortcutCardProps {
  style: StyleOverviewDto;
}

function trackCountLabel(count: number) {
  return count === 1 ? '1 låt' : `${count.toLocaleString('sv-SE')} låtar`;
}

/**
 * One dance style as a coloured tile: the name top-left, the number of tracks
 * bottom-left. An entry without a style name is the "Okänd stil" tile, drawn
 * as a dashed outline on a white surface so it reads as a gap, not a style.
 */
export function StyleShortcutCard({ style }: StyleShortcutCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const count = style.trackCount ?? 0;
  const base =
    'flex min-h-[104px] flex-col justify-between rounded-[var(--radius-lg)] p-4 transition-[filter,background-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))] focus-visible:ring-offset-2';

  if (!style.style) {
    return (
      <Link
        to="/search"
        className={`${base} border border-dashed border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-accent-muted))]`}
      >
        <h3 className="text-lg font-bold leading-tight">Okänd stil</h3>
        <p className="text-[13px] text-[rgb(var(--color-text-muted))]">{trackCountLabel(count)}</p>
      </Link>
    );
  }

  const styleName = style.style;
  const color = getStyleColor(styleName);
  const bg = isDark ? color.bgDark : color.bg;
  const text = isDark ? color.textDark : color.text;

  return (
    <Link
      to={`/search?style=${encodeURIComponent(styleName)}`}
      className={`${base} hover:brightness-95`}
      style={{ backgroundColor: bg, color: text }}
    >
      <h3 className="text-lg font-bold leading-tight">{styleName}</h3>
      <p className="text-[13px] opacity-90">{trackCountLabel(count)}</p>
    </Link>
  );
}
