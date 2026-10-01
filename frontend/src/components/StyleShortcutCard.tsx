import { Link } from 'react-router-dom';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';

interface StyleShortcutCardProps {
  style: StyleOverviewDto;
}

export function StyleShortcutCard({ style }: StyleShortcutCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styleName = style.style ?? 'Övrigt';
  const count = style.trackCount ?? 0;
  const color = getStyleColor(styleName);
  const bg = isDark ? color.bgDark : color.bg;
  const text = isDark ? color.textDark : color.text;

  return (
    <Link
      to={`/search?style=${encodeURIComponent(styleName)}`}
      className="block rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))]/50 p-3 shadow-[var(--color-card-shadow)] transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] focus-visible:ring-offset-2"
      style={{ backgroundColor: bg, color: text }}
    >
      <h3 className="font-semibold">{styleName}</h3>
      <p className="mt-1 text-sm opacity-90">{count} låtar</p>
    </Link>
  );
}
