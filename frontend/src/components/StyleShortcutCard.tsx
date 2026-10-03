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
      className="block rounded-[var(--radius-lg)] border p-3 shadow-[var(--color-card-shadow)] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] focus-visible:ring-offset-2"
      style={{ backgroundColor: bg, color: text, borderColor: `color-mix(in srgb, ${text} 35%, transparent)` }}
    >
      <h3 className="font-display text-lg font-semibold leading-tight">{styleName}</h3>
      <p className="mt-1 text-sm opacity-90">{count} låtar</p>
    </Link>
  );
}
