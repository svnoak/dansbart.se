import { StarMarkIcon } from '@/icons/StarMarkIcon';
import { getStyleColor } from '@/styles/danceStyleColors';
import { useTheme } from '@/theme/useTheme';

interface ArtworkPlaceholderProps {
  className?: string;
  aspect?: 'square' | 'wide';
  /** When given, the tile takes the dance style's colour pair. Without it the tile is neutral. */
  styleName?: string | null;
}

/**
 * The no-artwork tile: the eight-point star mark on a soft fill. Neutral by
 * default, in the style's colour pair when a style name is passed.
 */
export function ArtworkPlaceholder({ className = '', aspect = 'square', styleName }: ArtworkPlaceholderProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const color = styleName ? getStyleColor(styleName) : null;
  const inlineStyle = color
    ? { backgroundColor: isDark ? color.bgDark : color.bg, color: isDark ? color.textDark : color.text }
    : undefined;

  return (
    <div
      className={`flex items-center justify-center rounded-[var(--radius)] ${
        color ? '' : 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))]'
      } ${aspect === 'square' ? 'aspect-square' : 'aspect-video'} ${className}`}
      style={inlineStyle}
      aria-hidden
    >
      <StarMarkIcon className="h-[40%] w-[40%]" />
    </div>
  );
}
