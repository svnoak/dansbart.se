import { useNavigate } from 'react-router-dom';
import { Card } from '@/ui';
import type { StyleOverviewDto } from '@/api/models/styleOverviewDto';

interface StyleShortcutCardProps {
  style: StyleOverviewDto;
}

const COLOR_PALETTE = [
  'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200',
];

function hashStyleName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h);
}

function getStyleBg(styleName: string): string {
  return COLOR_PALETTE[hashStyleName(styleName) % COLOR_PALETTE.length];
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
