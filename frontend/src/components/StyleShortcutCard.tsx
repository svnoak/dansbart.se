import { useNavigate } from 'react-router-dom';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';

interface StyleShortcutCardProps {
  style: StyleOverviewDto;
}

export function StyleShortcutCard({ style }: StyleShortcutCardProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styleName = style.style ?? 'Övrigt';
  const count = style.trackCount ?? 0;
  const color = getStyleColor(styleName);
  const bg = isDark ? color.bgDark : color.bg;
  const text = isDark ? color.textDark : color.text;

  const handleClick = () => {
    navigate(`/search?style=${encodeURIComponent(styleName)}`);
  };

  return (
    <div
      className="cursor-pointer rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))]/50 p-3 shadow-[var(--color-card-shadow)] transition-transform hover:scale-[1.02]"
      style={{ backgroundColor: bg, color: text }}
    >
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] focus-visible:ring-offset-2 rounded-[var(--radius)]"
      >
        <h3 className="font-semibold">{styleName}</h3>
        <p className="mt-1 text-sm opacity-90">{count} låtar</p>
      </button>
    </div>
  );
}
