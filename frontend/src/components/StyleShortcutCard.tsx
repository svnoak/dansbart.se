import { useNavigate } from 'react-router-dom';
import { Card } from '@/ui';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';

interface StyleShortcutCardProps {
  style: StyleOverviewDto;
}

const STYLE_COLORS: Record<string, string> = {
  Polska: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200',
  Schottis: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  Vals: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200',
  Brudmarsch: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200',
  Mazurka: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
};

function getStyleBg(styleName: string): string {
  return STYLE_COLORS[styleName] ?? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]';
}

export function StyleShortcutCard({ style }: StyleShortcutCardProps) {
  const navigate = useNavigate();
  const styleName = style.style ?? 'Övrigt';
  const count = style.trackCount ?? 0;

  const handleClick = () => {
    navigate(`/search?style=${encodeURIComponent(styleName)}`);
  };

  return (
    <Card
      className={`cursor-pointer p-4 transition-transform hover:scale-[1.02] ${getStyleBg(styleName)}`}
    >
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] focus-visible:ring-offset-2 rounded-[var(--radius)]"
      >
        <h3 className="font-semibold">{styleName}</h3>
        <p className="mt-1 text-sm opacity-90">{count} låtar</p>
      </button>
    </Card>
  );
}
